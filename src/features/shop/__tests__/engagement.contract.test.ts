import { describe, expect, test } from "bun:test"

import { toQuote, type WireQuote } from "../model/checkout"
import type { WireProductDetailBody } from "../model/catalogue"
import { deliveryView, formatDeliverBy, toDeliveryEstimate, type WireDeliveryEstimate } from "../model/delivery"
import { readProductReaction, toReactionState, toReviewVoteState, voteFailureMessage, type WireReactionResult, type WireReviewVoteResult } from "../model/reactions"
import { toReviewsPage, type WireReviewsPage } from "../model/reviews"
import { hasFixture, readBackendFixture, readFixture, readLocalFixtureText } from "./contractFixtures"

/*
  Engagement fixtures (shop-engagement contract, 1 Oct 2026), copied byte for
  byte from commerce-service internal/http/testdata/contracts/:
    storefront/delivery_estimate_200, delivery_estimate_200_not_serviceable,
               delivery_estimate_400_pincode_required,
               product_reaction_put_200_like, product_reaction_put_200_dislike,
               product_reaction_delete_200, product_share_post_204,
               product_get_200 (regenerated: like_count, viewer_reaction, share_count),
               product_reviews_200 (regenerated: helpful_count, viewer_vote)
    reviews/review_vote_put_200, review_vote_put_403_own
    checkout/quote_post_200 (regenerated: deliver_by, max_days)

  A fixture that is not on disk skips with its name; a regenerated one whose
  local copy predates the change skips its new-key check until it is copied.
  When the backend checkout is beside this one, every copy is compared to it.
*/

const only = (area: string, name: string) => (hasFixture(area, name) ? test : test.skip)

const sameAsBackend = (area: string, name: string) => {
  const theirs = readBackendFixture(area, name)
  if (theirs !== null) expect(readLocalFixtureText(area, name), `${area}/${name} differs from the backend copy`).toBe(theirs)
}

const has = (area: string, name: string, key: string) => hasFixture(area, name) && readLocalFixtureText(area, name).includes(`"${key}"`)

describe("delivery estimate fixtures", () => {
  only("storefront", "delivery_estimate_200")("delivery_estimate_200: a pincode and a date the block draws", () => {
    sameAsBackend("storefront", "delivery_estimate_200")
    const { data } = readFixture<WireDeliveryEstimate>("storefront", "delivery_estimate_200")
    const estimate = toDeliveryEstimate(data)
    expect(estimate.serviceable).toBe(true)
    expect(estimate.pincode).toMatch(/^[1-9]\d{5}$/)
    expect(data.deliver_by).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(estimate.deliverBy).toBe(formatDeliverBy(data.deliver_by))
    expect(estimate.deliverBy).not.toBe("")
    expect(deliveryView({ pincode: null, asked: true, isLoading: false, error: null, estimate }).kind).toBe("by")
  })

  only("storefront", "delivery_estimate_200_not_serviceable")("delivery_estimate_200_not_serviceable: no date, 'Not deliverable to …'", () => {
    sameAsBackend("storefront", "delivery_estimate_200_not_serviceable")
    const { data } = readFixture<WireDeliveryEstimate>("storefront", "delivery_estimate_200_not_serviceable")
    const estimate = toDeliveryEstimate(data)
    expect(estimate.serviceable).toBe(false)
    expect(estimate.deliverBy).toBe("")
    expect(deliveryView({ pincode: null, asked: true, isLoading: false, error: null, estimate }).kind).toBe("not_serviceable")
  })

  only("storefront", "delivery_estimate_400_pincode_required")("delivery_estimate_400_pincode_required: the block asks for a pincode", () => {
    sameAsBackend("storefront", "delivery_estimate_400_pincode_required")
    const body = readFixture("storefront", "delivery_estimate_400_pincode_required")
    expect(body.error?.code).toBe("PINCODE_REQUIRED")
    const error = { response: { status: 400, data: body } }
    expect(deliveryView({ pincode: null, asked: true, isLoading: false, error, estimate: null })).toEqual({ kind: "ask" })
  })

  const quoteHasDate = has("checkout", "quote_post_200", "deliver_by")
  ;(quoteHasDate ? test : test.skip)("quote_post_200 (regenerated): deliver_by reaches 'Arrives by'", () => {
    sameAsBackend("checkout", "quote_post_200")
    const { data } = readFixture<WireQuote>("checkout", "quote_post_200")
    expect(formatDeliverBy(toQuote(data).deliverBy)).not.toBe("")
  })
})

describe("reaction fixtures", () => {
  for (const [name, kind] of [["product_reaction_put_200_like", "like"], ["product_reaction_put_200_dislike", "dislike"], ["product_reaction_delete_200", null]] as const) {
    only("storefront", name)(`${name}: viewer_reaction ${kind}, a like count, never a dislike count`, () => {
      sameAsBackend("storefront", name)
      const text = readLocalFixtureText("storefront", name)
      expect(text).not.toContain("dislike_count")
      const { data } = readFixture<WireReactionResult>("storefront", name)
      const state = toReactionState(data)
      expect(state.viewerReaction).toBe(kind)
      expect(Number.isInteger(state.likeCount)).toBe(true)
    })
  }

  only("storefront", "product_share_post_204")("product_share_post_204: empty, as the other 204s", () => {
    sameAsBackend("storefront", "product_share_post_204")
    expect(readLocalFixtureText("storefront", "product_share_post_204").trim()).toBe("")
  })

  ;(has("storefront", "product_get_200", "like_count") ? test : test.skip)("product_get_200 (regenerated): like_count read, no dislike count anywhere", () => {
    sameAsBackend("storefront", "product_get_200")
    const text = readLocalFixtureText("storefront", "product_get_200")
    expect(text).not.toContain("dislike_count")
    const { data } = readFixture<WireProductDetailBody>("storefront", "product_get_200")
    const raw = JSON.parse(text) as { data: { product?: { like_count?: number }; like_count?: number } }
    expect(readProductReaction(data as never).likeCount).toBe(raw.data.product?.like_count ?? raw.data.like_count ?? 0)
  })

  ;(has("storefront", "products_list_200", "like_count") ? test : test.skip)("products_list_200 (regenerated): summaries carry like_count, never a dislike count", () => {
    expect(readLocalFixtureText("storefront", "products_list_200")).not.toContain("dislike_count")
  })
})

describe("review vote fixtures", () => {
  only("reviews", "review_vote_put_200")("review_vote_put_200: viewer_vote and the helpful count", () => {
    sameAsBackend("reviews", "review_vote_put_200")
    const { data } = readFixture<WireReviewVoteResult>("reviews", "review_vote_put_200")
    const state = toReviewVoteState(data)
    expect(["helpful", "not_helpful"]).toContain(state.viewerVote as string)
    expect(Number.isInteger(state.helpfulCount)).toBe(true)
    expect(readLocalFixtureText("reviews", "review_vote_put_200")).not.toContain("not_helpful_count")
  })

  only("reviews", "review_vote_put_403_own")("review_vote_put_403_own: CANNOT_VOTE_OWN_REVIEW is said plainly", () => {
    sameAsBackend("reviews", "review_vote_put_403_own")
    const body = readFixture("reviews", "review_vote_put_403_own")
    expect(body.error?.code).toBe("CANNOT_VOTE_OWN_REVIEW")
    expect(voteFailureMessage({ response: { status: 403, data: body } })).toBe("You can't vote on your own review.")
  })

  ;(has("storefront", "product_reviews_200", "helpful_count") ? test : test.skip)("product_reviews_200 (regenerated): rows carry helpful_count and an author", () => {
    sameAsBackend("storefront", "product_reviews_200")
    const { data } = readFixture<WireReviewsPage>("storefront", "product_reviews_200")
    const page = toReviewsPage(data)
    expect(page.reviews.length).toBeGreaterThan(0)
    for (const review of page.reviews) {
      expect(Number.isInteger(review.helpfulCount)).toBe(true)
      expect(review.reviewerId).not.toBe("")
    }
  })
})

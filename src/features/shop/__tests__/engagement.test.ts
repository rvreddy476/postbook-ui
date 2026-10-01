import { afterEach, describe, expect, it } from "bun:test"
import api from "@/lib/api"
import { fetchDeliveryEstimate } from "../api/delivery"
import { sendProductReaction, sendReviewVote } from "../api/reactions"
import { fetchProductReviews } from "../api/reviews"
import { recordShare } from "../api/share"
import { toQuote, type WireQuote } from "../model/checkout"
import {
  arrivesByLine,
  deliveryHeadline,
  deliveryView,
  formatDeliverBy,
  isValidPincode,
  normalisePincode,
  PINCODE_STORAGE_KEY,
  readStoredPincode,
  shouldAskEstimate,
  toDeliveryEstimate,
  writeStoredPincode,
  type PincodeStore,
} from "../model/delivery"
import {
  canShowReviewVotes,
  compactCount,
  dislikeLabel,
  helpfulLabel,
  likeLabel,
  pressReaction,
  pressReviewVote,
  readProductReaction,
  REVIEW_SORTS,
  reviewSortParam,
  toReactionState,
  voteFailureMessage,
  type ReactionState,
} from "../model/reactions"
import { toReview, withReviewVote } from "../model/reviews"
import {
  canShareNatively,
  isShareCancelled,
  productShareUrl,
  SHARE_TARGETS,
  sharePayload,
  shareText,
  whatsappHref,
} from "../model/share"
import { isAlphabetical } from "../model/storefront"

/*
  Delivery date, share, like / dislike, review votes (shop-engagement
  contract, 1 Oct 2026): the pure rules, and the exact requests the four
  api files put on the wire.
*/

// ── deliver_by ─────────────────────────────────────────────────────────

describe("formatDeliverBy", () => {
  it("draws a calendar date as that day (4 Oct 2026 is a Sunday)", () => {
    expect(formatDeliverBy("2026-10-03")).toBe("Sat, 3 Oct")
    expect(formatDeliverBy("2026-10-04")).toBe("Sun, 4 Oct")
    expect(formatDeliverBy("2026-12-31")).toBe("Thu, 31 Dec")
    expect(formatDeliverBy("2027-01-01")).toBe("Fri, 1 Jan")
  })

  it("converts a timestamp to India's day across the IST midnight (18:30Z)", () => {
    expect(formatDeliverBy("2026-10-03T18:29:59Z")).toBe("Sat, 3 Oct")
    expect(formatDeliverBy("2026-10-03T18:30:00Z")).toBe("Sun, 4 Oct")
    expect(formatDeliverBy("2026-10-03T23:59:00+05:30")).toBe("Sat, 3 Oct")
    expect(formatDeliverBy("2026-10-04T00:00:00+05:30")).toBe("Sun, 4 Oct")
  })

  it("a date-only value is never shifted by the reader's own zone (UTC midnight is still that day)", () => {
    // Read naively, "2026-10-04" is UTC midnight: the day before in the Americas.
    const naive = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", day: "numeric" }).format(new Date("2026-10-04"))
    expect(naive).toBe("3")
    expect(formatDeliverBy("2026-10-04")).toBe("Sun, 4 Oct")
  })

  it("answers '' for nothing and for an impossible date", () => {
    expect(formatDeliverBy("")).toBe("")
    expect(formatDeliverBy(null)).toBe("")
    expect(formatDeliverBy("2026-02-31")).toBe("")
    expect(formatDeliverBy("soon")).toBe("")
  })

  it("arrivesByLine is the checkout sentence, or null", () => {
    expect(arrivesByLine("2026-10-04")).toBe("Arrives by Sun, 4 Oct")
    expect(arrivesByLine("")).toBeNull()
    expect(arrivesByLine(undefined)).toBeNull()
  })

  it("the quote carries deliver_by through, '' when absent", () => {
    const wire: WireQuote = {
      quote_id: "q", subtotal_minor: 100, discount_minor: 0, shipping_minor: 0, tax_minor: 0, total_minor: 100,
      currency: "INR", expires_at: "2026-10-01T10:00:00Z", serviceable: true,
    }
    expect(toQuote(wire).deliverBy).toBe("")
    expect(toQuote({ ...wire, deliver_by: "2026-10-04", max_days: 4 }).deliverBy).toBe("2026-10-04")
  })
})

// ── pincode ────────────────────────────────────────────────────────────

const memoryStore = (seed: Record<string, string> = {}): PincodeStore & { data: Map<string, string> } => {
  const data = new Map(Object.entries(seed))
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

const throwingStore: PincodeStore = {
  getItem: () => { throw new Error("SecurityError") },
  setItem: () => { throw new Error("QuotaExceededError") },
  removeItem: () => { throw new Error("SecurityError") },
}

describe("pincode", () => {
  it("is six digits, not starting with 0; spaces and hyphens a person types are dropped", () => {
    for (const ok of ["500081", " 500 081 ", "500-081", "110001"]) expect(isValidPincode(ok)).toBe(true)
    for (const bad of ["", "50008", "5000811", "050081", "abcdef", "5OOO81", "500.81"]) expect(isValidPincode(bad)).toBe(false)
    expect(normalisePincode(" 500 081 ")).toBe("500081")
  })

  it("is remembered under shop.pincode, and only a valid one is written", () => {
    expect(PINCODE_STORAGE_KEY).toBe("shop.pincode")
    const store = memoryStore()
    expect(writeStoredPincode(store, "12")).toBe(false)
    expect(store.data.size).toBe(0)
    expect(writeStoredPincode(store, "500 081")).toBe(true)
    expect(store.data.get("shop.pincode")).toBe("500081")
    expect(readStoredPincode(store)).toBe("500081")
  })

  it("a stored value that is not a pincode is ignored", () => {
    expect(readStoredPincode(memoryStore({ "shop.pincode": "<script>" }))).toBeNull()
    expect(readStoredPincode(memoryStore({ "shop.pincode": "050081" }))).toBeNull()
    expect(readStoredPincode(memoryStore())).toBeNull()
    expect(readStoredPincode(null)).toBeNull()
  })

  it("storage that throws (private mode, blocked site data) never breaks the page", () => {
    expect(readStoredPincode(throwingStore)).toBeNull()
    expect(writeStoredPincode(throwingStore, "500081")).toBe(false)
  })
})

// ── the estimate and its block ─────────────────────────────────────────

const err = (status: number, code: string) => ({ response: { status, data: { error: { code, message: "x" } } } })

describe("delivery estimate", () => {
  it("asks with a pincode; without one only for a signed-in shopper (the default address answers)", () => {
    expect(shouldAskEstimate({ pincode: "500081", signedIn: false, known: true })).toBe(true)
    expect(shouldAskEstimate({ pincode: null, signedIn: true, known: true })).toBe(true)
    expect(shouldAskEstimate({ pincode: null, signedIn: false, known: true })).toBe(false)
    expect(shouldAskEstimate({ pincode: null, signedIn: true, known: false })).toBe(false)
    expect(shouldAskEstimate({ pincode: "123", signedIn: true, known: true })).toBe(false)
  })

  it("maps the wire; not serviceable has no date even if one were sent", () => {
    const by = toDeliveryEstimate({ pincode: "500081", serviceable: true, deliver_by: "2026-10-04", min_days: 3, max_days: 4, pincode_source: "default_address" })
    expect(by).toEqual({ pincode: "500081", serviceable: true, deliverBy: "Sun, 4 Oct", deliverByIso: "2026-10-04", maxDays: 4, fromDefaultAddress: true })
    const no = toDeliveryEstimate({ pincode: "500081", serviceable: false, deliver_by: "2026-10-04" })
    expect(no.serviceable).toBe(false)
    expect(no.deliverBy).toBe("")
  })

  it("the block says 'Delivery by Sun, 4 Oct' / 'Not deliverable to 500081'", () => {
    const base = { pincode: "500081", asked: true, isLoading: false, error: null }
    const by = deliveryView({ ...base, estimate: toDeliveryEstimate({ pincode: "500081", serviceable: true, deliver_by: "2026-10-04" }) })
    expect(by).toEqual({ kind: "by", pincode: "500081", date: "Sun, 4 Oct", iso: "2026-10-04" })
    expect(deliveryHeadline(by)).toBe("Delivery by Sun, 4 Oct")
    const no = deliveryView({ ...base, estimate: toDeliveryEstimate({ pincode: "500081", serviceable: false }) })
    expect(deliveryHeadline(no)).toBe("Not deliverable to 500081")
  })

  it("the default address's pincode is the one shown when none was typed", () => {
    const view = deliveryView({ pincode: null, asked: true, isLoading: false, error: null, estimate: toDeliveryEstimate({ pincode: "560001", serviceable: true, deliver_by: "2026-10-05" }) })
    expect(view).toEqual({ kind: "by", pincode: "560001", date: "Mon, 5 Oct", iso: "2026-10-05" })
  })

  it("errors branch on the code: PINCODE_REQUIRED asks, INVALID_PINCODE says so, anything else is unavailable", () => {
    const base = { pincode: "500081", asked: true, isLoading: false, estimate: null }
    expect(deliveryView({ ...base, pincode: null, error: err(400, "PINCODE_REQUIRED") })).toEqual({ kind: "ask" })
    expect(deliveryHeadline(deliveryView({ ...base, error: err(400, "INVALID_PINCODE") }))).toBe("500081 is not a valid pincode")
    expect(deliveryView({ ...base, error: err(503, "COURIER_UNAVAILABLE") }).kind).toBe("unavailable")
    expect(deliveryView({ ...base, asked: false, error: null })).toEqual({ kind: "ask" })
    expect(deliveryView({ ...base, isLoading: true, error: null }).kind).toBe("loading")
  })
})

// ── share ──────────────────────────────────────────────────────────────

describe("share", () => {
  it("the fallback menu is Copy link, then WhatsApp (alphabetical)", () => {
    expect(SHARE_TARGETS.map((t) => t.label)).toEqual(["Copy link", "WhatsApp"])
    expect(SHARE_TARGETS.map((t) => t.channel)).toEqual(["copy_link", "whatsapp"])
    expect(isAlphabetical(SHARE_TARGETS)).toBe(true)
  })

  it("shares the clean product URL, the title and the price", () => {
    expect(productShareUrl("https://cleestudio.com/", "p 1")).toBe("https://cleestudio.com/shop/products/p%201")
    expect(shareText("Earbuds", 28900)).toBe("Earbuds · ₹289 on MStore")
    expect(shareText("  ", null)).toBe("This product on MStore")
    expect(sharePayload({ origin: "https://cleestudio.com", productId: "p1", title: "Earbuds", priceMinor: 28900 })).toEqual({
      title: "Earbuds",
      text: "Earbuds · ₹289 on MStore",
      url: "https://cleestudio.com/shop/products/p1",
    })
  })

  it("WhatsApp is wa.me/?text= with the text and the link, encoded once", () => {
    const href = whatsappHref({ text: "Earbuds · ₹289 on MStore", url: "https://cleestudio.com/shop/products/p1?x=1&y=2" })
    expect(href.startsWith("https://wa.me/?text=")).toBe(true)
    expect(decodeURIComponent(href.slice("https://wa.me/?text=".length))).toBe("Earbuds · ₹289 on MStore https://cleestudio.com/shop/products/p1?x=1&y=2")
    expect(href).not.toContain("&y=")
  })

  it("the share sheet is used only when the browser has one; closing it is not a failure", () => {
    expect(canShareNatively({ share: async () => undefined })).toBe(true)
    expect(canShareNatively({})).toBe(false)
    expect(canShareNatively(null)).toBe(false)
    expect(isShareCancelled({ name: "AbortError" })).toBe(true)
    expect(isShareCancelled({ name: "NotAllowedError" })).toBe(false)
  })
})

// ── like / dislike ─────────────────────────────────────────────────────

describe("product reaction state machine", () => {
  const s = (viewerReaction: ReactionState["viewerReaction"], likeCount: number): ReactionState => ({ viewerReaction, likeCount })

  it("none → like → dislike → none, the count moving only on like", () => {
    const a = pressReaction(s(null, 10), "like")
    expect(a.next).toEqual(s("like", 11))
    expect(a.request).toEqual({ method: "PUT", kind: "like" })
    const b = pressReaction(a.next, "dislike")
    expect(b.next).toEqual(s("dislike", 10))
    expect(b.request).toEqual({ method: "PUT", kind: "dislike" })
    const c = pressReaction(b.next, "dislike")
    expect(c.next).toEqual(s(null, 10))
    expect(c.request).toEqual({ method: "DELETE" })
  })

  it("the other edges", () => {
    expect(pressReaction(s("like", 5), "like")).toEqual({ next: s(null, 4), request: { method: "DELETE" } })
    expect(pressReaction(s(null, 5), "dislike")).toEqual({ next: s("dislike", 5), request: { method: "PUT", kind: "dislike" } })
    expect(pressReaction(s("dislike", 5), "like")).toEqual({ next: s("like", 6), request: { method: "PUT", kind: "like" } })
  })

  it("the count never goes below zero", () => {
    expect(pressReaction(s("like", 0), "like").next.likeCount).toBe(0)
  })

  it("reads the detail body's product (or the body) and never a dislike count", () => {
    expect(readProductReaction({ product: { like_count: 12, viewer_reaction: "dislike" } })).toEqual(s("dislike", 12))
    expect(readProductReaction({ product: {}, like_count: 3, viewer_reaction: "like" })).toEqual(s("like", 3))
    expect(readProductReaction({ product: { viewer_reaction: "love" as never } })).toEqual(s(null, 0))
    const withDislikes = readProductReaction({ product: { like_count: 2, dislike_count: 99 } as never })
    expect(Object.values(withDislikes)).not.toContain(99)
    expect(toReactionState({ viewer_reaction: null, like_count: 7 })).toEqual(s(null, 7))
  })

  it("labels: the like carries its count, the dislike never does", () => {
    expect(likeLabel(s(null, 1))).toBe("Like this product, 1 like")
    expect(likeLabel(s("like", 12))).toBe("Remove your like, 12 likes")
    expect(dislikeLabel(s("dislike", 12))).toBe("Remove your dislike")
    expect(dislikeLabel(s(null, 12))).not.toMatch(/\d/)
    expect(compactCount(999)).toBe("999")
    expect(compactCount(-3)).toBe("0")
  })

  it("a refusal says what happened, by code", () => {
    expect(voteFailureMessage(err(403, "CANNOT_VOTE_OWN_REVIEW"))).toBe("You can't vote on your own review.")
    expect(voteFailureMessage(err(429, "RATE_LIMITED"))).toBe("Too many taps. Try again in a moment.")
    expect(voteFailureMessage(new Error("boom"))).toBe("That did not save. Try again.")
  })
})

// ── review votes ───────────────────────────────────────────────────────

describe("review votes", () => {
  it("helpful is public and counted; not helpful is not", () => {
    expect(pressReviewVote({ viewerVote: null, helpfulCount: 2 }, "helpful")).toEqual({ next: { viewerVote: "helpful", helpfulCount: 3 }, request: { method: "PUT", kind: "helpful" } })
    expect(pressReviewVote({ viewerVote: "helpful", helpfulCount: 3 }, "not_helpful")).toEqual({ next: { viewerVote: "not_helpful", helpfulCount: 2 }, request: { method: "PUT", kind: "not_helpful" } })
    expect(pressReviewVote({ viewerVote: "not_helpful", helpfulCount: 2 }, "not_helpful")).toEqual({ next: { viewerVote: null, helpfulCount: 2 }, request: { method: "DELETE" } })
    expect(pressReviewVote({ viewerVote: "helpful", helpfulCount: 3 }, "helpful")).toEqual({ next: { viewerVote: null, helpfulCount: 2 }, request: { method: "DELETE" } })
  })

  it("never on the viewer's own review; held back until the session is known; shown signed out", () => {
    expect(canShowReviewVotes({ reviewerId: "u1", viewerId: "u1", known: true })).toBe(false)
    expect(canShowReviewVotes({ reviewerId: "u1", viewerId: "u2", known: true })).toBe(true)
    expect(canShowReviewVotes({ reviewerId: "u1", viewerId: null, known: true })).toBe(true)
    expect(canShowReviewVotes({ reviewerId: "u1", viewerId: "u2", known: false })).toBe(false)
  })

  it("'Helpful (n)' only once someone has said so", () => {
    expect(helpfulLabel(0)).toBe("Helpful")
    expect(helpfulLabel(3)).toBe("Helpful (3)")
  })

  it("a review carries its author, helpful count and the viewer's vote", () => {
    const r = toReview({ id: "r1", rating: 4, reviewer_id: "u9", helpful_count: 5, viewer_vote: "not_helpful" })!
    expect([r.reviewerId, r.helpfulCount, r.viewerVote]).toEqual(["u9", 5, "not_helpful"])
    const bare = toReview({ id: "r2", rating: 4, viewer_vote: "meh" as never })!
    expect([bare.reviewerId, bare.helpfulCount, bare.viewerVote]).toEqual(["", 0, null])
  })

  it("withReviewVote replaces one review's vote and leaves a page without it untouched", () => {
    const page = { reviews: [toReview({ id: "r1", rating: 5 })!, toReview({ id: "r2", rating: 3 })!], total: 2, average: 4 }
    const next = withReviewVote(page, "r2", { viewerVote: "helpful", helpfulCount: 1 })!
    expect(next.reviews[1].viewerVote).toBe("helpful")
    expect(next.reviews[0]).toBe(page.reviews[0])
    expect(withReviewVote(page, "nope", { viewerVote: "helpful", helpfulCount: 1 })).toBe(page)
  })

  it("sort: Most helpful, Most recent (alphabetical); unknown is the server's default", () => {
    expect(REVIEW_SORTS.map((o) => o.label)).toEqual(["Most helpful", "Most recent"])
    expect(isAlphabetical(REVIEW_SORTS)).toBe(true)
    expect(reviewSortParam("recent")).toBe("recent")
    expect(reviewSortParam("helpful")).toBe("helpful")
    expect(reviewSortParam("rating")).toBe("helpful")
    expect(reviewSortParam(undefined)).toBe("helpful")
  })
})

// ── the wire: what each api call sends ─────────────────────────────────

type Call = { method: string; url: string; body?: unknown; config?: { params?: unknown } }

describe("requests on the wire", () => {
  const original = { get: api.get, put: api.put, post: api.post, delete: api.delete }
  const calls: Call[] = []
  const respond = (data: unknown) => Promise.resolve({ data: { data } })
  const install = (data: unknown = {}) => {
    calls.length = 0
    api.get = ((url: string, config?: Call["config"]) => (calls.push({ method: "GET", url, config }), respond(data))) as never
    api.put = ((url: string, body?: unknown) => (calls.push({ method: "PUT", url, body }), respond(data))) as never
    api.post = ((url: string, body?: unknown) => (calls.push({ method: "POST", url, body }), respond(data))) as never
    api.delete = ((url: string) => (calls.push({ method: "DELETE", url }), respond(data))) as never
  }
  afterEach(() => Object.assign(api, original))

  it("GET /products/:id/delivery-estimate with ?pincode, or with none for the default address", async () => {
    install({ pincode: "500081", serviceable: true, deliver_by: "2026-10-04" })
    const out = await fetchDeliveryEstimate("p1", "500081")
    expect(calls[0]).toEqual({ method: "GET", url: "/v1/commerce/products/p1/delivery-estimate", config: { params: { pincode: "500081" } } })
    expect(out.deliverBy).toBe("Sun, 4 Oct")
    await fetchDeliveryEstimate("p1", null)
    expect(calls[1].config?.params).toBeUndefined()
  })

  it("PUT /products/:id/reaction {kind}; DELETE for none", async () => {
    install({ viewer_reaction: "like", like_count: 4 })
    expect(await sendProductReaction("p1", { method: "PUT", kind: "like" })).toEqual({ viewerReaction: "like", likeCount: 4 })
    await sendProductReaction("p1", { method: "DELETE" })
    expect(calls).toEqual([
      { method: "PUT", url: "/v1/commerce/products/p1/reaction", body: { kind: "like" } },
      { method: "DELETE", url: "/v1/commerce/products/p1/reaction" },
    ])
  })

  it("PUT /reviews/:id/vote {vote}; DELETE for none", async () => {
    install({ viewer_vote: "not_helpful", helpful_count: 2 })
    expect(await sendReviewVote("r1", { method: "PUT", kind: "not_helpful" })).toEqual({ viewerVote: "not_helpful", helpfulCount: 2 })
    await sendReviewVote("r1", { method: "DELETE" })
    expect(calls).toEqual([
      { method: "PUT", url: "/v1/commerce/reviews/r1/vote", body: { vote: "not_helpful" } },
      { method: "DELETE", url: "/v1/commerce/reviews/r1/vote" },
    ])
  })

  it("POST /products/:id/share {channel}, and a failure is swallowed", async () => {
    install()
    recordShare("p1", "whatsapp")
    expect(calls).toEqual([{ method: "POST", url: "/v1/commerce/products/p1/share", body: { channel: "whatsapp" } }])
    api.post = (() => Promise.reject(new Error("offline"))) as never
    await expect(recordShare("p1", "copy_link")).resolves.toBeUndefined()
  })

  it("GET /products/:id/reviews sends sort", async () => {
    install({ reviews: [], total: 0 })
    await fetchProductReviews("p1", { sort: "recent" })
    await fetchProductReviews("p1")
    expect(calls.map((c) => c.config?.params)).toEqual([
      { limit: 20, offset: 0, sort: "recent" },
      { limit: 20, offset: 0, sort: "helpful" },
    ])
  })
})

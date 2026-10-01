import { afterEach, describe, expect, it } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MutationObserver, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { generateMetadata } from "@/app/shop/products/[id]/page"
import { QuoteBreakdown } from "../components/checkout/CheckoutParts"
import { DeliveryBlock } from "../components/catalogue/DeliveryBlock"
import { ReactionButtons } from "../components/catalogue/ReactionButtons"
import { ReviewList } from "../components/reviews/ReviewList"
import { ProductCard } from "../components/storefront/ProductGrid"
import { CATALOGUE_KEYS } from "../hooks/catalogue"
import { productReactionOptions, reviewVoteOptions, type DetailWithReaction } from "../hooks/reactions"
import { REVIEWS_SORTED_KEY } from "../hooks/reviews"
import { toQuote } from "../model/checkout"
import { deliveryView, toDeliveryEstimate } from "../model/delivery"
import { absoluteUrl, lowestPriceMinor, PRODUCT_FALLBACK_METADATA, productMetadata } from "../model/productMeta"
import { readProductReaction, type ReactionState } from "../model/reactions"
import { toReviewsPage, type ReviewsPage } from "../model/reviews"
import { signInHref, toProductCard } from "../model/storefront"
import { readFixture } from "./contractFixtures"
import type { WireProductDetailBody } from "../model/catalogue"

/*
  The engagement rules that live in markup or in the caches: a dislike
  count is never drawn, the vote buttons are not on the viewer's own
  review, a refused press is put back, and the link preview is built only
  for a product the server would show a stranger.
*/

const withClient = (node: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToStaticMarkup(<QueryClientProvider client={qc}>{node}</QueryClientProvider>)
}

/** The one <button> or <a> whose markup contains `marker`, from its start tag to its close. */
const buttonWith = (html: string, marker: string): string => {
  const at = html.indexOf(marker)
  expect(at, `no ${marker} in markup`).toBeGreaterThan(-1)
  const open = Math.max(html.lastIndexOf("<button", at), html.lastIndexOf("<a ", at))
  const closeTag = html.startsWith("<button", open) ? "</button>" : "</a>"
  return html.slice(open, html.indexOf(closeTag, at) + closeTag.length)
}

/** What a person sees or hears of an element: its text and its aria-label, never its href. */
const spoken = (el: string): string => `${el.replace(/<[^>]*>/g, "")} ${[...el.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]).join(" ")}`

// ── no dislike count, anywhere ─────────────────────────────────────────

describe("a dislike count is never drawn", () => {
  const state: ReactionState = { viewerReaction: "dislike", likeCount: 7 }

  it("signed in: the like shows its count, the dislike shows none and is pressed", () => {
    const html = renderToStaticMarkup(<ReactionButtons state={state} signInUrl={null} onPress={() => undefined} />)
    const like = buttonWith(html, 'aria-label="Like this product, 7 likes"')
    const dislike = buttonWith(html, 'aria-label="Remove your dislike"')
    expect(like).toContain(">7<")
    expect(like).toContain('aria-pressed="false"')
    expect(dislike).toContain('aria-pressed="true"')
    expect(spoken(dislike)).not.toMatch(/\d/)
    expect(html.match(/>7</g)?.length).toBe(1)
  })

  it("signed out: both are sign-in links with a way back, the dislike still without a count", () => {
    const url = signInHref("/shop/products/p1")
    const html = renderToStaticMarkup(<ReactionButtons state={{ viewerReaction: null, likeCount: 3 }} signInUrl={url} onPress={() => undefined} />)
    expect(html).not.toContain("<button")
    expect(html.match(/href="\/login\?next=%2Fshop%2Fproducts%2Fp1/g)?.length).toBe(2)
    const dislike = buttonWith(html, 'aria-label="Sign in to dislike this product"')
    expect(spoken(dislike)).not.toMatch(/\d/)
  })

  it("a dislike_count the server should never send is never read, on the page or on a card", () => {
    const reaction = readProductReaction({ product: { like_count: 2, dislike_count: 99 } as never })
    const page = renderToStaticMarkup(<ReactionButtons state={reaction} signInUrl={null} onPress={() => undefined} />)
    // Visible text only: icon path data can contain "99" (e.g. "1.99").
    expect(visibleText(page)).not.toContain("99")
    const card = toProductCard({ id: "p1", title: "Earbuds", min_price_minor: 28900, like_count: 2, dislike_count: 99 } as never)!
    expect(visibleText(withClient(<ProductCard product={card} />))).not.toContain("99")
  })

  it("grid cards show the like count small, and only when it is not zero", () => {
    const none = toProductCard({ id: "p1", title: "Earbuds", min_price_minor: 28900 })!
    expect(withClient(<ProductCard product={none} />)).not.toContain("shop-card__likes")
    const ratedNoLikes = toProductCard({ id: "p1", title: "Earbuds", min_price_minor: 28900, avg_rating: 4.2, review_count: 3 })!
    const rated = withClient(<ProductCard product={ratedNoLikes} />)
    expect(rated).toContain("4.2")
    expect(rated).not.toContain("shop-card__likes")
    const some = toProductCard({ id: "p1", title: "Earbuds", min_price_minor: 28900, like_count: 12 })!
    const html = withClient(<ProductCard product={some} />)
    expect(html).toContain('class="shop-card__likes" aria-label="12 likes"')
  })
})

// ── reviews ────────────────────────────────────────────────────────────

describe("review votes in markup", () => {
  const page = toReviewsPage({
    reviews: [
      { id: "mine", rating: 5, reviewer_id: "me", helpful_count: 4, created_at: "2026-09-15T10:00:00Z" },
      { id: "theirs", rating: 4, reviewer_id: "them", helpful_count: 3, viewer_vote: "helpful", created_at: "2026-09-14T10:00:00Z" },
    ],
    total: 2,
  })
  const render = (viewerId: string | null, known = true) =>
    renderToStaticMarkup(
      <ReviewList
        reviews={page.reviews}
        total={2}
        average={4.5}
        sort="helpful"
        onSort={() => undefined}
        voting={{ viewerId, known, signInUrl: viewerId ? null : "/login?next=x", pendingReviewId: null, onVote: () => undefined }}
      />,
    )
  const item = (html: string, id: number) => html.split('<li class="shop-review">')[id + 1]

  it("hidden on the viewer's own review, shown on others with Helpful (n) pressed", () => {
    const html = render("me")
    expect(item(html, 0)).not.toContain("shop-review__votes")
    const theirs = item(html, 1)
    expect(theirs).toContain("Helpful (3)")
    expect(buttonWith(theirs, "Helpful (3)")).toContain('aria-pressed="true"')
    expect(buttonWith(theirs, "Not helpful")).toContain('aria-pressed="false"')
    expect(spoken(buttonWith(theirs, "Not helpful"))).not.toMatch(/\d/)
  })

  it("not drawn until the session is known; signed out they are sign-in links", () => {
    expect(render("me", false)).not.toContain("shop-review__votes")
    const out = render(null)
    expect(item(out, 0)).toContain('href="/login?next=x"')
    expect(item(out, 1)).toContain('href="/login?next=x"')
  })

  it("the sort control lists Most helpful, then Most recent, with the current one selected", () => {
    const html = render("me")
    const options = [...html.matchAll(/<option value="(\w+)"[^>]*>([^<]+)<\/option>/g)].map((m) => [m[1], m[2]])
    expect(options).toEqual([["helpful", "Most helpful"], ["recent", "Most recent"]])
    expect(html).toMatch(/<option value="helpful" selected="">/)
  })
})

// ── delivery and checkout ──────────────────────────────────────────────

describe("delivery in markup", () => {
  it("the block reads 'Delivery by …' then 'to 500081' and Change", () => {
    const view = deliveryView({ pincode: "500081", asked: true, isLoading: false, error: null, estimate: toDeliveryEstimate({ pincode: "500081", serviceable: true, deliver_by: "2026-10-03" }) })
    const html = renderToStaticMarkup(<DeliveryBlock view={view} onPincode={() => true} />)
    expect(html).toContain('Delivery by <time dateTime="2026-10-03">Sat, 3 Oct</time>')
    expect(html).toContain("<span>to 500081</span>")
    expect(html).toContain(">Change</button>")
  })

  it("not serviceable: 'Not deliverable to 500081'; nothing to go on: ask for a pincode", () => {
    const no = deliveryView({ pincode: "500081", asked: true, isLoading: false, error: null, estimate: toDeliveryEstimate({ pincode: "500081", serviceable: false }) })
    expect(renderToStaticMarkup(<DeliveryBlock view={no} onPincode={() => true} />)).toContain("Not deliverable to 500081")
    const ask = renderToStaticMarkup(<DeliveryBlock view={{ kind: "ask" }} onPincode={() => true} />)
    expect(ask).toContain("Enter a pincode to see when it arrives")
    expect(ask).toContain(">Enter pincode</button>")
  })

  it("checkout shows 'Arrives by' from the quote, and nothing when the quote has no date", () => {
    const wire = { quote_id: "q", subtotal_minor: 100, discount_minor: 0, shipping_minor: 0, tax_minor: 0, total_minor: 100, currency: "INR", expires_at: "2026-10-01T10:00:00Z", serviceable: true }
    const html = renderToStaticMarkup(<QuoteBreakdown quote={toQuote({ ...wire, deliver_by: "2026-10-04" })} secondsLeft={60} quoting={false} />)
    expect(html).toContain('<time dateTime="2026-10-04">Arrives by Sun, 4 Oct</time>')
    expect(renderToStaticMarkup(<QuoteBreakdown quote={toQuote(wire)} secondsLeft={60} quoting={false} />)).not.toContain("Arrives by")
  })
})

// ── optimistic, with rollback ──────────────────────────────────────────

const refusal = Object.assign(new Error("nope"), { response: { status: 500, data: { error: { code: "INTERNAL", message: "x" } } } })

describe("reaction caches", () => {
  const detail = (like_count: number, viewer_reaction: "like" | "dislike" | null): DetailWithReaction => ({
    product: { id: "p1", title: "Earbuds", like_count, viewer_reaction },
    variants: [],
  })

  it("a like is drawn at once, then settled to the server's figures", async () => {
    const qc = new QueryClient()
    qc.setQueryData(CATALOGUE_KEYS.detail("p1"), detail(10, null))
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const sent: unknown[] = []
    const observer = new MutationObserver(qc, productReactionOptions(qc, "p1", async (_id, request) => {
      sent.push(request)
      await gate
      return { viewerReaction: "like", likeCount: 15 }
    }))
    const done = observer.mutate({ before: { viewerReaction: null, likeCount: 10 }, pressed: "like" })
    await new Promise((r) => setTimeout(r, 0))
    expect(readProductReaction(qc.getQueryData(CATALOGUE_KEYS.detail("p1")))).toEqual({ viewerReaction: "like", likeCount: 11 })
    release()
    await done
    expect(sent).toEqual([{ method: "PUT", kind: "like" }])
    expect(readProductReaction(qc.getQueryData(CATALOGUE_KEYS.detail("p1")))).toEqual({ viewerReaction: "like", likeCount: 15 })
  })

  it("a refused press is put back exactly as it was", async () => {
    const qc = new QueryClient()
    const before = detail(10, "like")
    qc.setQueryData(CATALOGUE_KEYS.detail("p1"), before)
    const observer = new MutationObserver(qc, productReactionOptions(qc, "p1", async () => { throw refusal }))
    await observer.mutate({ before: { viewerReaction: "like", likeCount: 10 }, pressed: "dislike" }).catch(() => undefined)
    expect(qc.getQueryData(CATALOGUE_KEYS.detail("p1"))).toEqual(detail(10, "like"))
  })

  it("a refused review vote is put back on every sort", async () => {
    const qc = new QueryClient()
    const page: ReviewsPage = toReviewsPage({ reviews: [{ id: "r1", rating: 5, helpful_count: 2 }], total: 1 })
    const helpfulKey = REVIEWS_SORTED_KEY("p1", "helpful")
    const recentKey = REVIEWS_SORTED_KEY("p1", "recent")
    qc.setQueryData(helpfulKey, page)
    qc.setQueryData(recentKey, page)
    let fail!: (e: unknown) => void
    const observer = new MutationObserver(qc, reviewVoteOptions(qc, "p1", () => new Promise((_, reject) => (fail = reject))))
    const done = observer.mutate({ reviewId: "r1", before: { viewerVote: null, helpfulCount: 2 }, pressed: "helpful" }).catch(() => undefined)
    await new Promise((r) => setTimeout(r, 0))
    for (const key of [helpfulKey, recentKey]) {
      expect(qc.getQueryData<ReviewsPage>(key)!.reviews[0]).toMatchObject({ viewerVote: "helpful", helpfulCount: 3 })
    }
    fail(refusal)
    await done
    expect(qc.getQueryData(helpfulKey)).toEqual(page)
    expect(qc.getQueryData(recentKey)).toEqual(page)
  })
})

// ── link preview ───────────────────────────────────────────────────────

describe("product link preview", () => {
  const fixture = readFixture<WireProductDetailBody>("storefront", "product_get_200").data

  it("title, '₹… · MStore', the first image absolute, and the canonical", () => {
    const meta = productMetadata("ignored", fixture)!
    const id = fixture.product!.id!
    expect(meta.title).toBe(`${fixture.product!.title} · MStore`)
    expect(meta.description).toBe("₹1,299 · MStore")
    expect(meta.alternates?.canonical).toBe(`https://cleestudio.com/shop/products/${id}`)
    const og = meta.openGraph as { url: string; images: Array<{ url: string }> }
    expect(og.url).toBe(`https://cleestudio.com/shop/products/${id}`)
    expect(og.images[0].url).toBe("https://media.example.test/00000000-0000-4000-8000-0000000d0001/medium_1080.jpg")
    expect((meta.twitter as { card: string }).card).toBe("summary_large_image")
  })

  it("the summary price wins; else the lowest variant a buyer can pick", () => {
    expect(productMetadata("p1", { product: { id: "p1", title: "Earbuds", min_price_minor: 28900 } })!.description).toBe("₹289 · MStore")
    expect(lowestPriceMinor({ product: { id: "p1" }, variants: [
      { id: "a", selling_price_minor: 50000, status: "active" },
      { id: "b", selling_price_minor: 28900, status: "active" },
    ] })).toBe(28900)
  })

  it("a relative image is made absolute; a javascript: one is refused", () => {
    const meta = productMetadata("p1", { product: { id: "p1", title: "Earbuds", image_url: "/v1/media/x.jpg" } })!
    expect((meta.openGraph as { images: Array<{ url: string }> }).images[0].url).toBe("https://cleestudio.com/v1/media/x.jpg")
    expect((meta.twitter as { images: string[] }).images).toEqual(["https://cleestudio.com/v1/media/x.jpg"])
    expect(absoluteUrl("/v1/media/x.jpg")).toBe("https://cleestudio.com/v1/media/x.jpg")
    expect(absoluteUrl("javascript:alert(1)")).toBeNull()
  })

  it("no product, no preview", () => {
    expect(productMetadata("p1", { product: null })).toBeNull()
    expect(productMetadata("p1", undefined)).toBeNull()
  })

  describe("generateMetadata", () => {
    const realFetch = globalThis.fetch
    afterEach(() => {
      globalThis.fetch = realFetch
    })
    const run = (id: string) => generateMetadata({ params: Promise.resolve({ id }) })

    it("asks the gateway for the product, without a cookie, and builds the preview", async () => {
      const seen: Array<{ url: string; init?: RequestInit }> = []
      globalThis.fetch = (async (url: string, init?: RequestInit) => {
        seen.push({ url: String(url), init })
        return new Response(JSON.stringify({ data: fixture }), { status: 200 })
      }) as typeof fetch
      const meta = await run(fixture.product!.id!)
      expect(seen[0].url).toEndWith(`/v1/commerce/products/${fixture.product!.id}`)
      expect(JSON.stringify(seen[0].init?.headers ?? {}).toLowerCase()).not.toContain("cookie")
      expect(meta.openGraph).toBeDefined()
    })

    it("a 404 (a product a buyer may not see) gets no preview", async () => {
      globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code: "PRODUCT_NOT_FOUND", message: "x" } }), { status: 404 })) as unknown as typeof fetch
      const meta = await run("hidden")
      expect(meta).toEqual(PRODUCT_FALLBACK_METADATA)
      expect(meta.openGraph).toBeUndefined()
    })

    it("a refused response is never read, whatever its body says", async () => {
      globalThis.fetch = (async () => new Response(JSON.stringify({ data: fixture }), { status: 404 })) as unknown as typeof fetch
      expect(await run("hidden")).toEqual(PRODUCT_FALLBACK_METADATA)
    })

    it("an API that does not answer costs the preview, not the page", async () => {
      globalThis.fetch = (async () => { throw new Error("ECONNREFUSED") }) as unknown as typeof fetch
      expect(await run("p1")).toEqual(PRODUCT_FALLBACK_METADATA)
    })
  })
})

/** Text a person can read or hear: tags and inline SVG drawing data removed, aria-labels kept. */
function visibleText(html: string): string {
  const labels = [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]).join(" ")
  return html.replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ") + " " + labels
}

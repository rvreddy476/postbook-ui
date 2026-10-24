import { describe, expect, mock, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

mock.module("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} }),
  usePathname: () => "/posttube/hub/insights/7a1d0000-0000-4000-8000-000000000001",
  useSearchParams: () => new URLSearchParams(),
}))

const { ToastProvider } = await import("@/contexts/ToastContext")
const { CopyrightReviewNotice } = await import("../components/CopyrightReviewNotice")
const { decodeCopyrightReview } = await import("../model")
const { normalizeLibraryRow, normalizePostDetail } = await import("@/features/posttube/hub/hubApi")
const { LibraryTable } = await import("@/features/posttube/hub/components/LibraryTable")
const { ContentInsightsPage } = await import("@/features/posttube/hub/components/InsightsPage")
const { HUB_KEYS } = await import("@/features/posttube/hub/hooks/useHub")
const { ReelReportDialog } = await import("@/features/reels/components/ReelReportDialog")
const { fixture } = await import("./fixtures")

const POST = "7a1d0000-0000-4000-8000-000000000001"

function render(node: ReactNode, client = new QueryClient()): string {
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ToastProvider>{node}</ToastProvider>
    </QueryClientProvider>,
  )
}

/** Visible text, entities decoded, tags dropped. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

const review = (over: Record<string, unknown> = {}) =>
  decodeCopyrightReview({ state: "pending", matched_title: "Sholay", created_at: "2026-10-24T05:00:00Z", ...over })!

describe("CopyrightReviewNotice", () => {
  test("pending: the hold sentence and Request review", () => {
    const html = render(<CopyrightReviewNotice postId={POST} review={review()} />)
    expect(html).toContain('data-copyright-review="pending"')
    expect(html).toContain('data-tone="warning"')
    expect(text(html)).toContain("In copyright review — this video is hidden until our team checks it. It matched “Sholay”.")
    expect(html).toContain("data-request-review")
    expect(text(html)).toContain("Request review")
  })

  test("asked: Review requested <date>, and no second request", () => {
    const html = render(<CopyrightReviewNotice postId={POST} review={review({ review_requested_at: "2026-10-25T06:30:00Z" })} />)
    expect(text(html)).toContain("Review requested 25 Oct 2026")
    expect(html).not.toContain("data-request-review")
  })

  test("cleared and blocked", () => {
    const cleared = render(<CopyrightReviewNotice postId={POST} review={review({ state: "cleared" })} />)
    expect(text(cleared)).toContain("Cleared — your video is live")
    expect(cleared).toContain('data-tone="success"')
    expect(cleared).not.toContain("data-request-review")
    const blocked = render(<CopyrightReviewNotice postId={POST} review={review({ state: "blocked" })} />)
    expect(text(blocked)).toContain("Blocked for copyright — it matched “Sholay”. This isn't a strike, but repeated blocks pause long-video uploads.")
    expect(blocked).toContain('data-tone="danger"')
    expect(blocked).not.toContain("data-request-review")
  })

  test("blocked with the appeal unused: Ask for a review, not Request review", () => {
    const html = render(<CopyrightReviewNotice postId={POST} review={review({ state: "blocked", can_appeal: true })} />)
    expect(html).toContain('data-copyright-review="blocked"')
    expect(html).toContain("data-ask-for-review")
    expect(html).not.toContain("data-request-review")
    expect(text(html)).toContain("Ask for a review")
  })

  test("the appeal answered or under way: no Ask for a review", () => {
    const answered = render(<CopyrightReviewNotice postId={POST} review={review({ state: "blocked", appealed_at: "2026-10-26T04:00:00Z" })} />)
    expect(answered).not.toContain("data-ask-for-review")
    expect(text(answered)).toContain("You asked for a review and the block stayed.")
    const waiting = render(<CopyrightReviewNotice postId={POST} review={review({ appealed_at: "2026-10-26T04:00:00Z" })} />)
    expect(waiting).not.toContain("data-ask-for-review")
    expect(waiting).not.toContain("data-request-review")
    expect(text(waiting)).toContain("Review requested 26 Oct 2026")
  })

  test("the appeal form: an optional note, the one-ask hint, Send enabled with no note", () => {
    const html = render(<CopyrightReviewNotice postId={POST} review={review({ state: "blocked", can_appeal: true })} defaultOpen />)
    expect(html).toContain("data-appeal")
    const t = text(html)
    expect(t).toContain("Ask for a review")
    expect(t).toContain("Add a note (optional)")
    expect(t).toContain("A reviewer looks at the block again. You can ask once.")
    expect(t).toContain("0 / 1,000")
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Send/)
  })

  test("the request form: the note's placeholder, its 1,000 cap, Send", () => {
    const html = render(<CopyrightReviewNotice postId={POST} review={review()} defaultOpen />)
    expect(html).toContain("data-request-review-dialog")
    expect(html).toContain('placeholder="I own the rights / I have a licence"')
    expect(text(html)).toContain("0 / 1,000")
    expect(text(html)).toContain("It matched “Sholay”.")
    expect(text(html)).toContain("Send")
  })
})

describe("Creator Hub", () => {
  test("library rows show each review's sentence; only the unasked pending one offers Request review", () => {
    const rows = (fixture("uploads_videos_states") as { data: unknown[] }).data.map((r) => normalizeLibraryRow(r)!)
    const html = render(
      <LibraryTable
        rows={rows}
        selected={new Set()}
        onToggle={() => {}}
        onToggleAll={() => {}}
        sortKey="published"
        sortDir="desc"
        onSort={() => {}}
        actions={{ onEdit: () => {}, onCopyLink: () => {}, onDelete: () => {} }}
        ownerId={null}
      />,
    )
    const t = text(html)
    expect(t).toContain("In copyright review — this video is hidden until our team checks it. It matched “Sholay”.")
    expect(t).toContain("Cleared — your video is live")
    expect(t).toContain("Blocked for copyright — it matched “Dilwale Dulhania Le Jayenge”.")
    expect(html.match(/data-copyright-review=/g)).toHaveLength(3)
    expect(html.match(/data-request-review(?![-\w])/g)).toHaveLength(1)
    expect(html).toContain("cr-notice--row")
  })

  test("the video's insights page shows the review from the detail", () => {
    const client = new QueryClient()
    client.setQueryData(HUB_KEYS.post(POST), normalizePostDetail((fixture("post_detail_owner_requested") as { data: unknown }).data))
    const html = render(<ContentInsightsPage postId={POST} />, client)
    expect(text(html)).toContain("Review requested 25 Oct 2026")
    expect(html).toContain('data-copyright-review="pending"')
  })

  test("a video never flagged shows no notice", () => {
    const client = new QueryClient()
    client.setQueryData(HUB_KEYS.post(POST), normalizePostDetail((fixture("post_detail_viewer") as { data: unknown }).data))
    expect(render(<ContentInsightsPage postId={POST} />, client)).not.toContain("data-copyright-review")
  })
})

describe("report sheet", () => {
  test("reels and videos offer the copyright reasons; a plain post does not", () => {
    for (const target of ["reel", "video"] as const) {
      const t = text(render(<ReelReportDialog open targetId={POST} targetType={target} onClose={() => {}} />))
      expect(t).toContain("Copyright: this is my content")
      expect(t).toContain("Copyright: film, TV or music")
      expect(t.indexOf("Copyright: film, TV or music")).toBeLessThan(t.lastIndexOf("Other"))
    }
    const post = text(render(<ReelReportDialog open targetId={POST} targetType="post" onClose={() => {}} />))
    expect(post).not.toContain("Copyright:")
  })
})

import { describe, expect, mock, test } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

mock.module("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} }),
  usePathname: () => "/echo",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

const { ToastProvider } = await import("@/contexts/ToastContext")
const { EchoActionsProvider, EligibilityDialog } = await import("../components/EchoActions")
const { NoteCard } = await import("../components/NoteCard")
const { Composer, Counter } = await import("../components/Composer")
const { parseNote, ECHO_WORDS } = await import("../model")
const { readFixture } = await import("./contractFixtures")

function render(node: React.ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <EchoActionsProvider>{node}</EchoActionsProvider>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

const note = parseNote(readFixture("note"))!

describe("the note card", () => {
  const html = render(<NoteCard note={note} />)

  test("author name, handle and the Verified mark", () => {
    expect(html).toContain("Alice Rao")
    expect(html).toContain("@alice")
    expect(html).toContain('data-mark="person"')
    expect(html).toContain('aria-label="Verified"')
  })

  test("hashtags link to the tag page; the picture comes from media-service by id", () => {
    expect(html).toContain('href="/hashtag/Bengaluru"')
    expect(html).toContain("/v1/media/e1111111-1111-4111-8111-111111111111/serve/medium_1080")
  })

  test("the quoted note, one level deep", () => {
    expect(html).toContain('data-quoted-note="f4444444-4444-4444-8444-444444444444"')
    expect(html).toContain("Monsoon is here.")
  })

  test("heart only, shown liked, with the counts; reply, repost, quote and share", () => {
    expect(html).toContain('aria-label="Unlike"')
    expect(html).toContain('aria-pressed="true"')
    for (const label of ["Reply", "Repost", "Quote", "Share"]) expect(html).toContain(`aria-label="${label}"`)
    expect(html).not.toMatch(/reaction|emoji/i)
  })

  test("no Edited mark until the note is edited", () => {
    expect(html).not.toContain("Edited")
    expect(render(<NoteCard note={{ ...note, editedAt: "2026-11-12T09:40:00Z" }} />)).toContain("· Edited")
  })

  test("a quote whose note is gone says so", () => {
    expect(render(<NoteCard note={{ ...note, quoted: null }} />)).toContain("This note isn&#x27;t available.")
  })

  test("signed out: no options menu", () => {
    expect(html).not.toContain('aria-label="More options"')
  })
})

describe("the composer", () => {
  test("starts empty: 500 left, Post off, the reply-policy picker with the three choices", () => {
    const html = render(<Composer purpose={{ kind: "note" }} />)
    expect(html).toContain('data-remaining="500"')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Post<\/button>/)
    for (const label of ["Everyone", "People you follow", "Only people you mention"]) expect(html).toContain(label)
    expect(html).toContain("Make a thread")
  })

  test("a reply has no thread and no reply-policy picker", () => {
    const html = render(<Composer purpose={{ kind: "reply", to: note }} />)
    expect(html).not.toContain("Make a thread")
    expect(html).not.toContain("Who can reply")
    expect(html).toContain(">Reply<")
  })

  test("a quote shows the note it quotes and no thread", () => {
    const html = render(<Composer purpose={{ kind: "quote", of: note }} />)
    expect(html).toContain("Rain all week in")
    expect(html).not.toContain("Make a thread")
  })

  test("the counter warns near the limit and goes red past it", () => {
    expect(renderToStaticMarkup(<Counter text={"a".repeat(485)} />)).toContain("text-warning")
    expect(renderToStaticMarkup(<Counter text={"a".repeat(501)} />)).toContain("text-danger")
    expect(renderToStaticMarkup(<Counter text={"a".repeat(501)} />)).toContain('data-remaining="-1"')
  })
})

describe("the eligibility dialog", () => {
  test("says Premium is needed and offers no purchase (the web has no Premium page yet)", () => {
    const html = renderToStaticMarkup(<EligibilityDialog notice={{ title: ECHO_WORDS.premiumRequired, detail: ECHO_WORDS.premiumRequiredDetail }} onClose={() => {}} />)
    expect(html).toContain("Posting on Echo needs Momentum Premium")
    expect(html).not.toMatch(/buy|purchase|subscribe|upgrade/i)
    expect(renderToStaticMarkup(<EligibilityDialog notice={null} onClose={() => {}} />)).toBe("")
  })
})

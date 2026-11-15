import { describe, expect, mock, test } from "bun:test"
import React from "react"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/*
  Echo v2 (modernsmapp docs/designs/echo-v2-contract.md): the X-style app.
  Fixtures are post-service's testdata/contracts/notes, copied byte for
  byte into __tests__/contracts.
*/

let signedIn: { id: string; name: string; username: string; avatar: string } | null = null

mock.module("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} }),
  usePathname: () => "/echo",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))
mock.module("@/store/auth", () => ({
  useAuthUser: () => signedIn,
  useAuthStore: <T,>(sel: (s: { user: { id: string } | null }) => T) => sel({ user: signedIn ? { id: signedIn.id } : null }),
}))

const { ToastProvider } = await import("@/contexts/ToastContext")
const { EchoActionsProvider } = await import("../components/EchoActions")
const { EchoShell, LeftNav } = await import("../components/EchoShell")
const { ActionBar, NoteMediaGrid, PollView } = await import("../components/NoteCard")
const model = await import("../model")
const { ComposerGateView, CharRing, gifFileFromPick } = await import("../components/Composer")
const { parseNote, parseNotePage, readFailure, echoErrorMessage } = await import("../model")
const { createNoteBody, echoPaths, echoV2Paths } = await import("../api")
const { inboxListPath } = await import("@/lib/activityInbox")
const v2 = await import("../v2")

const { readFixture } = await import("./contractFixtures")
const draft = (name: string) => readFixture(name)

function render(node: React.ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <EchoActionsProvider>{node}</EchoActionsProvider>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

const pollNote = parseNote(draft("note_v2"))!
const ALICE = "a1111111-1111-4111-8111-111111111111"
const BOB = "b2222222-2222-4222-8222-222222222222"

describe("Note JSON v2 fields (contract §1)", () => {
  test("counts, bookmark state, status and the poll are read", () => {
    expect([pollNote.viewCount, pollNote.bookmarkCount, pollNote.quoteCount, pollNote.shareCount]).toEqual([7, 1, 1, 0])
    expect(pollNote.bookmarked).toBe(true)
    expect(pollNote.status).toBe("published")
    expect(pollNote.poll?.options.map((o) => [o.label, o.votes])).toEqual([["Bajji", 1], ["Samosa", 1]])
    expect(pollNote.poll?.totalVotes).toBe(2)
    expect(pollNote.poll?.viewerVote).toBe(0)
    expect(pollNote.poll?.endsAt).toBe("2026-11-13T09:40:00Z")
  })

  test("bookmark state falls back to is_bookmarked until viewer_has_bookmarked ships", () => {
    expect(parseNote({ id: "x", is_bookmarked: true })?.bookmarked).toBe(true)
    expect(parseNote({ id: "x", is_bookmarked: true, viewer_has_bookmarked: false })?.bookmarked).toBe(false)
  })

  test("the scheduled list (GET /v1/notes/me/scheduled)", () => {
    const page = parseNotePage(draft("note_scheduled"))
    expect(page.items.length).toBe(1)
    expect(page.items[0].status).toBe("scheduled")
    expect(page.items[0].scheduledAt).toBe("2026-11-12T12:40:00Z")
    expect(page.items[0].publishError).toBeNull()
    expect(page.nextCursor).toBeNull()
  })

  test("a failed scheduled note carries publish_error (only when set)", () => {
    const n = parseNote({ id: "x", status: "failed", publish_error: "premium_required" })!
    expect(n.status).toBe("failed")
    expect(n.publishError).toBe("premium_required")
  })

  test("trends are ranked and #-free", () => {
    expect(v2.parseTrends(draft("trends")).map((t) => [t.rank, t.tag, t.noteCount])).toEqual([[1, "bengaluru", 4]])
    expect(v2.parseTrends({ data: { items: [{ tag: "#b", rank: 2 }, { tag: "a", rank: 1 }] } }).map((t) => t.tag)).toEqual(["a", "b"])
    expect(v2.trendCountLabel(1520)).toBe("1.5K posts")
  })

  test("POLL_CLOSED reads as our words", () => {
    const err = { isAxiosError: true, response: { status: 409, data: draft("error_poll_closed"), headers: {} } }
    expect(readFailure(err).code).toBe("POLL_CLOSED")
    expect(echoErrorMessage(err)).toBe("This poll has ended.")
  })
})

describe("the shell renders without the VChat chrome", () => {
  test("signed in: Echo's own nav, Post and the account chip; nothing from VChat's rail", () => {
    signedIn = { id: ALICE, name: "Alice Rao", username: "alice", avatar: "" }
    const html = render(<LeftNav />)
    for (const [key, href] of [
      ["home", "/echo"],
      ["explore", "/echo/explore"],
      ["notifications", "/echo/notifications"],
      ["chat", "/messenger"],
      ["bookmarks", "/echo/bookmarks"],
      ["profile", "/echo/alice"],
    ]) {
      const tag = html.match(new RegExp(`<a[^>]*data-nav="${key}"[^>]*>`))?.[0] ?? ""
      expect(tag, key).toContain(`href="${href}"`)
    }
    expect(html).toContain('aria-label="More"')
    expect(html).toContain('href="/echo/compose"')
    expect(html).toContain("data-echo-account-chip")
    expect(html).toContain("@alice")
    // Home is the current page.
    expect(html.match(/<a[^>]*data-nav="home"[^>]*>/)?.[0]).toContain(`aria-current="page"`)
    signedIn = null
  })

  test("the whole shell: three columns, no VChat header, rail or second Echo menu", () => {
    signedIn = { id: ALICE, name: "Alice Rao", username: "alice", avatar: "" }
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <EchoShell>
            <p>centre</p>
          </EchoShell>
        </ToastProvider>
      </QueryClientProvider>,
    )
    signedIn = null
    expect(html).toContain("data-echo-shell")
    expect(html).toContain("data-echo-left-nav")
    expect(html).toContain("data-echo-right-column")
    expect(html).toContain("data-echo-tab-bar")
    expect(html).toContain("<p>centre</p>")
    expect(html.match(/aria-label="Echo"/g)?.length).toBe(2) // the left nav and the logo, once each
    for (const vchat of ['href="/reels"', 'href="/shop"', 'href="/feed"', "Marketplace"]) expect(html).not.toContain(vchat)
  })

  test("no Echo page or layout mounts VChat's AppShell", () => {
    const root = resolve(import.meta.dir, "../../../app/echo")
    const files: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.tsx?$/.test(f)) files.push(p)
      }
    }
    walk(root)
    expect(files.length).toBeGreaterThan(10)
    for (const f of files) {
      const src = readFileSync(f, "utf8")
      expect(src, f).not.toContain("AppShell")
      expect(src, f).not.toContain("PublicPageChrome")
    }
    expect(readFileSync(join(root, "layout.tsx"), "utf8")).toContain("EchoShell")
  })

  test("the nav items and the More menu", () => {
    expect(v2.echoNavItems(null).map((i) => i.label)).toEqual(["Home", "Explore", "Notifications", "Saved", "Scheduled", "Chat", "Premium"])
    expect(v2.echoNavItems("bob").at(-1)).toEqual({ key: "profile", label: "Profile", href: "/echo/bob" })
    expect(v2.ECHO_MORE_ITEMS.map((i) => i.label)).toEqual(["Settings", "Back to VChat"])
    expect(v2.activeNavKey("/echo/hashtag/x", "a")).toBe("explore")
    expect(v2.activeNavKey("/echo/a", "a")).toBe("profile")
    expect(v2.activeNavKey("/echo/a/status/1", "a")).toBeNull()
    expect(v2.activeNavKey("/echo/scheduled", "a")).toBe("scheduled")
  })
})

describe("the composer's Premium gate", () => {
  const composer = <div data-echo-composer="note">composer</div>

  test("a free member sees 'Posting on Echo needs Premium' and Get Premium, not the composer", () => {
    const html = renderToStaticMarkup(<ComposerGateView eligibility={{ canPost: false, canReply: true, reason: "premium_required" }} loading={false}>{composer}</ComposerGateView>)
    expect(html).toContain("Posting on Echo needs Premium")
    expect(html).toMatch(/href="\/premium"[^>]*>Get Premium</)
    expect(html).not.toContain("data-echo-composer")
  })

  test("a member gets the composer", () => {
    const html = renderToStaticMarkup(<ComposerGateView eligibility={{ canPost: true, canReply: true, reason: "" }} loading={false}>{composer}</ComposerGateView>)
    expect(html).toContain("data-echo-composer")
    expect(html).not.toContain("Get Premium")
  })

  test("another refusal says why and offers no purchase", () => {
    const html = renderToStaticMarkup(<ComposerGateView eligibility={{ canPost: false, canReply: false, reason: "suspended" }} loading={false}>{composer}</ComposerGateView>)
    expect(html).toContain("data-echo-cannot-post")
    expect(html).not.toContain("Get Premium")
    expect(html).not.toContain("data-echo-composer")
  })

  test("the full composer has the toolbar, the reply picker and the ring", () => {
    signedIn = { id: ALICE, name: "Alice Rao", username: "alice", avatar: "" }
    const { Composer } = require("../components/Composer") as typeof import("../components/Composer")
    const html = render(<Composer purpose={{ kind: "note" }} />)
    signedIn = null
    for (const label of ["Add photos", "Add a poll", "Add an emoji", "Schedule for later", "Add to thread"]) expect(html).toContain(`aria-label="${label}"`)
    expect(html).toContain("Everyone can reply")
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Post note<\/button>/)
  })

  test("the character ring warns in the last 20 and goes red past 500", () => {
    expect(renderToStaticMarkup(<CharRing text={"a".repeat(485)} />)).toContain("text-warning")
    expect(renderToStaticMarkup(<CharRing text={"a".repeat(501)} />)).toContain('data-remaining="-1"')
    expect(renderToStaticMarkup(<CharRing text={"a".repeat(501)} />)).toContain("text-danger")
  })
})

describe("poll counts are hidden until voted, closed, or the author (contract §1)", () => {
  const NOW = Date.parse("2026-11-13T09:00:00Z")
  const withCounts = { ...pollNote, poll: { ...pollNote.poll!, viewerVote: null, closed: false, endsAt: "2099-11-15T08:00:00Z", totalVotes: 15, options: [{ index: 0, label: "Tea", votes: 12 }, { index: 1, label: "Coffee", votes: 3 }] } }
  const withheld = { ...withCounts, poll: { ...withCounts.poll, options: withCounts.poll.options.map((o) => ({ ...o, votes: null })) } }

  test("a stranger who has not voted on an open poll sees no counts", () => {
    expect(v2.pollCountsVisible(withCounts, BOB, NOW)).toBe(false)
    expect(v2.canVote(withCounts, BOB, NOW)).toBe(true)
  })

  test("after voting, once closed, or as the author: counts show", () => {
    expect(v2.pollCountsVisible({ ...withCounts, poll: { ...withCounts.poll, viewerVote: 1 } }, BOB, NOW)).toBe(true)
    expect(v2.pollCountsVisible({ ...withCounts, poll: { ...withCounts.poll, closed: true } }, BOB, NOW)).toBe(true)
    expect(v2.pollCountsVisible(withCounts, BOB, Date.parse("2099-11-16T00:00:00Z"))).toBe(true)
    // The server fixture: the viewer voted on an open poll, so counts show.
    expect(v2.pollCountsVisible(pollNote, BOB, NOW)).toBe(true)
    expect(v2.pollCountsVisible(withCounts, ALICE, NOW)).toBe(true)
    expect(v2.canVote(withCounts, ALICE, NOW)).toBe(false)
  })

  test("counts the server withheld (null) are never drawn", () => {
    expect(v2.pollCountsVisible({ ...withheld, poll: { ...withheld.poll, viewerVote: 0 } }, BOB, NOW)).toBe(false)
    expect(v2.pollCountsVisible(withheld, ALICE, NOW)).toBe(false)
  })

  test("drawn: choices to vote on before, percentages after", () => {
    signedIn = { id: BOB, name: "Bob", username: "bob", avatar: "" }
    const before = render(<PollView note={withCounts} />)
    expect(before).toContain('data-poll-counts="hidden"')
    expect(before).not.toContain("80%")
    expect(before).toContain("15 votes")
    const after = render(<PollView note={{ ...withCounts, poll: { ...withCounts.poll, viewerVote: 0 } }} />)
    expect(after).toContain('data-poll-counts="shown"')
    expect(after).toContain("80%")
    expect(after).toContain("20%")
    expect(after).toContain('aria-label="Your vote"')
    signedIn = null
  })

  test("a poll draft: 2–4 choices of 25, 5 minutes to 7 days; empty extras dropped", () => {
    const d = { options: ["Yes", "No", ""], days: 1, hours: 0, minutes: 0 }
    expect(v2.pollProblem(d)).toBeNull()
    expect(v2.pollBody(d)).toEqual({ options: ["Yes", "No"], duration_minutes: 1440 })
    expect(v2.pollProblem({ ...d, options: ["Yes", ""] })).toBe("A poll needs at least 2 choices.")
    expect(v2.pollProblem({ ...d, options: ["a".repeat(26), "b"] })).toBe("Each choice can be up to 25 characters.")
    expect(v2.pollProblem({ ...d, days: 0, minutes: 4 })).toBe("A poll must stay open for at least 5 minutes.")
    expect(v2.pollProblem({ ...d, days: 7, minutes: 1 })).toBe("A poll can stay open for up to 7 days.")
    expect(v2.pollProblem({ ...d, days: 7 })).toBeNull()
  })

  test("a poll note sends no media", () => {
    expect(createNoteBody({ text: "Q?", mediaIds: ["m1"], poll: { options: ["a", "b"], duration_minutes: 60 } })).toEqual({ text: "Q?", poll: { options: ["a", "b"], duration_minutes: 60 } })
  })
})

describe("views are batched every few seconds into POST /v1/notes/views", () => {
  function fakeTimers() {
    let pending: (() => void) | null = null
    let scheduled = 0
    return {
      setTimer: (fn: () => void) => {
        scheduled += 1
        pending = fn
        return scheduled
      },
      clearTimer: () => {
        pending = null
      },
      fire: () => pending?.(),
      get scheduled() {
        return scheduled
      },
    }
  }

  test("ids seen within the window go out in one call, once each", async () => {
    const calls: string[][] = []
    const t = fakeTimers()
    const b = new v2.ViewBatcher(async (ids) => void calls.push(ids), { setTimer: t.setTimer, clearTimer: t.clearTimer })
    b.add("n1")
    b.add("n2")
    b.add("n1")
    expect(calls).toEqual([])
    expect(t.scheduled).toBe(1)
    t.fire()
    await Promise.resolve()
    expect(calls).toEqual([["n1", "n2"]])
    b.add("n1") // already counted this session
    expect(b.pending).toBe(0)
    b.add("n3")
    await b.flush()
    expect(calls).toEqual([["n1", "n2"], ["n3"]])
  })

  test("more than 50 ids are split into calls of 50", async () => {
    const calls: string[][] = []
    const b = new v2.ViewBatcher(async (ids) => void calls.push(ids), { setTimer: () => 1, clearTimer: () => {} })
    for (let i = 0; i < 120; i += 1) b.add(`n${i}`)
    await b.flush()
    expect(calls.map((c) => c.length)).toEqual([50, 50, 20])
  })

  test("a failed call is dropped, not retried", async () => {
    let tries = 0
    const b = new v2.ViewBatcher(async () => {
      tries += 1
      throw new Error("offline")
    }, { setTimer: () => 1, clearTimer: () => {} })
    b.add("n1")
    await b.flush()
    await b.flush()
    expect(tries).toBe(1)
  })

  test("the route and the 50 cap", () => {
    expect(echoV2Paths.views).toBe("/v1/notes/views")
    expect(v2.VIEWS_MAX_PER_CALL).toBe(50)
    expect(v2.VIEWS_FLUSH_MS).toBeLessThanOrEqual(10_000)
  })
})

describe("the repost and share menus", () => {
  test("repost: Repost (or Undo repost) and Quote", () => {
    expect(v2.repostMenu({ reposted: false }).map((o) => o.label)).toEqual(["Repost", "Quote"])
    expect(v2.repostMenu({ reposted: true }).map((o) => o.label)).toEqual(["Undo repost", "Quote"])
  })

  test("share: Copy link and Send via Chat; signed out only Copy link", () => {
    expect(v2.shareMenu(true).map((o) => o.label)).toEqual(["Copy link", "Send via Chat"])
    expect(v2.shareMenu(false).map((o) => o.label)).toEqual(["Copy link"])
  })

  test("drawn open from the action bar", () => {
    signedIn = { id: BOB, name: "Bob", username: "bob", avatar: "" }
    const repost = render(<ActionBar note={pollNote} initialMenu="repost" />)
    expect(repost).toMatch(/role="menu" aria-label="Echo it"/)
    expect(repost).toContain('data-menu-item="repost"')
    expect(repost).toContain('data-menu-item="quote"')
    expect(repost).toContain(">Re-echo<")
    expect(repost).toContain(">Quote<")
    // Share lives in More now, beside Save and the account items.
    const more = render(<ActionBar note={pollNote} initialMenu="more" />)
    expect(more).toMatch(/role="menu" aria-label="More"/)
    expect(more).toContain(">Copy link<")
    expect(more).toContain(">Send via Chat<")
    expect(more).toContain('data-menu-item="bookmark"')
    expect(more).toContain(">Report post<")
    signedIn = null
  })

  test("the action bar: Reply, Echo it, heart, the eye with views, More, evenly spaced", () => {
    const html = render(<ActionBar note={pollNote} />)
    expect(html).toContain('aria-label="0 Replies. Reply"')
    expect(html).toContain('aria-label="Echo it"')
    expect(html).toContain('aria-label="Unlike"') // the fixture viewer liked it
    expect(html).toContain('aria-label="7 views"')
    expect(html).toContain("lucide-eye")
    expect(html).toContain('aria-label="More"')
    expect(html).toMatch(/data-echo-pill="reply".*data-echo-pill="echo".*data-echo-pill="heart".*data-echo-pill="views".*data-echo-pill="more"/s)
    expect(html).toContain("justify-between")
    expect(html).not.toContain("flex-wrap")
    // The saved state shows inside More.
    expect(render(<ActionBar note={pollNote} initialMenu="more" />)).toContain(">Remove from Saved<")
  })

  test("Copy link and Send via Chat count a share on the existing route", () => {
    expect(echoV2Paths.share("n1")).toBe("/v1/posts/n1/share")
  })
})

describe("schedule: 5 minutes to 18 months ahead", () => {
  const NOW = Date.parse("2026-11-14T12:00:00Z")
  test("inside the window", () => {
    expect(v2.scheduleProblem(new Date(NOW + 5 * 60_000), NOW)).toBeNull()
    expect(v2.scheduleProblem(new Date(NOW + 24 * 3600_000), NOW)).toBeNull()
    expect(v2.scheduleProblem(v2.scheduleLatest(NOW), NOW)).toBeNull()
  })
  test("too soon, too late, or no time", () => {
    expect(v2.scheduleProblem(new Date(NOW + 4 * 60_000), NOW)).toBe("Pick a time at least 5 minutes from now.")
    expect(v2.scheduleProblem(new Date(NOW - 60_000), NOW)).toBe("Pick a time at least 5 minutes from now.")
    expect(v2.scheduleProblem(new Date(v2.scheduleLatest(NOW).getTime() + 60_000), NOW)).toBe("You can schedule up to 18 months ahead.")
    expect(v2.scheduleProblem(null, NOW)).toBe("Pick a date and time.")
    expect(v2.scheduleProblem(new Date("nope"), NOW)).toBe("Pick a date and time.")
  })
  test("18 calendar months", () => {
    const latest = v2.scheduleLatest(NOW)
    expect(latest.getUTCFullYear() * 12 + latest.getUTCMonth() - (2026 * 12 + 10)).toBe(18)
  })
  test("the datetime-local round trip", () => {
    const d = new Date(2027, 0, 5, 9, 7)
    expect(v2.toLocalInputValue(d)).toBe("2027-01-05T09:07")
    expect(v2.fromLocalInputValue("2027-01-05T09:07")?.getTime()).toBe(d.getTime())
    expect(v2.fromLocalInputValue("")).toBeNull()
  })
  test("the body: scheduled_at on a note, never on a reply", () => {
    const at = new Date("2026-12-01T04:30:00Z")
    expect(createNoteBody({ text: "x", scheduledAt: at }).scheduled_at).toBe("2026-12-01T04:30:00.000Z")
    expect(createNoteBody({ text: "x", replyToId: "p", scheduledAt: at }).scheduled_at).toBeUndefined()
  })
})

describe("notifications: All and Mentions (?filter=mentions)", () => {
  test("the page param", () => {
    expect(v2.notificationsFilterFromParam("mentions")).toBe("mentions")
    expect(v2.notificationsFilterFromParam(null)).toBe("all")
    expect(v2.notificationsFilterFromParam("likes")).toBe("all")
    expect(v2.notificationsTabHref("mentions")).toBe("/echo/notifications?filter=mentions")
    expect(v2.notificationsTabHref("all")).toBe("/echo/notifications")
  })

  test("the GET sends filter=mentions (contract §4) beside the existing category", () => {
    expect(v2.withMentionsFilter(inboxListPath("mentions", null), "mentions")).toBe("/v1/notifications?category=mentions&limit=30&filter=mentions")
    expect(v2.withMentionsFilter(inboxListPath("", null), "all")).toBe("/v1/notifications?limit=30")
  })
})

describe("routes and paths", () => {
  test("v2 API paths", () => {
    expect(echoV2Paths.vote("n1")).toBe("/v1/notes/n1/poll/vote")
    expect(echoV2Paths.scheduled()).toBe("/v1/notes/me/scheduled?limit=20")
    expect(echoV2Paths.bookmark("n1")).toBe("/v1/notes/n1/bookmark")
    expect(echoV2Paths.bookmarks("c")).toBe("/v1/notes/bookmarks?cursor=c&limit=20")
    expect(echoV2Paths.quotes("n1")).toBe("/v1/notes/n1/quotes?limit=20")
    expect(echoV2Paths.trends(50)).toBe("/v1/notes/trends?limit=30")
    expect(echoV2Paths.hashtag("#Rain", "latest")).toBe("/v1/notes/hashtags/Rain?tab=latest&limit=20")
    expect(echoV2Paths.search("monsoon rain", "top")).toBe("/v1/notes/search?q=monsoon+rain&tab=top&limit=20")
    expect(echoPaths.timeline("for-you")).toBe("/v1/feed/notes/for-you?limit=20")
  })

  test("a list route that is not there yet (404) or off (503) is 'unavailable'; a missing note is not", () => {
    const fail = (status: number, code?: string) => ({ isAxiosError: true, response: { status, data: code ? { error: { code } } : {}, headers: {} } })
    expect(v2.listUnavailable(fail(404))).toBe(true)
    expect(v2.listUnavailable(fail(503, "ECHO_NOT_ENABLED"))).toBe(true)
    expect(v2.listUnavailable(fail(404, "NOTE_NOT_FOUND"))).toBe(false)
    expect(v2.listUnavailable(fail(500))).toBe(false)
  })

  test("a picked GIF is downloaded and uploaded as image/gif", async () => {
    const fetcher = (async () => new Response(new Blob(["GIF89a"], { type: "image/gif" }))) as unknown as typeof fetch
    const file = await gifFileFromPick({ id: "abc", url: "https://media.giphy.com/x.gif" }, fetcher)
    expect(file.type).toBe("image/gif")
    expect(file.name).toBe("giphy-abc.gif")
  })
})


describe("video in notes", () => {
  const { videoProblem, videoClock, videoTooLongNotice, mediaProblem, isVideoFile } = model
  test("limits follow X: 140 s and 512 MB without Premium, 10 minutes with", () => {
    expect(videoProblem(140_000, 512 * 1024 * 1024, false)).toBeNull()
    expect(videoProblem(140_001, 1, false)).toBe("Videos can be up to 2 min 20 s.")
    expect(videoProblem(1, 512 * 1024 * 1024 + 1, false)).toBe("Videos can be up to 512 MB.")
    expect(videoProblem(600_000, 4 * 1024 ** 3, true)).toBeNull()
    expect(videoProblem(600_001, 1, true)).toBe("Videos can be up to 10 minutes.")
    expect(videoProblem(0, 1, false)).toBeNull() // length unknown: the server decides later
  })

  test("one video goes on its own; the clock and the author's notice", () => {
    expect(mediaProblem([{ isGif: false, isVideo: true }])).toBeNull()
    expect(mediaProblem([{ isGif: false, isVideo: true }, { isGif: false }])).toBe(model.MEDIA_LIMIT_MESSAGE)
    expect(isVideoFile({ type: "video/mp4" })).toBe(true)
    expect(videoClock(65_000)).toBe("1:05")
    expect(videoClock(3_723_000)).toBe("1:02:03")
    expect(videoTooLongNotice(200_000)).toBe("This video is longer than 2 min 20 s and is only visible to you.")
    expect(videoTooLongNotice(700_000)).toBe("This video is longer than 10 minutes and is only visible to you.")
  })

  test("a video note parses its video, processing state and the too-long flag", () => {
    const n = parseNote({
      id: "v1", author_id: "a", text: "", created_at: "2026-11-15T10:00:00Z", post_type: "video",
      is_processing: false, video_too_long: true,
      media: [{ media_id: "m1", kind: "video", duration_ms: 65000, hls_url: "/v1/media/m1/hls/master.m3u8", position: 0 }],
    })!
    expect(n.media).toEqual([{ mediaId: "m1", isGif: false, altText: "", isVideo: true, durationMs: 65000, hlsUrl: "/v1/media/m1/hls/master.m3u8" }])
    expect(n.videoTooLong).toBe(true)
    expect(n.isProcessing).toBe(false)
  })

  test("a card shows the player, its length and the author's notice; processing shows a placeholder", () => {
    const base = parseNote({ id: "v2", author_id: "a", text: "", created_at: "2026-11-15T10:00:00Z", media: [{ media_id: "m2", kind: "video", duration_ms: 65000 }] })!
    const html = render(<NoteMediaGrid note={{ ...base, videoTooLong: true }} />)
    expect(html).toContain('data-echo-video="m2"')
    expect(html).toContain(">1:05<")
    expect(html).toContain("only visible to you")
    const busy = render(<NoteMediaGrid note={{ ...base, isProcessing: true }} />)
    expect(busy).toContain("Processing video…")
    expect(busy).not.toContain("<video")
  })

  test("the note page's pills: an even 3-column grid with the eye, no views in the date line", () => {
    const html = render(<ActionBar note={pollNote} big />)
    expect(html).toContain("grid-cols-3")
    expect(html).toMatch(/data-echo-pill="heart".*data-echo-pill="echo".*data-echo-pill="views".*data-echo-pill="save".*data-echo-pill="reply".*data-echo-pill="more"/s)
    expect(html).toContain("lucide-eye")
  })
})

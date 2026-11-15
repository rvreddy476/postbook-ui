import { describe, expect, mock, test } from "bun:test"
import React from "react"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/*
  Echo look v3, "serif conversation cards" (modernsmapp
  docs/designs/echo-look-v3.md): the topic line rules, the reply bubbles,
  the labelled pills, the composer's words, and the one token source.
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
const { ActionBar, BigNote, NoteCard, ReplyBubble, ReplyBubbles, ReplyThread, TopicLineView } = await import("../components/NoteCard")
const { Composer } = await import("../components/Composer")
const { WriteNoteButton, Tabs } = await import("../components/EchoShell")
const { parseNote } = await import("../model")
const look = await import("../look")
const { echoPaths } = await import("../api")
const { readFixture } = await import("./contractFixtures")

type Note = NonNullable<ReturnType<typeof parseNote>>

function render(node: React.ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <EchoActionsProvider>{node}</EchoActionsProvider>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

const base = parseNote(readFixture("note"))!
const NOW = Date.parse("2026-11-12T11:30:00Z")
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString()

function note(over: Partial<Note> = {}): Note {
  return { ...base, quoteOfId: null, quoted: null, replyToId: null, editedAt: null, poll: null, media: [], text: "Plain words", createdAt: ago(120), ...over }
}

function reply(id: string, authorId: string, name: string, text: string, replyToId = base.id): Note {
  return note({ id, authorId, author: { id: authorId, username: name.toLowerCase(), displayName: name, avatarUrl: null, mark: "none" }, text, replyToId })
}

describe("the topic line", () => {
  test("the first hashtag and the time, in ember", () => {
    const t = look.topicLine(note({ text: "Rain in #Bengaluru and #Mumbai" }), { now: NOW })
    expect(t).toEqual({ kind: "hashtag", lead: "#Bengaluru", tag: "Bengaluru", age: "2h", accent: true })
  })

  test("no hashtag: just the time, in secondary text", () => {
    const t = look.topicLine(note({ text: "No tags here" }), { now: NOW })
    expect(t.kind).toBe("time")
    expect(t.lead).toBeNull()
    expect(t.accent).toBe(false)
    expect(t.age).toBe("2h")
  })

  test("a quote says Quote, even with a hashtag", () => {
    expect(look.topicLine(note({ quoteOfId: "q1", text: "#rain" }), { now: NOW })).toMatchObject({ kind: "quote", lead: "Quote", accent: true })
  })

  test("a reply says who it answers when known, Reply otherwise", () => {
    expect(look.topicLine(note({ replyToId: "p1" }), { now: NOW, replyToHandle: "bob" }).lead).toBe("Reply to @bob")
    expect(look.topicLine(note({ replyToId: "p1", text: "#rain" }), { now: NOW }).lead).toBe("Reply")
  })

  test("a thread says Thread, with its parts when the client knows them", () => {
    expect(look.topicLine(note(), { now: NOW, thread: true }).lead).toBe("Thread")
    expect(look.topicLine(note(), { now: NOW, threadParts: 3 }).lead).toBe("Thread · 3 parts")
    // A later part of the author's own thread reads as the thread, not as a reply.
    expect(look.topicLine(note({ replyToId: "p1" }), { now: NOW, threadPart: true }).kind).toBe("thread")
  })

  test("drawn: ember with a lead, muted for the time alone; the tag links to its page", () => {
    const tagged = renderToStaticMarkup(<TopicLineView note={note()} topic={look.topicLine(note({ text: "#rain" }), { now: NOW })} />)
    expect(tagged).toContain('data-echo-topic="hashtag"')
    expect(tagged).toContain("text-echo-accent")
    expect(tagged).toContain('href="/echo/hashtag/rain"')
    expect(tagged).toContain(">#rain<")
    const plain = renderToStaticMarkup(<TopicLineView note={note()} topic={look.topicLine(note(), { now: NOW })} />)
    expect(plain).toContain('data-echo-topic="time"')
    expect(plain).toContain("text-muted-foreground")
    expect(plain).not.toContain("text-echo-accent")
  })

  test("the card puts the name, then how long ago, on top, then the serif words (no avatar column)", () => {
    const html = render(<NoteCard note={note({ text: "Rain in #Bengaluru" })} />)
    const author = html.indexOf("data-echo-author")
    const age = html.indexOf("data-echo-age")
    expect(author).toBeGreaterThan(-1)
    expect(author).toBeLessThan(age)
    expect(age).toBeLessThan(html.indexOf("data-echo-text"))
    expect(html.indexOf("data-echo-topic")).toBeLessThan(html.indexOf("data-echo-text"))
    expect(html).not.toContain("data-echo-signature")
    expect(html).toContain('data-echo-text="timeline"')
    expect(html).toContain("font-echo-serif")
    expect(html).toContain("rounded-echo-card")
    expect(html).not.toContain("h-10 w-10")
  })

  test("a long note is set one step smaller", () => {
    expect(look.isLongNote("a".repeat(280))).toBe(false)
    expect(look.isLongNote("a".repeat(281))).toBe(true)
    expect(render(<NoteCard note={note({ text: "a ".repeat(200) })} />)).toContain('data-echo-text="long"')
  })
})

describe("reply bubbles on the timeline", () => {
  const parent = note({ replyCount: 5 })
  const r1 = reply("r1", "u1", "Bob", "First\nreply")
  const r2 = reply("r2", "u2", "Cara", "Second reply")
  const r3 = reply("r3", "u3", "Dev", "Third reply")

  test("at most two, then 'N replies' to the note page", () => {
    const html = renderToStaticMarkup(<ReplyBubbles note={parent} replies={[r1, r2, r3]} />)
    expect(html.match(/data-echo-reply-bubble=/g)?.length).toBe(2)
    expect(html).toContain("Bob")
    expect(html).toContain("First reply") // one line: the break is folded
    expect(html).toContain("Cara")
    expect(html).not.toContain("Dev")
    const link = html.match(/<a[^>]*data-echo-replies-link[^>]*>[^<]*<\/a>/)?.[0] ?? ""
    expect(link).toContain('href="/echo/alice/status/f1111111-1111-4111-8111-111111111111"')
    expect(link).toContain(">5 replies</a>")
    expect(html).toContain("truncate")
  })

  test("no replies: no bubble area at all", () => {
    expect(renderToStaticMarkup(<ReplyBubbles note={note({ replyCount: 0 })} replies={[]} />)).toBe("")
    expect(renderToStaticMarkup(<ReplyBubbles note={parent} replies={[]} />)).toBe("")
  })

  test("the author's own reply is the thread carrying on, not a bubble", () => {
    const own = reply("t2", base.authorId, "Alice", "Part two")
    const split = look.timelineBubbles(parent, [own, r1])
    expect(split.thread).toBe(true)
    expect(split.bubbles.map((b) => b.id)).toEqual(["r1"])
    expect(renderToStaticMarkup(<ReplyBubbles note={parent} replies={[own]} />)).toBe("")
  })

  test("'1 reply' and '12 replies'", () => {
    expect(look.replyCountLabel(1)).toBe("1 reply")
    expect(look.replyCountLabel(12)).toBe("12 replies")
    expect(look.replyCountLabel(1234)).toBe("1,234 replies")
  })

  test("a photo-only reply still says something", () => {
    expect(look.bubbleText({ text: " ", media: [{ mediaId: "m", isGif: false, altText: "" }], poll: null })).toBe("Photo")
    expect(look.bubbleText({ text: "", media: [{ mediaId: "m", isGif: true, altText: "" }], poll: null })).toBe("GIF")
  })

  test("the card asks for them lazily: nothing on the server render, and the replies call takes limit 2", () => {
    const html = render(<NoteCard note={parent} />)
    expect(html).not.toContain("data-echo-reply-bubbles")
    expect(echoPaths.replies("n1", null, 2)).toBe("/v1/notes/n1/replies?limit=2")
    // The full replies list is unchanged.
    expect(echoPaths.replies("n1")).toBe("/v1/notes/n1/replies?limit=20")
  })
})

describe("labelled action pills", () => {
  test("the timeline: Reply, Echo it, heart + count, More — pills, not a bare icon row", () => {
    const html = render(<ActionBar note={note({ likeCount: 42, liked: false, repostCount: 2, quoteCount: 1 })} />)
    expect(html).toMatch(/aria-label="\d+ Replies\. Reply"[^>]*>.*Reply<\/button>/)
    expect(html).toMatch(/aria-label="Echo it"[^>]*>.*Echo it/)
    expect(html).toMatch(/aria-label="Like"[^>]*>.*42/)
    expect(html).toContain('aria-label="More"')
    expect(html.match(/rounded-full border border-border/g)!.length).toBeGreaterThanOrEqual(4)
  })

  test("Echo it opens Re-echo and Quote; a re-echoed note offers Undo re-echo", () => {
    const html = render(<ActionBar note={note({ reposted: true })} initialMenu="repost" />)
    expect(html).toContain(">Undo re-echo<")
    expect(html).toContain(">Quote<")
  })

  test("the note page: '42 hearts', '3 echoes', Save", () => {
    const html = render(<ActionBar note={note({ likeCount: 42, repostCount: 2, quoteCount: 1, bookmarked: false })} big />)
    expect(html).toContain("42 hearts")
    expect(html).toContain("3 echoes")
    expect(html).toMatch(/aria-label="Save"[^>]*>.*Save/)
    expect(look.heartsLabel(1)).toBe("1 heart")
    expect(look.echoesLabel({ repostCount: 1, quoteCount: 0 })).toBe("1 echo")
  })

  test("More holds Save and the share items for a signed-out reader too", () => {
    const html = render(<ActionBar note={note()} initialMenu="more" />)
    expect(html).toContain(">Save<")
    expect(html).toContain(">Copy link<")
    expect(html).not.toContain(">Report post<")
  })

  test("the author's More keeps Edit, View post activity and Delete", () => {
    signedIn = { id: base.authorId, name: "Alice Rao", username: "alice", avatar: "" }
    const html = render(<ActionBar note={note({ createdAt: new Date().toISOString() })} initialMenu="more" />)
    signedIn = null
    for (const item of ["Edit", "View post activity", "Delete", "Copy link", "Send via Chat", "Save"]) expect(html).toContain(`>${item}<`)
  })
})

describe("the note page", () => {
  test("the big note: ember border, meta line, the 22px serif", () => {
    const html = render(<BigNote note={note({ text: "Big #news", viewCount: 1200, createdAt: new Date().toISOString() })} />)
    expect(html).toContain("border-echo-accent")
    expect(html).toContain('data-echo-text="lead"')
    expect(html).toContain(">#news<")
    expect(html).toContain("1.2k views")
  })

  test("the meta line reads '#tag · 2:14 pm · 1.2k views'", () => {
    const at = new Date(2026, 10, 14, 14, 14).getTime()
    const m = look.metaLine({ text: "x #tag", createdAt: new Date(at).toISOString(), viewCount: 1234 }, at + 60_000)
    expect(m).toEqual({ tag: "tag", time: "2:14 pm", views: "1.2k views" })
    expect(look.viewsLabel(1)).toBe("1 view")
  })

  test("a reply bubble: avatar beside it, then Heart · Reply · time", () => {
    const html = render(<ReplyBubble note={reply("r1", "u1", "Bob", "Nice one")} />)
    expect(html).toContain("Bob")
    expect(html).toContain("Nice one")
    expect(html).toContain("data-echo-reply-actions")
    expect(html).toMatch(/Heart.*Reply.*<time/)
  })

  test("a reply to a reply goes one step in, two at most, then flat with 'Replying to @x'", () => {
    const a = reply("a", "u1", "Bob", "1")
    const b = reply("b", "u2", "Cara", "2", "a")
    const c = reply("c", "u3", "Dev", "3", "b")
    const d = reply("d", "u4", "Eve", "4", "c")
    const z = reply("z", "u5", "Zed", "5")
    const rows = look.conversationRows(base.id, [d, z, c, a, b])
    expect(rows.map((r) => [r.note.id, r.depth, r.replyingTo])).toEqual([
      ["z", 0, null],
      ["a", 0, null],
      ["b", 1, null],
      ["c", 2, null],
      ["d", 2, "dev"],
    ])
  })

  test("the thread page lists every part after the open note, part 3 and on included", () => {
    const p1 = reply("p1", "u1", "Bob", "1")
    const p2 = reply("p2", "u1", "Bob", "2", "p1")
    const p3 = reply("p3", "u1", "Bob", "3", "p2")
    expect(look.threadPartsAfter("p1", [p1, p2, p3]).map((p) => p.id)).toEqual(["p2", "p3"])
    expect(look.threadPartsAfter("p2", [p1, p2, p3]).map((p) => p.id)).toEqual(["p3"])
    expect(look.threadPartsAfter("p3", [p1, p2, p3])).toEqual([])
    expect(look.threadPartsAfter("x", [p1, p2, p3])).toEqual([])
  })
})

describe("the composer's words", () => {
  test("a note: 'What's worth saying today?', Post note, labelled pills, 'N left'", () => {
    signedIn = { id: "a1", name: "Alice Rao", username: "alice", avatar: "" }
    const html = render(<Composer purpose={{ kind: "note" }} />)
    signedIn = null
    expect(html).toContain(`placeholder="What&#x27;s worth saying today?"`)
    expect(html).toMatch(/>Post note<\/button>/)
    for (const label of ["Photo", "Poll", "Emoji", "Later", "Add to thread"]) expect(html).toContain(`> ${label}</button>`)
    expect(html).toContain("500 left")
    expect(html).toContain("Everyone can reply")
    // The text area is a serif card with the signature on top.
    expect(html).toContain("rounded-echo-card")
    expect(html).toContain("data-echo-signature")
    expect(html).toContain("font-echo-serif")
  })

  test("a reply: the parent above as a small card, 'Your reply…', Reply", () => {
    const html = render(<Composer purpose={{ kind: "reply", to: note({ text: "The parent words" }) }} />)
    expect(html).toContain("data-echo-reply-parent")
    expect(html).toContain("The parent words")
    expect(html).toContain('placeholder="Your reply…"')
    expect(html).toMatch(/>Reply<\/button>/)
  })

  test("the modal: Cancel and Post note on top", () => {
    const html = render(<Composer purpose={{ kind: "note" }} onCancel={() => {}} />)
    expect(html).toMatch(/data-echo-composer-bar.*>Cancel<\/button>.*>Post note<\/button>/)
  })

  test("the note page's reply box: 'Reply to <name>…'", () => {
    expect(look.replyBoxPlaceholder(note())).toBe("Reply to Alice Rao…")
    const html = render(<Composer purpose={{ kind: "reply", to: note() }} inline placeholder={look.replyBoxPlaceholder(note())} />)
    expect(html).toContain('placeholder="Reply to Alice Rao…"')
  })

  test("the words, one place", () => {
    expect(look.composerWords("note")).toEqual({ placeholder: "What's worth saying today?", submit: "Post note" })
    expect(look.composerWords("reply")).toEqual({ placeholder: "Your reply…", submit: "Reply" })
    expect(look.composerWords("note", { scheduled: true }).submit).toBe("Schedule")
    expect(look.composerWords("note", { thread: true }).submit).toBe("Post thread")
  })
})

describe("the shell pieces", () => {
  test("Write a note: an ember pill to the compose modal", () => {
    const html = renderToStaticMarkup(<WriteNoteButton />)
    expect(html).toContain('href="/echo/compose"')
    expect(html).toContain("Write a note")
    expect(html).toContain("bg-echo-accent")
  })

  test("tabs are pills; the selected one takes the ember tint", () => {
    const html = renderToStaticMarkup(<Tabs label="Timeline" tabs={[{ key: "a", label: "For you" }, { key: "b", label: "Following" }]} active="a" />)
    expect(html).toMatch(/aria-selected="true"[^>]*class="[^"]*bg-echo-accent-tint/)
    expect(html).toMatch(/aria-selected="false"[^>]*class="[^"]*rounded-full/)
  })
})

describe("colour and font come from the one token place", () => {
  const ROOT = join(import.meta.dir, "..", "..", "..", "..")
  const theme = readFileSync(join(ROOT, "src/ui/theme.css"), "utf8")
  const globals = readFileSync(join(ROOT, "src/app/globals.css"), "utf8")
  const layout = readFileSync(join(ROOT, "src/app/layout.tsx"), "utf8")

  test("the ember is declared for light and dark, and mapped to Tailwind", () => {
    for (const token of ["echo-accent", "echo-accent-hover", "echo-accent-tint", "echo-on-accent"]) {
      expect(theme.match(new RegExp(`--theme-${token}:`, "g"))?.length, token).toBe(2)
      expect(globals.match(new RegExp(`--${token}: var\\(--theme-${token}\\)`, "g"))?.length, token).toBe(2)
      expect(globals).toContain(`--color-${token}: rgb(var(--${token}))`)
    }
  })

  test("Bodoni Moda is loaded once through next/font and exposed as font-echo-serif", () => {
    expect(layout).toContain("Bodoni_Moda")
    expect(layout).toContain("--font-bodoni")
    expect(globals).toContain("--font-echo-serif: var(--font-bodoni)")
  })

  test("no Echo component spells a font family or a colour", () => {
    const glob = new Bun.Glob("**/*.{ts,tsx}")
    for (const dir of ["src/features/echo", "src/app/echo"]) {
      for (const rel of glob.scanSync({ cwd: join(ROOT, dir) })) {
        if (rel.includes("__tests__")) continue
        const src = readFileSync(join(ROOT, dir, rel), "utf8")
        expect(src, rel).not.toMatch(/Bodoni|Figtree|Outfit|fontFamily/)
        expect(src, rel).not.toMatch(/(?<![\w&])#[0-9a-fA-F]{6}\b/)
      }
    }
  })
})

describe("selfDisplayName", () => {
  test("never shows an email address as the viewer's name", async () => {
    const { selfDisplayName } = await import("../look")
    expect(selfDisplayName({ name: "echoa@example.com", username: "echo_a" })).toBe("echo_a")
    expect(selfDisplayName({ name: "echoa@example.com", username: "" })).toBe("")
    expect(selfDisplayName({ name: "Asha Rao", username: "asha" })).toBe("Asha Rao")
    expect(selfDisplayName(null)).toBe("")
  })
})

describe("thread part count on the timeline", () => {
  test("thread_parts is read off the note JSON, 0 when absent", () => {
    const raw = (readFixture("note") as { data: Record<string, unknown> }).data
    expect(parseNote({ ...raw, thread_parts: 4 })!.threadParts).toBe(4)
    expect(parseNote({ ...raw, thread_parts: undefined })!.threadParts).toBe(0)
  })

  test("a thread's first note says Thread · N parts and offers Read the thread", () => {
    const html = render(<NoteCard note={note({ threadParts: 3, text: "Start #rain" })} />)
    expect(html).toContain('data-echo-topic="thread"')
    expect(html).toContain("Thread · 3 parts")
    expect(html).toContain("data-echo-read-thread")
  })

  test("a lone note (0 or 1 part) is no thread", () => {
    const html = render(<NoteCard note={note({ threadParts: 0 })} />)
    expect(html).not.toContain("Thread")
    expect(render(<NoteCard note={note({ threadParts: 1 })} />)).not.toContain("data-echo-read-thread")
  })
})

describe("replies to replies on the note page", () => {
  test("placement: one step in up to two, then flat with Replying to @x", () => {
    expect(look.childReplyPlacement(0, "bob")).toEqual({ depth: 1, replyingTo: null })
    expect(look.childReplyPlacement(1, "bob")).toEqual({ depth: 2, replyingTo: null })
    expect(look.childReplyPlacement(2, "bob")).toEqual({ depth: 2, replyingTo: "bob" })
    expect(look.childReplyPlacement(2, "")).toEqual({ depth: 2, replyingTo: null })
  })

  test("the button's words", () => {
    expect(look.viewRepliesLabel(1)).toBe("View 1 reply")
    expect(look.viewRepliesLabel(12)).toBe("View 12 replies")
  })

  test("a reply with replies offers View N replies; one without does not", () => {
    const withKids = render(<ReplyThread note={{ ...reply("r1", "u1", "Bob", "Hi"), replyCount: 3 }} />)
    expect(withKids).toContain('data-echo-view-replies="r1"')
    expect(withKids).toContain("View 3 replies")
    expect(withKids).not.toContain("data-echo-child-replies")
    const none = render(<ReplyThread note={{ ...reply("r2", "u2", "Cara", "Yo"), replyCount: 0 }} />)
    expect(none).not.toContain("data-echo-view-replies")
  })

  test("the button sits at the reply's own indent", () => {
    const html = render(<ReplyThread note={{ ...reply("r3", "u3", "Dev", "Deep"), replyCount: 2 }} depth={1} />)
    expect(html).toContain('data-echo-reply-depth="1"')
    expect(html).toMatch(/ml-8[^"]*"><button[^>]*data-echo-view-replies="r3"/)
  })
})

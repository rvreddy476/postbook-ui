/*
  Echo look v3, "serif conversation cards" (modernsmapp
  docs/designs/echo-look-v3.md): the pure rules behind the new cards, so
  the words and the choices are tested without a browser. Nothing here
  changes what a note is or which routes are called.
*/

import { compactCount, fullCount, noteLength, shortAge, textSegments, type Note } from "./model"

/** A note longer than this is set one step smaller on the timeline (16 instead of 18). */
export const LONG_NOTE_CHARS = 280

/** Up to this many top replies show as bubbles inside a timeline card. */
export const TIMELINE_REPLY_BUBBLES = 2

export function isLongNote(text: string): boolean {
  return noteLength(text) > LONG_NOTE_CHARS
}

/** The first #hashtag in the words, without the #; null when there is none. */
export function firstHashtag(text: string): string | null {
  for (const seg of textSegments(text)) if (seg.kind === "hashtag") return seg.tag
  return null
}

export type TopicKind = "reply" | "thread" | "quote" | "hashtag" | "time"

export interface TopicLine {
  kind: TopicKind
  /** What comes before the time ("#rain", "Thread · 3 parts", "Quote", "Reply to @bob"); null for time only. */
  lead: string | null
  /** The tag (no #) when kind is "hashtag". */
  tag: string | null
  /** "2h", "now", "2026-11-01". */
  age: string
  /** Ember when there is a lead; secondary text for the time alone. */
  accent: boolean
}

/**
 * The small line on top of every note. A reply says who it answers, a
 * thread says so (with its part count when the client knows it), a quote
 * says Quote, otherwise the first hashtag; with none of those it is just
 * the time, in secondary text.
 */
export function topicLine(
  note: Pick<Note, "text" | "createdAt" | "replyToId" | "quoteOfId">,
  opts: { now?: number; thread?: boolean; threadParts?: number | null; replyToHandle?: string | null; threadPart?: boolean } = {},
): TopicLine {
  const age = shortAge(note.createdAt, opts.now)
  // A later part of the author's own thread reads as the thread, not as a reply.
  if (opts.threadPart) return { kind: "thread", lead: "Thread", tag: null, age, accent: true }
  if (note.replyToId) {
    const who = opts.replyToHandle ? `Reply to @${opts.replyToHandle}` : "Reply"
    return { kind: "reply", lead: who, tag: null, age, accent: true }
  }
  if (opts.thread || (opts.threadParts ?? 0) > 1) {
    const parts = opts.threadParts && opts.threadParts > 1 ? ` · ${opts.threadParts} parts` : ""
    return { kind: "thread", lead: `Thread${parts}`, tag: null, age, accent: true }
  }
  if (note.quoteOfId) return { kind: "quote", lead: "Quote", tag: null, age, accent: true }
  const tag = firstHashtag(note.text)
  if (tag) return { kind: "hashtag", lead: `#${tag}`, tag, age, accent: true }
  return { kind: "time", lead: null, tag: null, age, accent: false }
}

/** "1 reply", "12 replies". */
export function replyCountLabel(count: number): string {
  const n = Math.max(0, Math.floor(count))
  return n === 1 ? "1 reply" : `${fullCount(n)} replies`
}

/** "1 heart", "42 hearts", "1.2K hearts". */
export function heartsLabel(count: number): string {
  const n = Math.max(0, Math.floor(count))
  return n === 1 ? "1 heart" : `${n < 1000 ? n : compactCount(n)} hearts`
}

/** Reposts and quotes together: "1 echo", "3 echoes". */
export function echoesLabel(note: Pick<Note, "repostCount" | "quoteCount">): string {
  const n = Math.max(0, note.repostCount + note.quoteCount)
  return n === 1 ? "1 echo" : `${n < 1000 ? n : compactCount(n)} echoes`
}

/** "1 view", "1.2k views" (lower case, as the note page's meta line reads). */
export function viewsLabel(count: number): string {
  const n = Math.max(0, Math.floor(count))
  if (n === 1) return "1 view"
  return `${n < 1000 ? n : compactCount(n).toLowerCase()} views`
}

/** "2:14 pm" for the note page's meta line; the date is added when it is not today. */
export function metaTime(createdAt: string, now: number = Date.now()): string {
  const t = Date.parse(createdAt)
  if (!Number.isFinite(t)) return ""
  const d = new Date(t)
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()
  if (new Date(now).toDateString() === d.toDateString()) return time
  return `${time} · ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
}

/** The note page's meta line parts: `#tag · 2:14 pm · 1.2k views`. */
export function metaLine(note: Pick<Note, "text" | "createdAt" | "viewCount">, now: number = Date.now()): { tag: string | null; time: string; views: string } {
  return { tag: firstHashtag(note.text), time: metaTime(note.createdAt, now), views: viewsLabel(note.viewCount) }
}

/**
 * The bubbles inside a timeline card. A reply by the note's own author is
 * the thread carrying on, not a conversation, so it never shows as a
 * bubble; it marks the card as a thread instead. At most two.
 */
export function timelineBubbles(note: Pick<Note, "id" | "authorId">, replies: readonly Note[]): { bubbles: Note[]; thread: boolean } {
  const direct = replies.filter((r) => r.id !== note.id)
  const thread = direct.some((r) => r.authorId === note.authorId && r.replyToId === note.id)
  const bubbles = direct.filter((r) => r.authorId !== note.authorId).slice(0, TIMELINE_REPLY_BUBBLES)
  return { bubbles, thread }
}

/** A bubble's one line: the words with no line breaks, or what the note carries when it has none. */
export function bubbleText(note: Pick<Note, "text" | "media" | "poll">): string {
  const words = note.text.replace(/\s+/g, " ").trim()
  if (words) return words
  if (note.poll) return "Poll"
  if (note.media.some((m) => m.isGif)) return "GIF"
  if (note.media.length > 1) return `${note.media.length} photos`
  if (note.media.length === 1) return "Photo"
  return ""
}

export const MAX_REPLY_DEPTH = 2

export interface ConversationRow {
  note: Note
  /** 0 for a direct reply, 1 for a reply to a reply, 2 at most (MAX_REPLY_DEPTH). */
  depth: number
  /** Set when the reply is deeper than the indent goes: whose reply it answers. */
  replyingTo: string | null
}

/** The thread parts after the open note, in order; [] when the note is not in the thread. */
export function threadPartsAfter(noteId: string, thread: readonly Note[]): Note[] {
  const i = thread.findIndex((p) => p.id === noteId)
  return i < 0 ? [] : thread.slice(i + 1)
}

/**
 * The note page's replies in reading order. A reply to a reply in the
 * loaded set sits under its parent, one step in (two steps at most); past
 * that it stays flat and says "Replying to @x". Replies whose parent is
 * not loaded are direct replies. The incoming order is kept among siblings.
 */
export function conversationRows(rootId: string, replies: readonly Note[]): ConversationRow[] {
  const byId = new Map(replies.map((r) => [r.id, r]))
  const children = new Map<string, Note[]>()
  const roots: Note[] = []
  for (const r of replies) {
    const parent = r.replyToId && r.replyToId !== rootId && byId.has(r.replyToId) ? r.replyToId : null
    if (parent) children.set(parent, [...(children.get(parent) ?? []), r])
    else roots.push(r)
  }
  const out: ConversationRow[] = []
  const seen = new Set<string>()
  const walk = (n: Note, level: number) => {
    if (seen.has(n.id)) return
    seen.add(n.id)
    const parent = n.replyToId ? byId.get(n.replyToId) : undefined
    const depth = Math.min(level, MAX_REPLY_DEPTH)
    const replyingTo = level > MAX_REPLY_DEPTH && parent ? parent.author?.username || null : null
    out.push({ note: n, depth, replyingTo })
    for (const c of children.get(n.id) ?? []) walk(c, level + 1)
  }
  for (const r of roots) walk(r, 0)
  // A cycle the server should never send still shows every reply once.
  for (const r of replies) if (!seen.has(r.id)) walk(r, 0)
  return out
}

/** The composer's words (look v3 §3). */
export function composerWords(kind: "note" | "reply" | "quote", opts: { poll?: boolean; thread?: boolean; scheduled?: boolean } = {}): { placeholder: string; submit: string } {
  const placeholder = kind === "reply" ? "Your reply…" : kind === "quote" ? "Add your take…" : opts.poll ? "Ask a question" : "What's worth saying today?"
  const submit = opts.scheduled ? "Schedule" : kind === "reply" ? "Reply" : opts.thread ? "Post thread" : "Post note"
  return { placeholder, submit }
}

/** "Reply to Alice…" for the reply box at the bottom of the note page. */
export function replyBoxPlaceholder(note: Pick<Note, "author">): string {
  const name = note.author?.displayName || note.author?.username || "this note"
  return `Reply to ${name}…`
}

/**
 * The name to sign the viewer's own composer card with. A session can carry
 * the sign-in email as its "name" (an account with no display name yet);
 * Echo never shows an email address, so that falls back to the username.
 */
export function selfDisplayName(user: { name?: string | null; username?: string | null } | null | undefined): string {
  const name = (user?.name ?? "").trim()
  if (name && !name.includes("@")) return name
  return (user?.username ?? "").trim()
}

/**
 * Where a reply loaded under another reply on the note page sits: one step
 * further in, up to MAX_REPLY_DEPTH; past that it stays at the deepest step
 * and says whose reply it answers ("Replying to @x").
 */
export function childReplyPlacement(parentDepth: number, parentHandle: string | null | undefined): { depth: number; replyingTo: string | null } {
  const level = parentDepth + 1
  if (level <= MAX_REPLY_DEPTH) return { depth: level, replyingTo: null }
  return { depth: MAX_REPLY_DEPTH, replyingTo: parentHandle || null }
}

/** "View 1 reply", "View 12 replies": the button that opens a reply's own replies. */
export function viewRepliesLabel(count: number): string {
  return `View ${fullCount(count)} ${count === 1 ? "reply" : "replies"}`
}

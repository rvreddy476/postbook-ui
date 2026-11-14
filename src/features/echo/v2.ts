/*
  Echo v2 (modernsmapp docs/designs/echo-v2-contract.md): the pure rules
  the X-style screens lean on. No React here, so each rule is tested on
  its own: poll count visibility and drafts, the schedule window, the
  view batcher, the repost and share menus, the left-nav items and the
  notifications filter.

  Limits copy X's (contract preamble): poll 2–4 choices of up to 25
  characters, open 5 minutes to 7 days; schedule 5 minutes to 18 months.
*/

import { isAuthor, readFailure, unwrap, type Note, type Poll } from "./model"

// ── Polls ───────────────────────────────────────────────────────────────

export const POLL_RULES = {
  minOptions: 2,
  maxOptions: 4,
  maxLabel: 25,
  minMinutes: 5,
  maxMinutes: 7 * 24 * 60,
  defaultMinutes: 24 * 60,
} as const

function pollEnded(poll: Pick<Poll, "closed" | "endsAt">, now: number): boolean {
  if (poll.closed) return true
  const t = Date.parse(poll.endsAt)
  return Number.isFinite(t) && t <= now
}

/**
 * Whether the counts show (contract §1): after the viewer voted, once the
 * poll has closed, or to the note's author. The server sends `votes: null`
 * otherwise; a count it did not send is never drawn, whatever the rule says.
 */
export function pollCountsVisible(note: Pick<Note, "authorId" | "poll">, viewerId: string | null | undefined, now: number = Date.now()): boolean {
  const poll = note.poll
  if (!poll) return false
  const allowed = poll.viewerVote !== null || pollEnded(poll, now) || isAuthor(note, viewerId)
  return allowed && poll.options.every((o) => o.votes !== null)
}

/** Whether this viewer may still vote: signed in, not the author, not voted, not ended. */
export function canVote(note: Pick<Note, "authorId" | "poll">, viewerId: string | null | undefined, now: number = Date.now()): boolean {
  const poll = note.poll
  if (!poll || !viewerId) return false
  return poll.viewerVote === null && !pollEnded(poll, now) && !isAuthor(note, viewerId)
}

/** Whole-number percentage of the total; 0 when nobody voted. */
export function pollPercent(votes: number | null, total: number): number {
  if (votes === null || total <= 0) return 0
  return Math.round((votes / total) * 100)
}

/** "2 days left", "5 hours left", "12 minutes left", "Final results". */
export function pollTimeLeft(poll: Pick<Poll, "closed" | "endsAt">, now: number = Date.now()): string {
  if (pollEnded(poll, now)) return "Final results"
  const t = Date.parse(poll.endsAt)
  if (!Number.isFinite(t)) return ""
  const minutes = Math.max(1, Math.ceil((t - now) / 60_000))
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} left`
  if (minutes < 60) return plural(minutes, "minute")
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return plural(hours, "hour")
  return plural(Math.floor(hours / 24), "day")
}

export interface PollDraft {
  options: string[]
  days: number
  hours: number
  minutes: number
}

export function newPollDraft(): PollDraft {
  return { options: ["", ""], days: 1, hours: 0, minutes: 0 }
}

export function pollDurationMinutes(d: Pick<PollDraft, "days" | "hours" | "minutes">): number {
  return d.days * 24 * 60 + d.hours * 60 + d.minutes
}

/** Why the poll cannot be posted, or null. Empty extra choices (3 and 4) are left out, as on X. */
export function pollProblem(d: PollDraft): string | null {
  const filled = d.options.map((o) => o.trim()).filter(Boolean)
  if (filled.length < POLL_RULES.minOptions) return "A poll needs at least 2 choices."
  if (filled.length > POLL_RULES.maxOptions) return "A poll can have up to 4 choices."
  if (filled.some((o) => Array.from(o).length > POLL_RULES.maxLabel)) return "Each choice can be up to 25 characters."
  const minutes = pollDurationMinutes(d)
  if (minutes < POLL_RULES.minMinutes) return "A poll must stay open for at least 5 minutes."
  if (minutes > POLL_RULES.maxMinutes) return "A poll can stay open for up to 7 days."
  return null
}

export function pollBody(d: PollDraft): { options: string[]; duration_minutes: number } {
  return { options: d.options.map((o) => o.trim()).filter(Boolean), duration_minutes: pollDurationMinutes(d) }
}

/** The note after the viewer's vote, before the server answers. Counts stay as they were (null stays null). */
export function withVote(note: Note, id: string, optionIndex: number): Note {
  if (note.id !== id || !note.poll) return note
  return { ...note, poll: { ...note.poll, viewerVote: optionIndex, totalVotes: note.poll.totalVotes + 1 } }
}

// ── Schedule ────────────────────────────────────────────────────────────

export const SCHEDULE_MIN_MINUTES = 5
export const SCHEDULE_MAX_MONTHS = 18

/** The latest moment a note may be scheduled for: 18 calendar months from now. */
export function scheduleLatest(now: number = Date.now()): Date {
  const d = new Date(now)
  d.setMonth(d.getMonth() + SCHEDULE_MAX_MONTHS)
  return d
}

export function scheduleEarliest(now: number = Date.now()): Date {
  return new Date(now + SCHEDULE_MIN_MINUTES * 60_000)
}

/** Why a scheduled time is refused, or null. */
export function scheduleProblem(at: Date | null, now: number = Date.now()): string | null {
  if (!at || !Number.isFinite(at.getTime())) return "Pick a date and time."
  if (at.getTime() < scheduleEarliest(now).getTime()) return "Pick a time at least 5 minutes from now."
  if (at.getTime() > scheduleLatest(now).getTime()) return "You can schedule up to 18 months ahead."
  return null
}

/** A Date as the value of an <input type="datetime-local"> (local time, minutes). */
export function toLocalInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** The value of a datetime-local input as a Date (local time), or null. */
export function fromLocalInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null
  const d = new Date(value)
  return Number.isFinite(d.getTime()) ? d : null
}

/** "Will send on Sat, Nov 15, 2026 at 9:30 AM". */
export function scheduleLabel(at: string | Date): string {
  const d = typeof at === "string" ? new Date(at) : at
  if (!Number.isFinite(d.getTime())) return ""
  const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return `Will send on ${date} at ${time}`
}

// ── Views ───────────────────────────────────────────────────────────────

export const VIEWS_FLUSH_MS = 5_000
export const VIEWS_MAX_PER_CALL = 50

export interface ViewBatcherOptions {
  intervalMs?: number
  maxPerCall?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

/**
 * Collects the notes that came into view and sends them every few seconds
 * in one POST /v1/notes/views (at most 50 ids a call). Each id is sent once
 * per page session; the server dedupes per day anyway. Views are
 * best-effort: a failed call is dropped, never retried in a loop.
 */
export class ViewBatcher {
  private queued = new Set<string>()
  private sent = new Set<string>()
  private timer: unknown = null
  private readonly intervalMs: number
  private readonly maxPerCall: number
  private readonly setTimer: (fn: () => void, ms: number) => unknown
  private readonly clearTimer: (handle: unknown) => void

  constructor(private readonly send: (ids: string[]) => Promise<unknown>, opts: ViewBatcherOptions = {}) {
    this.intervalMs = opts.intervalMs ?? VIEWS_FLUSH_MS
    this.maxPerCall = opts.maxPerCall ?? VIEWS_MAX_PER_CALL
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  }

  add(id: string): void {
    if (!id || this.sent.has(id) || this.queued.has(id)) return
    this.queued.add(id)
    if (this.timer === null) this.timer = this.setTimer(() => void this.flush(), this.intervalMs)
  }

  get pending(): number {
    return this.queued.size
  }

  async flush(): Promise<void> {
    if (this.timer !== null) {
      this.clearTimer(this.timer)
      this.timer = null
    }
    const ids = [...this.queued]
    this.queued.clear()
    for (const id of ids) this.sent.add(id)
    for (let i = 0; i < ids.length; i += this.maxPerCall) {
      try {
        await this.send(ids.slice(i, i + this.maxPerCall))
      } catch {
        // Best-effort: a view that failed to count is not worth a retry storm.
      }
    }
  }
}

// ── Menus ───────────────────────────────────────────────────────────────

export type RepostMenuKey = "repost" | "quote"
export type ShareMenuKey = "copy" | "chat"

/** The repost button's menu: Repost (or Undo repost) and Quote. */
export function repostMenu(note: Pick<Note, "reposted">): { key: RepostMenuKey; label: string }[] {
  return [
    { key: "repost", label: note.reposted ? "Undo repost" : "Repost" },
    { key: "quote", label: "Quote" },
  ]
}

/** The share button's menu: Copy link, and Send via Chat for a signed-in viewer. */
export function shareMenu(signedIn: boolean): { key: ShareMenuKey; label: string }[] {
  return signedIn
    ? [
        { key: "copy", label: "Copy link" },
        { key: "chat", label: "Send via Chat" },
      ]
    : [{ key: "copy", label: "Copy link" }]
}

export function withBookmark(note: Note, id: string, bookmarked: boolean, count?: number): Note {
  const apply = (n: Note): Note =>
    n.id === id
      ? { ...n, bookmarked, bookmarkCount: typeof count === "number" ? Math.max(0, count) : Math.max(0, n.bookmarkCount + (bookmarked === n.bookmarked ? 0 : bookmarked ? 1 : -1)) }
      : n
  const next = apply(note)
  return next.quoted ? { ...next, quoted: apply(next.quoted) } : next
}

// ── Navigation ──────────────────────────────────────────────────────────

export type EchoNavKey = "home" | "explore" | "notifications" | "chat" | "bookmarks" | "scheduled" | "premium" | "profile"

export interface EchoNavItem {
  key: EchoNavKey
  label: string
  href: string
}

/**
 * The left column, top to bottom (contract §5, look v3 §4: Home, Explore,
 * Notifications, Saved, Scheduled, then Chat and Premium, Profile). Chat
 * opens VChat's chat; Premium the purchase page. Saved is the bookmarks list.
 */
export function echoNavItems(username: string | null | undefined): EchoNavItem[] {
  const items: EchoNavItem[] = [
    { key: "home", label: "Home", href: "/echo" },
    { key: "explore", label: "Explore", href: "/echo/explore" },
    { key: "notifications", label: "Notifications", href: "/echo/notifications" },
    { key: "bookmarks", label: "Saved", href: "/echo/bookmarks" },
    { key: "scheduled", label: "Scheduled", href: "/echo/scheduled" },
    { key: "chat", label: "Chat", href: "/messenger" },
    { key: "premium", label: "Premium", href: "/premium" },
  ]
  if (username) items.push({ key: "profile", label: "Profile", href: `/echo/${encodeURIComponent(username)}` })
  return items
}

/** More: Settings and back to VChat (Scheduled moved up into the menu, look v3 §4). */
export const ECHO_MORE_ITEMS: readonly { key: string; label: string; href: string }[] = [
  { key: "settings", label: "Settings", href: "/settings" },
  { key: "vchat", label: "Back to VChat", href: "/" },
]

/** The phone's bottom tab bar (X mobile web): Home, Explore, Notifications, Chat. */
export const ECHO_TAB_BAR_KEYS: readonly EchoNavKey[] = ["home", "explore", "notifications", "chat"]

/** Which nav item a path belongs to; null for none. */
export function activeNavKey(pathname: string, username: string | null | undefined): EchoNavKey | null {
  const p = pathname.replace(/\/+$/, "") || "/"
  if (p === "/echo") return "home"
  if (p.startsWith("/echo/explore") || p.startsWith("/echo/hashtag/")) return "explore"
  if (p.startsWith("/echo/notifications")) return "notifications"
  if (p.startsWith("/echo/bookmarks")) return "bookmarks"
  if (p.startsWith("/echo/scheduled")) return "scheduled"
  if (username && (p === `/echo/${encodeURIComponent(username)}` || p === `/echo/${username}`)) return "profile"
  return null
}

// ── Notifications ───────────────────────────────────────────────────────

export type EchoNotificationsFilter = "all" | "mentions"

/** The tab /echo/notifications?filter=mentions names; All for anything else. */
export function notificationsFilterFromParam(value: string | null | undefined): EchoNotificationsFilter {
  return value === "mentions" ? "mentions" : "all"
}

export function notificationsTabHref(filter: EchoNotificationsFilter): string {
  return filter === "mentions" ? "/echo/notifications?filter=mentions" : "/echo/notifications"
}

/**
 * The inbox GET for a tab. Mentions sends the contract's `filter=mentions`
 * (contract §4) beside the existing `category=mentions`, so whichever the
 * server reads, the list is mentions only.
 */
export function withMentionsFilter(path: string, filter: EchoNotificationsFilter): string {
  if (filter !== "mentions") return path
  return `${path}${path.includes("?") ? "&" : "?"}filter=mentions`
}

// ── Trends and list errors ──────────────────────────────────────────────

export interface Trend {
  tag: string
  noteCount: number
  rank: number
}

/** `{items:[{tag, note_count, rank}]}`; rows without a tag are dropped. */
export function parseTrends(raw: unknown): Trend[] {
  const v = unwrap(raw) as { items?: unknown } | null
  const items = v && typeof v === "object" && Array.isArray(v.items) ? v.items : []
  return items
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t, i) => ({
      tag: typeof t.tag === "string" ? t.tag.replace(/^#/, "") : "",
      noteCount: typeof t.note_count === "number" && t.note_count > 0 ? Math.floor(t.note_count) : 0,
      rank: typeof t.rank === "number" && t.rank > 0 ? Math.floor(t.rank) : i + 1,
    }))
    .filter((t) => t.tag)
    .sort((a, b) => a.rank - b.rank)
}

/**
 * A list route that is not there yet (404, the server lane still building)
 * or switched off (503) says so plainly instead of "Something went wrong".
 */
export function listUnavailable(err: unknown): boolean {
  const f = readFailure(err)
  return (f.status === 404 && f.code !== "NOTE_NOT_FOUND") || f.status === 503
}

/** "1.2K posts" / "1 post" under a trend. */
export function trendCountLabel(count: number): string {
  if (count <= 0) return ""
  if (count === 1) return "1 post"
  if (count < 1000) return `${count} posts`
  const tenths = Math.floor((count * 10) / (count < 1_000_000 ? 1000 : 1_000_000))
  const unit = count < 1_000_000 ? "K" : "M"
  return `${tenths % 10 === 0 ? tenths / 10 : (tenths / 10).toFixed(1)}${unit} posts`
}

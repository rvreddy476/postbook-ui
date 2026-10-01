import { errorCode, errorStatus, num, str } from "./model"
import { parseCreator, type CreatorCard } from "./discovery"

// Free hearts and top supporters (live surfaces contract, section 5).
// No money anywhere: a heart is a free tap.
//
//   POST /v1/livestream/streams/:id/hearts   {"count": n}  n 1..20, flushed about once a second
//        → {"data":{"heart_count": <stream total>}}
//        401 signed out · 403 BANNED_FROM_STREAM | LIVE_BANNED · 409 STREAM_NOT_LIVE
//        422 VALIDATION_ERROR · 429 RATE_LIMITED (60 hearts / 10 s / user / stream)
//   frame `hearts` {count, heart_count} — aggregated, at most one a second, no user ids
//   GET  /v1/livestream/streams/:id/supporters?limit=
//        → {"data":[{"user":{user_id,name,handle,avatar_url,badges},"hearts":n,"messages":m,"rank":k}]}
//
// Pure logic: no React, no network, no timers of its own (they are handed in).

type Obj = Record<string, unknown>

function asObj(v: unknown): Obj | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null
}

function count(v: unknown): number {
  const n = num(v)
  return n !== null && n > 0 ? Math.floor(n) : 0
}

export const HEART_BATCH_MAX = 20
export const HEART_FLUSH_MS = 1000
/** Hearts drawn at once; taps and frames past it still count, they just do not float. */
export const HEART_FLOAT_MAX = 12
export const HEART_FLOAT_MS = 2400
/** An own tap not echoed by a frame within this long is forgotten (the frame was lost). */
export const HEART_ECHO_MS = 5000
export const SUPPORTERS_REFRESH_MS = 15_000
export const SUPPORTERS_TOP = 3

export function heartsPath(streamId: string): string {
  return `/v1/livestream/streams/${encodeURIComponent(streamId)}/hearts`
}

export function supportersPath(streamId: string): string {
  return `/v1/livestream/streams/${encodeURIComponent(streamId)}/supporters`
}

/** The POST body for a batch; null when there is nothing to send. Never more than 20. */
export function heartsBody(pending: number): { count: number } | null {
  const n = Math.floor(pending)
  if (!Number.isFinite(n) || n < 1) return null
  return { count: Math.min(n, HEART_BATCH_MAX) }
}

/** `{data:{heart_count}}` → the stream total; null when the answer carries none. */
export function parseHeartsAnswer(body: unknown): number | null {
  const obj = asObj(body)
  const data = asObj(obj && "data" in obj ? obj.data : body)
  const n = num(data?.heart_count)
  return n !== null && n >= 0 ? Math.floor(n) : null
}

// ── The `hearts` frame ────────────────────────────────────────────────

export interface HeartsFrame {
  /** Hearts since the last frame. */
  count: number
  /** The stream total; 0 when the frame did not carry it. */
  heart_count: number
}

/** The payload of a `hearts` frame. A frame with neither number says nothing and is null. */
export function parseHeartsFrame(field: (key: string) => unknown): HeartsFrame | null {
  const frame = { count: count(field("count")), heart_count: count(field("heart_count")) }
  return frame.count === 0 && frame.heart_count === 0 ? null : frame
}

/**
 * A frame counts everybody's hearts, the reader's own included, and the
 * reader's own already floated when they tapped. `others` is what is left
 * to float; `ownLeft` is how many own taps are still waiting for an echo.
 */
export function splitFrameHearts(frameCount: number, ownUnechoed: number): { others: number; ownLeft: number } {
  const own = Math.min(Math.max(0, ownUnechoed), Math.max(0, frameCount))
  return { others: Math.max(0, frameCount) - own, ownLeft: Math.max(0, ownUnechoed) - own }
}

// ── Who may send ──────────────────────────────────────────────────────

export type HeartBlock = "signed_out" | "banned" | "not_live"

export const HEART_BLOCK_COPY: Record<HeartBlock, string> = {
  signed_out: "Sign in to send hearts.",
  banned: "You can't send hearts on this stream.",
  not_live: "Hearts open when the stream is live.",
}

/** Hearts are open while the stream is live or reconnecting, to a signed-in reader who is not banned. */
export function heartGate(input: { signedIn: boolean; banned: boolean; status: unknown }): HeartBlock | null {
  const status = str(input.status)
  if (status !== "live" && status !== "reconnecting") return "not_live"
  if (!input.signedIn) return "signed_out"
  if (input.banned) return "banned"
  return null
}

export type HeartFailure =
  /** The batch is gone and nothing is said (429, a network blip, anything unexpected). */
  | { kind: "drop" }
  /** Sending stops and the button says why. */
  | { kind: "block"; block: HeartBlock }

/** What a failed POST /hearts means. Branches on the code, never on the message. */
export function heartFailure(err: unknown): HeartFailure {
  const code = errorCode(err)
  if (code === "BANNED_FROM_STREAM" || code === "LIVE_BANNED") return { kind: "block", block: "banned" }
  if (code === "STREAM_NOT_LIVE") return { kind: "block", block: "not_live" }
  if (errorStatus(err) === 401) return { kind: "block", block: "signed_out" }
  return { kind: "drop" }
}

// ── Floating hearts ───────────────────────────────────────────────────

export interface FloatingHeart {
  id: number
  /** Horizontal lane, 0..1 across the layer. */
  x: number
  /** Start delay in ms so a burst does not rise as one block. */
  delay: number
}

/**
 * Adds up to `n` hearts without passing HEART_FLOAT_MAX on screen. With
 * prefers-reduced-motion nothing floats at all: the count is the feedback.
 */
export function addFloating(current: readonly FloatingHeart[], n: number, opts: { reducedMotion: boolean; nextId: number; random?: () => number }): FloatingHeart[] {
  if (opts.reducedMotion) return current as FloatingHeart[]
  const room = Math.max(0, HEART_FLOAT_MAX - current.length)
  const add = Math.min(Math.max(0, Math.floor(n)), room)
  if (add === 0) return current as FloatingHeart[]
  const random = opts.random ?? Math.random
  const out = current.slice()
  for (let i = 0; i < add; i++) out.push({ id: opts.nextId + i, x: random(), delay: i * 90 })
  return out
}

/** 950 → "950", 1 234 → "1.2K", 2 500 000 → "2.5M". */
export function heartCountLabel(n: number): string {
  const v = Math.max(0, Math.floor(n))
  if (v < 1000) return String(v)
  const [div, unit] = v < 1_000_000 ? [1000, "K"] : [1_000_000, "M"]
  const scaled = Math.floor((v / div) * 10) / 10
  return `${scaled >= 100 ? Math.floor(scaled) : scaled.toString().replace(/\.0$/, "")}${unit}`
}

// ── Controller ────────────────────────────────────────────────────────

export interface HeartsSnapshot {
  /** The stream total as shown: what the server last said plus own taps it has not counted yet. */
  count: number
  floating: FloatingHeart[]
  /** Set by a server refusal (banned, not on air, signed out); null while hearts may be sent. */
  blocked: HeartBlock | null
}

export interface HeartsDeps {
  /** POST the batch; resolves with the response body. */
  send(count: number): Promise<unknown>
  schedule(fn: () => void, ms: number): unknown
  cancel(handle: unknown): void
  now(): number
  reducedMotion(): boolean
  random?: () => number
}

/**
 * One stream's hearts: taps are batched and flushed once a second, at most
 * 20 a request; the rest of a fast burst goes in the next flush. A 429
 * quietly drops that batch. Frames add other people's hearts.
 */
export class HeartsController {
  private total = 0
  /** Taps not yet sent. */
  private queued = 0
  /** Taps in the request that is in flight. */
  private inFlight = 0
  private ownUnechoed = 0
  private lastTapAt = 0
  private floating: FloatingHeart[] = []
  private blocked: HeartBlock | null = null
  private nextId = 1
  private flushTimer: unknown = null
  private floatTimers = new Set<unknown>()
  private listeners = new Set<() => void>()
  private snapshot: HeartsSnapshot = { count: 0, floating: [], blocked: null }
  private disposed = false

  constructor(private deps: HeartsDeps) {}

  getSnapshot = (): HeartsSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** The stream row's heart_count; the total never goes down. */
  seed(total: unknown): void {
    const n = count(total)
    if (n > this.total) {
      this.total = n
      this.emit()
    }
  }

  /** One tap. False when hearts are blocked (nothing floats, nothing is queued). */
  tap(): boolean {
    if (this.disposed || this.blocked) return false
    this.queued += 1
    this.ownUnechoed += 1
    this.lastTapAt = this.deps.now()
    this.float(1)
    if (this.flushTimer === null && this.inFlight === 0) {
      this.flushTimer = this.deps.schedule(() => { void this.flush() }, HEART_FLUSH_MS)
    }
    this.emit()
    return true
  }

  /** A `hearts` frame: the total, and other people's hearts floating up. */
  frame(frame: HeartsFrame): void {
    if (this.disposed) return
    if (this.deps.now() - this.lastTapAt > HEART_ECHO_MS) this.ownUnechoed = 0
    const { others, ownLeft } = splitFrameHearts(frame.count, this.ownUnechoed)
    this.ownUnechoed = ownLeft
    this.total = frame.heart_count > 0 ? Math.max(this.total, frame.heart_count) : this.total + others
    this.float(others)
    this.emit()
  }

  /** The reader may send again (they signed in, the stream came back on air). */
  unblock(): void {
    if (!this.blocked) return
    this.blocked = null
    this.emit()
  }

  dispose(): void {
    this.disposed = true
    if (this.flushTimer !== null) this.deps.cancel(this.flushTimer)
    this.flushTimer = null
    for (const t of this.floatTimers) this.deps.cancel(t)
    this.floatTimers.clear()
    this.listeners.clear()
  }

  /** Sends one batch (at most 20). Public so a test can drive it; the timer calls it in the app. */
  async flush(): Promise<void> {
    this.flushTimer = null
    if (this.disposed || this.inFlight > 0) return
    const body = heartsBody(this.queued)
    if (!body) return
    this.queued -= body.count
    this.inFlight = body.count
    try {
      const answer = parseHeartsAnswer(await this.deps.send(body.count))
      this.total = answer !== null ? Math.max(this.total, answer) : this.total + body.count
    } catch (err) {
      // The batch is gone either way: never re-sent, so a refusal cannot loop.
      this.ownUnechoed = Math.max(0, this.ownUnechoed - body.count)
      const failure = heartFailure(err)
      if (failure.kind === "block") {
        this.blocked = failure.block
        this.ownUnechoed = Math.max(0, this.ownUnechoed - this.queued)
        this.queued = 0
      }
    } finally {
      this.inFlight = 0
    }
    if (this.disposed) return
    if (this.queued > 0) this.flushTimer = this.deps.schedule(() => { void this.flush() }, HEART_FLUSH_MS)
    this.emit()
  }

  private float(n: number): void {
    const next = addFloating(this.floating, n, { reducedMotion: this.deps.reducedMotion(), nextId: this.nextId, random: this.deps.random })
    if (next === this.floating) return
    const added = next.slice(this.floating.length)
    this.nextId += added.length
    this.floating = next
    for (const heart of added) {
      const timer = this.deps.schedule(() => {
        this.floatTimers.delete(timer)
        this.floating = this.floating.filter((h) => h.id !== heart.id)
        this.emit()
      }, HEART_FLOAT_MS + heart.delay)
      this.floatTimers.add(timer)
    }
  }

  private emit(): void {
    this.snapshot = { count: this.total + this.queued + this.inFlight, floating: this.floating, blocked: this.blocked }
    for (const listener of this.listeners) listener()
  }
}

// ── Top supporters ────────────────────────────────────────────────────

export interface Supporter {
  user: CreatorCard
  hearts: number
  messages: number
  rank: number
}

/**
 * GET /supporters. Rows without a user id are dropped; the server's order
 * is kept and a missing rank is the row's place in the list.
 */
export function parseSupporters(body: unknown): Supporter[] {
  const obj = asObj(body)
  const data = obj && "data" in obj ? obj.data : body
  if (!Array.isArray(data)) return []
  const out: Supporter[] = []
  const seen = new Set<string>()
  for (const raw of data) {
    const o = asObj(raw)
    const user = parseCreator(o?.user)
    if (!o || !user.user_id || seen.has(user.user_id)) continue
    seen.add(user.user_id)
    out.push({ user, hearts: count(o.hearts), messages: count(o.messages), rank: count(o.rank) || out.length + 1 })
  }
  return out
}

/** The avatars in the chat header. */
export function topSupporters(list: readonly Supporter[], n = SUPPORTERS_TOP): Supporter[] {
  return list.slice(0, n)
}

/** The list refreshes every 15 s while the stream is on air and stops once it is over. */
export function supportersRefetchMs(status: unknown): number | false {
  const s = str(status)
  return s === "live" || s === "reconnecting" ? SUPPORTERS_REFRESH_MS : false
}

export const SUPPORTERS_EMPTY_COPY = "Be the first to send a heart"

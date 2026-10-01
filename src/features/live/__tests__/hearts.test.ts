import { describe, expect, it } from "bun:test"

import {
  HEART_BATCH_MAX,
  HEART_BLOCK_COPY,
  HEART_ECHO_MS,
  HEART_FLOAT_MAX,
  HEART_FLUSH_MS,
  HeartsController,
  SUPPORTERS_EMPTY_COPY,
  SUPPORTERS_REFRESH_MS,
  addFloating,
  heartCountLabel,
  heartFailure,
  heartGate,
  heartsBody,
  heartsPath,
  parseHeartsAnswer,
  parseHeartsFrame,
  parseSupporters,
  splitFrameHearts,
  supportersPath,
  supportersRefetchMs,
  topSupporters,
  type FloatingHeart,
} from "../hearts"
import { parseLiveFrame } from "../realtime"

const S = "11111111-1111-4111-8111-111111111111"
const err = (code: string, status: number) => ({ response: { status, data: { error: { code } } } })

/** A controller on a hand-driven clock: timers run only when the test says so. */
function rig(opts: { reducedMotion?: boolean; send?: (n: number) => Promise<unknown> } = {}) {
  const sent: number[] = []
  let now = 1_000_000
  let seq = 0
  const timers = new Map<number, { fn: () => void; at: number }>()
  const controller = new HeartsController({
    send: opts.send ?? (async (n) => { sent.push(n); return { data: { heart_count: 0 } } }),
    schedule: (fn, ms) => { const id = ++seq; timers.set(id, { fn, at: now + ms }); return id },
    cancel: (id) => { timers.delete(id as number) },
    now: () => now,
    reducedMotion: () => opts.reducedMotion ?? false,
    random: () => 0.5,
  })
  /** Advance the clock, running every timer that comes due (flushes are awaited). */
  const advance = async (ms: number) => {
    now += ms
    for (const [id, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
      if (t.at > now) continue
      timers.delete(id)
      t.fn()
    }
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }
  return { controller, sent, advance, timers, tick: (ms: number) => { now += ms } }
}

describe("request shape", () => {
  it("POST /hearts {count}: 1..20, nothing to send below one", () => {
    expect(heartsPath(S)).toBe(`/v1/livestream/streams/${S}/hearts`)
    expect(supportersPath(S)).toBe(`/v1/livestream/streams/${S}/supporters`)
    expect(heartsBody(1)).toEqual({ count: 1 })
    expect(heartsBody(20)).toEqual({ count: 20 })
    expect(heartsBody(57)).toEqual({ count: HEART_BATCH_MAX })
    expect(heartsBody(0)).toBeNull()
    expect(heartsBody(-3)).toBeNull()
    expect(heartsBody(Number.NaN)).toBeNull()
  })
  it("the answer is {data:{heart_count}}; null when it carries none", () => {
    expect(parseHeartsAnswer({ data: { heart_count: 412 } })).toBe(412)
    expect(parseHeartsAnswer({ data: { heart_count: 0 } })).toBe(0)
    expect(parseHeartsAnswer({ data: {} })).toBeNull()
    expect(parseHeartsAnswer("")).toBeNull()
  })
})

describe("the hearts frame", () => {
  const frame = (payload: Record<string, unknown>) => ({ ...payload, type: "hearts", stream_id: S, at: "2026-10-02T10:00:00Z", payload })
  it("realtime parses {count, heart_count} at the top level and under payload", () => {
    expect(parseLiveFrame(frame({ count: 5, heart_count: 250 }))).toEqual({ kind: "hearts", stream_id: S, count: 5, heart_count: 250 })
    expect(parseLiveFrame({ type: "hearts", stream_id: S, payload: { count: 2, heart_count: 9 } })).toEqual({ kind: "hearts", stream_id: S, count: 2, heart_count: 9 })
  })
  it("zero values fall through: an omitted number is 0, and a frame with neither says nothing", () => {
    expect(parseLiveFrame(frame({ count: 3 }))).toEqual({ kind: "hearts", stream_id: S, count: 3, heart_count: 0 })
    expect(parseLiveFrame(frame({ heart_count: 40 }))).toEqual({ kind: "hearts", stream_id: S, count: 0, heart_count: 40 })
    expect(parseLiveFrame(frame({}))).toBeNull()
    expect(parseLiveFrame(frame({ count: null, heart_count: "12" }))).toBeNull()
    expect(parseHeartsFrame(() => -4)).toBeNull()
  })
  it("a frame without a stream id is not a room frame", () => {
    expect(parseLiveFrame({ type: "hearts", count: 3 })).toBeNull()
  })
  it("own taps already floated: only other people's hearts are left to float", () => {
    expect(splitFrameHearts(5, 2)).toEqual({ others: 3, ownLeft: 0 })
    expect(splitFrameHearts(2, 5)).toEqual({ others: 0, ownLeft: 3 })
    expect(splitFrameHearts(4, 0)).toEqual({ others: 4, ownLeft: 0 })
    expect(splitFrameHearts(0, 3)).toEqual({ others: 0, ownLeft: 3 })
  })
})

describe("who may send", () => {
  it("open while live or reconnecting, to a signed-in reader who is not banned", () => {
    expect(heartGate({ signedIn: true, banned: false, status: "live" })).toBeNull()
    expect(heartGate({ signedIn: true, banned: false, status: "reconnecting" })).toBeNull()
  })
  it("signed out, banned and off air each get their own copy", () => {
    expect(heartGate({ signedIn: false, banned: false, status: "live" })).toBe("signed_out")
    expect(heartGate({ signedIn: true, banned: true, status: "live" })).toBe("banned")
    for (const status of ["scheduled", "starting", "ended", "failed", "", undefined]) expect(heartGate({ signedIn: true, banned: false, status })).toBe("not_live")
    expect(HEART_BLOCK_COPY.signed_out).toBe("Sign in to send hearts.")
    expect(HEART_BLOCK_COPY.not_live).toBe("Hearts open when the stream is live.")
    expect(HEART_BLOCK_COPY.banned).toBe("You can't send hearts on this stream.")
  })
  it("a refusal is read from the code: 429 drops quietly, bans and off-air block", () => {
    expect(heartFailure(err("RATE_LIMITED", 429))).toEqual({ kind: "drop" })
    expect(heartFailure(err("VALIDATION_ERROR", 422))).toEqual({ kind: "drop" })
    expect(heartFailure(new Error("network"))).toEqual({ kind: "drop" })
    expect(heartFailure(err("BANNED_FROM_STREAM", 403))).toEqual({ kind: "block", block: "banned" })
    expect(heartFailure(err("LIVE_BANNED", 403))).toEqual({ kind: "block", block: "banned" })
    expect(heartFailure(err("STREAM_NOT_LIVE", 409))).toEqual({ kind: "block", block: "not_live" })
    expect(heartFailure(err("", 401))).toEqual({ kind: "block", block: "signed_out" })
  })
})

describe("floating hearts", () => {
  const some = (n: number): FloatingHeart[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, x: 0.5, delay: 0 }))
  it("never more than 12 on screen", () => {
    expect(addFloating([], 5, { reducedMotion: false, nextId: 1 })).toHaveLength(5)
    expect(addFloating(some(10), 5, { reducedMotion: false, nextId: 11 })).toHaveLength(HEART_FLOAT_MAX)
    const full = some(HEART_FLOAT_MAX)
    expect(addFloating(full, 3, { reducedMotion: false, nextId: 99 })).toBe(full)
    expect(addFloating([], 500, { reducedMotion: false, nextId: 1 })).toHaveLength(HEART_FLOAT_MAX)
  })
  it("with prefers-reduced-motion nothing floats: the count is the feedback", () => {
    const none: FloatingHeart[] = []
    expect(addFloating(none, 5, { reducedMotion: true, nextId: 1 })).toBe(none)
  })
  it("ids are unique and a burst is staggered", () => {
    const out = addFloating(some(1), 3, { reducedMotion: false, nextId: 7, random: () => 0.25 })
    expect(out.map((h) => h.id)).toEqual([1, 7, 8, 9])
    expect(out.slice(1).map((h) => h.delay)).toEqual([0, 90, 180])
    expect(out[1].x).toBe(0.25)
  })
  it("the count label", () => {
    expect(heartCountLabel(0)).toBe("0")
    expect(heartCountLabel(950)).toBe("950")
    expect(heartCountLabel(1234)).toBe("1.2K")
    expect(heartCountLabel(15_000)).toBe("15K")
    expect(heartCountLabel(2_500_000)).toBe("2.5M")
  })
})

describe("HeartsController: batching", () => {
  it("taps are batched and flushed once, a second after the first tap", async () => {
    const r = rig()
    r.controller.seed(100)
    for (let i = 0; i < 5; i++) r.controller.tap()
    expect(r.sent).toEqual([]) // nothing leaves on a tap
    expect(r.controller.getSnapshot().count).toBe(105) // the count answers at once
    await r.advance(HEART_FLUSH_MS - 1)
    expect(r.sent).toEqual([])
    await r.advance(1)
    expect(r.sent).toEqual([5])
  })

  it("a burst over 20 goes out as 20, then the rest a second later", async () => {
    const r = rig()
    for (let i = 0; i < 47; i++) r.controller.tap()
    await r.advance(HEART_FLUSH_MS)
    expect(r.sent).toEqual([20])
    await r.advance(HEART_FLUSH_MS)
    expect(r.sent).toEqual([20, 20])
    await r.advance(HEART_FLUSH_MS)
    expect(r.sent).toEqual([20, 20, 7])
    await r.advance(HEART_FLUSH_MS * 3)
    expect(r.sent).toEqual([20, 20, 7]) // nothing left: no empty request
  })

  it("the server's total replaces the guess and never lowers the count", async () => {
    const r = rig({ send: async () => ({ data: { heart_count: 500 } }) })
    r.controller.seed(100)
    r.controller.tap()
    await r.advance(HEART_FLUSH_MS)
    expect(r.controller.getSnapshot().count).toBe(500)
    r.controller.seed(120) // a stale row
    expect(r.controller.getSnapshot().count).toBe(500)
  })

  it("an answer without a total still counts the batch", async () => {
    const r = rig({ send: async () => ({}) })
    r.controller.seed(10)
    r.controller.tap()
    r.controller.tap()
    await r.advance(HEART_FLUSH_MS)
    expect(r.controller.getSnapshot().count).toBe(12)
  })

  it("subscribers hear every change; dispose cancels the pending flush", async () => {
    const r = rig()
    let calls = 0
    const off = r.controller.subscribe(() => { calls += 1 })
    r.controller.tap()
    expect(calls).toBe(1)
    off()
    r.controller.tap()
    expect(calls).toBe(1)
    r.controller.dispose()
    await r.advance(HEART_FLUSH_MS * 2)
    expect(r.sent).toEqual([])
    expect(r.controller.tap()).toBe(false)
  })
})

describe("HeartsController: errors", () => {
  it("a 429 quietly drops that batch: no block, no retry, the count gives the hearts back", async () => {
    let calls = 0
    const r = rig({ send: async () => { calls += 1; throw err("RATE_LIMITED", 429) } })
    r.controller.seed(100)
    for (let i = 0; i < 4; i++) r.controller.tap()
    await r.advance(HEART_FLUSH_MS)
    expect(calls).toBe(1)
    expect(r.controller.getSnapshot()).toMatchObject({ count: 100, blocked: null })
    await r.advance(HEART_FLUSH_MS * 3)
    expect(calls).toBe(1) // the dropped batch is never sent again
    expect(r.controller.tap()).toBe(true) // and the button still works
  })

  it("a ban stops sending, empties the queue and says so", async () => {
    let calls = 0
    const r = rig({ send: async () => { calls += 1; throw err("BANNED_FROM_STREAM", 403) } })
    for (let i = 0; i < 30; i++) r.controller.tap()
    await r.advance(HEART_FLUSH_MS)
    expect(r.controller.getSnapshot()).toMatchObject({ count: 0, blocked: "banned" })
    await r.advance(HEART_FLUSH_MS * 3)
    expect(calls).toBe(1) // the 10 still queued are not sent
    expect(r.controller.tap()).toBe(false)
  })

  it("STREAM_NOT_LIVE blocks until the page lifts it", async () => {
    const r = rig({ send: async () => { throw err("STREAM_NOT_LIVE", 409) } })
    r.controller.tap()
    await r.advance(HEART_FLUSH_MS)
    expect(r.controller.getSnapshot().blocked).toBe("not_live")
    r.controller.unblock()
    expect(r.controller.getSnapshot().blocked).toBeNull()
  })
})

describe("HeartsController: frames and floating", () => {
  it("other people's hearts float and raise the total", () => {
    const r = rig()
    r.controller.seed(10)
    r.controller.frame({ count: 4, heart_count: 14 })
    expect(r.controller.getSnapshot().count).toBe(14)
    expect(r.controller.getSnapshot().floating).toHaveLength(4)
  })

  it("a frame without a total adds what it counted", () => {
    const r = rig()
    r.controller.seed(10)
    r.controller.frame({ count: 3, heart_count: 0 })
    expect(r.controller.getSnapshot().count).toBe(13)
  })

  it("own taps float once: the frame that echoes them floats only the others", async () => {
    const r = rig({ send: async () => ({ data: { heart_count: 12 } }) })
    r.controller.seed(10)
    r.controller.tap()
    r.controller.tap()
    expect(r.controller.getSnapshot().floating).toHaveLength(2)
    await r.advance(HEART_FLUSH_MS)
    r.controller.frame({ count: 5, heart_count: 15 }) // 2 mine + 3 others
    expect(r.controller.getSnapshot().floating).toHaveLength(5)
    expect(r.controller.getSnapshot().count).toBe(15)
  })

  it("an echo that never came is forgotten, so later frames float in full", () => {
    const r = rig()
    r.controller.tap()
    r.tick(HEART_ECHO_MS + 1)
    r.controller.frame({ count: 3, heart_count: 0 })
    expect(r.controller.getSnapshot().floating).toHaveLength(4) // my 1 + all 3
  })

  it("the on-screen cap holds across taps and frames; hearts leave after their rise", async () => {
    const r = rig()
    for (let i = 0; i < 9; i++) r.controller.tap()
    r.controller.frame({ count: 40, heart_count: 0 })
    expect(r.controller.getSnapshot().floating).toHaveLength(HEART_FLOAT_MAX)
    await r.advance(10_000)
    expect(r.controller.getSnapshot().floating).toHaveLength(0)
  })

  it("with reduced motion nothing floats, and the count still moves", () => {
    const r = rig({ reducedMotion: true })
    r.controller.tap()
    r.controller.frame({ count: 6, heart_count: 30 })
    expect(r.controller.getSnapshot().floating).toHaveLength(0)
    expect(r.controller.getSnapshot().count).toBe(31)
  })
})

describe("top supporters", () => {
  const body = {
    data: [
      { user: { user_id: "u1", name: "Asha", handle: "asha", avatar_url: "/a.png", badges: ["founding_creator"] }, hearts: 120, messages: 4, rank: 1 },
      { user: { user_id: "u2" }, rank: 2 }, // name, hearts and messages omitted (zero values)
      { user: { user_id: "u1", name: "Again" }, hearts: 1, rank: 3 },
      { user: {}, hearts: 9 },
      { hearts: 9 },
    ],
  }
  it("rows: the user card, hearts, messages, rank; zero values fall through; rows without a user are dropped", () => {
    expect(parseSupporters(body)).toEqual([
      { user: { user_id: "u1", name: "Asha", handle: "asha", avatar_url: "/a.png", badges: ["founding_creator"] }, hearts: 120, messages: 4, rank: 1 },
      { user: { user_id: "u2", name: "", handle: "", avatar_url: "", badges: [] }, hearts: 0, messages: 0, rank: 2 },
    ])
    expect(parseSupporters({ data: null })).toEqual([])
    expect(parseSupporters(undefined)).toEqual([])
  })
  it("a missing rank is the row's place in the list", () => {
    expect(parseSupporters({ data: [{ user: { user_id: "a" }, hearts: 3 }, { user: { user_id: "b" }, hearts: 1 }] }).map((s) => s.rank)).toEqual([1, 2])
  })
  it("the header shows three; the list refreshes every 15 s only while on air", () => {
    const four = parseSupporters({ data: ["a", "b", "c", "d"].map((id) => ({ user: { user_id: id }, hearts: 1 })) })
    expect(topSupporters(four).map((s) => s.user.user_id)).toEqual(["a", "b", "c"])
    expect(supportersRefetchMs("live")).toBe(SUPPORTERS_REFRESH_MS)
    expect(supportersRefetchMs("reconnecting")).toBe(15_000)
    expect(supportersRefetchMs("ended")).toBe(false)
    expect(supportersRefetchMs("scheduled")).toBe(false)
    expect(SUPPORTERS_EMPTY_COPY).toBe("Be the first to send a heart")
  })
})

import { describe, expect, it } from "bun:test"

import {
  EMPTY_STREAM_FORM,
  FOUNDING_BADGE,
  LIVE_ROUTES,
  RoomSlot,
  categoryLabel,
  createInputFromForm,
  creatorHref,
  creatorName,
  formFromRow,
  formatCountdown,
  formatLocalDateTime,
  foundingNewlyEarned,
  hasFoundingBadge,
  heroShouldConnect,
  isLive,
  isoToLocalInput,
  liveByCreator,
  liveNowParams,
  liveOnly,
  liveWatchHref,
  localInputToIso,
  msUntil,
  nextReminder,
  parseBadges,
  parseCreator,
  parseLiveCategories,
  parseLiveCreators,
  parseReminder,
  parseStream,
  parseStreamPage,
  parseUserBadges,
  patchReminder,
  pickHero,
  recordingHref,
  reminderCountLabel,
  reminderErrorCopy,
  reminderRequest,
  rowStatusView,
  scheduleErrorCopy,
  streamCreateBody,
  streamPatchBody,
  toggleReminder,
  upcomingOnly,
  upcomingParams,
  userStreamsParams,
  validateStreamForm,
  watchState,
  type ReminderHttp,
  type ReminderState,
  type ReminderStore,
  type StreamRow,
} from "../discovery"

/*
  Fixtures shaped like the live surfaces contract (2 Oct 2026, section 1).
  The backend's golden files (testdata/contracts/live/) did not exist when
  this was written; when they land, copy them next to
  contracts/mtube/livestreams_scheduled.json and read them here.
*/
const S1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const S2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const U1 = "11111111-1111-4111-8111-111111111111"

/** A live list row with every contract field set. */
const LIVE_ROW = {
  id: S1,
  creator_user_id: U1,
  livekit_room: "live_" + S1,
  title: "Sunday build",
  description: "Soldering a router",
  cover_media_id: "55555555-5555-4555-8555-555555555555",
  status: "live",
  visibility: "public",
  started_at: "2026-10-02T10:00:00Z",
  viewer_peak: 40,
  viewer_count: 31,
  heart_count: 250,
  ended_reason: null,
  status_changed_at: "2026-10-02T10:00:05Z",
  source: "encoder",
  orientation: "landscape",
  category: "technology",
  creator: { user_id: U1, name: "Raghu Builds", handle: "raghu.builds", avatar_url: "/v1/media/a1/serve", badges: ["founding_creator"] },
  created_at: "2026-10-02T09:50:00Z",
  updated_at: "2026-10-02T10:00:05Z",
}

/** The same row as Go writes it with every zero value omitted (omitempty). */
const BARE_ROW = { id: S2, creator_user_id: U1, livekit_room: "r", title: "Untitled", status: "scheduled", visibility: "followers", created_at: "2026-10-02T09:00:00Z", updated_at: "2026-10-02T09:00:00Z" }

const UPCOMING_ROW = { ...BARE_ROW, scheduled_at: "2026-10-05T12:30:00Z", reminder_set: true, reminder_count: 7, orientation: "portrait", creator: { user_id: U1 } }

const row = (extra: Partial<StreamRow> = {}): StreamRow => ({ ...(parseStream(LIVE_ROW) as StreamRow), ...extra })

describe("stream row parsing", () => {
  it("reads every contract field of a full row", () => {
    expect(parseStream(LIVE_ROW)).toEqual({
      id: S1,
      creator_user_id: U1,
      title: "Sunday build",
      description: "Soldering a router",
      status: "live",
      visibility: "public",
      orientation: "landscape",
      category: "technology",
      cover_media_id: "55555555-5555-4555-8555-555555555555",
      scheduled_at: "",
      started_at: "2026-10-02T10:00:00Z",
      ended_at: "",
      ended_reason: "",
      viewer_count: 31,
      viewer_peak: 40,
      heart_count: 250,
      source: "encoder",
      creator: { user_id: U1, name: "Raghu Builds", handle: "raghu.builds", avatar_url: "/v1/media/a1/serve", badges: ["founding_creator"] },
      reminder_set: false,
      reminder_count: 0,
      recording_post_id: "",
      recording_url: "",
      created_at: "2026-10-02T09:50:00Z",
    })
  })

  it("zero values fall through: an absent field, null, \"\" and 0 all read as nothing", () => {
    const bare = parseStream(BARE_ROW) as StreamRow
    expect(bare.orientation).toBe("landscape") // the default, not an error
    expect(bare.category).toBe("")
    expect(bare.cover_media_id).toBe("")
    expect(bare.viewer_count).toBe(0)
    expect(bare.heart_count).toBe(0)
    expect(bare.reminder_set).toBe(false)
    expect(bare.reminder_count).toBe(0)
    expect(bare.recording_post_id).toBe("")
    expect(bare.source).toBe("device")
    // No creator card at all: the row's creator_user_id stands in and nothing else is invented.
    expect(bare.creator).toEqual({ user_id: U1, name: "", handle: "", avatar_url: "", badges: [] })
    const nulls = parseStream({ ...BARE_ROW, orientation: "", category: null, creator: null, reminder_count: null, recording_post_id: null, heart_count: null, scheduled_at: null }) as StreamRow
    expect(nulls.orientation).toBe("landscape")
    expect(nulls.category).toBe("")
    expect(nulls.creator.user_id).toBe(U1)
    expect(nulls.scheduled_at).toBe("")
    expect(nulls.recording_post_id).toBe("")
  })

  it("a creator card that only has user_id (the lookup failed) is kept as that", () => {
    const up = parseStream(UPCOMING_ROW) as StreamRow
    expect(up.creator).toEqual({ user_id: U1, name: "", handle: "", avatar_url: "", badges: [] })
    expect(creatorName(up.creator)).toBe("Creator")
    expect(creatorHref(up.creator)).toBe(`/posttube/channel/${U1}`)
    expect(up.orientation).toBe("portrait")
    expect(up.reminder_set).toBe(true)
    expect(up.reminder_count).toBe(7)
  })

  it("unknown orientation and status never become a known one; a row without an id is dropped", () => {
    expect((parseStream({ ...LIVE_ROW, orientation: "square" }) as StreamRow).orientation).toBe("landscape")
    expect((parseStream({ ...LIVE_ROW, status: "paused" }) as StreamRow).status).toBe("unknown")
    expect(parseStream({ ...LIVE_ROW, id: "" })).toBeNull()
    expect(parseStream(null)).toBeNull()
    expect(parseStream("x")).toBeNull()
  })

  it("names: the name, else @handle, else Creator; the channel link prefers the handle", () => {
    expect(creatorName(parseCreator(LIVE_ROW.creator))).toBe("Raghu Builds")
    expect(creatorName(parseCreator({ user_id: U1, handle: "@raghu" }))).toBe("@raghu")
    expect(creatorHref(parseCreator(LIVE_ROW.creator))).toBe("/posttube/channel/raghu.builds")
    expect(creatorHref(parseCreator(null))).toBe("")
  })

  it("a page is data[] + meta.next_cursor; repeats and id-less rows are dropped; the last page has no cursor", () => {
    const page = parseStreamPage({ data: [LIVE_ROW, LIVE_ROW, { title: "no id" }, UPCOMING_ROW], meta: { next_cursor: "c2" } })
    expect(page.items.map((r) => r.id)).toEqual([S1, S2])
    expect(page.next_cursor).toBe("c2")
    expect(parseStreamPage({ data: [], meta: {} })).toEqual({ items: [], next_cursor: "" })
    expect(parseStreamPage({ data: null })).toEqual({ items: [], next_cursor: "" })
    expect(parseStreamPage(undefined)).toEqual({ items: [], next_cursor: "" })
  })
})

describe("categories/live and creators/live", () => {
  it("categories: slug, label, counts; a category with nobody live is not a rail", () => {
    expect(
      parseLiveCategories({
        data: [
          { slug: "gaming", label: "Gaming", live_count: 3, viewer_count: 120 },
          { slug: "music", live_count: 1 }, // label and viewer_count omitted (zero values)
          { slug: "news", label: "News", live_count: 0, viewer_count: 0 },
          { slug: "gaming", label: "Again", live_count: 9 },
          { label: "No slug", live_count: 2 },
        ],
      }),
    ).toEqual([
      { slug: "gaming", label: "Gaming", live_count: 3, viewer_count: 120 },
      { slug: "music", label: "Music", live_count: 1, viewer_count: 0 },
    ])
    expect(parseLiveCategories({ data: null })).toEqual([])
    expect(categoryLabel("science-tech")).toBe("Science Tech")
    expect(categoryLabel("gaming", [{ slug: "gaming", label: "Games" }])).toBe("Games")
    expect(categoryLabel("")).toBe("")
  })

  it("creators: the card, the stream and the audience; rows that cannot be opened are dropped", () => {
    const rows = parseLiveCreators({
      data: [
        { creator: LIVE_ROW.creator, stream_id: S1, viewer_count: 31, orientation: "landscape" },
        { creator: { user_id: "u2" }, stream_id: S2 }, // viewer_count 0 and orientation omitted
        { creator: { user_id: "u3" } },
        { stream_id: "s9" },
      ],
    })
    expect(rows.map((r) => [r.creator.user_id, r.stream_id, r.viewer_count, r.orientation])).toEqual([
      [U1, S1, 31, "landscape"],
      ["u2", S2, 0, "landscape"],
    ])
    expect(liveByCreator(rows).get("u2")?.stream_id).toBe(S2)
    expect(parseLiveCreators({})).toEqual([])
  })
})

describe("never Live unless status === \"live\"", () => {
  it("isLive is true for live only", () => {
    for (const status of ["scheduled", "starting", "reconnecting", "ended", "failed", "unknown"] as const) expect(isLive(row({ status }))).toBe(false)
    expect(isLive(row({ status: "live" }))).toBe(true)
    expect(isLive(null)).toBe(false)
    expect(liveOnly([row({ id: "a" }), row({ id: "b", status: "reconnecting" }), row({ id: "c", status: "ended" })]).map((r) => r.id)).toEqual(["a"])
  })

  it("upcomingOnly keeps scheduled rows still ahead, soonest first", () => {
    const now = Date.parse("2026-10-02T12:00:00Z")
    const rows = [
      row({ id: "late", status: "scheduled", scheduled_at: "2026-10-02T11:00:00Z" }),
      row({ id: "b", status: "scheduled", scheduled_at: "2026-10-04T11:00:00Z" }),
      row({ id: "a", status: "scheduled", scheduled_at: "2026-10-03T11:00:00Z" }),
      row({ id: "live", status: "live", scheduled_at: "2026-10-03T11:00:00Z" }),
    ]
    expect(upcomingOnly(rows, now).map((r) => r.id)).toEqual(["a", "b"])
  })
})

describe("list request shapes", () => {
  it("live now: status is always sent; a filter only when set", () => {
    expect(liveNowParams()).toEqual({ status: "live", limit: "24" })
    expect(liveNowParams({ orientation: "landscape", category: "gaming", following: true, sort: "viewers", limit: 8, cursor: "c2" })).toEqual({
      status: "live", orientation: "landscape", category: "gaming", following: "true", sort: "viewers", limit: "8", cursor: "c2",
    })
    expect("following" in liveNowParams({ following: false })).toBe(false)
    expect("category" in liveNowParams({ category: "" })).toBe(false)
  })
  it("upcoming and a creator's streams", () => {
    expect(upcomingParams({ orientation: "portrait", following: true })).toEqual({ orientation: "portrait", following: "true", limit: "12" })
    expect(userStreamsParams("past", { cursor: "p2" })).toEqual({ status: "past", limit: "12", cursor: "p2" })
    expect(LIVE_ROUTES.upcoming).toBe("/v1/livestream/streams/upcoming")
    expect(LIVE_ROUTES.categories).toBe("/v1/livestream/categories/live")
    expect(LIVE_ROUTES.creators).toBe("/v1/livestream/creators/live")
    expect(LIVE_ROUTES.userStreams(U1)).toBe(`/v1/livestream/users/${U1}/streams`)
    expect(LIVE_ROUTES.userBadges(U1)).toBe(`/v1/livestream/users/${U1}/badges`)
    expect(LIVE_ROUTES.stream("a/b")).toBe("/v1/livestream/streams/a%2Fb")
  })
})

describe("watch page state", () => {
  const NOW = Date.parse("2026-10-02T12:00:00Z")
  it("live: the player, the chat and the Live badge", () => {
    expect(watchState(row({ status: "live" }), NOW)).toMatchObject({ kind: "live", player: true, liveBadge: true, chat: true, canRemind: false })
  })
  it("reconnecting keeps the player but is not badged Live", () => {
    expect(watchState(row({ status: "reconnecting" }), NOW)).toMatchObject({ kind: "live", player: true, liveBadge: false })
  })
  it("starting: no player yet, chat visible", () => {
    expect(watchState(row({ status: "starting" }), NOW)).toMatchObject({ kind: "starting", player: false, chat: true, liveBadge: false })
  })
  it("scheduled: the waiting page with Notify me; the countdown only while the time is ahead", () => {
    expect(watchState(row({ status: "scheduled", scheduled_at: "2026-10-02T13:00:00Z" }), NOW)).toMatchObject({ kind: "waiting", player: false, chat: false, canRemind: true, countdown: true, liveBadge: false })
    expect(watchState(row({ status: "scheduled", scheduled_at: "2026-10-02T11:00:00Z" }), NOW).countdown).toBe(false)
    expect(watchState(row({ status: "scheduled", scheduled_at: "" }), NOW).countdown).toBe(false)
  })
  it("ended with a recording that became a video links to the watch page", () => {
    const s = watchState(row({ status: "ended", recording_post_id: "p1", recording_url: "https://cdn/x.mp4" }), NOW)
    expect(s).toMatchObject({ kind: "ended", player: false, chat: false, recordingHref: "/posttube/watch/p1", recordingUrl: "" })
  })
  it("ended with only a file plays the file; ended with nothing has neither", () => {
    expect(watchState(row({ status: "ended", recording_url: "https://cdn/x.mp4" }), NOW)).toMatchObject({ kind: "ended", recordingHref: "", recordingUrl: "https://cdn/x.mp4" })
    expect(watchState(row({ status: "ended" }), NOW)).toMatchObject({ kind: "ended", recordingHref: "", recordingUrl: "" })
  })
  it("failed and unknown never show a player", () => {
    expect(watchState(row({ status: "failed" }), NOW)).toMatchObject({ kind: "failed", player: false })
    expect(watchState(row({ status: "unknown" }), NOW)).toMatchObject({ kind: "unavailable", player: false, liveBadge: false })
  })
  it("the ended panel states the reason; links follow the row", () => {
    expect(rowStatusView(row({ status: "ended", ended_reason: "host_ended" })).body).toBe("The host ended the stream.")
    expect(rowStatusView(row({ status: "scheduled", scheduled_at: "" })).kind).toBe("scheduled")
    expect(liveWatchHref(row())).toBe(`/posttube/live/${S1}`)
    expect(liveWatchHref(row({ orientation: "portrait" }))).toBe(`/reels/live/${S1}`)
    expect(liveWatchHref({ id: S1 })).toBe(`/posttube/live/${S1}`)
    expect(recordingHref(row({ recording_post_id: "" }))).toBe("")
  })
})

describe("countdown and local time", () => {
  it("formats by the largest unit that matters", () => {
    const s = 1000, m = 60 * s, h = 60 * m, d = 24 * h
    expect(formatCountdown(2 * d + 4 * h + 10 * m)).toBe("2d 4h")
    expect(formatCountdown(d)).toBe("1d 0h")
    expect(formatCountdown(4 * h + 5 * m + 9 * s)).toBe("4h 05m")
    expect(formatCountdown(5 * m + 9 * s)).toBe("5m 09s")
    expect(formatCountdown(60 * s)).toBe("1m 00s")
    expect(formatCountdown(42 * s)).toBe("42s")
    expect(formatCountdown(400)).toBe("1s") // rounds up: never "0s" while time is left
  })
  it("zero, the past and nonsense read Starting soon", () => {
    expect(formatCountdown(0)).toBe("Starting soon")
    expect(formatCountdown(-5000)).toBe("Starting soon")
    expect(formatCountdown(Number.NaN)).toBe("Starting soon")
  })
  it("msUntil: the gap to an instant, null when it does not parse", () => {
    expect(msUntil("2026-10-02T12:00:10Z", Date.parse("2026-10-02T12:00:00Z"))).toBe(10_000)
    expect(msUntil("", 0)).toBeNull()
    expect(msUntil(null, 0)).toBeNull()
  })
  it("a stream's time is shown in the viewer's zone, with the zone named", () => {
    const iso = "2026-10-05T12:30:00Z"
    expect(formatLocalDateTime(iso, "en-GB", "Asia/Kolkata")).toContain("18:00")
    expect(formatLocalDateTime(iso, "en-GB", "America/New_York")).toContain("08:30")
    expect(formatLocalDateTime(iso, "en-GB", "Asia/Kolkata")).not.toBe(formatLocalDateTime(iso, "en-GB", "America/New_York"))
    expect(formatLocalDateTime("nope")).toBe("")
    expect(formatLocalDateTime(null)).toBe("")
  })
})

describe("schedule form", () => {
  const NOW = new Date(2026, 9, 2, 12, 0).getTime()
  it("the title is required and capped at 140", () => {
    expect(validateStreamForm({ title: "   ", scheduledLocal: "" }, { now: NOW })).toMatchObject({ ok: false, errors: { title: "Give your stream a title." } })
    expect(validateStreamForm({ title: "x".repeat(141), scheduledLocal: "" }, { now: NOW }).ok).toBe(false)
    expect(validateStreamForm({ title: "x".repeat(140), scheduledLocal: "" }, { now: NOW }).ok).toBe(true)
  })
  it("a time must be in the future", () => {
    expect(validateStreamForm({ title: "Show", scheduledLocal: "2026-10-02T11:59" }, { now: NOW })).toMatchObject({ ok: false, errors: { scheduled_at: "Choose a time in the future." }, scheduled_at: null })
    expect(validateStreamForm({ title: "Show", scheduledLocal: "2026-10-02T12:00" }, { now: NOW }).ok).toBe(false) // now is not the future
    const ok = validateStreamForm({ title: "Show", scheduledLocal: "2026-10-02T12:01" }, { now: NOW })
    expect(ok.ok).toBe(true)
    expect(ok.scheduled_at).toBe(new Date(2026, 9, 2, 12, 1).toISOString())
  })
  it("no time: fine for going live now, an error when scheduling", () => {
    expect(validateStreamForm({ title: "Show", scheduledLocal: "" }, { now: NOW })).toEqual({ ok: true, errors: {}, scheduled_at: null })
    expect(validateStreamForm({ title: "Show", scheduledLocal: "" }, { now: NOW, requireTime: true })).toMatchObject({ ok: false, errors: { scheduled_at: "Choose a date and time." } })
  })
  it("a value that is not a date is refused", () => {
    expect(validateStreamForm({ title: "Show", scheduledLocal: "tomorrow" }, { now: NOW })).toMatchObject({ ok: false, errors: { scheduled_at: "That date and time isn't valid." } })
  })
  it("datetime-local values are the viewer's wall clock, both ways", () => {
    const iso = localInputToIso("2026-10-05T18:30")
    expect(iso).toBe(new Date(2026, 9, 5, 18, 30).toISOString())
    expect(isoToLocalInput(iso)).toBe("2026-10-05T18:30")
    expect(localInputToIso("")).toBe("")
    expect(isoToLocalInput("nope")).toBe("")
  })
})

describe("create and PATCH request shapes", () => {
  it("create: the old fields, plus orientation when chosen and category only when set", () => {
    expect(streamCreateBody({ title: "Show", visibility: "public" })).toEqual({ title: "Show", description: "", visibility: "public", cover_media_id: null, scheduled_at: null })
    expect(
      streamCreateBody({ title: "Show", description: "d", visibility: "followers", cover_media_id: "m1", scheduled_at: "2026-10-05T12:30:00.000Z", source: "encoder", orientation: "portrait", category: "music" }),
    ).toEqual({ title: "Show", description: "d", visibility: "followers", cover_media_id: "m1", scheduled_at: "2026-10-05T12:30:00.000Z", source: "encoder", orientation: "portrait", category: "music" })
    expect("category" in streamCreateBody({ title: "Show", visibility: "public", category: "" })).toBe(false)
  })
  it("a checked form becomes the create input (trimmed; no empty category)", () => {
    const input = createInputFromForm({ ...EMPTY_STREAM_FORM, title: "  Show  ", description: " d ", orientation: "portrait" }, "2026-10-05T12:30:00.000Z")
    expect(input).toEqual({ title: "Show", description: "d", visibility: "public", cover_media_id: null, scheduled_at: "2026-10-05T12:30:00.000Z", source: "device", orientation: "portrait", category: undefined })
  })
  it("PATCH carries only what changed", () => {
    const original = row({ status: "scheduled", scheduled_at: "2026-10-05T12:30:00Z", source: "device" })
    const form = formFromRow(original)
    expect(streamPatchBody(original, form, "2026-10-05T12:30:00.000Z")).toEqual({})
    expect(streamPatchBody(original, { ...form, title: " New title " }, "2026-10-05T12:30:00.000Z")).toEqual({ title: "New title" })
    expect(streamPatchBody(original, { ...form, category: "", visibility: "followers", orientation: "portrait", cover_media_id: "m2" }, "2026-10-06T08:00:00.000Z")).toEqual({
      category: "", visibility: "followers", orientation: "portrait", cover_media_id: "m2", scheduled_at: "2026-10-06T08:00:00.000Z",
    })
  })
  it("PATCH never sends the source, whatever the form says", () => {
    const original = row({ status: "scheduled", scheduled_at: "2026-10-05T12:30:00Z", source: "device" })
    const body = streamPatchBody(original, { ...formFromRow(original), source: "encoder", title: "T" }, null)
    expect(Object.keys(body)).toEqual(["title"])
  })
  it("refusals read as people would say them", () => {
    const err = (code: string, status = 422) => ({ response: { status, data: { error: { code } } } })
    expect(scheduleErrorCopy(err("INVALID_CATEGORY"))).toBe("That topic isn't available. Choose another.")
    expect(scheduleErrorCopy(err("STREAM_STATE_CONFLICT", 409))).toContain("can't be edited")
    expect(scheduleErrorCopy(err("", 401))).toBe("Sign in to schedule a stream.")
    expect(scheduleErrorCopy(new Error("x"))).toBe("We couldn't save your stream. Try again.")
  })
})

describe("reminders", () => {
  it("the answer is {data:{reminder_set, reminder_count}}; zero values fall through", () => {
    expect(parseReminder({ data: { reminder_set: true, reminder_count: 8 } })).toEqual({ reminder_set: true, reminder_count: 8 })
    expect(parseReminder({ data: {} })).toEqual({ reminder_set: false, reminder_count: 0 }) // false and 0 omitted
    expect(parseReminder({ data: null })).toBeNull()
    expect(parseReminder(undefined)).toBeNull()
  })
  it("request shape: PUT sets, DELETE clears, same path, no body", () => {
    expect(reminderRequest(S1, true)).toEqual({ method: "put", url: `/v1/livestream/streams/${S1}/reminder` })
    expect(reminderRequest(S1, false)).toEqual({ method: "delete", url: `/v1/livestream/streams/${S1}/reminder` })
  })
  it("the optimistic step moves the count by one and never below zero", () => {
    expect(nextReminder({ reminder_set: false, reminder_count: 7 }, true)).toEqual({ reminder_set: true, reminder_count: 8 })
    expect(nextReminder({ reminder_set: true, reminder_count: 8 }, false)).toEqual({ reminder_set: false, reminder_count: 7 })
    expect(nextReminder({ reminder_set: true, reminder_count: 0 }, false)).toEqual({ reminder_set: false, reminder_count: 0 })
    const same = { reminder_set: true, reminder_count: 3 }
    expect(nextReminder(same, true)).toBe(same)
  })

  function harness(initial: ReminderState) {
    const cache = new Map<string, ReminderState>([[S1, initial]])
    const writes: ReminderState[] = []
    const store: ReminderStore<Map<string, ReminderState>> = {
      read: (id) => cache.get(id) ?? null,
      write: (id, state) => { cache.set(id, state); writes.push(state) },
      snapshot: () => new Map(cache),
      restore: (snap) => { cache.clear(); for (const [k, v] of snap) cache.set(k, v) },
    }
    return { cache, writes, store }
  }
  const calls: string[] = []
  const http = (answer: () => Promise<{ data: unknown }>): ReminderHttp => ({
    put: (url) => { calls.push(`PUT ${url}`); return answer() },
    delete: (url) => { calls.push(`DELETE ${url}`); return answer() },
  })

  it("toggle is optimistic: the store changes before the server answers, then takes the server's numbers", async () => {
    const h = harness({ reminder_set: false, reminder_count: 7 })
    let release: (v: { data: unknown }) => void = () => {}
    const pending = toggleReminder(http(() => new Promise((r) => { release = r })), h.store, S1, true)
    expect(h.cache.get(S1)).toEqual({ reminder_set: true, reminder_count: 8 }) // before any answer
    release({ data: { data: { reminder_set: true, reminder_count: 12 } } })
    expect(await pending).toEqual({ reminder_set: true, reminder_count: 12 })
    expect(h.cache.get(S1)).toEqual({ reminder_set: true, reminder_count: 12 })
    expect(calls.at(-1)).toBe(`PUT /v1/livestream/streams/${S1}/reminder`)
  })

  it("toggle rolls back to exactly what was there when the server refuses, and rethrows", async () => {
    const h = harness({ reminder_set: true, reminder_count: 5 })
    const boom = { response: { status: 409, data: { error: { code: "STREAM_STATE_CONFLICT" } } } }
    await expect(toggleReminder(http(() => Promise.reject(boom)), h.store, S1, false)).rejects.toBe(boom)
    expect(h.writes[0]).toEqual({ reminder_set: false, reminder_count: 4 }) // the optimistic write did happen
    expect(h.cache.get(S1)).toEqual({ reminder_set: true, reminder_count: 5 })
    expect(calls.at(-1)).toBe(`DELETE /v1/livestream/streams/${S1}/reminder`)
    expect(reminderErrorCopy(boom)).toBe("This stream has already started.")
    expect(reminderErrorCopy({ response: { status: 401 } })).toBe("Sign in to get a reminder.")
  })

  it("an answer without a body keeps the optimistic state", async () => {
    const h = harness({ reminder_set: false, reminder_count: 0 })
    expect(await toggleReminder(http(() => Promise.resolve({ data: "" })), h.store, S1, true)).toEqual({ reminder_set: true, reminder_count: 1 })
  })

  it("patchReminder reaches a row, a page and an infinite list, and leaves everything else untouched", () => {
    const state = { reminder_set: true, reminder_count: 9 }
    const a = { id: S1, title: "A", reminder_set: false, reminder_count: 8 }
    const b = { id: S2, title: "B" }
    expect(patchReminder(a, S1, state)).toEqual({ ...a, ...state })
    const infinite = { pages: [{ items: [b], next_cursor: "" }, { items: [a, b], next_cursor: "" }], pageParams: ["", "c"] }
    const patched = patchReminder(infinite, S1, state)
    expect(patched.pages[1].items[0]).toEqual({ ...a, ...state })
    expect(patched.pages[0]).toBe(infinite.pages[0]) // untouched pages keep their identity
    expect(patched.pageParams).toBe(infinite.pageParams)
    expect(patchReminder(infinite, "other", state)).toBe(infinite)
    const chat = [{ id: S1, text: "hi" }]
    expect(patchReminder(chat, S1, state)).toBe(chat)
    expect(patchReminder(undefined, S1, state)).toBeUndefined()
  })

  it("the count line", () => {
    expect(reminderCountLabel(0)).toBe("")
    expect(reminderCountLabel(1)).toBe("1 reminder set")
    expect(reminderCountLabel(12)).toBe("12 reminders set")
  })
})

describe("hero", () => {
  it("is the most-watched LIVE landscape stream; ties keep the server's order", () => {
    const rows = [
      row({ id: "portrait", orientation: "portrait", viewer_count: 900 }),
      row({ id: "scheduled", status: "scheduled", viewer_count: 800 }),
      row({ id: "a", viewer_count: 30 }),
      row({ id: "b", viewer_count: 70 }),
      row({ id: "c", viewer_count: 70 }),
    ]
    expect(pickHero(rows)?.id).toBe("b")
    expect(pickHero([row({ id: "x", status: "reconnecting" })])).toBeNull()
    expect(pickHero([])).toBeNull()
  })
  it("holds a room only while live, on screen and in a foreground tab", () => {
    expect(heroShouldConnect({ live: true, inView: true, pageVisible: true })).toBe(true)
    expect(heroShouldConnect({ live: true, inView: false, pageVisible: true })).toBe(false) // scrolled away
    expect(heroShouldConnect({ live: true, inView: true, pageVisible: false })).toBe(false) // tab in the background
    expect(heroShouldConnect({ live: false, inView: true, pageVisible: true })).toBe(false) // not live
  })
})

describe("one room at a time", () => {
  it("claiming evicts the previous holder; done gives the slot back only if still held", () => {
    const slot = new RoomSlot()
    const log: string[] = []
    const doneA = slot.claim("a", () => log.push("a released"))
    expect(slot.owner()).toBe("a")
    const doneB = slot.claim("b", () => log.push("b released"))
    expect(log).toEqual(["a released"])
    expect(slot.owner()).toBe("b")
    doneA() // a is no longer the holder: nothing happens
    expect(slot.owner()).toBe("b")
    doneB()
    expect(slot.owner()).toBeNull()
    expect(log).toEqual(["a released"])
  })
  it("the same owner claiming again does not evict itself", () => {
    const slot = new RoomSlot()
    const log: string[] = []
    slot.claim("a", () => log.push("released"))
    slot.claim("a", () => log.push("released again"))
    expect(log).toEqual([])
  })
})

describe("founding creator badge", () => {
  it("badges: absent, null, empty and junk are none", () => {
    expect(parseBadges(["founding_creator"])).toEqual([FOUNDING_BADGE])
    expect(parseBadges(["founding_creator", "founding_creator", "", 7, null])).toEqual([FOUNDING_BADGE])
    expect(parseBadges(undefined)).toEqual([])
    expect(parseBadges(null)).toEqual([])
    expect(parseBadges([])).toEqual([])
    expect(parseBadges("founding_creator")).toEqual([])
    expect(hasFoundingBadge(parseBadges(["other"]))).toBe(false)
    expect(hasFoundingBadge(null)).toBe(false)
  })
  it("the badges route: {data:{badges:[{badge, granted_at}]}}; empty when none or banned", () => {
    expect(parseUserBadges({ data: { badges: [{ badge: "founding_creator", granted_at: "2026-10-02T10:00:00Z" }] } })).toEqual([FOUNDING_BADGE])
    expect(parseUserBadges({ data: { badges: [] } })).toEqual([])
    expect(parseUserBadges({ data: {} })).toEqual([])
    expect(parseUserBadges({ data: { badges: null } })).toEqual([])
    expect(parseUserBadges(undefined)).toEqual([])
  })
  it("the creator card carries them", () => {
    expect(parseCreator(LIVE_ROW.creator).badges).toEqual([FOUNDING_BADGE])
    expect(parseCreator({ user_id: U1 }).badges).toEqual([])
  })
  it("newly earned: not on the card before the stream, on it after", () => {
    expect(foundingNewlyEarned([], [FOUNDING_BADGE])).toBe(true)
    expect(foundingNewlyEarned([FOUNDING_BADGE], [FOUNDING_BADGE])).toBe(false) // already had it
    expect(foundingNewlyEarned([], [])).toBe(false) // not earned
    expect(foundingNewlyEarned(null, [FOUNDING_BADGE])).toBe(false) // before unknown: never claimed
    expect(foundingNewlyEarned(undefined, [FOUNDING_BADGE])).toBe(false)
  })
})

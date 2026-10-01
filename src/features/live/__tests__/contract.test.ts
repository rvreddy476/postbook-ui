import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { parseBanList, parseModeratorList, parseStreamList } from "../model"
import { currentViewerCount, liveStatusView } from "../status"

/*
  live-service-v2's golden response for GET /v1/livestream/streams?status=scheduled
  (internal/http/testdata/contracts/mtube/livestreams_scheduled.json, asserted
  byte for byte by streams_status_test.go), copied verbatim into
  __tests__/contracts/mtube/. If the backend file changes, copy it again.
*/
const golden = JSON.parse(
  readFileSync(resolve(import.meta.dir, "contracts/mtube/livestreams_scheduled.json"), "utf8"),
) as unknown

describe("the stream list against live-service-v2's golden JSON", () => {
  const page = parseStreamList(golden)

  it("rows are data[]; the last page carries no cursor (meta: {})", () => {
    expect(page.items.map((s) => s.id)).toEqual([
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ])
    expect(page.next_cursor).toBe("")
  })

  it("every row has the truthful-lifecycle fields the web reads", () => {
    for (const row of page.items) {
      expect(row.status).toBe("scheduled")
      expect(row.ended_reason).toBeNull()
      expect(typeof row.status_changed_at).toBe("string")
      expect(row.viewer_count).toBe(0)
      expect(row.viewer_peak).toBe(0)
      // A viewer is never told who moderates (host/moderators only).
      expect("moderator_user_ids" in row).toBe(false)
    }
  })

  it("omitempty: an unset cover is absent, not null", () => {
    expect(page.items[0].cover_media_id).toBe("55555555-5555-4555-8555-555555555555")
    expect("cover_media_id" in page.items[1]).toBe(false)
    expect("started_at" in page.items[1]).toBe(false)
  })

  it("renders as Scheduled with a start time and no audience", () => {
    const view = liveStatusView(page.items[0])
    expect(view.kind).toBe("scheduled")
    expect(view.label).toBe("Scheduled")
    expect(view.body).toStartWith("Starts ")
    expect(view.connectPlayer).toBe(false)
    expect(currentViewerCount(page.items[0], null)).toBe(0)
  })

  it("a cursor in meta.next_cursor is read", () => {
    expect(parseStreamList({ data: [], meta: { next_cursor: "1727780000000000:abc" } }).next_cursor).toBe("1727780000000000:abc")
    expect(parseStreamList({ items: [{ id: "x" }] }).items).toEqual([])
    expect(parseStreamList(null)).toEqual({ items: [], next_cursor: "" })
  })
})

describe("moderation list bodies (moderation_routes.go)", () => {
  it("GET /bans: {data:[{stream_id,user_id,banned_by,reason,created_at}]}; nil slice is null", () => {
    expect(parseBanList({
      data: [
        { stream_id: "s", user_id: "u1", banned_by: "h", reason: "", created_at: "2026-10-01T10:00:00Z" },
        { stream_id: "s", user_id: "u2", banned_by: "m", reason: "spam", created_at: "2026-10-01T10:01:00Z" },
      ],
    })).toEqual(["u1", "u2"])
    expect(parseBanList({ data: null })).toEqual([])
  })
  it("GET/PUT /moderators: {data:{user_ids:[...]}}; nil slice is null", () => {
    expect(parseModeratorList({ data: { user_ids: ["m1", "m2"] } })).toEqual(["m1", "m2"])
    expect(parseModeratorList({ data: { user_ids: null } })).toEqual([])
    expect(parseModeratorList({ data: ["m1"] })).toEqual([])
  })
})

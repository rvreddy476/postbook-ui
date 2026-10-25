import { describe, expect, test } from "bun:test"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  buildCreateRequest,
  buildDraftRequest,
  draftSummary,
  draftToCompose,
  emptyDetails,
  toDraftRow,
  toDraftRows,
  type ComposeExtras,
  type PostDetailsForm,
  type UploadedMedia,
} from "../model"

/*
  post-service's post-screens goldens, copied byte for byte from
  Architecture/services/post-service/internal/http/testdata/contracts/posts.
  When the backend checkout is on this machine the copies are compared to it,
  so a golden that changed there fails here.
*/

const LOCAL = resolve(import.meta.dir, "contracts")
const BACKEND_CANDIDATES = [
  "C:/workspace/modernsmapp/Architecture/services/post-service/internal/http/testdata/contracts/posts",
]
const backend = BACKEND_CANDIDATES.find((dir) => existsSync(dir)) ?? null
const COPIED = ["create_request.json", "draft_request.json", "draft_response.json", "drafts_list.json"]

const read = (name: string) => JSON.parse(readFileSync(resolve(LOCAL, name), "utf8"))
const golden = read("create_request.json") as Record<string, unknown>
const goldenDraft = read("draft_request.json") as { post_type: string; payload: Record<string, unknown>; schedule_at: null }

/** The keys of post-service's PostDraftPayload (service/post_drafts.go); it decodes with DisallowUnknownFields. */
const DRAFT_PAYLOAD_KEYS = new Set([
  "text", "visibility", "content_type", "media_ids", "alt_texts", "poll", "rich_text", "no_comments", "no_likes",
  "location_name", "location_lat", "location_lng", "feeling", "activity", "activity_detail", "language", "title",
  "distribution", "cover_frame_ms", "filter", "audio_track_id", "audio_start_ms", "cover_media_id", "tags",
  "category", "paid_promotion", "is_made_for_kids", "altered_content", "hide_share", "allow_download",
  "tagged_user_ids", "post_type", "hashtags", "mentions", "remix_setting", "comment_access", "link_url",
  "ai_generated", "is_branded", "cover_index", "location_place_id",
])

/** The golden's post, filled into our form the way an author would fill it. */
function goldenForm(): { text: string; details: PostDetailsForm; media: UploadedMedia[]; extras: ComposeExtras } {
  const ids = golden.media_ids as string[]
  return {
    text: "Sunday market haul #food @call.b",
    details: {
      ...emptyDetails("en"),
      title: "Sunday market",
      visibility: "friends",
      commentAccess: "followers",
      remixSetting: "disallow",
      paidPromotion: false,
      isBranded: true,
      aiGenerated: true,
      link: "https://example.com/sunday-market",
      locationName: "Banjara Hills, Hyderabad",
      locationPlaceId: "ChIJLbZ-NFv9DDkRQJY4FbcFcgM",
      locationLat: 17.4126,
      locationLng: 78.4387,
      coverIndex: 1,
      // "market" is not in the caption: a tag chip the draft carried.
      extraHashtags: ["market"],
    },
    media: ids.map((mediaId, i) => ({
      mediaId,
      kind: "image" as const,
      altText: i === 0 ? "Stalls under string lights" : i === 1 ? "A basket of mangoes" : "",
    })),
    extras: { contentType: "post" },
  }
}

describe("post-service goldens", () => {
  test("the four copies are present", () => {
    expect(readdirSync(LOCAL).sort()).toEqual([...COPIED].sort())
  })
  ;(backend ? test : test.skip)("the copies are byte for byte post-service's", () => {
    for (const name of COPIED) {
      expect(readFileSync(resolve(LOCAL, name)).equals(readFileSync(resolve(backend as string, name)))).toBe(true)
    }
  })
})

describe("the create request", () => {
  const ours = JSON.parse(JSON.stringify(buildCreateRequest(goldenForm()))) as Record<string, unknown>

  test("every key we send is a key of the golden create request, with the golden's value", () => {
    for (const key of Object.keys(ours)) {
      expect(Object.keys(golden), key).toContain(key)
      expect(ours[key], key).toEqual(golden[key])
    }
  })

  test("every details field of the golden is one we send", () => {
    for (const key of [
      "text", "visibility", "content_type", "media_ids", "post_type", "title", "language", "hashtags", "mentions",
      "remix_setting", "comment_access", "no_comments", "cover_media_id", "cover_index", "is_branded", "ai_generated",
      "paid_promotion", "link_url", "location_name", "location_lat", "location_lng", "location_place_id",
    ]) {
      expect(Object.keys(ours), key).toContain(key)
    }
  })

  test("there is no `location` key: the place goes as location_name / location_lat / location_lng / location_place_id", () => {
    expect(ours).not.toHaveProperty("location")
    expect(Object.keys(golden)).not.toContain("location")
  })

  test("hashtags go without '#', mentions without '@'", () => {
    expect(ours.hashtags).toEqual(["food", "market"])
    expect(ours.mentions).toEqual(["call.b"])
  })
})

describe("the draft request", () => {
  const ours = buildDraftRequest(goldenForm())

  test("a photo post is a 'post' draft with no schedule", () => {
    expect(ours.post_type).toBe(goldenDraft.post_type as "post")
    expect(ours.schedule_at).toBeNull()
  })

  test("every payload key is one post-service's draft payload decodes (an unknown key is a 400)", () => {
    for (const key of Object.keys(ours.payload)) expect(DRAFT_PAYLOAD_KEYS.has(key), key).toBe(true)
  })

  test("the golden draft payload is exactly what we send, key for key", () => {
    const payload = JSON.parse(JSON.stringify(ours.payload)) as Record<string, unknown>
    for (const [key, value] of Object.entries(goldenDraft.payload)) expect(payload[key], key).toEqual(value)
    for (const key of Object.keys(payload)) {
      if (!(key in goldenDraft.payload)) expect(["content_type", "language"], key).toContain(key)
    }
  })
})

describe("reading drafts back", () => {
  test("draft_response opens into the form it was saved from", () => {
    const row = toDraftRow(read("draft_response.json"))
    expect(row).not.toBeNull()
    const state = draftToCompose(row!, "hi")
    expect(row!.status).toBe("draft")
    expect(state.text).toBe("Sunday market haul #food @call.b")
    expect(state.media.map((m) => m.mediaId)).toEqual(golden.media_ids as string[])
    expect(state.media.map((m) => m.altText)).toEqual(["Stalls under string lights", "A basket of mangoes", ""])
    expect(state.details).toMatchObject({
      title: "Sunday market",
      visibility: "friends",
      commentAccess: "followers",
      remixSetting: "disallow",
      isBranded: true,
      aiGenerated: true,
      paidPromotion: false,
      link: "https://example.com/sunday-market",
      locationName: "Banjara Hills, Hyderabad",
      locationPlaceId: "ChIJLbZ-NFv9DDkRQJY4FbcFcgM",
      locationLat: 17.4126,
      locationLng: 78.4387,
      coverIndex: 1,
      extraHashtags: ["market"],
      extraMentions: [],
      // The golden draft carries no language: the fallback is used.
      language: "hi",
    })
  })

  test("a draft saved again round-trips to the same payload", () => {
    const row = toDraftRow(read("draft_response.json"))!
    const state = draftToCompose(row, "en")
    const again = buildDraftRequest({
      text: state.text,
      details: state.details,
      media: state.media.map((m) => ({ mediaId: m.mediaId!, kind: m.kind, altText: m.altText })),
      extras: state.extras,
    })
    const payload = JSON.parse(JSON.stringify(again.payload)) as Record<string, unknown>
    for (const [key, value] of Object.entries(goldenDraft.payload)) expect(payload[key], key).toEqual(value)
  })

  test("drafts_list parses into the list, with its row's heading, count and cover", () => {
    const rows = toDraftRows(read("drafts_list.json"))
    expect(rows).toHaveLength(1)
    const summary = draftSummary(rows[0], Date.parse("2026-10-18T15:00:00Z"))
    expect(summary).toEqual({ heading: "Sunday market", meta: "3 photos · 3 h ago", thumbMediaId: "c4444444-4444-4444-8444-444444444444" })
  })
})

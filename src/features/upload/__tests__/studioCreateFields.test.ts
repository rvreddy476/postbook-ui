import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import api from "@/lib/api";
import { createReel } from "@/features/reels/data/reelsApi";
import { studioCreateFields } from "../studioApi";
import { INITIAL_FORM_STATE, type StudioFormState } from "../types";

const form = (patch: Partial<StudioFormState> = {}): StudioFormState => ({ ...INITIAL_FORM_STATE, contentType: "long", ...patch });

describe("studioCreateFields (the direct-create publish path)", () => {
  test("carries the title, so a long video is not refused with TITLE_REQUIRED", () => {
    expect(studioCreateFields(form({ title: "  My first film  " })).title).toBe("My first film");
  });

  test("topic, language, tags and settings reach the create route", () => {
    const f = studioCreateFields(form({ title: "t", category: "film-animation", language: "te", tags: ["a", "b"], commentsEnabled: false, likesEnabled: false, isMadeForKids: true }));
    expect(f).toMatchObject({ category: "film-animation", language: "te", tags: ["a", "b"], no_comments: true, no_likes: true, is_made_for_kids: true });
  });

  test("empty optional fields are left out rather than sent blank", () => {
    const f = studioCreateFields(form({ title: "t", category: "", tags: [] }));
    expect("category" in f).toBe(false);
    expect("tags" in f).toBe(false);
    expect("recording_date" in f).toBe(false);
    expect("publish_at" in f).toBe(false);
  });

  test("a scheduled time becomes RFC3339 publish_at", () => {
    const f = studioCreateFields(form({ title: "t", scheduleAt: "2026-10-01T18:30" }));
    expect(f.publish_at).toBe(new Date("2026-10-01T18:30").toISOString());
  });
});

describe("createReel sends the extra fields", () => {
  afterEach(() => mock.restore());
  test("title and category are in the POST /v1/posts body; the core fields still win", async () => {
    const post = spyOn(api, "post").mockResolvedValue({ data: { data: { id: "p1", author_id: "a", content_type: "long_video", media: [] } } } as never);
    await createReel({ text: "caption", mediaIds: ["m1"], content_type: "long_video", fields: { title: "Film", category: "music", text: "ignored" } });
    const [url, body] = post.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toBe("/v1/posts");
    expect(body).toMatchObject({ title: "Film", category: "music", text: "caption", media_ids: ["m1"], content_type: "long_video" });
  });
});

describe("AI label and location (TikTok Studio parity, 2026-10-21)", () => {
  test("the AI-generated label and a picked place reach the create route", () => {
    const f = studioCreateFields(form({ title: "t", aiGenerated: true, locationName: "  Charminar ", locationPlaceId: "ChIJm5Mabo" }));
    expect(f).toMatchObject({ ai_generated: true, location_name: "Charminar", location_place_id: "ChIJm5Mabo" });
  });

  test("free-text location goes without a place id; no location, no fields", () => {
    const typed = studioCreateFields(form({ title: "t", locationName: "Grandma's house", locationPlaceId: null }));
    expect(typed.location_name).toBe("Grandma's house");
    expect("location_place_id" in typed).toBe(false);
    const none = studioCreateFields(form({ title: "t", locationName: "   ", locationPlaceId: "stale" }));
    expect("location_name" in none).toBe(false);
    expect("location_place_id" in none).toBe(false);
    expect("ai_generated" in none).toBe(false);
  });
});

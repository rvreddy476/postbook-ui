import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalizeBulkOutcomes, normalizeLibraryRow, normalizePostDetail, normalizePrivateShares } from "../hubApi";

/*
  The Creator Hub batch read against post-service's own golden fixtures
  (internal/http/testdata/contracts/mtube/*.json, copied verbatim into
  ./contracts). If the backend renames a field, the copy goes stale here
  and these fail instead of a setting silently reading false on dev.
*/

const load = (name: string): Record<string, unknown> => JSON.parse(readFileSync(resolve(import.meta.dir, "contracts", name), "utf8"));

describe("post-service fixtures", () => {
  test("owner detail: every setting the edit sheet prefills, made for kids read from is_made_for_kids", () => {
    const raw = load("post_detail_owner.json");
    const d = normalizePostDetail(raw)!;
    expect(raw.is_made_for_kids).toBe(false);
    expect("made_for_kids" in raw).toBe(false);
    expect(d.made_for_kids).toBe(false);
    expect(normalizePostDetail({ ...raw, is_made_for_kids: true })!.made_for_kids).toBe(true);
    expect(d).toMatchObject({
      paid_promotion: true,
      altered_content: false,
      license: "creative_commons",
      allow_embedding: true,
      recording_date: "2026-09-20",
      recording_location: "Hyderabad",
      remix_setting: "allow_audio_only",
      comment_moderation: "basic",
      comment_access: "followers",
      age_restricted: true,
      hide_like_count: true,
      default_comment_sort: "newest",
      related_post_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(d.related_post?.id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  test("a viewer's detail with hidden likes: like_count null, no related card", () => {
    const raw = load("post_detail_hidden_likes.json");
    expect(raw.like_count).toBeNull();
    const d = normalizePostDetail(raw)!;
    expect(d.hide_like_count).toBe(true);
    expect(d.related_post).toBeNull();
  });

  test("upload row: description, made for kids and age restriction for the filters", () => {
    const raw = load("upload_row.json");
    const r = normalizeLibraryRow(raw)!;
    expect(r.description).toBe(String(raw.description).slice(0, 200));
    expect(r.made_for_kids).toBe(false);
    expect(r.age_restricted).toBe(true);
  });

  test("bulk edit and bulk delete outcomes keep the per-id error", () => {
    const edit = normalizeBulkOutcomes(load("uploads_bulk.json"), ["11111111-1111-4111-8111-111111111111", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]);
    expect(edit.map((o) => [o.ok, o.error ?? null])).toEqual([
      [true, null],
      [false, "INVALID_TAGS"],
    ]);
    const del = normalizeBulkOutcomes(load("uploads_bulk_delete.json"), []);
    expect(del.length).toBeGreaterThan(0);
  });

  test("private shares list", () => {
    const users = normalizePrivateShares(load("private_shares.json"));
    expect(users).toEqual([
      {
        user_id: "33333333-3333-4333-8333-333333333333",
        username: "call.b",
        display_name: "Call B",
        avatar_url: "/v1/media/99999999-9999-4999-8999-999999999999/serve/avatar",
        added_at: "2026-09-27T12:00:00Z",
      },
    ]);
  });
});

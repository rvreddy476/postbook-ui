import { afterEach, describe, expect, spyOn, test } from "bun:test";

import api from "@/lib/api";
import {
  absoluteWatchUrl,
  bulkDelete,
  bulkDeleteBody,
  bulkEdit,
  bulkEditBody,
  bulkSetVisibility,
  getPrivateShares,
  hubErrorCode,
  normalizeBulkOutcomes,
  normalizeLibraryRow,
  normalizePostDetail,
  normalizePrivateShares,
  normalizeRecordingDate,
  normalizeRelatedPost,
  postPatchBody,
  privateSharesBody,
  setPrivateShares,
  updatePost,
} from "../hubApi";
import { detailsPatch, detailsProblems, notYetPublished, toDetailsForm } from "../editForm";

/* Hub batch (28 Sep): contract A–F shapes, only in hubApi.ts. */

const spies: { mockRestore: () => void }[] = [];
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore();
});

function spyApi(method: "get" | "post" | "put" | "patch", data: unknown) {
  const calls: { url: string; body: unknown }[] = [];
  const s = spyOn(api, method).mockImplementation(((url: string, body?: unknown) => {
    calls.push({ url, body: method === "get" ? undefined : body });
    return Promise.resolve({ data });
  }) as never);
  spies.push(s);
  return calls;
}

describe("library rows: contract E columns", () => {
  test("reads description, made_for_kids, age_restricted, hide_like_count, default_comment_sort, related_post_id", () => {
    const r = normalizeLibraryRow({
      id: "p1",
      title: "T",
      text: "the full description",
      description: "the first 200 runes",
      made_for_kids: true,
      age_restricted: true,
      hide_like_count: true,
      default_comment_sort: "newest",
      related_post_id: "p9",
    })!;
    expect(r.description).toBe("the first 200 runes");
    expect(r.made_for_kids).toBe(true);
    expect(r.age_restricted).toBe(true);
    expect(r.hide_like_count).toBe(true);
    expect(r.default_comment_sort).toBe("newest");
    expect(r.related_post_id).toBe("p9");
  });

  test("Go zero values and absent keys: '' description falls back to text, '' sort is top, '' related is null, null bools are false", () => {
    const r = normalizeLibraryRow({ id: "p2", text: "from text", description: "", default_comment_sort: "", related_post_id: "", age_restricted: null, hide_like_count: null, made_for_kids: null })!;
    expect(r.description).toBe("from text");
    expect(r.default_comment_sort).toBe("top");
    expect(r.related_post_id).toBeNull();
    expect(r.age_restricted).toBe(false);
    expect(r.hide_like_count).toBe(false);
    expect(r.made_for_kids).toBe(false);
    const bare = normalizeLibraryRow({ id: "p3" })!;
    expect(bare.description).toBe("");
    expect(bare.default_comment_sort).toBe("top");
    expect(normalizeLibraryRow({ id: "p4", default_comment_sort: "WEIRD" })!.default_comment_sort).toBe("top");
  });
});

describe("post detail: contract B", () => {
  const owner = {
    id: "p1",
    title: "T",
    text: "d",
    content_type: "long_video",
    visibility: "private",
    status: "Published",
    age_restricted: true,
    hide_like_count: true,
    default_comment_sort: "newest",
    related_post_id: "p2",
    related_post: { id: "p2", title: " Part two ", thumbnail_url: "/v1/media/c2/serve", duration_seconds: 125, channel_name: "Ravi" },
    paid_promotion: true,
    altered_content: true,
    license: "creative_commons",
    allow_embedding: false,
    recording_date: "2026-08-15T00:00:00Z",
    recording_location: "Hyderabad",
    remix_setting: "allow_audio_only",
    comment_moderation: "strict",
    comment_access: "followers",
    notify_subscribers: false,
  };

  test("the owner's full set", () => {
    const d = normalizePostDetail(owner)!;
    expect(d.status).toBe("published");
    expect(d.age_restricted).toBe(true);
    expect(d.hide_like_count).toBe(true);
    expect(d.default_comment_sort).toBe("newest");
    expect(d.related_post_id).toBe("p2");
    expect(d.related_post?.title).toBe("Part two");
    expect(d.related_post?.thumbnail_url).toContain("/v1/media/c2/serve");
    expect(d.related_post?.duration_seconds).toBe(125);
    expect(d.paid_promotion).toBe(true);
    expect(d.altered_content).toBe(true);
    expect(d.license).toBe("creative_commons");
    expect(d.allow_embedding).toBe(false);
    expect(d.recording_date).toBe("2026-08-15");
    expect(d.recording_location).toBe("Hyderabad");
    expect(d.remix_setting).toBe("allow_audio_only");
    expect(d.comment_moderation).toBe("strict");
    expect(d.comment_access).toBe("followers");
    expect(d.notify_subscribers).toBe(false);
  });

  test("absent / zero values fall back to the create route's defaults", () => {
    const d = normalizePostDetail({ id: "p1", license: "", remix_setting: "", comment_moderation: null, comment_access: "", default_comment_sort: "", recording_date: null, recording_location: null, related_post: null, related_post_id: "" })!;
    expect(d.license).toBe("standard");
    expect(d.remix_setting).toBe("allow");
    expect(d.comment_moderation).toBe("none");
    expect(d.comment_access).toBe("everyone");
    expect(d.default_comment_sort).toBe("top");
    expect(d.recording_date).toBe("");
    expect(d.recording_location).toBe("");
    expect(d.related_post).toBeNull();
    expect(d.related_post_id).toBeNull();
    // bools: absent embedding and notify default on, the rest off
    expect(d.allow_embedding).toBe(true);
    expect(d.notify_subscribers).toBe(true);
    expect(d.paid_promotion).toBe(false);
    expect(d.age_restricted).toBe(false);
    expect(d.status).toBe("");
  });

  test("related_post alone still names the id; a related_post without an id is dropped", () => {
    expect(normalizePostDetail({ id: "p1", related_post: { id: "p5", title: "" } })!.related_post_id).toBe("p5");
    expect(normalizeRelatedPost({ title: "x" })).toBeNull();
    expect(normalizeRelatedPost(null)).toBeNull();
    expect(normalizeRelatedPost({ id: "p5", title: "", thumbnail_url: "", duration_seconds: -3 })).toEqual({ id: "p5", title: "Untitled", thumbnail_url: "", duration_seconds: 0, channel_name: "" });
    expect(normalizeRelatedPost({ id: "p6", thumbnail_url: "https://cdn/x.jpg" })!.thumbnail_url).toBe("https://cdn/x.jpg");
  });

  test("recording dates: a DATE, a timestamp, or nothing", () => {
    expect(normalizeRecordingDate("2026-01-02")).toBe("2026-01-02");
    expect(normalizeRecordingDate("2026-01-02T00:00:00+05:30")).toBe("2026-01-02");
    expect(normalizeRecordingDate("")).toBe("");
    expect(normalizeRecordingDate(null)).toBe("");
    expect(normalizeRecordingDate("0001-01-01T00:00:00Z")).toBe("0001-01-01");
  });
});

describe("edit sheet: only changed fields (contract A)", () => {
  const detail = normalizePostDetail({
    id: "p1",
    title: "T",
    text: "d",
    visibility: "public",
    recording_date: "2026-08-15",
    recording_location: "Goa",
    related_post_id: "p2",
    tags: ["a"],
  })!;
  const base = toDetailsForm(detail);

  test("no change → an empty patch", () => {
    expect(detailsPatch(base, { ...base }, { notifyEditable: false })).toEqual({});
  });

  test("every More settings field goes by itself when it alone moved", () => {
    const next = { ...base, paid_promotion: true, license: "creative_commons" as const, allow_embedding: false, hide_like_count: true, default_comment_sort: "newest" as const, age_restricted: true };
    expect(detailsPatch(base, next, { notifyEditable: false })).toEqual({
      paid_promotion: true,
      license: "creative_commons",
      allow_embedding: false,
      hide_like_count: true,
      default_comment_sort: "newest",
      age_restricted: true,
    });
  });

  test("clearing the date, location or related video sends '' (the contract's clear)", () => {
    const next = { ...base, recording_date: "", recording_location: "  ", related_post_id: "" };
    expect(detailsPatch(base, next, { notifyEditable: false })).toEqual({ recording_date: "", recording_location: "", related_post_id: "" });
  });

  test("notify_subscribers only while the video is not out yet", () => {
    const next = { ...base, notify_subscribers: false };
    expect(detailsPatch(base, next, { notifyEditable: false })).toEqual({});
    expect(detailsPatch(base, next, { notifyEditable: true })).toEqual({ notify_subscribers: false });
    expect(notYetPublished({ visibility: "scheduled", status: "" })).toBe(true);
    expect(notYetPublished({ visibility: "private", status: "draft" })).toBe(true);
    expect(notYetPublished({ visibility: "public", status: "published" })).toBe(false);
  });

  test("the request body keeps '' and drops undefined", () => {
    expect(postPatchBody({ recording_date: "", title: undefined, hide_like_count: false })).toEqual({ recording_date: "", hide_like_count: false });
  });

  test("client checks mirror the 422 codes", () => {
    const today = new Date(2026, 8, 28);
    expect(detailsProblems({ ...base, recording_date: "2026-09-29" }, "p1", today)).toEqual(["The recording date can't be in the future."]);
    expect(detailsProblems({ ...base, recording_date: "2026-09-28" }, "p1", today)).toEqual([]);
    expect(detailsProblems({ ...base, recording_location: "x".repeat(101) }, "p1", today)[0]).toContain("100");
    expect(detailsProblems({ ...base, recording_location: "é".repeat(100) }, "p1", today)).toEqual([]);
    expect(detailsProblems({ ...base, related_post_id: "p1" }, "p1", today)[0]).toContain("itself");
  });

  test("PATCH /v1/posts/:id carries exactly the diff", async () => {
    const calls = spyApi("patch", { data: { id: "p1", hide_like_count: true } });
    const out = await updatePost("p1", detailsPatch(base, { ...base, hide_like_count: true, related_post_id: "" }, { notifyEditable: false }));
    expect(calls).toEqual([{ url: "/v1/posts/p1", body: { hide_like_count: true, related_post_id: "" } }]);
    expect(out?.hide_like_count).toBe(true);
  });
});

describe("bulk (contracts C and D)", () => {
  test("bulk edit body: ids deduped, tags carry tags_mode, tags_mode never goes alone", () => {
    expect(bulkEditBody(["a", "b", "a", ""], { tags: ["x"], tags_mode: "replace" })).toEqual({ post_ids: ["a", "b"], patch: { tags: ["x"], tags_mode: "replace" } });
    expect(bulkEditBody(["a"], { tags: ["x"] })).toEqual({ post_ids: ["a"], patch: { tags: ["x"], tags_mode: "add" } });
    expect(bulkEditBody(["a"], { tags_mode: "remove", age_restricted: true })).toEqual({ post_ids: ["a"], patch: { age_restricted: true } });
    expect(bulkEditBody(["a"], { visibility: undefined, no_comments: false })).toEqual({ post_ids: ["a"], patch: { no_comments: false } });
  });

  test("bulk delete body: the deduped ids", () => {
    expect(bulkDeleteBody(["x", "y", "x"])).toEqual({ post_ids: ["x", "y"] });
  });

  test("POST /v1/uploads/bulk and its {results:[{id, ok, error}]}", async () => {
    const calls = spyApi("post", { data: { results: [{ id: "a", ok: true }, { id: "b", ok: false, error: "FORBIDDEN" }] } });
    const out = await bulkEdit(["a", "b"], { tags: ["dal"], tags_mode: "remove" });
    expect(calls).toEqual([{ url: "/v1/uploads/bulk", body: { post_ids: ["a", "b"], patch: { tags: ["dal"], tags_mode: "remove" } } }]);
    expect(out).toEqual([
      { post_id: "a", ok: true, error: undefined },
      { post_id: "b", ok: false, error: "FORBIDDEN" },
    ]);
  });

  test("bulk visibility is one of the Edit fields (same route)", async () => {
    const calls = spyApi("post", { data: { results: [{ id: "a", ok: true }] } });
    await bulkSetVisibility(["a"], "unlisted");
    expect(calls[0]).toEqual({ url: "/v1/uploads/bulk", body: { post_ids: ["a"], patch: { visibility: "unlisted" } } });
  });

  test("POST /v1/uploads/bulk-delete with the ids", async () => {
    const calls = spyApi("post", { data: { results: [{ id: "a", ok: true }, { id: "b", ok: false, error: { code: "NOT_FOUND", message: "gone" } }] } });
    const out = await bulkDelete(["a", "b", "b"]);
    expect(calls).toEqual([{ url: "/v1/uploads/bulk-delete", body: { post_ids: ["a", "b"] } }]);
    expect(out.map((o) => [o.post_id, o.ok, o.error])).toEqual([
      ["a", true, undefined],
      ["b", false, "NOT_FOUND"],
    ]);
  });

  test("an error object on a result row reads its code (then its message)", () => {
    expect(normalizeBulkOutcomes({ results: [{ id: "a", ok: false, error: { message: "nope" } }] }, ["a"])[0].error).toBe("nope");
    expect(normalizeBulkOutcomes({ results: [{ id: "a", ok: false, error: "" }] }, ["a"])[0].error).toBeUndefined();
  });
});

describe("private shares (contract F)", () => {
  test("normalise {users:[…]}, dedupe, zero values, a bare array", () => {
    const users = normalizePrivateShares({
      users: [
        { user_id: "u1", username: "ravi", display_name: "Ravi", avatar_url: "https://a/1.jpg", added_at: "2026-09-28T00:00:00Z" },
        { user_id: "u1", username: "dupe" },
        { user_id: "", username: "no-id" },
        { user_id: "u2", username: "sita", display_name: "", avatar_url: "", added_at: "" },
        { user_id: "u3", username: "", display_name: "" },
        null,
      ],
    });
    expect(users.map((u) => u.user_id)).toEqual(["u1", "u2", "u3"]);
    expect(users[1].display_name).toBe("sita");
    expect(users[2].display_name).toBe("Someone");
    expect(users[0].avatar_url).toBe("https://a/1.jpg");
    expect(normalizePrivateShares([{ id: "u9", name: "Old" }])[0]).toEqual({ user_id: "u9", username: "", display_name: "Old", avatar_url: "", added_at: "" });
    expect(normalizePrivateShares(null)).toEqual([]);
    expect(normalizePrivateShares({ users: null })).toEqual([]);
  });

  test("PUT body: deduped, never the owner, at most 50", () => {
    const many = Array.from({ length: 60 }, (_, i) => `u${i}`);
    expect(privateSharesBody(["u1", "u1", "owner", "u2", ""], "owner")).toEqual({ user_ids: ["u1", "u2"] });
    expect(privateSharesBody(many).user_ids.length).toBe(50);
  });

  test("GET and PUT /v1/posts/:id/private-shares", async () => {
    const getCalls = spyApi("get", { data: { users: [{ user_id: "u1", username: "a" }] } });
    expect((await getPrivateShares("p1")).map((u) => u.user_id)).toEqual(["u1"]);
    expect(getCalls[0].url).toBe("/v1/posts/p1/private-shares");
    const putCalls = spyApi("put", { data: { users: [{ user_id: "u2", username: "b" }] } });
    const saved = await setPrivateShares("p1", ["u2", "u2", "me"], "me");
    expect(putCalls).toEqual([{ url: "/v1/posts/p1/private-shares", body: { user_ids: ["u2"] } }]);
    expect(saved[0].user_id).toBe("u2");
  });
});

describe("errors and links", () => {
  test("the service envelope's code", () => {
    expect(hubErrorCode({ response: { status: 422, data: { error: { code: "INVALID_LICENSE", message: "x" } } } })).toBe("INVALID_LICENSE");
    expect(hubErrorCode({ response: { data: { error: "RELATED_SELF" } } })).toBe("RELATED_SELF");
    expect(hubErrorCode({ response: { data: { error: "some sentence" } } })).toBeNull();
    expect(hubErrorCode({ response: { data: { code: "TOO_MANY_SHARES" } } })).toBe("TOO_MANY_SHARES");
    expect(hubErrorCode(new Error("network"))).toBeNull();
  });

  test("Copy link is the absolute watch URL", () => {
    expect(absoluteWatchUrl({ id: "p1", content_type: "long_video" }, "https://atpost.in/")).toBe("https://atpost.in/posttube/watch/p1");
  });
});

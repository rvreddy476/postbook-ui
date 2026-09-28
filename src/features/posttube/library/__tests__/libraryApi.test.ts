import { describe, expect, test } from "bun:test";

import { isSystemKind, isSystemPlaylistRefusal, normalizeItems, normalizePlaylist, playAllHref, SYSTEM_TITLES } from "../libraryApi";

describe("normalizePlaylist tolerates both wire variants", () => {
  test("the current row: visibility + kind + item_count", () => {
    const c = normalizePlaylist({ id: "p1", creator_id: "u1", kind: "watch_later", title: "Watch later", visibility: "private", item_count: 3, created_at: "2026-09-01T00:00:00Z" });
    expect(c).toMatchObject({ id: "p1", creatorId: "u1", kind: "watch_later", title: "Watch later", visibility: "private", itemCount: 3, createdAt: "2026-09-01T00:00:00Z" });
    expect(c.description).toBe("");
    // the server's row title never leaks: the vocabulary is ours
    expect(normalizePlaylist({ id: "p", kind: "liked", title: "Loved" }).title).toBe("Liked videos");
  });
  test("the older row: is_public, no kind → a private/public user collection", () => {
    expect(normalizePlaylist({ id: "p2", title: "Mix", is_public: true })).toMatchObject({ kind: "user", visibility: "public", itemCount: 0 });
    expect(normalizePlaylist({ id: "p3", title: "Mix", is_public: false })).toMatchObject({ kind: "user", visibility: "private" });
    expect(normalizePlaylist({ id: "p4", title: "Mix" }).visibility).toBe("private");
  });
  test("visibility wins over is_public when both are present; unknown values fall back", () => {
    expect(normalizePlaylist({ id: "p", title: "t", visibility: "unlisted", is_public: false }).visibility).toBe("unlisted");
    expect(normalizePlaylist({ id: "p", title: "t", visibility: "weird", is_public: true }).visibility).toBe("public");
  });
  test("an unknown kind is a user collection; a blank title gets the system name or Untitled", () => {
    expect(normalizePlaylist({ id: "p", kind: "banana", title: "x" }).kind).toBe("user");
    expect(normalizePlaylist({ id: "p", kind: "liked", title: "" }).title).toBe(SYSTEM_TITLES.liked);
    expect(normalizePlaylist({ id: "p", kind: "watch_later", title: null }).title).toBe("Watch later");
    expect(normalizePlaylist({ id: "p", title: "  " }).title).toBe("Untitled");
    expect(normalizePlaylist({ id: "p", title: "t", item_count: -4 }).itemCount).toBe(0);
  });
  test("isSystemKind", () => {
    expect(isSystemKind("watch_later")).toBe(true);
    expect(isSystemKind("liked")).toBe(true);
    expect(isSystemKind("user")).toBe(false);
    expect(isSystemKind(undefined)).toBe(false);
  });
});

describe("normalizeItems", () => {
  test("hydrated rows keep their post and sort by position", () => {
    const out = normalizeItems(
      [
        { playlist_id: "p", post_id: "b", position: 1, added_at: "2026-09-02T00:00:00Z", post: { id: "b", author_id: "a", title: "B" } },
        { playlist_id: "p", post_id: "a", position: 0, post: { id: "a", author_id: "a", title: "A" } },
      ],
      "p",
    );
    expect(out.map((r) => r.postId)).toEqual(["a", "b"]);
    expect(out[1].post?.title).toBe("B");
    expect(out[1].addedAt).toBe("2026-09-02T00:00:00Z");
  });
  test("bare rows (the move response, no post) are tolerated and take the index as position", () => {
    const out = normalizeItems([{ post_id: "x" }, { post_id: "y" }], "p");
    expect(out.map((r) => [r.postId, r.position, r.post, r.playlistId])).toEqual([
      ["x", 0, null, "p"],
      ["y", 1, null, "p"],
    ]);
  });
  test("drops duplicates, junk and non-arrays", () => {
    expect(normalizeItems([{ post_id: "a", position: 0 }, { post_id: "a", position: 1 }, null, { position: 2 }] as unknown, "p").map((r) => r.postId)).toEqual(["a"]);
    expect(normalizeItems(null)).toEqual([]);
    expect(normalizeItems({ data: [] })).toEqual([]);
  });
});

describe("errors and links", () => {
  test("409 SYSTEM_PLAYLIST is recognised in both envelope shapes", () => {
    expect(isSystemPlaylistRefusal({ response: { status: 409, data: { error: { code: "SYSTEM_PLAYLIST" } } } })).toBe(true);
    expect(isSystemPlaylistRefusal({ response: { status: 409, data: { code: "SYSTEM_PLAYLIST" } } })).toBe(true);
    expect(isSystemPlaylistRefusal({ response: { status: 409, data: { code: "CONFLICT" } } })).toBe(false);
    expect(isSystemPlaylistRefusal({ response: { status: 403 } })).toBe(false);
    expect(isSystemPlaylistRefusal(new Error("x"))).toBe(false);
  });
  test("Play all opens the first row with the list id; no rows, no link", () => {
    expect(playAllHref({ id: "pl 1" }, normalizeItems([{ post_id: "v/1", position: 0 }], "pl 1"))).toBe("/posttube/watch/v%2F1?list=pl%201");
    expect(playAllHref({ id: "pl" }, [])).toBeNull();
  });
});

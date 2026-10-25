import { describe, expect, test } from "bun:test";

import {
  HISTORY_PATH,
  SEARCH_TABS,
  buildTabRequest,
  emptyResultTitle,
  historyItemPath,
  isTopEmpty,
  nextTabIndex,
  parseHashtags,
  parseHistory,
  parsePeople,
  parsePopular,
  parseSearchTab,
  parseSounds,
  parseTop,
  parseVideos,
  postHref,
  searchPageHref,
  type SearchTabId,
} from "../searchModel";

describe("tabs", () => {
  test("Top · People · Videos · Reels · Sounds · Hashtags, and no LIVE tab", () => {
    expect(SEARCH_TABS.map((t) => t.label)).toEqual(["Top", "People", "Videos", "Reels", "Sounds", "Hashtags"]);
    expect(SEARCH_TABS.some((t) => /live/i.test(t.label))).toBe(false);
  });

  test("the URL's tab, with old ?type= spellings mapped and anything unknown falling back to Top", () => {
    expect(parseSearchTab("sounds")).toBe("sounds");
    expect(parseSearchTab("REELS")).toBe("reels");
    expect(parseSearchTab("profiles")).toBe("people");
    expect(parseSearchTab("all")).toBe("top");
    expect(parseSearchTab("posts")).toBe("top");
    expect(parseSearchTab("messages")).toBe("top");
    expect(parseSearchTab(null)).toBe("top");
  });

  test("arrow keys wrap, Home and End jump, other keys do nothing", () => {
    expect(nextTabIndex(0, "ArrowRight", 6)).toBe(1);
    expect(nextTabIndex(5, "ArrowRight", 6)).toBe(0);
    expect(nextTabIndex(0, "ArrowLeft", 6)).toBe(5);
    expect(nextTabIndex(3, "Home", 6)).toBe(0);
    expect(nextTabIndex(1, "End", 6)).toBe(5);
    expect(nextTabIndex(1, "Enter", 6)).toBeNull();
  });

  test("the page URL keeps the query and leaves the default tab out", () => {
    expect(searchPageHref("  cats ", "top")).toBe("/search?q=cats");
    expect(searchPageHref("a&b", "sounds")).toBe("/search?q=a%26b&tab=sounds");
    expect(searchPageHref("", "top")).toBe("/search");
  });
});

describe("request per tab", () => {
  const cases: [SearchTabId, string, Record<string, string | number>][] = [
    ["top", "/v1/search", { q: "cats", types: "users,posts,hashtags", limit: 10 }],
    ["people", "/v1/search/users", { q: "cats", limit: 20, record: 1 }],
    ["videos", "/v1/search/posts", { q: "cats", type: "videos", limit: 30 }],
    ["reels", "/v1/search/posts", { q: "cats", type: "flicks", limit: 60 }],
    ["sounds", "/v1/audio/search", { q: "cats", limit: 30, offset: 0 }],
    ["hashtags", "/v1/search/hashtags", { q: "cats", limit: 30, record: 1 }],
  ];
  for (const [tab, path, params] of cases) {
    test(`${tab} → ${path}`, () => {
      expect(buildTabRequest(tab, "  cats  ")).toEqual({ path, params });
    });
  }

  test("record=1 is sent only by People and Hashtags (the routes that record only on request)", () => {
    const recording = SEARCH_TABS.filter((t) => "record" in buildTabRequest(t.id, "x").params).map((t) => t.id);
    expect(recording).toEqual(["people", "hashtags"]);
  });
});

describe("recents and popular", () => {
  test("one entry is deleted by id; the bare path is clear-all", () => {
    expect(historyItemPath("6f1c0e9a-1111-4222-8333-444455556666")).toBe("/v1/search/history/6f1c0e9a-1111-4222-8333-444455556666");
    expect(historyItemPath("a/b")).toBe("/v1/search/history/a%2Fb");
    expect(HISTORY_PATH).toBe("/v1/search/history");
  });

  test("history rows keep server order and drop rows that cannot be removed", () => {
    const data = { items: [
      { id: "h1", user_id: "u", query: "cats", searched_at: "2026-10-14T10:00:00Z" },
      { id: "", query: "no id" },
      { id: "h2", query: "  dogs " },
      { id: "h1", query: "dupe" },
      { id: "h3", query: "" },
    ] };
    expect(parseHistory(data)).toEqual([{ id: "h1", query: "cats" }, { id: "h2", query: "dogs" }]);
    expect(parseHistory(null)).toEqual([]);
  });

  test("popular rows are {query}, deduped case-insensitively", () => {
    expect(parsePopular({ items: [{ query: "cricket" }, { query: "Cricket" }, { query: "" }, "recipes"] })).toEqual(["cricket", "recipes"]);
    expect(parsePopular([])).toEqual([]);
  });
});

describe("reading results", () => {
  test("people: avatar_url first, then the media route; Go's empty handle links by id", () => {
    const people = parsePeople({ items: [
      { user_id: "u1", username: "", display_name: "Asha", avatar_url: null, avatar_media_id: "m1", is_verified: true, follower_count: 12 },
      { user_id: "u2", username: "ravi", display_name: "", avatar_url: "https://cdn/x.jpg" },
      { username: "noid" },
    ] });
    expect(people.map((p) => [p.id, p.linkName, p.handle, p.name, p.avatarUrl, p.isVerified])).toEqual([
      ["u1", "u1", "", "Asha", "/v1/media/m1/serve", true],
      ["u2", "ravi", "ravi", "ravi", "https://cdn/x.jpg", false],
    ]);
  });

  test("hashtags: names from the hashtags route, objects from the ranked bucket", () => {
    expect(parseHashtags({ hashtags: ["food", "#Food", "travel"] })).toEqual([{ tag: "food", useCount: 0 }, { tag: "travel", useCount: 0 }]);
    expect(parseHashtags({ items: [{ hashtag: "food", use_count: 40 }] })).toEqual([{ tag: "food", useCount: 40 }]);
    expect(parseHashtags({ hashtags: null })).toEqual([]);
  });

  test("sounds: media-service tracks", () => {
    const sounds = parseSounds({ tracks: [{ id: "s1", title: "Rain", artist: "Meera", duration_ms: 30000, usage_count: 3 }, { title: "no id" }] });
    expect(sounds.map((s) => [s.id, s.title, s.artist, s.useCount])).toEqual([["s1", "Rain", "Meera", 3]]);
  });

  test("videos: watch-page rows", () => {
    const videos = parseVideos({ items: [{ id: "v1", title: "Trip", duration_ms: 125000, author: { username: "ravi", display_name: "Ravi" } }] });
    expect(videos[0]).toMatchObject({ id: "v1", title: "Trip", href: "/posttube/watch/v1", durationSeconds: 125, creatorName: "Ravi" });
  });

  test("top: three buckets, each post opening where it lives", () => {
    const top = parseTop({
      query_id: "q1",
      results: {
        users: { items: [{ user_id: "u1", username: "asha", display_name: "Asha" }], next_cursor: null },
        posts: { items: [
          { id: "p1", content_type: "long_video", title: "Long", like_count: 5 },
          { post_id: "p2", content_type: "flick", text: "dance\nmore" },
          { id: "p3", post_type: "text", text: "hello" },
        ], next_cursor: "c" },
        hashtags: { items: [{ hashtag: "dance", use_count: 9 }], next_cursor: null },
      },
    });
    expect(top.queryId).toBe("q1");
    expect(top.people.map((p) => p.id)).toEqual(["u1"]);
    expect(top.posts.map((p) => [p.id, p.kind, p.href, p.title])).toEqual([
      ["p1", "video", "/posttube/watch/p1", "Long"],
      ["p2", "reel", "/reels?reelId=p2", "dance"],
      ["p3", "post", "/post/p3", "hello"],
    ]);
    expect(top.hashtags).toEqual([{ tag: "dance", useCount: 9 }]);
    expect(isTopEmpty(top)).toBe(false);
    expect(isTopEmpty(parseTop({ results: {} }))).toBe(true);
    expect(postHref("a b", "post")).toBe("/post/a%20b");
  });

  test("empty-result words name the tab", () => {
    expect(emptyResultTitle("sounds", " rain ")).toBe("No sounds for “rain”");
    expect(emptyResultTitle("top", "x")).toBe("No results for “x”");
  });
});

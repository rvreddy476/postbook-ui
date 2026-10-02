import { describe, expect, test } from "bun:test";

import { browserDeviceId, deviceId, DEVICE_ID_KEY, isDeviceId } from "../deviceId";
import {
  checkRequests,
  createOfflineApi,
  DEFAULT_RECHECK_SECONDS,
  DEFAULT_TTL_MS,
  grantRequest,
  listRequest,
  OfflineGrantError,
  parseCheck,
  parseGrant,
  parseList,
  refusalOf,
  removeRequest,
  safeApiPath,
  wireTime,
  type OfflineHttp,
} from "../wire";

/* Fixtures shaped like the pinned contract (offline_grant.json, offline_check.json, offline_list.json). */
const NOW = Date.parse("2026-10-02T10:00:00Z");

const GRANT = {
  data: {
    post_id: "p1",
    expires_at: "2026-11-01T10:00:00Z",
    recheck_after_seconds: 172800,
    title: "A long video",
    channel_name: "Ravi",
    duration_ms: 754000,
    poster_path: "/v1/media/c1/serve/thumb",
    media: { media_id: "m1", variant: "720p", path: "/v1/media/m1/serve/720p", mime: "video/mp4", size_bytes: 123 },
    captions: [{ lang: "en", label: "English", path: "/v1/media/m1/subtitles/en.vtt" }],
    sound: { path: "/v1/audio/s1/serve", mime: "audio/mp4", size_bytes: 45 },
  },
};

const CHECK = {
  data: [
    { post_id: "p1", valid: true, expires_at: "2026-11-01T10:00:00Z" },
    { post_id: "p2", valid: false, reason: "deleted" },
    { post_id: "p3", valid: false, reason: "private" },
    { post_id: "p4", valid: false, reason: "not_allowed" },
  ],
};

const LIST = {
  data: [
    { post_id: "p1", expires_at: "2026-11-01T10:00:00Z", recheck_after_seconds: 172800, title: "A long video", channel_name: "Ravi", duration_ms: 754000, poster_path: "/v1/media/c1/serve/thumb", media: { media_id: "m1", variant: "720p", mime: "video/mp4", size_bytes: 123 }, captions: [], sound: null },
  ],
};

describe("the grant card", () => {
  test("reads every field of the contract's shape", () => {
    expect(parseGrant(GRANT, NOW)).toEqual({
      postId: "p1",
      title: "A long video",
      channelName: "Ravi",
      durationMs: 754000,
      posterPath: "/v1/media/c1/serve/thumb",
      expiresAt: Date.parse("2026-11-01T10:00:00Z"),
      recheckAfterSeconds: 172800,
      surface: null,
      media: { mediaId: "m1", variant: "720p", path: "/v1/media/m1/serve/720p", mime: "video/mp4", sizeBytes: 123 },
      captions: [{ lang: "en", label: "English", path: "/v1/media/m1/subtitles/en.vtt" }],
      sound: { path: "/v1/audio/s1/serve", mime: "audio/mp4", sizeBytes: 45, startMs: 0, originalVolume: 1, overlayVolume: 1 },
    });
  });

  test("Go zero values fall through exactly as absent ones do", () => {
    const zero = {
      data: {
        post_id: "p1",
        expires_at: "0001-01-01T00:00:00Z",
        recheck_after_seconds: 0,
        title: "",
        channel_name: "",
        duration_ms: 0,
        poster_path: "",
        media: { media_id: "m1", variant: "", path: "", mime: "", size_bytes: 0 },
        captions: null,
        sound: null,
      },
    };
    const absent = { data: { post_id: "p1", media: { media_id: "m1" } } };
    const want = {
      postId: "p1",
      title: "Untitled video",
      channelName: "",
      durationMs: null,
      posterPath: null,
      expiresAt: NOW + DEFAULT_TTL_MS,
      recheckAfterSeconds: DEFAULT_RECHECK_SECONDS,
      surface: null,
      media: { mediaId: "m1", variant: "720p", path: "/v1/media/m1/serve/720p", mime: "video/mp4", sizeBytes: null },
      captions: [],
      sound: null,
    };
    expect(parseGrant(zero, NOW)).toEqual(want);
    expect(parseGrant(absent, NOW)).toEqual(want);
    expect(parseGrant({ data: { ...zero.data, expires_at: "" } }, NOW)?.expiresAt).toBe(NOW + DEFAULT_TTL_MS);
  });

  test("an empty variant path is rebuilt from the media id and the granted variant, never the original", () => {
    const g = parseGrant({ data: { post_id: "p1", media: { media_id: "m 1", variant: "480p", path: "" } } }, NOW)!;
    expect(g.media.path).toBe("/v1/media/m%201/serve/480p");
  });

  test("a grant that names nothing fetchable is no grant", () => {
    expect(parseGrant({ data: { post_id: "p1", media: { media_id: "", path: "" } } }, NOW)).toBeNull();
    expect(parseGrant({ data: { post_id: "", media: { media_id: "m1" } } }, NOW)).toBeNull();
    expect(parseGrant({ data: { post_id: "p1" } }, NOW)).toBeNull();
    expect(parseGrant(null, NOW)).toBeNull();
    expect(parseGrant({ data: [] }, NOW)).toBeNull();
  });

  test("a sound with an empty path is no sound; a caption with an empty path is dropped; an empty label falls back to the language", () => {
    const g = parseGrant({ data: { ...GRANT.data, sound: { path: "", mime: "", size_bytes: 0 }, captions: [{ lang: "hi", label: "", path: "/v1/media/m1/subtitles/hi.vtt" }, { lang: "ta", label: "Tamil", path: "" }] } }, NOW)!;
    expect(g.sound).toBeNull();
    expect(g.captions).toEqual([{ lang: "hi", label: "hi", path: "/v1/media/m1/subtitles/hi.vtt" }]);
  });

  test("the creator's mix: a present 0 is a real 0, an absent volume is 1", () => {
    const g = parseGrant({ data: { ...GRANT.data, sound: { path: "/v1/audio/s1/serve", start_ms: 1500, original_volume: 0, overlay_volume: 0.5 } } }, NOW)!;
    expect(g.sound).toMatchObject({ startMs: 1500, originalVolume: 0, overlayVolume: 0.5 });
  });

  test("the content type, when the server sends one, decides the page's section", () => {
    expect(parseGrant({ data: { ...GRANT.data, content_type: "flick" } }, NOW)?.surface).toBe("reel");
    expect(parseGrant({ data: { ...GRANT.data, content_type: "long_video" } }, NOW)?.surface).toBe("video");
    expect(parseGrant({ data: { ...GRANT.data, content_type: "" } }, NOW)?.surface).toBeNull();
  });
});

describe("only our own serve paths are ever fetched", () => {
  test("a gateway path passes; anything else is refused", () => {
    expect(safeApiPath("/v1/media/m1/serve/720p")).toBe("/v1/media/m1/serve/720p");
    for (const bad of ["https://evil.example/v.mp4", "//evil.example/v.mp4", "/v1//evil", "/api/x", "v1/media/m1/serve", "", null, 7, "/v1/media\\x"]) {
      expect(safeApiPath(bad)).toBeNull();
    }
  });

  test("the attachment route is never a copy's source, even if a grant names it", () => {
    expect(safeApiPath("/v1/media/m1/download")).toBeNull();
    expect(safeApiPath("/v1/media/m1/download?x=1")).toBeNull();
    const g = parseGrant({ data: { post_id: "p1", media: { media_id: "m1", variant: "720p", path: "/v1/media/m1/download" } } }, NOW)!;
    expect(g.media.path).toBe("/v1/media/m1/serve/720p");
  });
});

describe("the check answer", () => {
  test("reads valid and invalid rows", () => {
    expect(parseCheck(CHECK)).toEqual([
      { postId: "p1", valid: true, expiresAt: Date.parse("2026-11-01T10:00:00Z"), renewable: true },
      { postId: "p2", valid: false, reason: "deleted" },
      { postId: "p3", valid: false, reason: "private" },
      { postId: "p4", valid: false, reason: "not_allowed" },
    ]);
  });

  test("an invalid row with no reason, or an unknown one, reads unknown; a zero expiry on a valid row is absent", () => {
    expect(parseCheck({ data: [{ post_id: "p1", valid: false, reason: "" }, { post_id: "p2", valid: false, reason: "brand_new" }, { post_id: "p3", valid: true, expires_at: "0001-01-01T00:00:00Z" }] })).toEqual([
      { postId: "p1", valid: false, reason: "unknown" },
      { postId: "p2", valid: false, reason: "unknown" },
      { postId: "p3", valid: true, expiresAt: null, renewable: true },
    ]);
  });

  test("a valid row is renewable unless it says `renewable: false` — absent, null and Go's zero-less true all mean try", () => {
    const rows = parseCheck({ data: [{ post_id: "a", valid: true }, { post_id: "b", valid: true, renewable: true }, { post_id: "c", valid: true, renewable: false }, { post_id: "d", valid: true, renewable: null }] });
    expect(rows.map((r) => [r.postId, r.valid && r.renewable])).toEqual([["a", true], ["b", true], ["c", false], ["d", true]]);
  });

  test("a row without `valid`, or without a post id, is dropped — nothing is deleted on a guess", () => {
    expect(parseCheck({ data: [{ post_id: "p1" }, { post_id: "", valid: false }, { valid: false, reason: "deleted" }, null, "x"] })).toEqual([]);
    expect(parseCheck({ data: null })).toEqual([]);
    expect(parseCheck(undefined)).toEqual([]);
  });
});

describe("the list", () => {
  test("reads the cards (no media.path on this route)", () => {
    expect(parseList(LIST, NOW)).toEqual([
      { postId: "p1", title: "A long video", channelName: "Ravi", durationMs: 754000, posterPath: "/v1/media/c1/serve/thumb", expiresAt: Date.parse("2026-11-01T10:00:00Z"), recheckAfterSeconds: 172800, surface: null },
    ]);
  });

  test("null, an empty array and rows without ids are an empty list", () => {
    expect(parseList({ data: null }, NOW)).toEqual([]);
    expect(parseList({ data: [] }, NOW)).toEqual([]);
    expect(parseList({ data: [{ post_id: "" }, null] }, NOW)).toEqual([]);
  });
});

describe("wireTime", () => {
  test("Go's zero time and the empty string are absent", () => {
    expect(wireTime("0001-01-01T00:00:00Z")).toBeNull();
    expect(wireTime("")).toBeNull();
    expect(wireTime(null)).toBeNull();
    expect(wireTime("not a time")).toBeNull();
    expect(wireTime("2026-11-01T10:00:00Z")).toBe(Date.parse("2026-11-01T10:00:00Z"));
  });
});

describe("request shapes", () => {
  test("every call carries the device id", () => {
    expect(grantRequest("p 1", "dev-1")).toEqual({ method: "POST", url: "/v1/posts/p%201/offline", body: { device_id: "dev-1" } });
    expect(listRequest("dev-1")).toEqual({ method: "GET", url: "/v1/posts/offline", params: { device_id: "dev-1" } });
    expect(removeRequest("p1", "dev-1")).toEqual({ method: "DELETE", url: "/v1/posts/p1/offline", body: { device_id: "dev-1" }, params: { device_id: "dev-1" } });
    expect(checkRequests(["p1", "p2", "p1", ""], "dev-1")).toEqual([{ method: "POST", url: "/v1/posts/offline/check", body: { device_id: "dev-1", post_ids: ["p1", "p2"] } }]);
  });

  test("a check never sends more than 100 ids in one request", () => {
    const ids = Array.from({ length: 230 }, (_, i) => `p${i}`);
    const reqs = checkRequests(ids, "dev-1");
    expect(reqs.map((r) => (r.body!.post_ids as string[]).length)).toEqual([100, 100, 30]);
    expect(checkRequests([], "dev-1")).toEqual([]);
  });

  test("the transport sends what the builders built, and parses what comes back", async () => {
    const sent: unknown[] = [];
    const http: OfflineHttp = {
      request: async (config) => {
        sent.push(config);
        if (config.method === "POST" && config.url.endsWith("/check")) return { data: CHECK };
        if (config.method === "GET") return { data: LIST };
        return { data: GRANT };
      },
    };
    const api = createOfflineApi(http, () => "dev-9", () => NOW);
    expect((await api.grant("p1")).media.path).toBe("/v1/media/m1/serve/720p");
    expect(await api.check(["p1", "p2"])).toHaveLength(4);
    expect(await api.list()).toHaveLength(1);
    await api.remove("p1");
    expect(sent).toEqual([
      { method: "POST", url: "/v1/posts/p1/offline", data: { device_id: "dev-9" }, params: undefined },
      { method: "POST", url: "/v1/posts/offline/check", data: { device_id: "dev-9", post_ids: ["p1", "p2"] }, params: undefined },
      { method: "GET", url: "/v1/posts/offline", data: undefined, params: { device_id: "dev-9" } },
      { method: "DELETE", url: "/v1/posts/p1/offline", data: { device_id: "dev-9" }, params: { device_id: "dev-9" } },
    ]);
  });

  test("a refused grant is a named refusal; an unreadable grant is a failure", async () => {
    const refuse = (status: number, code?: string): OfflineHttp => ({ request: async () => Promise.reject({ response: { status, data: code ? { error: { code } } : {} } }) });
    const of = async (http: OfflineHttp) => createOfflineApi(http, () => "d").grant("p1").then(() => "ok", (e: OfflineGrantError) => e.refusal);
    expect(await of(refuse(401))).toBe("sign_in");
    expect(await of(refuse(403, "OFFLINE_NOT_ALLOWED"))).toBe("not_allowed");
    expect(await of(refuse(409, "NOT_READY"))).toBe("not_ready");
    expect(await of(refuse(409, "OFFLINE_LIMIT"))).toBe("limit");
    expect(await of(refuse(404))).toBe("gone");
    expect(await of(refuse(422))).toBe("unsupported_kind");
    expect(await of(refuse(500))).toBe("failed");
    expect(await of({ request: async () => Promise.reject(new Error("Network Error")) })).toBe("network");
    expect(await of({ request: async () => ({ data: { data: { post_id: "p1" } } }) })).toBe("failed");
    expect(refusalOf({ response: { status: 409, data: { error: "OFFLINE_LIMIT" } } })).toBe("limit");
  });
});

describe("the device id", () => {
  const store = () => {
    const map = new Map<string, string>();
    return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
  };

  test("made once, kept in storage, and the same on every later read", () => {
    const s = store();
    const first = deviceId(s, () => "abcdef0123456789");
    expect(first).toBe("abcdef0123456789");
    expect(s.map.get(DEVICE_ID_KEY)).toBe(first);
    expect(deviceId(s, () => "something-else-entirely")).toBe(first);
  });

  test("at most 64 characters, opaque, and a damaged stored value is replaced", () => {
    const s = store();
    expect(deviceId(s, () => "x".repeat(200))).toHaveLength(64);
    s.map.set(DEVICE_ID_KEY, "bad id with spaces");
    expect(deviceId(s, () => "fresh-id-0001")).toBe("fresh-id-0001");
    expect(isDeviceId("short")).toBe(false);
    expect(isDeviceId("a".repeat(65))).toBe(false);
  });

  test("storage that throws still yields an id for the page", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(deviceId(broken, () => "page-only-id-1")).toBe("page-only-id-1");
    expect(deviceId(null, () => "page-only-id-2")).toBe("page-only-id-2");
    expect(isDeviceId(browserDeviceId())).toBe(true);
  });
});

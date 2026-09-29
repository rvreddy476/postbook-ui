import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import { API_GATEWAY_URL } from "@/app/api/auth/_lib/session";

import { GET, HEAD } from "../route";

/*
  The feed route against a stubbed upstream: what it asks post-service
  for, and what it answers a podcast app with.
*/

const MEDIA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const BODY = {
  data: {
    channel: {
      user_id: "22222222-2222-4222-8222-222222222222",
      name: "Raghu Builds",
      handle: "raghu.builds",
      about: "Weekly builds",
      avatar_media_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      avatar_url: null,
      contact_email: "hello@example.com",
      language: "en",
      dominant_category: "science-tech",
    },
    category: "",
    updated_at: "2026-09-29T08:00:00Z",
    items: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "A bench in a weekend",
        text: "Notes",
        category: "podcasts",
        language: "en",
        hashtags: [],
        published_at: "2026-09-28T10:05:09Z",
        media_id: MEDIA,
        duration_ms: 3_725_000,
        cover_media_id: "",
        enclosure: { variant: "720p", path: `/v1/media/${MEDIA}/serve/720p`, mime: "video/mp4", size_bytes: 123_456_789 },
      },
    ],
  },
};

interface Call {
  url: string;
  init?: RequestInit;
}

let calls: Call[] = [];
const realFetch = globalThis.fetch;
const realWarn = console.warn;
const ENV_KEYS = ["NEXT_PUBLIC_SITE_URL", "FEED_MEDIA_BASE_URL", "NEXT_PUBLIC_API_BASE_URL"] as const;
const savedEnv: Record<string, string | undefined> = {};

function stubFetch(answer: () => Response | Promise<Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input instanceof Request ? input.url : input), init });
    return answer();
  }) as typeof fetch;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const ctx = (handle: string) => ({ params: Promise.resolve({ handle }) });

function req(path: string, init: RequestInit = {}): Request {
  return new Request(`https://cleestudio.com${path}`, init);
}

beforeEach(() => {
  calls = [];
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.NEXT_PUBLIC_SITE_URL = "https://cleestudio.com";
  process.env.FEED_MEDIA_BASE_URL = "https://api-dev.cleestudio.com";
  process.env.NEXT_PUBLIC_API_BASE_URL = "";
  stubFetch(() => json(BODY));
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("GET feed.xml", () => {
  test("200: the feed, its type, the shared-cache header, a weak sha1 ETag and Last-Modified", async () => {
    const res = await GET(req("/posttube/channel/raghu.builds/feed.xml"), ctx("raghu.builds"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=600, stale-while-revalidate=3600");
    expect(res.headers.get("Last-Modified")).toBe("Tue, 29 Sep 2026 08:00:00 GMT");
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(res.headers.get("Vary")).toBeNull();

    const xml = await res.text();
    expect(res.headers.get("ETag")).toBe(`W/"${createHash("sha1").update(xml).digest("hex")}"`);
    expect(xml).toContain("<title>Raghu Builds</title>");
    expect(xml).toContain('<atom:link href="https://cleestudio.com/posttube/channel/raghu.builds/feed.xml" rel="self" type="application/rss+xml"/>');
    expect(xml).toContain(`<enclosure url="https://api-dev.cleestudio.com/v1/media/${MEDIA}/serve/720p" length="123456789" type="video/mp4"/>`);
    expect(xml).toContain("<link>https://cleestudio.com/posttube/watch/11111111-1111-4111-8111-111111111111</link>");
  });

  test("asks the gateway for the channel's feed, 50 at most, and sends no identity", async () => {
    await GET(req("/posttube/channel/raghu.builds/feed.xml", { headers: { Cookie: "pb_auth=1", Authorization: "Bearer secret", "X-User-Id": "someone" } }), ctx("raghu.builds"));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${API_GATEWAY_URL}/v1/channels/raghu.builds/feed?limit=50`);
    const sent = new Headers(calls[0].init?.headers);
    expect(sent.get("cookie")).toBeNull();
    expect(sent.get("authorization")).toBeNull();
    expect(sent.get("x-user-id")).toBeNull();
    expect((calls[0].init?.method ?? "GET").toUpperCase()).toBe("GET");
  });

  test("a leading @ is stripped, encoded or not", async () => {
    await GET(req("/posttube/channel/@raghu.builds/feed.xml"), ctx("@raghu.builds"));
    await GET(req("/posttube/channel/%40raghu.builds/feed.xml"), ctx("%40raghu.builds"));
    expect(calls.map((c) => c.url)).toEqual([`${API_GATEWAY_URL}/v1/channels/raghu.builds/feed?limit=50`, `${API_GATEWAY_URL}/v1/channels/raghu.builds/feed?limit=50`]);
  });

  test("a category that is a slug is forwarded and carried by the self link", async () => {
    stubFetch(() => json({ data: { ...BODY.data, category: "podcasts" } }));
    const res = await GET(req("/posttube/channel/raghu.builds/feed.xml?category=podcasts"), ctx("raghu.builds"));
    expect(calls[0].url).toBe(`${API_GATEWAY_URL}/v1/channels/raghu.builds/feed?category=podcasts&limit=50`);
    const xml = await res.text();
    expect(xml).toContain("<title>Raghu Builds · Podcasts</title>");
    expect(xml).toContain('<atom:link href="https://cleestudio.com/posttube/channel/raghu.builds/feed.xml?category=podcasts" rel="self"');
  });

  test("a category that is not a slug is not forwarded", async () => {
    for (const bad of ["Podcasts", "a%20b", "x%26limit%3D500", "..%2Fme", "a".repeat(33), "pod<casts>"]) {
      calls = [];
      const res = await GET(req(`/posttube/channel/raghu.builds/feed.xml?category=${bad}`), ctx("raghu.builds"));
      expect(res.status).toBe(200);
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe(`${API_GATEWAY_URL}/v1/channels/raghu.builds/feed?limit=50`);
      expect(await res.text()).not.toContain("?category=");
    }
  });

  test("the self link is the channel's own address, whatever ref was asked for", async () => {
    const res = await GET(req("/posttube/channel/22222222-2222-4222-8222-222222222222/feed.xml"), ctx("22222222-2222-4222-8222-222222222222"));
    expect(calls[0].url).toBe(`${API_GATEWAY_URL}/v1/channels/22222222-2222-4222-8222-222222222222/feed?limit=50`);
    expect(await res.text()).toContain('<atom:link href="https://cleestudio.com/posttube/channel/raghu.builds/feed.xml" rel="self"');
  });

  test("If-None-Match with the current ETag: 304, no body, the validators repeated", async () => {
    const first = await GET(req("/posttube/channel/raghu.builds/feed.xml"), ctx("raghu.builds"));
    const etag = first.headers.get("ETag") as string;
    expect(etag).toMatch(/^W\/"[0-9a-f]{40}"$/);

    for (const header of [etag, etag.replace(/^W\//, ""), `"other", ${etag}`, "*"]) {
      const res = await GET(req("/posttube/channel/raghu.builds/feed.xml", { headers: { "If-None-Match": header } }), ctx("raghu.builds"));
      expect(res.status).toBe(304);
      expect(await res.text()).toBe("");
      expect(res.headers.get("ETag")).toBe(etag);
      expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=600, stale-while-revalidate=3600");
      expect(res.headers.get("Last-Modified")).toBe("Tue, 29 Sep 2026 08:00:00 GMT");
    }

    const stale = await GET(req("/posttube/channel/raghu.builds/feed.xml", { headers: { "If-None-Match": 'W/"0000"' } }), ctx("raghu.builds"));
    expect(stale.status).toBe(200);
    expect(await stale.text()).toContain("<rss ");
  });

  test("the ETag moves when the feed does", async () => {
    const a = await GET(req("/posttube/channel/raghu.builds/feed.xml"), ctx("raghu.builds"));
    stubFetch(() => json({ data: { ...BODY.data, items: [] } }));
    const b = await GET(req("/posttube/channel/raghu.builds/feed.xml"), ctx("raghu.builds"));
    expect(b.status).toBe(200);
    expect(b.headers.get("ETag")).not.toBe(a.headers.get("ETag"));
    expect(await b.text()).not.toContain("<item>");
  });

  test("upstream 404 (no channel, or a hidden owner) is a 404", async () => {
    stubFetch(() => json({ error: { code: "NOT_FOUND" } }, 404));
    const res = await GET(req("/posttube/channel/nobody/feed.xml"), ctx("nobody"));
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Type")).not.toContain("rss");
    expect(await res.text()).not.toContain("<rss");
  });

  test("upstream 400 (a category that is not ours) is a 404", async () => {
    stubFetch(() => json({ error: { code: "INVALID_CATEGORY" } }, 400));
    const res = await GET(req("/posttube/channel/raghu.builds/feed.xml?category=no-such-topic"), ctx("raghu.builds"));
    expect(res.status).toBe(404);
  });

  test("upstream 5xx, a refused connection and a body that is not a feed are a 502, never cached", async () => {
    const answers: (() => Response | Promise<Response>)[] = [
      () => json({ error: "boom" }, 500),
      () => json({ error: "later" }, 503),
      () => Promise.reject(new Error("ECONNREFUSED")),
      () => new Response("<html>gateway</html>", { status: 200 }),
      () => json({ data: { items: [] } }),
    ];
    for (const answer of answers) {
      stubFetch(answer);
      const res = await GET(req("/posttube/channel/raghu.builds/feed.xml"), ctx("raghu.builds"));
      expect(res.status).toBe(502);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(res.headers.get("ETag")).toBeNull();
    }
  });

  test("a ref that could walk a path never reaches the gateway", async () => {
    for (const bad of ["..", "%2E%2E", "a%2Fb", "me%3Fx%3D1", "a..b", "x".repeat(65)]) {
      const res = await GET(req(`/posttube/channel/${bad}/feed.xml`), ctx(bad));
      expect(res.status).toBe(404);
    }
    expect(calls).toHaveLength(0);
  });

  test("no media origin: the feed still answers, without enclosures, and says so once", async () => {
    process.env.FEED_MEDIA_BASE_URL = "";
    process.env.NEXT_PUBLIC_API_BASE_URL = "";
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));
    const a = await GET(req("/posttube/channel/raghu.builds/feed.xml"), ctx("raghu.builds"));
    const b = await GET(req("/posttube/channel/raghu.builds/feed.xml"), ctx("raghu.builds"));
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const xml = await a.text();
    expect(xml).toContain("<item>");
    expect(xml).not.toContain("<enclosure");
    expect(xml).not.toMatch(/(?:href|url)="\//);
    expect(warnings.filter((w) => w.includes("FEED_MEDIA_BASE_URL"))).toHaveLength(1);
  });

  test("FEED_MEDIA_BASE_URL unset falls back to NEXT_PUBLIC_API_BASE_URL", async () => {
    delete process.env.FEED_MEDIA_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.cleestudio.com";
    const res = await GET(req("/posttube/channel/raghu.builds/feed.xml"), ctx("raghu.builds"));
    expect(await res.text()).toContain(`<enclosure url="https://api.cleestudio.com/v1/media/${MEDIA}/serve/720p"`);
  });
});

describe("HEAD feed.xml", () => {
  test("the GET's headers and no body", async () => {
    const get = await GET(req("/posttube/channel/raghu.builds/feed.xml"), ctx("raghu.builds"));
    const xml = await get.text();
    const res = await HEAD(req("/posttube/channel/raghu.builds/feed.xml", { method: "HEAD" }), ctx("raghu.builds"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    expect(res.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=600, stale-while-revalidate=3600");
    expect(res.headers.get("ETag")).toBe(get.headers.get("ETag"));
    expect(res.headers.get("Last-Modified")).toBe("Tue, 29 Sep 2026 08:00:00 GMT");
    expect(res.headers.get("Content-Length")).toBe(String(Buffer.byteLength(xml, "utf8")));
  });

  test("304 and 404 carry no body either", async () => {
    const get = await GET(req("/posttube/channel/raghu.builds/feed.xml"), ctx("raghu.builds"));
    const etag = get.headers.get("ETag") as string;
    const same = await HEAD(req("/posttube/channel/raghu.builds/feed.xml", { method: "HEAD", headers: { "If-None-Match": etag } }), ctx("raghu.builds"));
    expect(same.status).toBe(304);
    expect(await same.text()).toBe("");

    stubFetch(() => json({}, 404));
    const gone = await HEAD(req("/posttube/channel/nobody/feed.xml", { method: "HEAD" }), ctx("nobody"));
    expect(gone.status).toBe(404);
    expect(await gone.text()).toBe("");
  });
});

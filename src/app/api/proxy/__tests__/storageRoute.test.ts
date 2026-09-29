import { describe, expect, test } from "bun:test";

import { internalTarget, isRedirect, readStorageRoute, responseHeaders, storageRequestHeaders, withoutQuery } from "../_lib/storageRoute";

const ROUTE = { MEDIA_STORAGE_PUBLIC_ORIGIN: "https://media-dev.example.test", MEDIA_STORAGE_INTERNAL_ORIGIN: "http://minio:9000" };

describe("the storage route", () => {
  test("is read from the two origins", () => {
    const route = readStorageRoute(ROUTE)!;
    expect(route.publicOrigin).toBe("https://media-dev.example.test");
    expect(route.internal.origin).toBe("http://minio:9000");
  });

  test("tolerates a trailing slash and surrounding space", () => {
    const route = readStorageRoute({ MEDIA_STORAGE_PUBLIC_ORIGIN: " https://media-dev.example.test/ ", MEDIA_STORAGE_INTERNAL_ORIGIN: "http://minio:9000/" })!;
    expect(route.publicOrigin).toBe("https://media-dev.example.test");
  });

  test("is off unless both sides are bare http(s) origins", () => {
    expect(readStorageRoute({})).toBeNull();
    expect(readStorageRoute({ MEDIA_STORAGE_PUBLIC_ORIGIN: ROUTE.MEDIA_STORAGE_PUBLIC_ORIGIN })).toBeNull();
    expect(readStorageRoute({ MEDIA_STORAGE_INTERNAL_ORIGIN: ROUTE.MEDIA_STORAGE_INTERNAL_ORIGIN })).toBeNull();
    expect(readStorageRoute({ ...ROUTE, MEDIA_STORAGE_INTERNAL_ORIGIN: "minio:9000" })).toBeNull();
    expect(readStorageRoute({ ...ROUTE, MEDIA_STORAGE_INTERNAL_ORIGIN: "ftp://minio" })).toBeNull();
    expect(readStorageRoute({ ...ROUTE, MEDIA_STORAGE_INTERNAL_ORIGIN: "http://minio:9000/media" })).toBeNull();
    expect(readStorageRoute({ ...ROUTE, MEDIA_STORAGE_INTERNAL_ORIGIN: "http://user:pw@minio:9000" })).toBeNull();
    expect(readStorageRoute({ ...ROUTE, MEDIA_STORAGE_PUBLIC_ORIGIN: "https://media-dev.example.test/?x=1" })).toBeNull();
    expect(readStorageRoute({ MEDIA_STORAGE_PUBLIC_ORIGIN: "http://minio:9000", MEDIA_STORAGE_INTERNAL_ORIGIN: "http://minio:9000" })).toBeNull();
  });
});

describe("the internal target", () => {
  const route = readStorageRoute(ROUTE);
  const signed = new URL("https://media-dev.example.test/media/user/u1/m1/720p?X-Amz-Expires=300&X-Amz-Signature=abc%2Fdef");

  test("is the signed link's own path and query on the internal origin, under the signed Host", () => {
    expect(internalTarget(signed, route)).toEqual({
      protocol: "http:",
      hostname: "minio",
      port: 9000,
      path: "/media/user/u1/m1/720p?X-Amz-Expires=300&X-Amz-Signature=abc%2Fdef",
      hostHeader: "media-dev.example.test",
    });
  });

  test("keeps a port the link was signed with, and defaults the internal one", () => {
    const r = readStorageRoute({ MEDIA_STORAGE_PUBLIC_ORIGIN: "http://localhost:9000", MEDIA_STORAGE_INTERNAL_ORIGIN: "https://storage.internal" });
    expect(internalTarget(new URL("http://localhost:9000/media/a?b=1"), r)).toEqual({ protocol: "https:", hostname: "storage.internal", port: 443, path: "/media/a?b=1", hostHeader: "localhost:9000" });
    const plain = readStorageRoute({ MEDIA_STORAGE_PUBLIC_ORIGIN: "https://media-dev.example.test", MEDIA_STORAGE_INTERNAL_ORIGIN: "http://storage" });
    expect(internalTarget(signed, plain)?.port).toBe(80);
  });

  test("is only for the public storage origin", () => {
    expect(internalTarget(new URL("https://elsewhere.example.test/media/user/u1/m1/720p"), route)).toBeNull();
    expect(internalTarget(new URL("http://media-dev.example.test/media/x"), route)).toBeNull();
    expect(internalTarget(new URL("https://media-dev.example.test:8443/media/x"), route)).toBeNull();
    expect(internalTarget(new URL("https://media-dev.example.test.evil.test/media/x"), route)).toBeNull();
    expect(internalTarget(signed, null)).toBeNull();
  });
});

describe("what leaves the gateway", () => {
  test("carries the byte range and never the session", () => {
    const forwarded = new Headers({
      cookie: "access_token=secret",
      authorization: "Bearer secret",
      "x-csrf-token": "secret",
      "x-user-id": "u1",
      "idempotency-key": "k",
      "content-type": "application/json",
      range: "bytes=100-",
      "if-range": '"etag"',
      accept: "*/*",
    });
    expect(storageRequestHeaders(forwarded)).toEqual({ range: "bytes=100-", "if-range": '"etag"', accept: "*/*" });
    expect(storageRequestHeaders(new Headers())).toEqual({});
  });
});

describe("response headers", () => {
  test("drop the hop-by-hop ones and keep the rest", () => {
    const h = responseHeaders(Object.entries({ "content-range": "bytes 0-1/2", "Transfer-Encoding": "chunked", connection: "keep-alive", "keep-alive": "timeout=5", "content-type": "video/mp4", etag: undefined }));
    expect(h.get("content-range")).toBe("bytes 0-1/2");
    expect(h.get("content-type")).toBe("video/mp4");
    expect(h.get("transfer-encoding")).toBeNull();
    expect(h.get("connection")).toBeNull();
    expect(h.get("keep-alive")).toBeNull();
  });

  test("keep every cookie, in either shape", () => {
    expect(responseHeaders([["set-cookie", ["a=1", "b=2"]]]).getSetCookie()).toEqual(["a=1", "b=2"]);
    expect(
      responseHeaders([
        ["set-cookie", "a=1"],
        ["set-cookie", "b=2"],
      ]).getSetCookie(),
    ).toEqual(["a=1", "b=2"]);
  });
});

describe("helpers", () => {
  test("redirect statuses", () => {
    for (const s of [301, 302, 303, 307, 308]) expect(isRedirect(s)).toBe(true);
    for (const s of [200, 206, 304, 400, 404, 500]) expect(isRedirect(s)).toBe(false);
  });

  test("a link is logged without its query", () => {
    expect(withoutQuery("https://media-dev.example.test/media/a/b?X-Amz-Signature=abc")).toBe("https://media-dev.example.test/media/a/b");
    expect(withoutQuery(new URL("http://gw:8080/v1/media/x/serve?token=t"))).toBe("http://gw:8080/v1/media/x/serve");
    expect(withoutQuery("not a url")).toBe("(unparseable url)");
  });
});

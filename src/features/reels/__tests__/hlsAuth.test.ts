import { describe, expect, test } from "bun:test";
import type { HlsConfig } from "hls.js";

import { elementCrossOrigin, isApiUrl } from "@/features/reels/playback/hlsAuth";
import { SignedPlaylistRefresher, signedHlsConfig } from "@/features/reels/playback/hlsRefresh";

/*
  reels-2: the CDN answers CORS with allow-credentials=false, so only API
  routes may carry the cookie. The production shape: the app on
  app.cleestudio.com, the API on api.cleestudio.com
  (NEXT_PUBLIC_API_BASE_URL, forced by build-web.yml), segments on
  media.cleestudio.com. Dev: NEXT_PUBLIC_API_BASE_URL="" (the /v1 proxy).
*/

const PROD = { apiBase: "https://api.cleestudio.com", pageOrigin: "https://app.cleestudio.com" };
const DEV = { apiBase: "", pageOrigin: "http://localhost:3000" };

const MASTER = "https://api.cleestudio.com/v1/media/m1/hls";
const CHILD = "https://api.cleestudio.com/v1/media/m1/hls/720p.m3u8";
const SEGMENT = "https://media.cleestudio.com/m1/hls/720p_00001.ts?Policy=p&Signature=s&Key-Pair-Id=k";
const SERVE = "https://api.cleestudio.com/v1/media/m1/serve";

describe("isApiUrl: who gets the cookie", () => {
  test("production: API playlists yes, CDN segments no", () => {
    expect(isApiUrl(MASTER, PROD)).toBe(true);
    expect(isApiUrl(CHILD, PROD)).toBe(true);
    expect(isApiUrl(SERVE, PROD)).toBe(true);
    expect(isApiUrl(SEGMENT, PROD)).toBe(false);
    expect(isApiUrl("https://media.cleestudio.com/public/x.ts", PROD)).toBe(false);
  });
  test("dev: the same-origin proxy yes, the object store no", () => {
    expect(isApiUrl("/v1/media/m1/hls", DEV)).toBe(true);
    expect(isApiUrl("http://localhost:3000/v1/media/m1/hls/720p.m3u8", DEV)).toBe(true);
    expect(isApiUrl("http://minio.local:9000/media/m1/hls/720p_00001.ts?X-Amz-Signature=s", DEV)).toBe(false);
  });
  test("a look-alike host is not the API", () => {
    expect(isApiUrl("https://api.cleestudio.com.evil.test/v1/media/m1/hls", PROD)).toBe(false);
    expect(isApiUrl("//media.cleestudio.com/x.ts", PROD)).toBe(false);
  });
});

describe("the hls.js config both players build", () => {
  const HlsStub = { DefaultConfig: { loader: class {} } as unknown as HlsConfig };

  test("xhrSetup sets withCredentials per request: true for playlists, false for segments", () => {
    const cfg = signedHlsConfig(HlsStub, new SignedPlaylistRefresher(), { maxBufferLength: 30 });
    expect(cfg.maxBufferLength).toBe(30);
    expect(cfg.pLoader).toBeDefined();
    expect(cfg.fLoader).toBeDefined();
    const prev = process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = PROD.apiBase;
    try {
      const xhr = { withCredentials: true } as XMLHttpRequest;
      cfg.xhrSetup!(xhr, SEGMENT);
      expect(xhr.withCredentials).toBe(false);
      cfg.xhrSetup!(xhr, CHILD);
      expect(xhr.withCredentials).toBe(true);
      cfg.xhrSetup!(xhr, MASTER);
      expect(xhr.withCredentials).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
      else process.env.NEXT_PUBLIC_API_BASE_URL = prev;
    }
  });
});

describe("the <video> crossorigin for a source it loads itself", () => {
  test("hls.js (blob:) and CDN or same-origin sources: anonymous, never use-credentials", () => {
    expect(elementCrossOrigin("blob:https://app.cleestudio.com/1234", PROD)).toBe("anonymous");
    expect(elementCrossOrigin(SEGMENT, PROD)).toBe("anonymous");
    expect(elementCrossOrigin("/v1/media/m1/serve", DEV)).toBe("anonymous");
    expect(elementCrossOrigin(null, PROD)).toBe("anonymous");
  });
  test("a cross-origin API route that redirects to the CDN: no attribute (cookie sent, redirect not CORS-checked)", () => {
    expect(elementCrossOrigin(SERVE, PROD)).toBeNull();
    expect(elementCrossOrigin(MASTER, PROD)).toBeNull();
  });
});

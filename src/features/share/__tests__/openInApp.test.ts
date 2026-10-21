import { describe, expect, test } from "bun:test";

import { bannerDecision, bannerLinks, DISMISS_FOR_MS, isAppRoute, PHONE_MAX_WIDTH, platformOf } from "../openInApp";

/* The "Open in app" banner's rules: where, for whom, and where its buttons go. */

const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const ID = "3f860f61-ddb6-4be6-98e6-3b892e9c584f";
const PLAY = "https://play.google.com/store/apps/details?id=com.us.android";

const base = { pathname: `/post/${ID}`, userAgent: ANDROID, width: 375, dismissedAt: null, now: 1_000_000, playStoreUrl: PLAY };

describe("isAppRoute", () => {
  test("every route a shared link lands on, and no other", () => {
    for (const path of [
      `/post/${ID}`,
      `/reels/${ID}`,
      `/posttube/watch/${ID}`,
      "/shop/products/prod_123",
      "/u/raghu.builds",
      "/posttube/channel/raghu.builds",
      "/channel/raghu",
      `/reels/sound/${ID}`,
      "/hashtag/workshop",
      `/post/${ID}/`,
    ]) {
      expect(isAppRoute(path)).toBe(true);
    }
    for (const path of ["/", "/feed", "/reels", "/reels/create", "/post/not-a-uuid", "/shop", "/shop/bag", "/u/", "/login", "/settings", null, ""]) {
      expect(isAppRoute(path)).toBe(false);
    }
  });
});

describe("platformOf", () => {
  test("android, iphone, and everything else (an iPad reads as a Mac)", () => {
    expect(platformOf(ANDROID)).toBe("android");
    expect(platformOf(IPHONE)).toBe("ios");
    expect(platformOf(DESKTOP)).toBe("other");
    expect(platformOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari")).toBe("other");
    expect(platformOf(null)).toBe("other");
  });
});

describe("bannerDecision", () => {
  test("an Android phone on a shared route: both buttons when the store link is set", () => {
    expect(bannerDecision(base)).toEqual({ show: true, platform: "android", openInApp: true, getTheApp: true });
    expect(bannerDecision({ ...base, playStoreUrl: "" })).toEqual({ show: true, platform: "android", openInApp: true, getTheApp: false });
  });

  test("phone width only: a tablet or a narrowed desktop window gets nothing", () => {
    expect(bannerDecision({ ...base, width: PHONE_MAX_WIDTH })).toMatchObject({ show: true });
    expect(bannerDecision({ ...base, width: PHONE_MAX_WIDTH + 1 })).toEqual({ show: false });
    expect(bannerDecision({ ...base, width: null })).toEqual({ show: false });
    expect(bannerDecision({ ...base, userAgent: DESKTOP })).toEqual({ show: false });
  });

  test("only on the routes a shared link lands on", () => {
    expect(bannerDecision({ ...base, pathname: "/feed" })).toEqual({ show: false });
    expect(bannerDecision({ ...base, pathname: "/reels" })).toEqual({ show: false });
  });

  test("dismissed: gone for a week, then back", () => {
    expect(bannerDecision({ ...base, dismissedAt: base.now - DISMISS_FOR_MS + 1 })).toEqual({ show: false });
    expect(bannerDecision({ ...base, dismissedAt: base.now - DISMISS_FOR_MS })).toMatchObject({ show: true });
  });

  test("an iPhone only when there is an App Store link, and then only Get the app", () => {
    expect(bannerDecision({ ...base, userAgent: IPHONE })).toEqual({ show: false });
    expect(bannerDecision({ ...base, userAgent: IPHONE, appStoreUrl: "https://apps.apple.com/app/id1" })).toEqual({ show: true, platform: "ios", openInApp: false, getTheApp: true });
  });
});

describe("bannerLinks", () => {
  const pageUrl = `https://cleestudio.com/post/${ID}?ref=k7x2m9q4pz&utm_source=share`;

  test("android: the intent falls back to the store, and the store carries the ref and the path", () => {
    const links = bannerLinks({ platform: "android", pageUrl, ref: "k7x2m9q4pz", playStoreUrl: PLAY });
    expect(links.getTheApp).toContain("play.google.com");
    const referrer = new URLSearchParams(new URL(links.getTheApp!).searchParams.get("referrer")!);
    expect(referrer.get("ref")).toBe("k7x2m9q4pz");
    expect(referrer.get("link")).toBe(`/post/${ID}?ref=k7x2m9q4pz&utm_source=share`);
    expect(links.openInApp).toContain(`S.browser_fallback_url=${encodeURIComponent(links.getTheApp!)};end`);
    expect(links.openInApp).toContain("package=com.us.android;");
  });

  test("android with no store: the intent falls back to the page; the flavour is named when given", () => {
    const links = bannerLinks({ platform: "android", pageUrl, ref: null, playStoreUrl: "", packageName: "com.us.android.dev" });
    expect(links.getTheApp).toBeNull();
    expect(links.openInApp).toContain("package=com.us.android.dev;");
    expect(links.openInApp).toContain(`S.browser_fallback_url=${encodeURIComponent(pageUrl)};end`);
  });

  test("ios: only the App Store page, and only over https", () => {
    expect(bannerLinks({ platform: "ios", pageUrl, ref: null, playStoreUrl: PLAY, appStoreUrl: "https://apps.apple.com/app/id1" })).toEqual({ openInApp: null, getTheApp: "https://apps.apple.com/app/id1" });
    expect(bannerLinks({ platform: "ios", pageUrl, ref: null, playStoreUrl: PLAY, appStoreUrl: "http://apps.apple.com/app/id1" }).getTheApp).toBeNull();
  });

  test("nothing personal ever rides a link", () => {
    const links = bannerLinks({ platform: "android", pageUrl, ref: "k7x2m9q4pz", playStoreUrl: PLAY });
    for (const href of [links.openInApp!, links.getTheApp!]) {
      expect(href).not.toMatch(/user|email|token|session|cookie/i);
    }
  });
});

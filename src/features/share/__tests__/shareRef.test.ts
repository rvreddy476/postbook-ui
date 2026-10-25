import { describe, expect, test } from "bun:test";

import { appIntentHref, isShareRefId, newShareRef, playStoreHref, shareRefOf, withShareRef } from "../shareRef";

/* The share ref every link carries, and the two app links built from it. */

const POST = "https://cleestudio.com/post/3f860f61-ddb6-4be6-98e6-3b892e9c584f";

describe("newShareRef", () => {
  test("ten lower-case base36 characters, from the bytes it is given", () => {
    const ref = newShareRef();
    expect(ref).toMatch(/^[a-z0-9]{10}$/);
    expect(isShareRefId(ref)).toBe(true);
    expect(newShareRef(() => new Uint8Array(10))).toBe("aaaaaaaaaa");
    expect(newShareRef()).not.toBe(newShareRef());
  });

  test("only our shape is a ref", () => {
    expect(isShareRefId("abc")).toBe(false);
    expect(isShareRefId("ABCDEF")).toBe(false);
    expect(isShareRefId("raghu@example.com")).toBe(false);
    expect(isShareRefId(null)).toBe(false);
  });
});

describe("withShareRef", () => {
  test("appends ?ref=<id>&utm_source=share and nothing else", () => {
    expect(withShareRef(POST, "k7x2m9q4pz")).toBe(`${POST}?ref=k7x2m9q4pz&utm_source=share`);
  });

  test("keeps other query parameters and the fragment; a ref already there wins", () => {
    expect(withShareRef("https://cleestudio.com/posttube/watch/x?t=42#top", "k7x2m9q4pz")).toBe("https://cleestudio.com/posttube/watch/x?t=42&ref=k7x2m9q4pz&utm_source=share#top");
    expect(withShareRef(`${POST}?ref=abcd1234`, "k7x2m9q4pz")).toBe(`${POST}?ref=abcd1234&utm_source=share`);
    expect(withShareRef(`${POST}?ref=NOT-OURS`, "k7x2m9q4pz")).toBe(`${POST}?ref=k7x2m9q4pz&utm_source=share`);
  });

  test("an empty url, or a ref that is not ours, leaves the url alone", () => {
    expect(withShareRef("", "k7x2m9q4pz")).toBe("");
    expect(withShareRef(POST, "bad ref")).toBe(POST);
  });

  test("shareRefOf reads it back, from a search string or params", () => {
    expect(shareRefOf("?ref=k7x2m9q4pz&utm_source=share")).toBe("k7x2m9q4pz");
    expect(shareRefOf(new URLSearchParams("ref=k7x2m9q4pz"))).toBe("k7x2m9q4pz");
    expect(shareRefOf("?ref=<script>")).toBeNull();
    expect(shareRefOf("")).toBeNull();
  });
});

describe("playStoreHref", () => {
  test("the store page with an Install Referrer: source, ref and the page's path", () => {
    const href = playStoreHref("https://play.google.com/store/apps/details?id=com.us.android", { ref: "k7x2m9q4pz", link: "/post/abc?ref=k7x2m9q4pz#x" })!;
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe("https://play.google.com/store/apps/details");
    expect(url.searchParams.get("id")).toBe("com.us.android");
    const referrer = new URLSearchParams(url.searchParams.get("referrer")!);
    expect(referrer.get("utm_source")).toBe("share");
    expect(referrer.get("ref")).toBe("k7x2m9q4pz");
    expect(referrer.get("link")).toBe("/post/abc?ref=k7x2m9q4pz");
  });

  test("no store url, or not https, is no link; a link with a host is dropped", () => {
    expect(playStoreHref("", { ref: "k7x2m9q4pz" })).toBeNull();
    expect(playStoreHref("http://play.google.com/x", {})).toBeNull();
    const referrer = new URLSearchParams(new URL(playStoreHref("https://play.google.com/store/apps/details?id=x", { link: "//evil.test/p" })!).searchParams.get("referrer")!);
    expect(referrer.get("link")).toBeNull();
  });
});

describe("appIntentHref", () => {
  test("intent:// for the page, the package, and the fallback", () => {
    const page = `${POST}?ref=k7x2m9q4pz&utm_source=share`;
    const href = appIntentHref(page, { fallbackUrl: "https://play.google.com/store/apps/details?id=com.us.android" })!;
    expect(href.startsWith("intent://cleestudio.com/post/3f860f61-ddb6-4be6-98e6-3b892e9c584f?ref=k7x2m9q4pz&utm_source=share#Intent;scheme=https;package=com.us.android;")).toBe(true);
    expect(href).toContain(`S.browser_fallback_url=${encodeURIComponent("https://play.google.com/store/apps/details?id=com.us.android")};end`);
  });

  test("falls back to the page itself; names the flavour it is told; refuses http and a bad package", () => {
    expect(appIntentHref(POST, { packageName: "com.us.android.dev" })).toContain(`package=com.us.android.dev;S.browser_fallback_url=${encodeURIComponent(POST)};end`);
    expect(appIntentHref("http://cleestudio.com/post/x")).toBeNull();
    expect(appIntentHref(POST, { packageName: "not a package" })).toBeNull();
    expect(appIntentHref("nope")).toBeNull();
  });
});

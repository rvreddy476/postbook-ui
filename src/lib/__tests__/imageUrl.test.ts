import { expect, test } from "bun:test";

import { imageVariantFor, onImageError, originalImageUrl, resolveImageUrl } from "../imageUrl";

/*
  media-service ignores ?w=&q= on /serve; the sizes are the named variant
  routes /serve/:variant (thumb_150, small_480, medium_1080, and the avatar
  alias). A failed variant falls back to the plain /serve once.
*/

test("a plain serve URL becomes the variant route for its size", () => {
  const url = "/v1/media/abc/serve";
  expect(resolveImageUrl(url, { dataSaver: false, size: "large" })).toBe("/v1/media/abc/serve/medium_1080");
  expect(resolveImageUrl(url, { dataSaver: false, size: "medium" })).toBe("/v1/media/abc/serve/small_480");
  expect(resolveImageUrl(url, { dataSaver: false, size: "small" })).toBe("/v1/media/abc/serve/avatar");
  expect(resolveImageUrl(url, { dataSaver: true, size: "large" })).toBe("/v1/media/abc/serve/small_480");
  expect(resolveImageUrl("https://api.example/v1/media/abc/serve", { dataSaver: false, size: "large" })).toBe("https://api.example/v1/media/abc/serve/medium_1080");
});

test("never the ignored w=/q= params; other query params survive", () => {
  expect(resolveImageUrl("/v1/media/abc/serve?w=96&q=80", { dataSaver: false, size: "large" })).toBe("/v1/media/abc/serve/medium_1080");
  expect(resolveImageUrl("/v1/media/abc/serve?v=2", { dataSaver: false, size: "medium" })).toBe("/v1/media/abc/serve/small_480?v=2");
  expect(resolveImageUrl("/v1/media/abc/serve", { dataSaver: false })).not.toContain("w=");
});

test("anything that is not a plain serve URL is left alone", () => {
  for (const url of ["/v1/media/abc/serve/thumb_300", "https://bucket.s3.example/key.jpg?X-Amz-Signature=1", "/t.jpg", "data:image/png;base64,AA", "blob:x"]) {
    expect(resolveImageUrl(url, { dataSaver: false, size: "large" })).toBe(url);
  }
  expect(resolveImageUrl("", { dataSaver: false })).toBe("");
  expect(resolveImageUrl(null, { dataSaver: false })).toBe("");
});

test("the fallback is the plain serve URL behind a variant, once", () => {
  expect(originalImageUrl("/v1/media/abc/serve/medium_1080")).toBe("/v1/media/abc/serve");
  expect(originalImageUrl("/v1/media/abc/serve/small_480?v=2")).toBe("/v1/media/abc/serve?v=2");
  expect(originalImageUrl("/v1/media/abc/serve")).toBeNull();
  expect(originalImageUrl("/v1/media/abc/serve/720p")).toBeNull();

  const img = { dataset: {} as Record<string, string>, src: "/v1/media/abc/serve/medium_1080", getAttribute() { return this.src; } };
  onImageError({ currentTarget: img as unknown as HTMLImageElement });
  expect(img.src).toBe("/v1/media/abc/serve");
  img.src = "/v1/media/abc/serve/medium_1080"; // a second failure must not loop
  onImageError({ currentTarget: img as unknown as HTMLImageElement });
  expect(img.src).toBe("/v1/media/abc/serve/medium_1080");
});

test("sizes map to the variants media-service makes", () => {
  expect(imageVariantFor("large", false)).toBe("medium_1080");
  expect(imageVariantFor("medium", true)).toBe("small_480");
});

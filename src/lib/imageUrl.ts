/**
 * Web image URL helper.
 *
 * media-service IGNORES `?w=&q=` on `/v1/media/:id/serve`: that route always
 * redirects to the original upload, so a 40px avatar used to download a
 * 4000px photo and a full-screen photo was never the sharp rendition. The
 * sizes it really serves are named variants on `/v1/media/:id/serve/:variant`
 * (media-service internal/processing/image.go):
 *
 *   thumb_150    150px, cropped square
 *   small_480    480px on the long edge
 *   medium_1080  1080px on the long edge
 *   avatar       an alias that resolves server-side to the smallest of those
 *                that exists, falling back to the original — so an avatar
 *                never 404s for an asset that exists (service/media.go).
 *
 * Only photos have small_480 / medium_1080; a video id has thumbnails and
 * rungs instead. So callers pass image URLs only, and every <img> that shows
 * a variant carries `onImageError` (below), which swaps the plain `/serve`
 * URL in once when a variant 404s — an old upload processed before the
 * variants existed, or a GIF the pipeline skipped.
 *
 * Use cases:
 *   - small  → avatars                       (avatar alias)
 *   - medium → grids, thumbnails, previews   (small_480)
 *   - large  → the post stage, full screen   (medium_1080; small_480 on data saver)
 */

export type ImageSize = "small" | "medium" | "large";

export type ImageVariant = "avatar" | "thumb_150" | "small_480" | "medium_1080";

const NORMAL_VARIANTS: Record<ImageSize, ImageVariant> = {
  small: "avatar",
  medium: "small_480",
  large: "medium_1080",
};

const SAVER_VARIANTS: Record<ImageSize, ImageVariant> = {
  small: "avatar",
  medium: "small_480",
  large: "small_480",
};

export interface ResolveImageUrlOptions {
  dataSaver: boolean;
  size?: ImageSize;
}

/*
  A plain serve URL, relative or absolute, with or without a query: the
  media id, then `/serve` and nothing after it but an optional query.
  Anything else — a URL that already names a variant, a presigned object
  URL, someone else's host — is returned unchanged.
*/
const PLAIN_SERVE = /^(.*\/v1\/media\/[^/?#]+\/serve)\/?(\?[^#]*)?$/;
const VARIANT_SERVE = /^(.*\/v1\/media\/[^/?#]+\/serve)\/(avatar|thumb_150|small_480|medium_1080)(\?[^#]*)?$/;

/** Drops the w= and q= params media-service never read; keeps anything else. */
function keepQuery(query: string | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams(query.slice(1));
  params.delete("w");
  params.delete("q");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

/** The variant a size asks for. */
export function imageVariantFor(size: ImageSize, dataSaver: boolean): ImageVariant {
  return (dataSaver ? SAVER_VARIANTS : NORMAL_VARIANTS)[size];
}

export function resolveImageUrl(
  url: string | null | undefined,
  { dataSaver, size = "medium" }: ResolveImageUrlOptions,
): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  const match = PLAIN_SERVE.exec(url);
  if (!match) return url;
  return `${match[1]}/${imageVariantFor(size, dataSaver)}${keepQuery(match[2])}`;
}

/** The plain `/serve` URL behind a variant URL, or null when it is not one. */
export function originalImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = VARIANT_SERVE.exec(url);
  return match ? `${match[1]}${match[3] ?? ""}` : null;
}

/**
 * `<img onError={onImageError}>`: a variant that failed falls back to the
 * original, once. A second failure is left alone so it cannot loop.
 */
export function onImageError(event: { currentTarget: HTMLImageElement }): void {
  const img = event.currentTarget;
  if (img.dataset.fallback === "1") return;
  const original = originalImageUrl(img.getAttribute("src"));
  if (!original) return;
  img.dataset.fallback = "1";
  img.src = original;
}

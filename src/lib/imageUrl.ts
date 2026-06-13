/**
 * Web image URL helper — symmetrical with mobile
 * `lib/services/image_url_helper.dart`.
 *
 * media-service's `/v1/media/:id/serve` accepts `w=` and `q=` query
 * params; the helper appends them when data-saver is on, halving
 * bytes-on-wire for feed cards and avatars.
 *
 * Use cases (highest traffic first):
 *   - Feed post media thumbnails.
 *   - Profile + comment avatars.
 *   - Posttube + reels poster frames.
 */

export type ImageSize = "small" | "medium" | "large";

interface ImageBudget {
  width: number;
  quality: number;
}

const NORMAL_BUDGETS: Record<ImageSize, ImageBudget> = {
  small: { width: 96, quality: 80 },
  medium: { width: 480, quality: 80 },
  large: { width: 1080, quality: 85 },
};

const SAVER_BUDGETS: Record<ImageSize, ImageBudget> = {
  // Recon §F.2 calls out "0.5x normal resolution". The numbers below
  // approximate that across the three buckets.
  small: { width: 48, quality: 60 },
  medium: { width: 200, quality: 60 },
  large: { width: 540, quality: 60 },
};

export interface ResolveImageUrlOptions {
  dataSaver: boolean;
  size?: ImageSize;
}

export function resolveImageUrl(
  url: string | null | undefined,
  { dataSaver, size = "medium" }: ResolveImageUrlOptions,
): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  const budgets = dataSaver ? SAVER_BUDGETS : NORMAL_BUDGETS;
  const { width, quality } = budgets[size];

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}w=${width}&q=${quality}`;
}

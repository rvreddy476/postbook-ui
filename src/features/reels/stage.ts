/*
  The stage frame takes the shape of the media it shows, so a landscape reel
  gets a wide frame and a portrait reel a tall one, and object-fit: contain
  never leaves bars. The ratio is clamped so an extreme file (a 1×20 strip)
  still gives a usable frame; unknown dimensions mean 9:16, the shape reels
  are shot in.
*/

/**
 * The comments column beside the stage, in px — TikTok's panel is a fixed
 * width, not a share of the viewport. The screen sets it as --reel-comments-w
 * on .reels-content and reels-screen.css reads it for the grid track.
 */
export const COMMENTS_COLUMN_WIDTH = 380;

export const STAGE_MIN_ASPECT = 9 / 16;
export const STAGE_MAX_ASPECT = 16 / 9;
export const STAGE_DEFAULT_ASPECT = 9 / 16;

export function stageAspect(width?: number, height?: number): number {
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return STAGE_DEFAULT_ASPECT;
  }
  return Math.min(STAGE_MAX_ASPECT, Math.max(STAGE_MIN_ASPECT, width / height));
}

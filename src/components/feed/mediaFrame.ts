/*
  How tall a photo sits on a feed card. The photo fills the card's width at
  its own shape, inside two limits: no taller than 4:5 (a portrait phone
  photo would otherwise push the actions off the screen) and no flatter than
  1.91:1 (a panorama would become a strip). Outside the limits the photo is
  cropped to the frame, the same as other big feeds do.

  Returns width / height, for CSS aspect-ratio.
*/
export const TALLEST_FRAME = 4 / 5;
export const FLATTEST_FRAME = 1.91;

export function mediaFrameRatio(width?: number | null, height?: number | null): number {
  if (!width || !height || width <= 0 || height <= 0) return 1;
  return Math.min(Math.max(width / height, TALLEST_FRAME), FLATTEST_FRAME);
}

/** Two taps within this many milliseconds, close together, are a double tap. */
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_SLOP_PX = 24;

export interface Tap { t: number; x: number; y: number }

export function isDoubleTap(previous: Tap | null, next: Tap): boolean {
  if (!previous) return false;
  return next.t - previous.t <= DOUBLE_TAP_MS
    && Math.hypot(next.x - previous.x, next.y - previous.y) <= DOUBLE_TAP_SLOP_PX;
}

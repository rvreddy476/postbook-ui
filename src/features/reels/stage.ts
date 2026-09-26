/*
  The stage frame takes the shape of the media it shows, so a landscape reel
  gets a wide frame and a portrait reel a tall one, and object-fit: contain
  never leaves bars. The server's stored dimensions are the first guess; the
  player reports the element's real videoWidth/videoHeight once metadata
  loads and that wins, because stored dimensions are sometimes missing or
  pre-rotation. The clamp admits a phone-tall 9:19.5 file and an ultrawide
  one and only refuses absurd strips; unknown dimensions mean 9:16, the
  shape reels are shot in.
*/

/*
  TikTok's desktop geometry, measured live (1440×840 and 1920×827) and used
  as px, never scaled. The comments column is a 352px card with a 16px
  margin on three sides, so its grid track is 368. The stage cluster is
  [frame][15px gap][48px rail][117px reserved zone] and that whole cluster
  is centred in the stage area — which is what "centred" means on TikTok:
  the video itself sits left of the centre line. The reserved zone is
  empty. The screen sets --reel-comments-w and reels-screen.css lays the
  cluster out; these numbers are the CSS's source of truth and the tests
  pin them.
*/
export const COMMENTS_COLUMN_WIDTH = 352;
export const COMMENTS_COLUMN_MARGIN = 16;
/** The grid track that holds the comments column: the card plus its margin. */
export const COMMENTS_TRACK_WIDTH = COMMENTS_COLUMN_WIDTH + COMMENTS_COLUMN_MARGIN;

export const RAIL_WIDTH = 40;
export const RAIL_GAP = 15;
export const RESERVED_RIGHT = 125; // 180 − 15 − 40: the frame stays where TikTok puts it with the slimmer rail
/** Everything the cluster adds to the right of the frame. */
export const CLUSTER_EXTRA = RAIL_GAP + RAIL_WIDTH + RESERVED_RIGHT;

/** The width of the centred cluster for a frame of the given width. */
export function clusterWidth(frameWidth: number): number {
  return frameWidth + CLUSTER_EXTRA;
}

/**
 * Where the frame's left edge lands: the cluster is centred in the stage
 * area (areaLeft..areaLeft+areaWidth), so the frame starts at the area's
 * left plus half of what the cluster leaves over.
 */
export function frameLeft(areaLeft: number, areaWidth: number, frameWidth: number): number {
  return areaLeft + (areaWidth - clusterWidth(frameWidth)) / 2;
}

/** The widest frame the area can hold with the whole cluster beside it. */
export function maxFrameWidth(areaWidth: number): number {
  return Math.max(0, areaWidth - CLUSTER_EXTRA);
}

export const STAGE_MIN_ASPECT = 0.4;
export const STAGE_MAX_ASPECT = 2.4;
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

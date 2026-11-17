/*
  The one place the web knows how long a Short may be (founder, 2026-10-21).

  A Short (reel / short / flick) is up to 10 minutes, inclusive, and portrait
  or square. A longer file is not refused anywhere: it is classified
  long_video and posted as a long video. Long video and podcasts have no
  size limit; their length limit is the server's (below).

  Mirrors FlickMaxDurationSeconds in Architecture/shared/postclassify/classify.go,
  the server's single source of truth. Change both together.
*/

export const SHORTS_MAX_DURATION_SECONDS = 600;
export const SHORTS_MAX_DURATION_MS = SHORTS_MAX_DURATION_SECONDS * 1000;

/** "10 minutes" — the boundary in words, for labels and notices. */
export const SHORTS_MAX_DURATION_LABEL = `${SHORTS_MAX_DURATION_SECONDS / 60} minutes`;

/*
  The longest video media-service processes: MEDIA_MAX_VIDEO_DURATION_SEC,
  default processing.DefaultMaxVideoDurationSeconds (4 h); a longer one is
  refused with 413 VIDEO_TOO_LONG (lv-30; the founder decision on the number
  is open). Only for the studio's label: the server is the authority and its
  refusal carries the live number. Change both together.
*/
export const LONG_VIDEO_MAX_DURATION_SECONDS = 4 * 3600;

/** "4 hours" */
export const LONG_VIDEO_MAX_DURATION_LABEL = `${LONG_VIDEO_MAX_DURATION_SECONDS / 3600} hours`;

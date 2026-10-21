/*
  The one place the web knows how long a Short may be (founder, 2026-10-21).

  A Short (reel / short / flick) is up to 10 minutes, inclusive, and portrait
  or square. A longer file is not refused anywhere: it is classified
  long_video and posted as a long video. Long video and podcasts have no
  size limit and no length limit.

  Mirrors FlickMaxDurationSeconds in Architecture/shared/postclassify/classify.go,
  the server's single source of truth. Change both together.
*/

export const SHORTS_MAX_DURATION_SECONDS = 600;
export const SHORTS_MAX_DURATION_MS = SHORTS_MAX_DURATION_SECONDS * 1000;

/** "10 minutes" — the boundary in words, for labels and notices. */
export const SHORTS_MAX_DURATION_LABEL = `${SHORTS_MAX_DURATION_SECONDS / 60} minutes`;

/** Upload Studio constants. Colour and type come from the shared theme (src/ui/theme.css), never from here. */

/** Content type identifiers. "short" and "reel" are the same vertical studio. */
export type ContentType = "reel" | "short" | "long" | "podcast";

export type StepId = "video" | "details" | "audience" | "engage" | "enrich" | "publish";

/** True for the vertical shorts studio (Reels); false for long video and podcasts (PostTube). */
export function isShortStudio(contentType: ContentType): boolean {
  return contentType === "reel" || contentType === "short";
}

/**
 * Step schemas per content type. Shorts ask much less (founder, 2026-10-21):
 * the video, a few details, and one page of final settings. Long video and
 * podcasts keep the full studio.
 */
export const STEP_SCHEMAS: Record<ContentType, readonly StepId[]> = {
  reel:    ["video", "details", "publish"],
  short:   ["video", "details", "publish"],
  long:    ["video", "details", "audience", "engage", "enrich", "publish"],
  podcast: ["video", "details", "audience", "engage", "enrich", "publish"],
} as const;

export const STEP_META: Record<StepId, { label: string; description: string }> = {
  video:    { label: "Video",    description: "Choose your file" },
  details:  { label: "Details",  description: "Title, description and cover" },
  audience: { label: "Audience", description: "Who it is for and disclosures" },
  engage:   { label: "Comments", description: "Comments, likes and remixing" },
  enrich:   { label: "Extras",   description: "Language, subtitles and chapters" },
  publish:  { label: "Publish",  description: "Visibility, topic and schedule" },
};

/** The heading and one line under it, per step and studio. */
export function stepIntro(step: StepId, contentType: ContentType): { title: string; body: string } {
  const short = isShortStudio(contentType);
  switch (step) {
    case "video":
      return { title: "Choose a video", body: short ? "A vertical clip of up to 5 minutes. Nothing uploads until you publish or save a draft." : "Start with a file from your device. Nothing uploads until you publish or save a draft." };
    case "details":
      return short
        ? { title: "Describe your reel", body: "A title is required. Add a caption with #hashtags, a cover, a sound or a place if you like." }
        : { title: "Add the details", body: "A title is required. A description, tags and a cover help people find your video." };
    case "audience":
      return { title: "Audience", body: "Say who this video is for and anything viewers should know." };
    case "engage":
      return { title: "Comments and likes", body: "Choose how viewers can respond to your video." };
    case "enrich":
      return { title: "Extras", body: "Optional: language, subtitles and chapters help viewers find their way." };
    case "publish":
      return short
        ? { title: "Ready to post", body: "Check who can watch, then publish now or schedule it." }
        : { title: "Review and publish", body: "Choose a topic, check who can watch and decide when it goes live." };
  }
}

/**
 * The reel (flick) duration cap in seconds, inclusive: 300 s = 5 minutes.
 * Mirrors FlickMaxDurationSeconds in Architecture/shared/postclassify/classify.go,
 * the server's single source of truth. A reel is also portrait or square.
 */
export const FLICK_MAX_DURATION_SECONDS = 300;

export const CONTENT_TYPE_META: Record<ContentType, { label: string; platformLabel: string; icon: string; aspect: string; maxDuration: number; maxSize: number }> = {
  reel:    { label: "Reel",    platformLabel: "Reels",    icon: "sparkles",     aspect: "9/16", maxDuration: FLICK_MAX_DURATION_SECONDS, maxSize: 500 * 1024 * 1024 },
  short:   { label: "Reel",    platformLabel: "Reels",    icon: "clapperboard", aspect: "9/16", maxDuration: FLICK_MAX_DURATION_SECONDS, maxSize: 500 * 1024 * 1024 },
  long:    { label: "Video",   platformLabel: "PostTube", icon: "film",         aspect: "16/9", maxDuration: 43200, maxSize: 10 * 1024 * 1024 * 1024 },
  podcast: { label: "Podcast", platformLabel: "PostTube", icon: "mic",          aspect: "1/1",  maxDuration: 28800, maxSize: 2 * 1024 * 1024 * 1024 },
};

// Topics are not a list here any more: the studio reads GET /v1/posts/categories
// (features/upload/categories.ts) so a topic is one deploy, never an app change.

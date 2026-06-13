/** Upload Studio design tokens — warm off-white theme */

export const T = {
  /* Surface */
  bg: "#F5F4F1",
  card: "#FFFFFF",
  cardBorder: "#E8E6E1",
  cardHover: "#FAFAF8",

  /* Text */
  textPrimary: "#1A1A1A",
  textSecondary: "#6B6B6B",
  textMuted: "#9E9E9E",
  textPlaceholder: "#BFBFBF",

  /* Brand accents */
  pink: "#E8527A",
  coral: "#F28B6D",
  teal: "#2BB5A0",
  purple: "#7C5CFC",
  gold: "#E5A93D",

  /* UI */
  accent: "#7C5CFC",
  accentHover: "#6A4AE8",
  accentLight: "#EDE9FE",
  danger: "#E8527A",
  success: "#2BB5A0",
  warning: "#E5A93D",

  /* Borders / Dividers */
  border: "#E8E6E1",
  borderFocus: "#7C5CFC",
  divider: "#F0EEE9",

  /* Radius */
  radiusSm: "8px",
  radiusMd: "12px",
  radiusLg: "16px",
  radiusXl: "20px",
  radiusFull: "9999px",

  /* Shadows */
  shadowSm: "0 1px 3px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.06)",
  shadowLg: "0 12px 32px rgba(0,0,0,0.08)",
} as const;

/** Content type identifiers */
export type ContentType = "reel" | "short" | "long" | "podcast";

/** Step schemas per content type */
export const STEP_SCHEMAS: Record<ContentType, readonly StepId[]> = {
  reel:    ["video", "details", "audience", "engage", "publish"],
  short:   ["video", "details", "audience", "engage", "publish"],
  long:    ["video", "details", "audience", "engage", "enrich", "publish"],
  podcast: ["video", "details", "audience", "engage", "enrich", "publish"],
} as const;

export type StepId = "video" | "details" | "audience" | "engage" | "enrich" | "publish";

export const STEP_META: Record<StepId, { label: string; description: string }> = {
  video:    { label: "Video",    description: "Upload your file" },
  details:  { label: "Details",  description: "Title, caption, cover & audio" },
  audience: { label: "Audience", description: "Age, COPPA & disclosures" },
  engage:   { label: "Engage",   description: "Comments, sparks & remix" },
  enrich:   { label: "Enrich",   description: "Subtitles, chapters & metadata" },
  publish:  { label: "Publish",  description: "Visibility, schedule & cross-post" },
};

export const CONTENT_TYPE_META: Record<ContentType, { label: string; platformLabel: string; icon: string; aspect: string; maxDuration: number; maxSize: number }> = {
  reel:    { label: "Reel",          platformLabel: "Reels",           icon: "sparkles", aspect: "9/16", maxDuration: 180,   maxSize: 500 * 1024 * 1024 },
  short:   { label: "Reel / Clip",   platformLabel: "Posttube Reels",  icon: "clapperboard", aspect: "9/16", maxDuration: 180,   maxSize: 500 * 1024 * 1024 },
  long:    { label: "Video",         platformLabel: "Posttube",        icon: "film",          aspect: "16/9", maxDuration: 43200, maxSize: 10 * 1024 * 1024 * 1024 },
  podcast: { label: "Podcast",       platformLabel: "Posttube",        icon: "mic",           aspect: "1/1",  maxDuration: 28800, maxSize: 2 * 1024 * 1024 * 1024 },
};

export const CATEGORIES = [
  "Film & Animation", "Music", "Gaming", "Entertainment", "Comedy",
  "Education", "Science & Technology", "Sports", "Travel & Events",
  "People & Blogs", "Howto & Style", "News & Politics", "Pets & Animals",
  "Nonprofits & Activism", "Other",
] as const;

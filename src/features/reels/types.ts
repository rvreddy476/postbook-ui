export interface Reel {
  reel_id: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  hashtags: string[];
  like_count: number;
  comment_count: number;
  share_count: number;
  view_count?: number;
  viewer_has_boosted: boolean;
  viewer_has_saved: boolean;
  duration_seconds?: number;
  audio_track?: AudioTrack;
}

export interface ReelComment {
  comment_id: string;
  author_id: string;
  author_name: string;
  text: string;
  created_at: string;
}

export interface CursorPage<T> {
  items: T[];
  next_cursor?: string;
}

export interface CommentsAroundResponse {
  reel_id: string;
  focus_comment_id: string;
  comments: ReelComment[];
  focus_index: number;
}

/* ── Audio/Music ─────────────────────────────────────────── */

export interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  duration_ms: number;
  audio_url: string;
  waveform_url?: string;
  usage_count: number;
  is_original: boolean;
  is_licensed: boolean;
  status: "active" | "disabled" | "copyright_claimed";
  source_reel_id?: string;
}

/* ── Reel Draft / Creation ───────────────────────────────── */

export type ReelVisibility = "public" | "followers" | "private" | "unlisted";
export type ReelStatus = "draft" | "processing" | "publishing_pending" | "published" | "rejected" | "deleted";
export type ModerationStatus = "pending" | "approved" | "flagged" | "rejected";
export type LicenseType = "standard" | "creative_commons";
export type CommentModeration = "none" | "basic" | "strict" | "hold_all";
export type RemixSetting = "allow" | "allow_audio_only" | "disallow";
export type CommentAccess = "everyone" | "followers" | "nobody";

export interface ReelDraft {
  id: string;
  author_id: string;
  media_id?: string;
  caption: string;
  hashtags: string[];
  visibility: ReelVisibility;
  topic_id?: number;
  language?: string;
  seo_title?: string;
  seo_slug?: string;
  audio_track_id?: string;
  audio_start_ms?: number;
  original_audio_volume?: number;
  overlay_audio_volume?: number;
  cover_media_id?: string;
  cross_post_postbook?: boolean;
  cross_post_posttube?: boolean;
  is_made_for_kids?: boolean;
  tags?: string[];
  paid_promotion?: boolean;
  altered_content?: boolean;
  auto_chapters?: boolean;
  featured_places?: boolean;
  auto_concepts?: boolean;
  recording_date?: string;
  recording_location?: string;
  license?: LicenseType;
  allow_embedding?: boolean;
  publish_to_feed?: boolean;
  remix_setting?: RemixSetting;
  category?: string;
  comments_enabled?: boolean;
  comment_moderation?: CommentModeration;
  comment_access?: CommentAccess;
  schedule_at?: string;
  status: ReelStatus;
  moderation_status?: ModerationStatus;
  processing_status?: Record<string, string>;
  copyright_status?: CopyrightCheck;
  created_at: string;
  updated_at: string;
}

export interface CopyrightCheck {
  status: "checking" | "none_found" | "claim_found" | "error";
  claims?: CopyrightClaim[];
}

export interface CopyrightClaim {
  id: string;
  asset: string;
  claimant: string;
  policy: "block" | "monetize" | "track";
  matched_segment?: { start_ms: number; end_ms: number };
}

export interface Topic {
  id: number;
  slug: string;
  label: string;
  icon?: string;
}

export interface CoverFrameResult {
  cover_media_id: string;
  object_key: string;
  preview_url: string;
}

export interface ProcessingStatusResult {
  media_id: string;
  status: string;
  renditions: RenditionInfo[];
  all_ready: boolean;
}

export interface RenditionInfo {
  type: string;
  quality?: string;
  status: "pending" | "processing" | "ready" | "failed" | "retrying";
  object_key?: string;
}

/* ── View tracking ───────────────────────────────────────── */

export interface ViewEvent {
  reel_id: string;
  /** Author of the reel — sent as creator_id on the analytics event. */
  creator_id: string;
  source: "feed" | "explore" | "profile" | "direct" | "audio_page";
  /** Defaults to "reel" when omitted. */
  content_type?: "reel" | "long_video";
  watched_ms: number;
  duration_ms: number;
  completed: boolean;
}

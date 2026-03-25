export interface PostTubeVideo {
  id: string;
  author_id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  content_type?: string;
  channel_id: string;
  subscription_channel_id?: string;
  channel_handle?: string;
  channel_name: string;
  channel_avatar_url: string;
  channel_subscriber_count: number;
  view_count: number;
  like_count: number;
  dislike_count: number;
  comment_count: number;
  share_count: number;
  hashtags: string[];
  published_at: string;
  duration_seconds: number;
  viewer_has_liked: boolean;
  viewer_has_disliked: boolean;
  viewer_has_saved: boolean;
  viewer_has_subscribed: boolean;
  resume_position_ms?: number;
  resume_duration_ms?: number;
  resume_percent_watched?: number;
  last_watched_at?: string;
  /** Tiny 360p 3–5s loop for hover preview (optional, falls back to video_url) */
  preview_url?: string;
  /** Best-moment start offset in ms for hover preview */
  highlight_start_ms?: number;
  /** Best-moment end offset in ms for hover preview */
  highlight_end_ms?: number;
}

export interface PostTubeComment {
  id: string;
  author_name: string;
  author_avatar_url: string;
  text: string;
  like_count: number;
  created_at: string;
}

/** VideoFeedItem matches the backend DTO for video content in feed responses. */
export interface VideoFeedItem {
  id: string;
  title: string;
  durationSeconds: number;
  effectiveDurationSeconds: number;
  finalCategory: "flick" | "long_video";
  thumbnailUrl: string;
  playbackUrl: string;
  creatorName: string;
  creatorAvatarUrl: string;
  publishedAt: string;
  viewCount: number;
  sparkCount: number;
  echoCount: number;
  stashCount: number;
  trimStartMs: number;
  trimEndMs?: number;
}

/** Feed page with cursor pagination */
export interface FeedPage<T = PostTubeVideo> {
  items: T[];
  next_cursor?: string;
}

/** Video metadata from backend */
export interface VideoMetadataDTO {
  duration_seconds: number;
  effective_duration_seconds: number;
  width?: number;
  height?: number;
  orientation: string;
  computed_category: string;
  final_category: string;
  upload_status: string;
  media_asset_id?: string;
  thumbnail_url?: string;
  playback_url?: string;
  trim_start_ms: number;
  trim_end_ms?: number;
}

export interface MediaSubtitleTrack {
  id: string;
  media_asset_id: string;
  language: string;
  source: string;
  format: string;
  content_url: string;
  confidence?: number | null;
  created_at: string;
}

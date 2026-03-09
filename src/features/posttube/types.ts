export interface PostTubeVideo {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  channel_id: string;
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
}

export interface PostTubeComment {
  id: string;
  author_name: string;
  author_avatar_url: string;
  text: string;
  like_count: number;
  created_at: string;
}

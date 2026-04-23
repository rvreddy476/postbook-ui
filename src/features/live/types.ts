export type LiveStreamStatus = "idle" | "live" | "ended";

export interface LiveStream {
  id: string;
  host_id: string;
  title: string;
  description: string;
  thumbnail_url?: string | null;
  stream_key?: string;
  ingest_url?: string | null;
  ingest_protocol?: string | null;
  publish_url?: string | null;
  publish_protocol?: string | null;
  playback_url?: string | null;
  playback_protocol?: string | null;
  status: LiveStreamStatus;
  visibility: "public" | "followers" | "private" | string;
  peak_viewers: number;
  total_viewers: number;
  like_count: number;
  started_at?: string | null;
  ended_at?: string | null;
  duration_secs: number;
  replay_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  message: string;
  is_pinned: boolean;
  created_at: string;
}

export interface ScheduledLiveStream {
  id: string;
  host_id: string;
  title: string;
  description: string;
  scheduled_at: string;
  reminder_sent: boolean;
  stream_id?: string | null;
  created_at: string;
}

export interface LiveMute {
  stream_id: string;
  user_id: string;
  muted_by: string;
  muted_at: string;
}

export interface LiveWordFilter {
  stream_id: string;
  word: string;
  added_by: string;
}

export interface LiveChatMessageEvent {
  type: "live_chat_message";
  stream_id: string;
  message_id: string;
  user_id: string;
  message: string;
  is_pinned: boolean;
  created_at: string;
}

export interface LiveStreamViewersEvent {
  type: "live_stream_viewers";
  stream_id: string;
  viewer_count: number;
  peak_viewers?: number;
  total_viewers?: number;
  reason?: string;
  actor_id?: string;
  updated_at?: string;
}

export interface LiveStreamLikesEvent {
  type: "live_stream_likes";
  stream_id: string;
  like_count: number;
  updated_at?: string;
}

export interface LiveMessagePinnedEvent {
  type: "live_message_pinned";
  stream_id: string;
  message_id: string;
  pinned_by?: string;
  pinned_at?: string;
}

export interface LiveStreamEndedEvent {
  type: "live_stream_ended";
  stream_id: string;
  host_id?: string;
  duration_secs?: number;
  peak_viewers?: number;
  total_viewers?: number;
  ended_at?: string;
}

export interface LiveUserMutedEvent {
  type: "live_user_muted";
  stream_id: string;
  user_id: string;
  muted_by?: string;
  muted_at?: string;
  updated_at?: string;
}

export interface LiveUserUnmutedEvent {
  type: "live_user_unmuted";
  stream_id: string;
  user_id: string;
  unmuted_by?: string;
  updated_at?: string;
}

export interface LiveWordFilterAddedEvent {
  type: "live_word_filter_added";
  stream_id: string;
  word: string;
  added_by?: string;
  updated_at?: string;
}

export interface LiveWordFilterRemovedEvent {
  type: "live_word_filter_removed";
  stream_id: string;
  word: string;
  removed_by?: string;
  updated_at?: string;
}

export type LiveRealtimeEvent =
  | LiveChatMessageEvent
  | LiveStreamViewersEvent
  | LiveStreamLikesEvent
  | LiveMessagePinnedEvent
  | LiveStreamEndedEvent
  | LiveUserMutedEvent
  | LiveUserUnmutedEvent
  | LiveWordFilterAddedEvent
  | LiveWordFilterRemovedEvent;

export const liveRealtimeEventTypes = [
  "live_chat_message",
  "live_stream_viewers",
  "live_stream_likes",
  "live_message_pinned",
  "live_stream_ended",
  "live_user_muted",
  "live_user_unmuted",
  "live_word_filter_added",
  "live_word_filter_removed",
] as const;

export function isLiveRealtimeEventType(type: unknown): type is LiveRealtimeEvent["type"] {
  return typeof type === "string" && liveRealtimeEventTypes.includes(type as LiveRealtimeEvent["type"]);
}

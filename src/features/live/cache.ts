import type { QueryClient } from "@tanstack/react-query";
import { liveKeys } from "@/features/live/queryKeys";
import type {
  LiveChatMessage,
  LiveMute,
  LiveRealtimeEvent,
  LiveStream,
  LiveWordFilter,
} from "@/features/live/types";
import {
  removeLiveMute,
  removeLiveWordFilter,
  setPinnedLiveMessage,
  upsertLiveChatMessage,
  upsertLiveMute,
  upsertLiveWordFilter,
} from "@/features/live/utils";

function updateLiveStreamArray(
  streams: LiveStream[] | undefined,
  streamId: string,
  updater: (stream: LiveStream) => LiveStream,
) {
  if (!streams) return streams;
  return streams.map((stream) => (stream.id === streamId ? updater(stream) : stream));
}

function updateStreamCaches(
  queryClient: QueryClient,
  streamId: string,
  updater: (stream: LiveStream) => LiveStream,
) {
  queryClient.setQueryData<LiveStream | undefined>(liveKeys.stream(streamId), (stream) =>
    stream ? updater(stream) : stream,
  );
  queryClient.setQueryData<LiveStream[] | undefined>(liveKeys.streams(), (streams) =>
    updateLiveStreamArray(streams, streamId, updater),
  );
  queryClient.setQueriesData<LiveStream[] | undefined>({ queryKey: ["live", "host-streams"] }, (streams) =>
    updateLiveStreamArray(streams, streamId, updater),
  );
}

export function applyLiveRealtimeEvent(queryClient: QueryClient, event: LiveRealtimeEvent) {
  switch (event.type) {
    case "live_chat_message": {
      const message: LiveChatMessage = {
        id: event.message_id,
        stream_id: event.stream_id,
        user_id: event.user_id,
        message: event.message,
        is_pinned: event.is_pinned,
        created_at: event.created_at,
      };
      queryClient.setQueryData<LiveChatMessage[] | undefined>(liveKeys.chat(event.stream_id), (messages) =>
        event.is_pinned
          ? setPinnedLiveMessage(upsertLiveChatMessage(messages, message), message.id)
          : upsertLiveChatMessage(messages, message),
      );
      return;
    }
    case "live_stream_viewers": {
      queryClient.setQueryData<number>(liveKeys.viewerCount(event.stream_id), event.viewer_count);
      updateStreamCaches(queryClient, event.stream_id, (stream) => ({
        ...stream,
        peak_viewers: event.peak_viewers ?? stream.peak_viewers,
        total_viewers: event.total_viewers ?? stream.total_viewers,
      }));
      return;
    }
    case "live_stream_likes": {
      updateStreamCaches(queryClient, event.stream_id, (stream) => ({
        ...stream,
        like_count: event.like_count,
      }));
      return;
    }
    case "live_message_pinned": {
      queryClient.setQueryData<LiveChatMessage[] | undefined>(liveKeys.chat(event.stream_id), (messages) =>
        setPinnedLiveMessage(messages, event.message_id),
      );
      return;
    }
    case "live_stream_ended": {
      queryClient.setQueryData<LiveStream[] | undefined>(liveKeys.streams(), (streams) =>
        streams?.filter((stream) => stream.id !== event.stream_id),
      );
      updateStreamCaches(queryClient, event.stream_id, (stream) => ({
        ...stream,
        status: "ended",
        ended_at: event.ended_at ?? stream.ended_at,
        peak_viewers: event.peak_viewers ?? stream.peak_viewers,
        total_viewers: event.total_viewers ?? stream.total_viewers,
        duration_secs: event.duration_secs ?? stream.duration_secs,
      }));
      return;
    }
    case "live_user_muted": {
      const mute: LiveMute = {
        stream_id: event.stream_id,
        user_id: event.user_id,
        muted_by: event.muted_by ?? "",
        muted_at: event.muted_at ?? event.updated_at ?? new Date().toISOString(),
      };
      queryClient.setQueryData<LiveMute[] | undefined>(liveKeys.mutes(event.stream_id), (mutes) =>
        upsertLiveMute(mutes, mute),
      );
      return;
    }
    case "live_user_unmuted": {
      queryClient.setQueryData<LiveMute[] | undefined>(liveKeys.mutes(event.stream_id), (mutes) =>
        removeLiveMute(mutes, event.user_id),
      );
      return;
    }
    case "live_word_filter_added": {
      const filter: LiveWordFilter = {
        stream_id: event.stream_id,
        word: event.word,
        added_by: event.added_by ?? "",
      };
      queryClient.setQueryData<LiveWordFilter[] | undefined>(liveKeys.wordFilters(event.stream_id), (filters) =>
        upsertLiveWordFilter(filters, filter),
      );
      return;
    }
    case "live_word_filter_removed": {
      queryClient.setQueryData<LiveWordFilter[] | undefined>(liveKeys.wordFilters(event.stream_id), (filters) =>
        removeLiveWordFilter(filters, event.word),
      );
      return;
    }
  }
}

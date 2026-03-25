import api from "@/lib/api";
import type {
  LiveChatMessage,
  LiveMute,
  LiveStream,
  LiveWordFilter,
  ScheduledLiveStream,
} from "@/features/live/types";
import { sortLiveChatMessages } from "@/features/live/utils";

interface ApiResponse<T> {
  data: T;
}

export async function listLiveStreams(limit = 20): Promise<LiveStream[]> {
  const res = await api.get<ApiResponse<{ items: LiveStream[] }>>("/v1/live/streams", {
    params: { limit },
  });
  return res.data.data.items ?? [];
}

export async function getLiveStream(streamId: string): Promise<LiveStream> {
  const res = await api.get<ApiResponse<LiveStream>>(`/v1/live/streams/${streamId}`);
  return res.data.data;
}

export async function listHostStreams(hostId: string, limit = 10): Promise<LiveStream[]> {
  const res = await api.get<ApiResponse<{ items: LiveStream[] }>>(`/v1/live/hosts/${hostId}/streams`, {
    params: { limit },
  });
  return res.data.data.items ?? [];
}

export async function createLiveStream(input: {
  title: string;
  description: string;
  visibility: string;
}): Promise<LiveStream> {
  const res = await api.post<ApiResponse<LiveStream>>("/v1/live/streams", input);
  return res.data.data;
}

export async function goLive(streamId: string): Promise<void> {
  await api.post(`/v1/live/streams/${streamId}/go-live`);
}

export async function endLiveStream(streamId: string): Promise<void> {
  await api.post(`/v1/live/streams/${streamId}/end`);
}

export async function scheduleLiveStream(input: {
  title: string;
  description: string;
  scheduled_at: string;
}): Promise<ScheduledLiveStream> {
  const res = await api.post<ApiResponse<ScheduledLiveStream>>("/v1/live/schedule", input);
  return res.data.data;
}

export async function listUpcomingLiveStreams(limit = 20): Promise<ScheduledLiveStream[]> {
  const res = await api.get<ApiResponse<{ items: ScheduledLiveStream[] }>>("/v1/live/schedule/upcoming", {
    params: { limit },
  });
  return res.data.data.items ?? [];
}

export async function getViewerCount(streamId: string): Promise<number> {
  const res = await api.get<ApiResponse<{ viewer_count: number }>>(`/v1/live/streams/${streamId}/viewers`);
  return res.data.data.viewer_count ?? 0;
}

export async function joinLiveStream(streamId: string): Promise<number> {
  const res = await api.post<ApiResponse<{ viewer_count: number }>>(`/v1/live/streams/${streamId}/join`);
  return res.data.data.viewer_count ?? 0;
}

export async function leaveLiveStream(streamId: string): Promise<void> {
  await api.post(`/v1/live/streams/${streamId}/leave`);
}

export async function likeLiveStream(streamId: string): Promise<void> {
  await api.post(`/v1/live/streams/${streamId}/like`);
}

export async function getLiveChatMessages(streamId: string, limit = 100): Promise<LiveChatMessage[]> {
  const res = await api.get<ApiResponse<{ items: LiveChatMessage[] }>>(`/v1/live/streams/${streamId}/chat`, {
    params: { limit },
  });
  return sortLiveChatMessages(res.data.data.items ?? []);
}

export async function sendLiveChatMessage(input: { streamId: string; message: string }): Promise<LiveChatMessage> {
  const res = await api.post<ApiResponse<LiveChatMessage>>(`/v1/live/streams/${input.streamId}/chat`, {
    message: input.message,
  });
  return res.data.data;
}

export async function pinLiveChatMessage(input: { streamId: string; messageId: string }): Promise<void> {
  await api.post(`/v1/live/streams/${input.streamId}/chat/${input.messageId}/pin`);
}

export async function getMutedUsers(streamId: string): Promise<LiveMute[]> {
  const res = await api.get<ApiResponse<{ items: LiveMute[] }>>(`/v1/live/streams/${streamId}/mutes`);
  return res.data.data.items ?? [];
}

export async function muteLiveUser(streamId: string, userId: string): Promise<void> {
  await api.post(`/v1/live/streams/${streamId}/mutes`, { user_id: userId });
}

export async function unmuteLiveUser(streamId: string, userId: string): Promise<void> {
  await api.delete(`/v1/live/streams/${streamId}/mutes/${userId}`);
}

export async function getWordFilters(streamId: string): Promise<LiveWordFilter[]> {
  const res = await api.get<ApiResponse<{ items: LiveWordFilter[] }>>(`/v1/live/streams/${streamId}/word-filters`);
  return res.data.data.items ?? [];
}

export async function addWordFilter(streamId: string, word: string): Promise<void> {
  await api.post(`/v1/live/streams/${streamId}/word-filters`, { word });
}

export async function removeWordFilter(streamId: string, word: string): Promise<void> {
  await api.delete(`/v1/live/streams/${streamId}/word-filters`, {
    params: { word },
  });
}

import type { LiveChatMessage, LiveMute, LiveStream, LiveWordFilter } from "@/features/live/types";

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatRelativeTime(value: string) {
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds || 1}s ago`;
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;
  return `${Math.floor(deltaHours / 24)}d ago`;
}

export function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

export function getPreferredLiveVideoUrl(stream: Pick<LiveStream, "status" | "playback_url" | "replay_url"> | null | undefined) {
  if (!stream) return null;
  if (stream.status === "live") {
    return stream.playback_url || stream.replay_url || null;
  }
  return stream.replay_url || stream.playback_url || null;
}

export function sortLiveChatMessages(messages: LiveChatMessage[]) {
  return [...messages].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.id.localeCompare(right.id);
  });
}

export function upsertLiveChatMessage(
  messages: LiveChatMessage[] | undefined,
  incoming: LiveChatMessage,
) {
  const next = [...(messages ?? [])];
  const index = next.findIndex((message) => message.id === incoming.id);
  if (index >= 0) {
    next[index] = incoming;
  } else {
    next.push(incoming);
  }
  return sortLiveChatMessages(next);
}

export function setPinnedLiveMessage(
  messages: LiveChatMessage[] | undefined,
  messageId: string,
) {
  return sortLiveChatMessages(
    (messages ?? []).map((message) => ({
      ...message,
      is_pinned: message.id === messageId,
    })),
  );
}

export function resolvePinnedLiveMessage(messages: LiveChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.is_pinned) {
      return messages[index];
    }
  }
  return null;
}

export function upsertLiveMute(mutes: LiveMute[] | undefined, incoming: LiveMute) {
  return [...(mutes ?? []).filter((mute) => mute.user_id !== incoming.user_id), incoming].sort((left, right) => {
    const leftTime = new Date(left.muted_at).getTime();
    const rightTime = new Date(right.muted_at).getTime();
    return leftTime - rightTime;
  });
}

export function removeLiveMute(mutes: LiveMute[] | undefined, userId: string) {
  return (mutes ?? []).filter((mute) => mute.user_id !== userId);
}

export function upsertLiveWordFilter(
  filters: LiveWordFilter[] | undefined,
  incoming: LiveWordFilter,
) {
  return [...(filters ?? []).filter((filter) => filter.word.toLowerCase() !== incoming.word.toLowerCase()), incoming].sort((left, right) =>
    left.word.localeCompare(right.word),
  );
}

export function removeLiveWordFilter(filters: LiveWordFilter[] | undefined, word: string) {
  return (filters ?? []).filter((filter) => filter.word.toLowerCase() !== word.toLowerCase());
}

export function shortUserId(userId: string) {
  return userId.length <= 8 ? userId : `${userId.slice(0, 8)}...`;
}

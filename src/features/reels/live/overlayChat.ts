import type { ChatState } from "@/features/live/chat";
import { chatAuthorName } from "@/features/live/author";
import type { LiveChatMessage } from "@/features/live/model";

/*
  The chat laid over the vertical stage: the last few messages, fading up
  behind the composer. The full thread (roles, moderation, top supporters)
  is the shared LiveChat in the desktop side column. A message a moderator
  removed is never drawn, even if a late echo put it back in the list, and
  a message with no text (Go omits an empty string) is not a row.
*/

export const OVERLAY_CHAT_COUNT = 4;
export const OVERLAY_CHAT_MAX_CHARS = 500;

export function overlayMessages(chat: Pick<ChatState, "messages" | "removed">, n = OVERLAY_CHAT_COUNT): LiveChatMessage[] {
  if (n <= 0) return [];
  const removed = new Set(chat.removed);
  return chat.messages
    .filter((m) => !!m && typeof m.id === "string" && m.id !== "" && !removed.has(m.id) && typeof m.text === "string" && m.text.trim() !== "")
    .slice(-n);
}

/**
 * The name on an overlay row, from the row's own author card (live-service-v2
 * sends it on every chat row): the name, else @handle, else "Viewer". Never an id.
 */
export function overlayName(message: Pick<LiveChatMessage, "author"> | null | undefined): string {
  return chatAuthorName(message?.author);
}

/** "Host" or "Mod" beside the name, from author.role; nothing for a viewer or a row with no author card. */
export function overlayTag(message: Pick<LiveChatMessage, "author"> | null | undefined): string | undefined {
  const role = message?.author?.role;
  return role === "host" ? "Host" : role === "moderator" ? "Mod" : undefined;
}

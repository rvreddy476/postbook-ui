import type { ChatState } from "@/features/live/chat";
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

type ProfileLike = { display_name?: string; first_name?: string; username?: string } | null | undefined;

/** The name on an overlay row: display name, first name, @username, else "Someone". Never an id. */
export function overlayName(profile: ProfileLike): string {
  if (profile?.display_name) return profile.display_name;
  if (profile?.first_name) return profile.first_name;
  if (profile?.username) return `@${profile.username}`;
  return "Someone";
}

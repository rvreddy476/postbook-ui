import type { SlambookOpinionSpaceItem, SlambookResponseItem } from "@/features/slambooks/types";

export function slambookVisibilityLabel(visibility: string): string {
  return visibility.replaceAll("_", " ");
}

export function slambookIdentityLabel(identityMode: string): string {
  return identityMode.replaceAll("_", " ");
}

export function slambookRelativeDate(timestamp?: string | null): string {
  if (!timestamp) return "just now";
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "just now";
  if (diffHours < 1) return `${diffMinutes}m ago`;
  if (diffDays < 1) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function slambookAnswerPreview(item: SlambookResponseItem): string {
  const text = item.answer_text?.trim();
  if (text) return text;
  const values = Object.values(item.answer_json ?? {});
  if (values.length === 0) return "No answer text";
  return values.map(String).join(", ");
}

export function slambookBoardPreview(item: SlambookOpinionSpaceItem): string {
  const text = item.answer_text?.trim();
  if (text) return text;
  const values = Object.values(item.answer_json ?? {});
  if (values.length === 0) return "No answer text";
  return values.map(String).join(", ");
}

import type { ReelItem } from "@/features/reels/model";

/*
  The reels stage's menu data that is not the More rows themselves. The
  More menu's rows — which appear, in which words and order — are the shared
  model in src/features/video-shell/moreRows.ts (one model for reels and
  long video); ReelMoreMenu.reelMoreRows maps a reel onto it.

  MENU_SPEEDS are the preset chips under the speed slider, on both surfaces.
*/
export const MENU_SPEEDS = [0.25, 1, 1.25, 1.5, 2] as const;

export type AuthorAction = "subscribe" | "follow" | "none";

/**
 * The author row's primary action: a reel posted through a channel gets
 * Subscribe (channel-service), any other creator gets Follow (graph), and
 * the viewer's own reel gets nothing.
 */
export function authorAction(reel: Pick<ReelItem, "channelHandle" | "authorUsername">, isOwn: boolean): AuthorAction {
  if (isOwn) return "none";
  if (reel.channelHandle) return "subscribe";
  if (reel.authorUsername) return "follow";
  return "none";
}

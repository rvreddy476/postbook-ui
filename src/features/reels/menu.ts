import type { ReelItem } from "@/features/reels/model";

/*
  What the "More" menu and the overlay's author row offer for a given reel,
  as data. Pure, so the tests pin the rules down without rendering:

  - own reel      → Delete; never Block / Follow / Interested / Not interested
  - suggested     → Interested (the reel carries a reason_text)
  - relationship  → Follow / Unfollow only once it is known; unknown = no row
  - channel reel  → Subscribe on the author row, otherwise Follow
*/

export type MoreMenuItemKey =
  | "copy-link"
  | "description"
  | "download"
  | "why"
  | "interested"
  | "follow"
  | "unfollow"
  | "block"
  | "delete"
  | "clear-screen"
  | "not-interested"
  | "dont-recommend"
  | "report";

export interface MoreMenuContext {
  isOwn: boolean;
  /** The batch relationship lookup has answered for this author. */
  relationshipKnown: boolean;
  following: boolean;
}

/*
  The playback rows at the top of the More menu (TikTok's layout): Speed
  as an inline segmented control, Quality opening a sub-list, Auto scroll
  and Captions as switches, Theater mode in the "Floating player" slot.
  They are always present; the mapped rows below them come from
  moreMenuItems. Speed offers five chips — 0.5 stays a valid stored value
  (playerPrefs.SPEEDS) but is not offered here.
*/
export const PLAYBACK_ROWS = ["speed", "quality", "auto-scroll", "theater", "captions"] as const;
export type PlaybackRowKey = (typeof PLAYBACK_ROWS)[number];
export const MENU_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

/** The mapped rows in display order, after the playback rows. Separators are the renderer's business. */
export function moreMenuItems(reel: ReelItem, ctx: MoreMenuContext): MoreMenuItemKey[] {
  // Only the three dots sit on the frame; everything a viewer can do with a reel is in here.
  const items: MoreMenuItemKey[] = ["copy-link"];
  if (reel.caption || reel.hashtags.length) items.push("description");
  if (reel.downloadAllowed) items.push("download");
  if (reel.reasonText) items.push("why");

  if (!ctx.isOwn) {
    if (reel.reasonText) items.push("interested");
    if (ctx.relationshipKnown && reel.authorUsername) items.push(ctx.following ? "unfollow" : "follow");
    items.push("block");
  } else {
    items.push("delete");
  }

  items.push("clear-screen");

  if (!ctx.isOwn) items.push("not-interested", "dont-recommend", "report");
  return items;
}

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

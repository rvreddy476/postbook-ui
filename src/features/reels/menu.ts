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

/** The rows in display order. Separators are the renderer's business. */
export function moreMenuItems(reel: ReelItem, ctx: MoreMenuContext): MoreMenuItemKey[] {
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

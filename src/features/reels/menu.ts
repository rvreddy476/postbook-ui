import type { ReelItem } from "@/features/reels/model";
import { canUseSound } from "@/features/reels/sounds";

/*
  What the "More" menu and the overlay's author row offer for a given reel,
  as data. Pure, so the tests pin the rules down without rendering:

  - own reel      → Delete; never Block / Follow / Interested / Not interested
  - suggested     → Interested (the reel carries a reason_text)
  - relationship  → Follow / Unfollow only once it is known; unknown = no row
  - channel reel  → Subscribe on the author row, otherwise Follow
  - sound         → Use this sound, when the reel plays an added sound or its
                    own audio may be reused (canUseSound: the creator allows
                    it, or the reel is the viewer's own)
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
  | "report"
  | "use-sound";

export interface MoreMenuContext {
  isOwn: boolean;
  /** The batch relationship lookup has answered for this author. */
  relationshipKnown: boolean;
  following: boolean;
}

/*
  The playback rows of the More menu (YouTube Shorts' layout): Captions,
  Audio track, Playback speed and Quality open panes inside the card and
  show their current value; Auto scroll is a switch. The mapped rows come
  from moreMenuItems (Description first, the feedback rows last).
  MENU_SPEEDS are the preset chips under the speed slider.
*/
export const PLAYBACK_ROWS = ["captions", "audio", "speed", "quality", "auto-scroll"] as const;
export type PlaybackRowKey = (typeof PLAYBACK_ROWS)[number];
export const MENU_SPEEDS = [0.25, 1, 1.25, 1.5, 2] as const;

/**
 * The mapped rows in display order, around the playback rows. The founder's
 * cut (2026-09-27, YouTube Shorts' list): Description, then Not interested,
 * Don't recommend this channel, Report; and Use this sound (2026-09-29,
 * original sounds) on any reel whose sound may be reused, the viewer's own
 * included. The other actions (copy link, download, follow, block, delete,
 * clear screen, don't recommend, why) keep their renderers and handlers
 * but are not offered until asked for again. Separators are the
 * renderer's business.
 */
export function moreMenuItems(reel: ReelItem, ctx: MoreMenuContext): MoreMenuItemKey[] {
  const items: MoreMenuItemKey[] = [];
  if (reel.caption || reel.hashtags.length) items.push("description");
  if (!ctx.isOwn) items.push("not-interested", "dont-recommend", "report");
  if (canUseSound(reel, ctx.isOwn)) items.push("use-sound");
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

"use client";

import {
  AlignLeft,
  Ban,
  CircleSlash,
  Download,
  EyeOff,
  Flag,
  Info,
  Link2,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  UserX,
} from "lucide-react";

import { MenuRow, Popover } from "@/features/reels/components/Popover";
import { moreMenuItems, type MoreMenuItemKey } from "@/features/reels/menu";
import type { ReelItem } from "@/features/reels/model";

interface ReelMoreMenuProps {
  open: boolean;
  onClose: () => void;
  reel: ReelItem;
  isOwn: boolean;
  /** undefined = relationship not known yet (no Follow row). */
  following: boolean | undefined;
  followPending?: boolean;
  onCopyLink: () => void;
  onDescription: () => void;
  onInterested: () => void;
  onToggleFollow: () => void;
  onBlock: () => void;
  onDelete: () => void;
  onClearScreen: () => void;
  onNotInterested: () => void;
  onDontRecommend: () => void;
  onReport: () => void;
  /**
   * "beside" (default): the card opens to the left of its trigger, growing
   * upward — the theater bar. "below": right-aligned under the trigger —
   * the More circle at the frame's top-right.
   */
  anchor?: "beside" | "below";
}

const ICON = "h-[18px] w-[18px]";

const MENU_GROUPS: readonly (readonly MoreMenuItemKey[])[] = [
  ["copy-link", "description", "download", "why"],
  ["interested", "follow", "unfollow", "block", "delete"],
  ["clear-screen"],
  ["not-interested", "dont-recommend", "report"],
];

/* Every row here does something real; nothing is a placeholder. Which rows
   appear is decided by moreMenuItems (pure, tested); this only draws them. */
export function ReelMoreMenu({
  open,
  onClose,
  reel,
  isOwn,
  following,
  followPending,
  onCopyLink,
  onDescription,
  onInterested,
  onToggleFollow,
  onBlock,
  onDelete,
  onClearScreen,
  onNotInterested,
  onDontRecommend,
  onReport,
  anchor = "beside",
}: ReelMoreMenuProps) {
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const handle = reel.authorUsername ? `@${reel.authorUsername}` : "this creator";
  const items = moreMenuItems(reel, { isOwn, relationshipKnown: following !== undefined, following: following === true });

  const row = (key: MoreMenuItemKey) => {
    switch (key) {
      case "copy-link":
        return <MenuRow key={key} icon={<Link2 className={ICON} />} label="Copy link" onClick={run(onCopyLink)} />;
      case "description":
        return <MenuRow key={key} icon={<AlignLeft className={ICON} />} label="Description" onClick={run(onDescription)} />;
      case "download":
        return (
          <a
            key={key}
            role="menuitem"
            href={reel.media.downloadUrl}
            download={`reel-${reel.id}.mp4`}
            onClick={onClose}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] font-medium text-brand-text transition hover:bg-brand-secondary"
          >
            <Download className={`${ICON} text-current/80`} /> Download
          </a>
        );
      case "why":
        return <MenuRow key={key} icon={<Info className={ICON} />} label="Why you're seeing this" hint={reel.reasonText ?? undefined} />;
      case "interested":
        return <MenuRow key={key} icon={<Sparkles className={ICON} />} label="Interested" hint="Show more like this" onClick={run(onInterested)} />;
      case "follow":
        return <MenuRow key={key} icon={<UserPlus className={ICON} />} label={`Follow ${handle}`} disabled={followPending} onClick={run(onToggleFollow)} />;
      case "unfollow":
        return <MenuRow key={key} icon={<UserMinus className={ICON} />} label={`Unfollow ${handle}`} disabled={followPending} onClick={run(onToggleFollow)} />;
      case "block":
        return <MenuRow key={key} icon={<Ban className={ICON} />} label={`Block ${handle}`} onClick={run(onBlock)} />;
      case "delete":
        return <MenuRow key={key} icon={<Trash2 className={ICON} />} label="Delete reel" danger onClick={run(onDelete)} />;
      case "clear-screen":
        return <MenuRow key={key} icon={<EyeOff className={ICON} />} label="Clear screen" hint="Hide the controls · H" onClick={run(onClearScreen)} />;
      case "not-interested":
        return <MenuRow key={key} icon={<CircleSlash className={ICON} />} label="Not interested" onClick={run(onNotInterested)} />;
      case "dont-recommend":
        return <MenuRow key={key} icon={<UserX className={ICON} />} label={`Don't recommend ${handle}`} onClick={run(onDontRecommend)} />;
      case "report":
        return <MenuRow key={key} icon={<Flag className={ICON} />} label="Report" danger onClick={run(onReport)} />;
      default:
        return null;
    }
  };

  // Visual groups: info · relationship · clear screen · feedback/report.
  const groups = MENU_GROUPS
    .map((g) => g.filter((k) => items.includes(k)))
    .filter((g) => g.length > 0);

  return (
    <Popover open={open} onClose={onClose} align="right" label="More options" placement={anchor === "below" ? "down" : "up"} belowTrigger={anchor === "below"}>
      <div className="py-1">
        {groups.map((group, gi) => (
          <div key={group[0]}>
            {gi > 0 ? <div role="separator" className="my-1 border-t border-border" /> : null}
            {group.map(row)}
          </div>
        ))}
      </div>
    </Popover>
  );
}

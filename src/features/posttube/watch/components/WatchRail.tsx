"use client";

import type { ReactNode } from "react";
import { Download, FolderPlus, HandHeart, ListVideo, MoreHorizontal, RectangleHorizontal, ThumbsDown } from "lucide-react";

import { RailBubble, RailHeart, RailShare } from "@/features/reels/components/ReelRailIcons";
import { formatCount } from "@/features/reels/model";

/*
  The action rail beside the player, the Reels rail turned to our
  vocabulary: Love (count under, filled when loved), Pass (private; filled
  when passed; never lit together with Love), Share, Thanks (a tip; only
  when the page passes onThanks — the creator has tips on and the viewer
  is not the creator, see thanks.showThanks), Keep (only when the post
  allows downloads or the viewer owns it — a link that opens the 307 in a
  new tab), Queue (filled when queued), Add (to a collection),
  Comments (count; opens the column), More (the choice-pane menu). 36px
  circles on a 56px pitch (watch.css). In theater the same buttons lie in
  a row on the stage colour, the Reels theater bar.
*/

export const WATCH_RAIL_ORDER = ["love", "pass", "share", "thanks", "keep", "queue", "add", "comments", "more"] as const;

export interface WatchRailProps {
  loved: boolean;
  likeCount: number;
  passed: boolean;
  shareHidden?: boolean;
  /** null hides Keep. */
  keepHref: string | null;
  queued: boolean;
  commentCount: number;
  commentsOff?: boolean;
  commentsOpen?: boolean;
  onLove: () => void;
  onPass: () => void;
  onShare: () => void;
  /** Absent hides Thanks; the page passes it only when thanks.showThanks is true. */
  onThanks?: () => void;
  onQueue: () => void;
  onAdd: () => void;
  onComments: () => void;
  onMore: () => void;
  /** The More popover, rendered by the page into the rail's More slot. */
  moreMenu?: ReactNode;
  /** "rail" beside the player (default); "bar" under it in theater. */
  variant?: "rail" | "bar";
  /** Theater bar only: the leave-theater button at the right end. */
  onLeaveTheater?: () => void;
}

export function WatchRail({
  loved,
  likeCount,
  passed,
  shareHidden = false,
  keepHref,
  queued,
  commentCount,
  commentsOff = false,
  commentsOpen = false,
  onLove,
  onPass,
  onShare,
  onThanks,
  onQueue,
  onAdd,
  onComments,
  onMore,
  moreMenu,
  variant = "rail",
  onLeaveTheater,
}: WatchRailProps) {
  const bar = variant === "bar";
  return (
    <div className={`tube-rail is-${variant}`} role="toolbar" aria-label="Video actions" onClick={(e) => e.stopPropagation()}>
      <RailButton label={loved ? "Unlove" : "Love"} count={likeCount} active={loved} activeClass="is-loved" onClick={onLove} icon={<RailHeart size={16} />} dataAction="love" />
      <RailButton label={passed ? "Undo pass" : "Pass"} active={passed} activeClass="is-passed" onClick={onPass} icon={<ThumbsDown size={17} className={passed ? "fill-current" : ""} />} dataAction="pass" />
      {!shareHidden ? <RailButton label="Share" onClick={onShare} icon={<RailShare size={18} />} dataAction="share" /> : null}
      {onThanks ? <RailButton label="Thanks" onClick={onThanks} icon={<HandHeart size={17} />} dataAction="thanks" /> : null}
      {keepHref ? (
        <a href={keepHref} target="_blank" rel="noopener" className="tube-rail__button" aria-label="Keep (download)" title="Keep" data-action="keep">
          <span className="tube-rail__icon">
            <Download size={17} />
          </span>
          <span className="tube-rail__count" aria-hidden />
        </a>
      ) : null}
      <RailButton label={queued ? "Remove from Queue" : "Queue"} active={queued} activeClass="is-queued" onClick={onQueue} icon={<ListVideo size={18} />} dataAction="queue" />
      <RailButton label="Add to collection" onClick={onAdd} icon={<FolderPlus size={17} />} dataAction="add" />
      {!commentsOff ? (
        <RailButton label={commentsOpen ? "Close comments" : "Comments"} count={commentCount} active={commentsOpen} activeClass="is-open" onClick={onComments} icon={<RailBubble size={18} />} dataAction="comments" />
      ) : null}
      {bar ? <span className="tube-rail__spacer" /> : null}
      <div className="tube-rail__more">
        <RailButton label="More" onClick={onMore} icon={<MoreHorizontal size={18} />} dataAction="more" />
        {moreMenu}
      </div>
      {bar && onLeaveTheater ? (
        <button type="button" className="tube-rail__leave" onClick={onLeaveTheater}>
          <RectangleHorizontal size={14} /> Leave theater
        </button>
      ) : null}
    </div>
  );
}

function RailButton({
  label,
  count,
  icon,
  onClick,
  active,
  activeClass = "",
  dataAction,
}: {
  label: string;
  count?: number;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
  dataAction: string;
}) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={onClick} data-action={dataAction} className={`tube-rail__button ${active ? activeClass : ""}`}>
      <span className="tube-rail__icon">{icon}</span>
      <span className="tube-rail__count">{typeof count === "number" ? formatCount(count) : ""}</span>
    </button>
  );
}

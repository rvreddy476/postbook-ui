"use client";

import { motion } from "framer-motion";
import { Bookmark, Flame, MessageCircle, MoreHorizontal, Share2 } from "lucide-react";
import type { ReactNode } from "react";

interface ActionRailProps {
  boosted: boolean;
  saved: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  unreadComments?: number;
  onBoost: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onMore: () => void;
}

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function RailButton({
  active,
  label,
  count,
  icon,
  onClick,
  badge,
}: {
  active?: boolean;
  label: string;
  count?: number;
  icon: ReactNode;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-1">
      <motion.button
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.06 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        type="button"
        onClick={onClick}
        className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ${
          active
            ? "bg-slate-900 text-white shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
            : "bg-[#F5F5F7] text-slate-600 hover:bg-slate-200/70"
        }`}
        aria-label={label}
      >
        {icon}
        {badge && badge > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </motion.button>
      {typeof count === "number" ? (
        <span className="text-[11px] font-semibold tabular-nums text-slate-500">{formatCount(count)}</span>
      ) : (
        <span className="h-[17px]" aria-hidden />
      )}
    </div>
  );
}

export function ActionRail(props: ActionRailProps) {
  return (
    <aside className="flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <RailButton
          active={props.boosted}
          label="Boost"
          count={props.likeCount}
          icon={<Flame className="h-[19px] w-[19px]" />}
          onClick={props.onBoost}
        />
        <RailButton
          label="Comment"
          count={props.commentCount}
          icon={<MessageCircle className="h-[19px] w-[19px]" />}
          badge={props.unreadComments}
          onClick={props.onComment}
        />
        <RailButton
          label="Share"
          icon={<Share2 className="h-[18px] w-[18px]" />}
          onClick={props.onShare}
        />
        <RailButton
          active={props.saved}
          label="Save"
          icon={<Bookmark className="h-[18px] w-[18px]" />}
          onClick={props.onSave}
        />
        <RailButton
          label="More"
          icon={<MoreHorizontal className="h-[18px] w-[18px]" />}
          onClick={props.onMore}
        />
      </div>
    </aside>
  );
}

"use client";

import { motion } from "framer-motion";
import {
  ThumbsUp,
  ThumbsDown,
  Share2,
  Bookmark,
  MessageCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { MoreMenu } from "@/features/reels/components/MoreMenu";

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function ActionButton({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      whileHover={{ scale: 1.04 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-all duration-150 ${
        active
          ? "bg-slate-900 text-white"
          : "bg-[#F5F5F7] text-slate-500 hover:bg-slate-200/70"
      }`}
      aria-label={label}
    >
      <span className="flex h-7 w-7 items-center justify-center">{icon}</span>
      {typeof count === "number" ? (
        <span className="text-[9px] font-semibold tabular-nums">
          {formatCount(count)}
        </span>
      ) : (
        <span className="text-[9px] font-medium">{label}</span>
      )}
    </motion.button>
  );
}

interface ActionsPanelProps {
  liked: boolean;
  disliked: boolean;
  saved: boolean;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  shareCount: number;
  commentsOpen: boolean;
  onToggleLike: () => void;
  onToggleDislike: () => void;
  onShare: () => void;
  onToggleSave: () => void;
  onToggleComments: () => void;
  onReport: () => void;
  onFeedback: () => void;
  onDontRecommend: () => void;
}

export function ActionsPanel({
  liked,
  disliked,
  saved,
  likeCount,
  dislikeCount,
  commentCount,
  shareCount,
  commentsOpen,
  onToggleLike,
  onToggleDislike,
  onShare,
  onToggleSave,
  onToggleComments,
  onReport,
  onFeedback,
  onDontRecommend,
}: ActionsPanelProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <ActionButton
        icon={<ThumbsUp className="h-[15px] w-[15px]" />}
        label="Like"
        count={likeCount}
        active={liked}
        onClick={onToggleLike}
      />
      <ActionButton
        icon={<ThumbsDown className="h-[15px] w-[15px]" />}
        label="Dislike"
        count={dislikeCount}
        active={disliked}
        onClick={onToggleDislike}
      />
      <ActionButton
        icon={<MessageCircle className="h-[15px] w-[15px]" />}
        label="Comments"
        count={commentCount}
        active={commentsOpen}
        onClick={onToggleComments}
      />
      <ActionButton
        icon={<Share2 className="h-[14px] w-[14px]" />}
        label="Share"
        count={shareCount}
        onClick={onShare}
      />
      <ActionButton
        icon={<Bookmark className="h-[14px] w-[14px]" />}
        label="Save"
        active={saved}
        onClick={onToggleSave}
      />
      <MoreMenu
        onReport={onReport}
        onFeedback={onFeedback}
        onDontRecommend={onDontRecommend}
      />
    </div>
  );
}

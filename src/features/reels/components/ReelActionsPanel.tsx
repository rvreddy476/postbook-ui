"use client";

import { motion } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  BarChart3,
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
  loved,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  loved?: boolean;
  onClick: () => void;
}) {
  const stateClass = loved
    ? "bg-rose-500/15 text-rose-500"
    : active
      ? "bg-brand-text text-brand-bg"
      : "bg-brand-secondary text-brand-highlight hover:bg-brand-secondary/70";
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      whileHover={{ scale: 1.04 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      type="button"
      onClick={onClick}
      aria-pressed={loved}
      className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-all duration-150 ${stateClass}`}
      aria-label={loved ? `${label}d` : label}
    >
      <span className="flex h-7 w-7 items-center justify-center">{icon}</span>
      {typeof count === "number" ? (
        <span className="text-[9px] font-semibold tabular-nums">
          {formatCount(count)}
        </span>
      ) : (
        <span className="text-[9px] font-medium">{loved ? `${label}d` : label}</span>
      )}
    </motion.button>
  );
}

interface ReelActionsPanelProps {
  boosted: boolean;
  saved: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  commentsOpen: boolean;
  onBoost: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onReport: () => void;
  onFeedback: () => void;
  onDontRecommend: () => void;
  onDescription?: () => void;
  onSaveToPlaylist?: () => void;
  onCaptions?: () => void;
  onQuality?: () => void;
  onNotInterested?: () => void;
}

export function ReelActionsPanel({
  boosted,
  saved,
  likeCount,
  commentCount,
  shareCount,
  viewCount,
  commentsOpen,
  onBoost,
  onComment,
  onShare,
  onSave,
  onReport,
  onFeedback,
  onDontRecommend,
  onDescription,
  onSaveToPlaylist,
  onCaptions,
  onQuality,
  onNotInterested,
}: ReelActionsPanelProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <ActionButton
        icon={<Heart className={`h-[15px] w-[15px] ${boosted ? "fill-rose-500 text-rose-500" : ""}`} />}
        label="Love"
        count={likeCount}
        loved={boosted}
        onClick={onBoost}
      />
      <ActionButton
        icon={<MessageCircle className="h-[15px] w-[15px]" />}
        label="Comments"
        count={commentCount}
        active={commentsOpen}
        onClick={onComment}
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
        onClick={onSave}
      />
      {/* Views — Twitter-style stat (not interactive) */}
      <div
        className="flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-brand-highlight"
        title={`${viewCount.toLocaleString()} views`}
        aria-label={`${viewCount.toLocaleString()} views`}
      >
        <span className="flex h-7 w-7 items-center justify-center">
          <BarChart3 className="h-[15px] w-[15px]" />
        </span>
        <span className="text-[9px] font-semibold tabular-nums">{formatCount(viewCount)}</span>
      </div>

      <MoreMenu
        onReport={onReport}
        onFeedback={onFeedback}
        onDontRecommend={onDontRecommend}
        onDescription={onDescription}
        onSaveToPlaylist={onSaveToPlaylist}
        onCaptions={onCaptions}
        onQuality={onQuality}
        onNotInterested={onNotInterested}
      />
    </div>
  );
}

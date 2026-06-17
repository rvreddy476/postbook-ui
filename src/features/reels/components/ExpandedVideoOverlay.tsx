"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
} from "lucide-react";
import { ReelPlayer } from "@/features/reels/components/ReelPlayer";
import { MoreMenu } from "@/features/reels/components/MoreMenu";
import { ShareSheet } from "@/features/reels/components/ShareSheet";
import CommentSection from "@/components/CommentSection";

/* ── tiny action button used only in expanded overlay ──── */

function OverlayAction({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-all duration-150 ${
        active
          ? "bg-slate-900 text-white"
          : "bg-brand-card/10 text-white/80 hover:bg-brand-card/20"
      }`}
      aria-label={label}
    >
      <span className="flex h-7 w-7 items-center justify-center">{icon}</span>
      <span className="text-[9px] font-medium">{label}</span>
    </button>
  );
}

/* ── overlay ───────────────────────────────────────────── */

interface ExpandedVideoOverlayProps {
  open: boolean;
  videoUrl: string;
  posterUrl: string;
  muted: boolean;
  onToggleMuted: () => void;
  onClose: () => void;
  postId?: string;
  postAuthorId?: string;
  commentCount?: number;
}

export function ExpandedVideoOverlay({
  open,
  videoUrl,
  posterUrl,
  muted,
  onToggleMuted,
  onClose,
  postId,
  postAuthorId,
  commentCount,
}: ExpandedVideoOverlayProps) {
  const showComments = Boolean(postId && postAuthorId);

  const [liked, setLiked] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(true);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Blurred backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-xl"
            onClick={onClose}
          />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-brand-card/10 text-white backdrop-blur-sm transition hover:bg-brand-card/20"
            aria-label="Close expanded video"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Content row: Video | Actions | Comments */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative z-10 flex h-[96vh] items-stretch gap-3"
          >
            {/* Expanded video — full height, proper fit */}
            <div className="h-full aspect-[9/16] overflow-hidden rounded-[24px] bg-black shadow-2xl">
              <ReelPlayer
                videoUrl={videoUrl}
                posterUrl={posterUrl}
                muted={muted}
                active
                contain
                onToggleMuted={onToggleMuted}
                onBoost={() => setLiked(true)}
              />
            </div>

            {/* Action buttons rail */}
            <div className="flex shrink-0 flex-col items-center gap-1.5 self-start pt-2">
              <OverlayAction
                icon={<Heart className={`h-[15px] w-[15px] ${liked ? "fill-rose-500 text-rose-500" : ""}`} />}
                label="Love"
                active={false}
                onClick={() => setLiked((p) => !p)}
              />
              <OverlayAction
                icon={<MessageCircle className="h-[15px] w-[15px]" />}
                label="Comments"
                active={commentsVisible}
                onClick={() => setCommentsVisible((p) => !p)}
              />
              <OverlayAction
                icon={<Share2 className="h-[14px] w-[14px]" />}
                label="Share"
                onClick={() => setShareOpen(true)}
              />
              <OverlayAction
                icon={<Bookmark className="h-[14px] w-[14px]" />}
                label="Save"
                active={saved}
                onClick={() => setSaved((p) => !p)}
              />
              <MoreMenu
                onReport={() => {}}
                onFeedback={() => {}}
                onDontRecommend={() => {}}
              />
            </div>

            {/* Comments panel */}
            {showComments && commentsVisible ? (
              <div className="flex w-[380px] shrink-0 flex-col rounded-2xl bg-brand-card shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#E8E8EE] px-4 py-3">
                  <h3 className="text-[13px] font-bold text-brand-text">
                    Comments{typeof commentCount === "number" ? ` (${commentCount})` : ""}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setCommentsVisible(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/60 transition hover:bg-brand-secondary hover:text-brand-highlight"
                    aria-label="Close comments"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <CommentSection
                    postId={postId!}
                    postAuthorId={postAuthorId!}
                    commentsCount={commentCount ?? 0}
                    alwaysExpanded
                  />
                </div>
              </div>
            ) : null}
          </motion.div>

          <ShareSheet
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            url={postId && typeof window !== "undefined" ? `${window.location.origin}/reels?reelId=${postId}` : ""}
            title="Check this out on VChat"
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

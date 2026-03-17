"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar } from "@/components/LetterAvatar";
import type { Reel } from "@/features/reels/types";

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

interface ReelChannelInfoProps {
  reel: Reel;
  subscribed: boolean;
  onToggleSubscribe: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function ReelChannelInfo({
  reel,
  subscribed,
  onToggleSubscribe,
  onPrev,
  onNext,
  hasPrev = true,
  hasNext = true,
}: ReelChannelInfoProps) {
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const isLong = reel.caption.length > 120;

  const displayText = useMemo(() => {
    if (captionExpanded || !isLong) return reel.caption;
    return `${reel.caption.slice(0, 120)}...`;
  }, [reel.caption, captionExpanded, isLong]);

  return (
    <div className="flex h-full flex-col justify-end overflow-y-auto pb-6">
      {/* Nav arrows */}
      <div className="mb-4 flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F7] text-brand-highlight transition hover:bg-slate-200/70 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous reel"
        >
          <ChevronUp className="h-4 w-4" />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F7] text-brand-highlight transition hover:bg-slate-200/70 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next reel"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Channel row + Subscribe */}
      <div className="flex items-center gap-3">
        <Avatar
          src={reel.author_avatar_url}
          name={reel.author_name}
          seed={reel.author_id}
          size="md"
          imgClassName="border-2 border-brand-divider"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-brand-text leading-tight">
            @{reel.author_name}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleSubscribe}
          className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold transition ${
            subscribed
              ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {subscribed ? "Subscribed" : "Subscribe"}
        </button>
      </div>

      {/* Caption */}
      <div className="mt-4">
        <p className="whitespace-pre-line text-[13px] leading-[1.5] text-brand-highlight">
          {displayText}
        </p>
        {isLong ? (
          <button
            type="button"
            onClick={() => setCaptionExpanded((prev) => !prev)}
            className="mt-1 text-[12px] font-semibold text-brand-text/60 hover:text-brand-highlight transition"
          >
            {captionExpanded ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>

      {/* Views */}
      {typeof reel.view_count === "number" ? (
        <div className="mt-1.5 text-[12px] text-brand-text/60">
          {formatCount(reel.view_count)} views
        </div>
      ) : null}

      {/* Hashtags */}
      {reel.hashtags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {reel.hashtags.map((tag) => (
            <Link
              key={tag}
              href={`/hashtag/${tag}`}
              className="rounded-full bg-brand-secondary px-2.5 py-0.5 text-[11px] font-semibold text-brand-highlight transition hover:bg-slate-100"
            >
              #{tag}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

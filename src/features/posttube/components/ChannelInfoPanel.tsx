"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/LetterAvatar";
import type { PostTubeVideo } from "../types";

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface ChannelInfoPanelProps {
  video: PostTubeVideo;
  subscribed: boolean;
  onToggleSubscribe: () => void;
}

export function ChannelInfoPanel({
  video,
  subscribed,
  onToggleSubscribe,
}: ChannelInfoPanelProps) {
  const [descExpanded, setDescExpanded] = useState(false);

  const descriptionLines = video.description.split("\n");
  const isLong = descriptionLines.length > 3 || video.description.length > 180;

  const displayText = useMemo(() => {
    if (descExpanded || !isLong) return video.description;
    const truncated = descriptionLines.slice(0, 3).join("\n");
    return truncated.length > 180 ? `${truncated.slice(0, 180)}...` : `${truncated}...`;
  }, [video.description, descExpanded, isLong, descriptionLines]);

  return (
    <div className="flex h-full flex-col justify-end overflow-y-auto pb-6">
      {/* 1. Channel row + Subscribe */}
      <div className="flex items-center gap-3">
        <Avatar
          src={video.channel_avatar_url}
          name={video.channel_name}
          seed={video.channel_id || video.channel_name}
          size="md"
          imgClassName="border-2 border-slate-100"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-slate-900 leading-tight">
            {video.channel_name}
          </p>
          <p className="text-[12px] text-slate-400">
            {formatCount(video.channel_subscriber_count)} subscribers
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

      {/* 2. Video title */}
      <h1 className="mt-5 text-[18px] font-bold leading-snug text-slate-900">
        {video.title}
      </h1>

      {/* 3. Views + time */}
      <div className="mt-1.5 flex items-center gap-2 text-[12px] text-slate-400">
        <span>{formatCount(video.view_count)} views</span>
        <span className="text-slate-200">·</span>
        <span>{timeAgo(video.published_at)}</span>
      </div>

      {/* 4. Hashtags */}
      {video.hashtags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {video.hashtags.map((tag) => (
            <Link
              key={tag}
              href={`/hashtag/${tag}`}
              className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100"
            >
              #{tag}
            </Link>
          ))}
        </div>
      ) : null}

      {/* 5. Description */}
      <div className="mt-4">
        <p className="whitespace-pre-line text-[13px] leading-[1.5] text-slate-600">
          {displayText}
        </p>
        {isLong ? (
          <button
            type="button"
            onClick={() => setDescExpanded((prev) => !prev)}
            className="mt-1 text-[12px] font-semibold text-slate-400 hover:text-slate-600 transition"
          >
            {descExpanded ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

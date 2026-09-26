"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Settings2, Volume2, VolumeX } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import { formatCount, type ReelItem } from "@/features/reels/model";

interface ReelOverlayProps {
  reel: ReelItem;
  isOwn: boolean;
  /** undefined = relationship unknown (no button yet) */
  following: boolean | undefined;
  followPending: boolean;
  onToggleFollow: () => void;
  sound: boolean;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  settingsMenu?: React.ReactNode;
}

const CAPTION_CLAMP = 110;

/*
  What sits on top of the video: sound and settings at the top right, the
  author, caption and hashtags at the bottom left over a gradient. Clicks on
  any of it stop before reaching the stage.
*/
export function ReelOverlay({
  reel,
  isOwn,
  following,
  followPending,
  onToggleFollow,
  sound,
  onToggleSound,
  onOpenSettings,
  settingsMenu,
}: ReelOverlayProps) {
  const [expanded, setExpanded] = useState(false);
  const long = reel.caption.length > CAPTION_CLAMP;
  const caption = expanded || !long ? reel.caption : `${reel.caption.slice(0, CAPTION_CLAMP).trimEnd()}…`;
  const profileHref = reel.authorUsername ? `/u/${reel.authorUsername}` : `/u/${reel.authorId}`;

  return (
    <>
      {/* top-right controls */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={sound ? "Mute" : "Unmute"}
          aria-pressed={!sound}
          onClick={onToggleSound}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/60"
        >
          {sound ? <Volume2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px]" />}
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label="Playback settings"
            onClick={onOpenSettings}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/60"
          >
            <Settings2 className="h-[18px] w-[18px]" />
          </button>
          {settingsMenu}
        </div>
      </div>

      {/* bottom-left author + caption */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-6 pt-16 pr-20 md:pr-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-auto flex items-center gap-2.5">
          <Link href={profileHref} className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <Avatar src={reel.authorAvatarUrl ?? ""} name={reel.authorName} seed={reel.authorId} size="sm" className="ring-2 ring-white/80" />
          </Link>
          <Link
            href={profileHref}
            className="min-w-0 truncate text-[14px] font-semibold text-white drop-shadow hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {reel.authorUsername ? `@${reel.authorUsername}` : reel.authorName}
          </Link>
          {!isOwn && following !== undefined ? (
            <button
              type="button"
              disabled={followPending}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFollow();
              }}
              className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold transition disabled:opacity-60 ${
                following
                  ? "border-white/40 bg-transparent text-white hover:bg-white/10"
                  : "border-white bg-white text-black hover:bg-white/90"
              }`}
            >
              {following ? "Following" : "Follow"}
            </button>
          ) : null}
        </div>

        {reel.caption ? (
          <p className="pointer-events-auto mt-2 max-w-[92%] whitespace-pre-wrap text-[13px] leading-snug text-white/95 drop-shadow">
            {caption}
            {long ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className="ml-1 font-semibold text-white/70 hover:text-white"
              >
                {expanded ? "less" : "more"}
              </button>
            ) : null}
          </p>
        ) : null}

        {reel.hashtags.length > 0 ? (
          <p className="pointer-events-auto mt-1 flex flex-wrap gap-x-2 text-[12px] font-semibold text-white/85">
            {reel.hashtags.slice(0, 6).map((tag) => (
              <Link key={tag} href={`/hashtag/${encodeURIComponent(tag)}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                #{tag}
              </Link>
            ))}
          </p>
        ) : null}

        <div className="mt-2 flex items-center gap-3 text-[11px] text-white/70">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" /> {formatCount(reel.viewCount)} views
          </span>
          {reel.reasonText ? <span className="truncate">· {reel.reasonText}</span> : null}
        </div>
      </div>
    </>
  );
}

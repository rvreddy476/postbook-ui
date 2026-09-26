"use client";

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
  const profileHref = reel.authorUsername ? `/u/${reel.authorUsername}` : `/u/${reel.authorId}`;

  return (
    <>
      <div className="reel-view-count" aria-label={`${formatCount(reel.viewCount)} views`}><Eye size={15}/><span>{formatCount(reel.viewCount)} views</span></div>
      {/* top-right controls */}
      <div className="reel-playback-controls absolute left-3 right-3 top-3 z-30 flex items-center justify-end gap-2 pointer-events-none" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={sound ? "Mute" : "Unmute"}
          aria-pressed={!sound}
          onClick={onToggleSound}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/60"
        >
          {sound ? <Volume2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px]" />}
        </button>
        <>
          <button
            type="button"
            aria-label="Playback settings"
            onClick={onOpenSettings}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/60"
          >
            <Settings2 className="h-[18px] w-[18px]" />
          </button>
          {settingsMenu}
        </>
      </div>

      {/* bottom-left author + caption */}
      <div
        className="reel-overlay-details pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-6 pt-16 pr-20 md:pr-4"
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

        {reel.title ? <h2 className="reel-title" title={reel.title}>{reel.title}</h2> : null}

        {reel.hashtags.length > 0 ? (
          <p className="pointer-events-auto mt-1 flex flex-wrap gap-x-2 text-[12px] font-semibold text-white/85">
            {reel.hashtags.slice(0, 6).map((tag) => (
              <Link key={tag} href={`/hashtag/${encodeURIComponent(tag)}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                #{tag}
              </Link>
            ))}
          </p>
        ) : null}

      </div>
    </>
  );
}

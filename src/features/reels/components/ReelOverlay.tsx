"use client";

import Link from "next/link";
import { Settings2, Volume2, VolumeX } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import { authorAction } from "@/features/reels/menu";
import { type ReelItem } from "@/features/reels/model";

interface ReelOverlayProps {
  reel: ReelItem;
  isOwn: boolean;
  /** undefined = relationship unknown (no button yet) */
  following: boolean | undefined;
  followPending: boolean;
  onToggleFollow: () => void;
  /**
   * Channel subscription for a reel posted through a Tube channel;
   * undefined = unknown (no button yet). Only read when channelHandle is set.
   */
  subscribed?: boolean | undefined;
  subscribePending?: boolean;
  onToggleSubscribe?: () => void;
  /**
   * Draw the author row (avatar, @handle, Follow/Subscribe) over the video.
   * The stage turns this on; CSS hides the row again wherever the creator
   * column is visible, so identity is never shown twice on wide screens.
   */
  showAuthor?: boolean;
  sound: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  settingsMenu?: React.ReactNode;
}

/*
  What sits on top of the video: sound and settings at the top right, the
  title and hashtags at the bottom left over a gradient, and — when asked
  for — the author row above the title, which is what tablets and phones
  see when the creator column is hidden. Clicks on any of it stop before
  reaching the stage.
*/
export function ReelOverlay({
  reel,
  isOwn,
  following,
  followPending,
  onToggleFollow,
  subscribed,
  subscribePending,
  onToggleSubscribe,
  showAuthor = false,
  sound,
  volume,
  onVolumeChange,
  onToggleSound,
  onOpenSettings,
  settingsMenu,
}: ReelOverlayProps) {
  const action = authorAction(reel, isOwn);
  const profileHref = `/u/${reel.authorUsername || reel.authorId}`;
  const hasText = Boolean(reel.title) || reel.hashtags.length > 0;
  const showDetails = showAuthor || hasText;

  return (
    <>
      {/* top-right controls */}
      <div className="reel-playback-controls absolute left-3 right-3 top-3 z-30 flex items-center justify-end gap-2 pointer-events-none" onClick={(e) => e.stopPropagation()}>
        <div className="reel-volume-control">
        <button
          type="button"
          aria-label={sound ? "Mute" : "Unmute"}
          aria-pressed={!sound}
          onClick={onToggleSound}
          className="reel-playback-button"
        >
          {sound && volume > 0 ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <input type="range" aria-label="Volume" min={0} max={100} step={1}
          value={sound ? Math.round(volume * 100) : 0}
          aria-valuetext={`${sound ? Math.round(volume * 100) : 0}%`}
          onChange={event => onVolumeChange(Number(event.target.value) / 100)}/>
        </div>
        <>
          <button
            type="button"
            aria-label="Playback settings"
            onClick={onOpenSettings}
            className="reel-playback-button"
          >
            <Settings2 size={15} />
          </button>
          {settingsMenu}
        </>
      </div>

      {showDetails ? <div
        className={`reel-overlay-details ${hasText ? "" : "is-author-only"} pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-6 pt-16 pr-20 md:pr-4`}
        onClick={(e) => e.stopPropagation()}
      >
        {showAuthor ? (
          <div className="reel-author-row pointer-events-auto" data-author-row>
            <Link href={profileHref} className="reel-author-row__identity" onClick={(e) => e.stopPropagation()}>
              <Avatar src={reel.authorAvatarUrl ?? ""} name={reel.authorName} seed={reel.authorId} size="sm" />
              <span className="min-w-0">
                <span className="reel-author-row__name">{reel.authorName}</span>
                {reel.authorUsername ? <span className="reel-author-row__handle">@{reel.authorUsername}</span> : null}
              </span>
            </Link>
            {action === "subscribe" && subscribed !== undefined ? (
              <button
                type="button"
                disabled={subscribePending}
                aria-pressed={subscribed}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSubscribe?.();
                }}
                className={`reel-author-row__action ${subscribed ? "is-on" : ""}`}
              >
                {subscribed ? "Subscribed" : "Subscribe"}
              </button>
            ) : action === "follow" && following !== undefined && !following ? (
              <button
                type="button"
                disabled={followPending}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFollow();
                }}
                className="reel-author-row__action"
              >
                Follow
              </button>
            ) : null}
          </div>
        ) : null}

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

      </div> : null}
    </>
  );
}

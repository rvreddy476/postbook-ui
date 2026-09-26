"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings2, Volume2, VolumeX } from "lucide-react";

import type { HoverAnchorProps } from "@/features/reels/hooks/useCreatorHoverCard";
import { authorAction } from "@/features/reels/menu";
import { formatCount, type ReelItem } from "@/features/reels/model";

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
  /** Hover-card wiring for the author name (undefined on coarse pointers: plain link). */
  authorAnchor?: HoverAnchorProps;
  sound: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  settingsMenu?: React.ReactNode;
}

/*
  What sits on top of the video: sound and settings at the top right, and
  at the bottom left over a soft gradient — always — the author's name with
  the Follow pill beside it, the title, the caption (two lines and "more"),
  the hashtags and the view count. Clicks on any of it stop before reaching
  the stage.
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
  authorAnchor,
  sound,
  volume,
  onVolumeChange,
  onToggleSound,
  onOpenSettings,
  settingsMenu,
}: ReelOverlayProps) {
  const [expanded, setExpanded] = useState(false);
  const action = authorAction(reel, isOwn);
  const profileHref = `/u/${reel.authorUsername || reel.authorId}`;
  const caption = reel.caption.trim();
  const longCaption = caption.length > 120 || caption.split("\n").length > 2;

  return (
    <>
      {/* top-right controls */}
      <div className="reel-playback-controls absolute left-3 right-3 top-3 z-30 flex items-center justify-end gap-2 pointer-events-none" onClick={(e) => e.stopPropagation()}>
        <div className="reel-volume-control">
          <button type="button" aria-label={sound ? "Mute" : "Unmute"} aria-pressed={!sound} onClick={onToggleSound} className="reel-playback-button">
            {sound && volume > 0 ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <input
            type="range"
            aria-label="Volume"
            min={0}
            max={100}
            step={1}
            value={sound ? Math.round(volume * 100) : 0}
            aria-valuetext={`${sound ? Math.round(volume * 100) : 0}%`}
            onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
          />
        </div>
        <button type="button" aria-label="Playback settings" onClick={onOpenSettings} className="reel-playback-button">
          <Settings2 size={15} />
        </button>
        {settingsMenu}
      </div>

      <div className="reel-overlay-details pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-6 pt-16 pr-20 lg:pr-4" onClick={(e) => e.stopPropagation()}>
        <div className="reel-author-row pointer-events-auto" data-author-row>
          <Link href={profileHref} className="reel-author-row__name" onClick={(e) => e.stopPropagation()} {...(authorAnchor ?? {})}>
            {reel.authorName}
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
              className={`reel-follow-pill ${subscribed ? "is-on" : ""}`}
            >
              {subscribed ? "Subscribed" : "Subscribe"}
            </button>
          ) : action === "follow" && following !== undefined ? (
            <button
              type="button"
              disabled={followPending}
              aria-pressed={following}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFollow();
              }}
              className={`reel-follow-pill ${following ? "is-on" : ""}`}
            >
              {following ? "Following" : "Follow"}
            </button>
          ) : null}
        </div>

        {reel.title ? <h2 className="reel-title" title={reel.title}>{reel.title}</h2> : null}

        {caption ? (
          <div className="reel-caption-row">
            <p className={`reel-caption ${expanded ? "is-expanded" : ""}`}>{caption}</p>
            {longCaption ? (
              <button
                type="button"
                className="reel-caption__more pointer-events-auto"
                aria-expanded={expanded}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
              >
                {expanded ? "less" : "more"}
              </button>
            ) : null}
          </div>
        ) : null}

        {reel.hashtags.length > 0 ? (
          <p className="reel-hashtags pointer-events-auto">
            {reel.hashtags.slice(0, 6).map((tag) => (
              <Link key={tag} href={`/hashtag/${encodeURIComponent(tag)}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                #{tag}
              </Link>
            ))}
          </p>
        ) : null}

        <p className="reel-view-count">{formatCount(reel.viewCount)} views</p>
      </div>
    </>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Lock, Radio } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";

import { formatCount, timeAgo } from "../../model";
import type { Chapter } from "../chapters";
import { descriptionNeedsMore, descriptionSegments } from "../linkify";
import { ChapterStrip } from "./ChapterStrip";

/*
  The details card under the player: the title (15/600), the creator row
  (36px avatar, name, follower count, Follow + bell from the page), the
  topic chip, views and date, the chapter strip, the description behind
  "More" (links, #hashtags → /hashtag/<tag>, timestamps seek), the join
  card when the video is gated. Small type: 13px body, 11px meta.
*/

export interface WatchDetailsProps {
  title: string;
  authorId: string;
  channelName: string;
  channelAvatar?: string;
  channelHref: string;
  followerCount: number;
  /** The Follow + bell control, rendered by the page (SubscribeButton). */
  follow?: ReactNode;
  topic?: { slug: string; label: string } | null;
  viewCount: number;
  publishedAt: string;
  source: "upload" | "live";
  resumedAtMs?: number;
  chapters: Chapter[];
  currentChapter: number;
  onSeek: (ms: number) => void;
  description: string;
  hashtags: string[];
}

export function WatchDetails({
  title,
  authorId,
  channelName,
  channelAvatar,
  channelHref,
  followerCount,
  follow,
  topic,
  viewCount,
  publishedAt,
  source,
  chapters,
  currentChapter,
  onSeek,
  description,
  hashtags,
}: WatchDetailsProps) {
  const [expanded, setExpanded] = useState(false);
  const needsMore = descriptionNeedsMore(description) || hashtags.length > 0;
  const collapsed = !expanded && needsMore;
  const segments = descriptionSegments(description);
  const tags = hashtags.map((h) => h.replace(/^#/, "")).filter((h) => h && !description.includes(`#${h}`));

  return (
    <section className="tube-details" aria-label="About this video">
      <h1 className="tube-details__title">{title}</h1>
      <div className="tube-details__meta">
        {topic ? (
          <Link href={`/posttube/topics/${encodeURIComponent(topic.slug)}`} className="tube-details__topic">
            {topic.label}
          </Link>
        ) : null}
        {source === "live" ? (
          <span className="tube-details__source">
            <Radio size={12} /> From a live stream
          </span>
        ) : null}
        <span>{formatCount(viewCount)} views</span>
        {publishedAt ? <span>· {timeAgo(publishedAt)}</span> : null}
      </div>

      <div className="tube-creator">
        <Link href={channelHref} className="tube-creator__link">
          <span className="tube-creator__avatar">
            <Avatar src={channelAvatar ?? ""} name={channelName} seed={authorId} size="md" />
          </span>
          <span className="min-w-0">
            <p className="tube-creator__name">{channelName}</p>
            <p className="tube-creator__followers">{formatCount(followerCount)} following</p>
          </span>
        </Link>
        <span className="tube-creator__spacer" />
        {follow}
      </div>

      <ChapterStrip chapters={chapters} currentIndex={currentChapter} onSeek={onSeek} />

      {description || tags.length > 0 ? (
        <div className="tube-description" data-collapsed={collapsed ? "" : undefined}>
          <p className="tube-description__text">
            {segments.map((s, i) => {
              switch (s.kind) {
                case "url":
                  return (
                    <a key={i} href={s.href} target="_blank" rel="noopener noreferrer">
                      {s.text}
                    </a>
                  );
                case "hashtag":
                  return (
                    <Link key={i} href={`/hashtag/${encodeURIComponent(s.tag)}`}>
                      {s.text}
                    </Link>
                  );
                case "timestamp":
                  return (
                    <button key={i} type="button" onClick={() => onSeek(s.ms)}>
                      {s.text}
                    </button>
                  );
                default:
                  return <span key={i}>{s.text}</span>;
              }
            })}
            {tags.length > 0 && !collapsed ? (
              <>
                {"\n"}
                {tags.map((t) => (
                  <Link key={t} href={`/hashtag/${encodeURIComponent(t)}`}>
                    #{t}{" "}
                  </Link>
                ))}
              </>
            ) : null}
          </p>
          {needsMore ? (
            <button type="button" className="tube-description__toggle" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
              {expanded ? "Less" : "More"}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** The join card on a membership-gated video: where the player would be. */
export function MembershipCard({ channelName, poster }: { channelName: string; poster?: string }) {
  return (
    <div className="tube-gate" style={poster ? { backgroundImage: `linear-gradient(rgb(var(--reel-stage) / .8), rgb(var(--reel-stage) / .9)), url("${poster}")`, backgroundSize: "cover" } : undefined}>
      <span className="tube-gate__icon">
        <Lock size={20} />
      </span>
      <p className="tube-gate__title">Members only</p>
      <p className="tube-gate__hint">{channelName} shares this video with members. Join to watch it.</p>
      <Link href="/monetization" className="tube-gate__cta">
        Join
      </Link>
    </div>
  );
}

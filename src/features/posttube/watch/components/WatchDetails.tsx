"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { HandHeart, Lock, Radio } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";

import { formatCount, timeAgo } from "../../model";
import type { Chapter } from "../chapters";
import { descriptionSegments } from "../linkify";
import { ChapterStrip } from "./ChapterStrip";

/*
  Under the player, the RUTUBE watch layout: the title (20/700), the
  creator row (40px avatar, name, subscriber count, then Subscribe + bell and
  Thanks right after the name), the action row (WatchActions, passed in),
  the chapter strip, and the about card: views · date (and "From a live
  stream") on top; collapsed it shows two lines of the description, and
  "Show more" opens the facts (Title, Topic) under a divider and the whole
  description with links, #hashtags (→ /hashtag/<tag>) and timestamps
  that seek; "Collapse" folds it back.
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
  /** Absent hides Thanks; the page passes it only when thanks.showThanks is true. */
  onThanks?: () => void;
  /** The action row (WatchActions), rendered by the page. */
  actions?: ReactNode;
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
  onThanks,
  actions,
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
  const segments = descriptionSegments(description);
  const tags = hashtags.map((h) => h.replace(/^#/, "")).filter((h) => h && !description.includes(`#${h}`));

  return (
    <section className="tube-details" aria-label="About this video">
      <h1 className="tube-details__title">{title}</h1>

      <div className="tube-creator">
        <Link href={channelHref} className="tube-creator__link">
          <span className="tube-creator__avatar">
            <Avatar src={channelAvatar ?? ""} name={channelName} seed={authorId} size="md" />
          </span>
          <span className="min-w-0">
            <p className="tube-creator__name">{channelName}</p>
            <p className="tube-creator__followers">{formatCount(followerCount)} subscribers</p>
          </span>
        </Link>
        <span className="tube-creator__buttons">
          {follow}
          {onThanks ? (
            <button type="button" className="tube-creator__thanks" onClick={onThanks} data-action="thanks">
              <HandHeart size={16} /> Thanks
            </button>
          ) : null}
        </span>
      </div>

      {actions}

      <ChapterStrip chapters={chapters} currentIndex={currentChapter} onSeek={onSeek} />

      <div className="tube-about" data-expanded={expanded ? "" : undefined}>
        <p className="tube-about__meta">
          <span>{formatCount(viewCount)} views</span>
          {publishedAt ? <span>· {timeAgo(publishedAt)}</span> : null}
          {source === "live" ? (
            <span className="tube-about__live">
              <Radio size={12} /> From a live stream
            </span>
          ) : null}
        </p>
        {expanded ? (
          <>
            <hr className="tube-about__rule" />
            <dl className="tube-about__facts">
              <dt>Title</dt>
              <dd>{title}</dd>
              {topic ? (
                <>
                  <dt>Topic</dt>
                  <dd>
                    <Link href={`/posttube/topics/${encodeURIComponent(topic.slug)}`}>{topic.label}</Link>
                  </dd>
                </>
              ) : null}
            </dl>
          </>
        ) : null}
        {description || (expanded && tags.length > 0) ? (
          <p className="tube-about__text">
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
            {tags.length > 0 && expanded ? (
              <>
                {description ? "\n" : null}
                {tags.map((t) => (
                  <Link key={t} href={`/hashtag/${encodeURIComponent(t)}`}>
                    #{t}{" "}
                  </Link>
                ))}
              </>
            ) : null}
          </p>
        ) : null}
        <button type="button" className="tube-about__toggle" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
          {expanded ? "Collapse" : "Show more"}
        </button>
      </div>
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

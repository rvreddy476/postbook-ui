"use client";

/*
  The search page's views, all driven by props so they render in tests
  without a network: the tab bar, recents, popular searches, and one
  results view per tab with its loading, empty and error states.
  Rows reuse the MTube discovery rows (disco-row) and the reels poster
  tiles (liked-reels__tile); search.css only lays the page out.
*/

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { BadgeCheck, Clock, Hash, Heart, Music2, Play, RefreshCw, SearchX, TrendingUp, UserRound, X } from "lucide-react";

import { VideoResultRow } from "@/features/posttube/discovery/components/SearchPage";
import { formatCount, type ReelItem, type ReelSound } from "@/features/reels/model";
import { soundPageHref, soundReelCount } from "@/features/reels/sounds";
import type { TabResults } from "./searchApi";
import {
  SEARCH_TABS,
  emptyResultTitle,
  hashtagHref,
  isTopEmpty,
  nextTabIndex,
  type HashtagResult,
  type PersonResult,
  type RecentSearch,
  type SearchTabId,
  type TopPostResult,
} from "./searchModel";
import "@/features/posttube/discovery/discovery.css";
import "@/features/reels/components/reels-screen.css";
import "./search.css";

export type ViewStatus = "loading" | "error" | "ready";

/* ── tabs ──────────────────────────────────────────────────── */

export const tabId = (id: SearchTabId) => `search-tab-${id}`;
export const PANEL_ID = "search-results-panel";

export function SearchTabs({ active, onSelect }: { active: SearchTabId; onSelect: (tab: SearchTabId) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = SEARCH_TABS.findIndex((t) => t.id === active);
    const next = nextTabIndex(current, e.key, SEARCH_TABS.length);
    if (next === null) return;
    e.preventDefault();
    onSelect(SEARCH_TABS[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label="Search results" className="srch-tabs" onKeyDown={onKeyDown}>
      {SEARCH_TABS.map((t, i) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(t.id)}
            aria-selected={selected}
            aria-controls={PANEL_ID}
            tabIndex={selected ? 0 : -1}
            className="srch-tab"
            data-tab={t.id}
            onClick={() => onSelect(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── shared states ─────────────────────────────────────────── */

export function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="srch-state" role="alert">
      <h2 className="srch-state__title">{message}</h2>
      <p className="srch-state__text">Check your connection and try again.</p>
      <button type="button" className="srch-button" onClick={onRetry}>
        <RefreshCw size={15} aria-hidden /> Retry
      </button>
    </div>
  );
}

function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="disco-rows" aria-busy="true" aria-label="Loading results">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="srch-skeleton" aria-hidden />
      ))}
    </div>
  );
}

function TilesSkeleton() {
  return (
    <ul className="liked-reels__grid" aria-busy="true" aria-label="Loading results">
      {Array.from({ length: 12 }).map((_, i) => (
        <li key={i} className="liked-reels__tile is-skeleton" aria-hidden />
      ))}
    </ul>
  );
}

function EmptyResult({ tab, query, onTryTop }: { tab: SearchTabId; query: string; onTryTop?: () => void }) {
  return (
    <div className="srch-state" data-state="empty">
      <SearchX size={28} className="srch-state__icon" aria-hidden />
      <h2 className="srch-state__title">{emptyResultTitle(tab, query)}</h2>
      <p className="srch-state__text">Try another word, a hashtag or a creator&apos;s name.</p>
      {tab !== "top" && onTryTop ? (
        <button type="button" className="srch-button" onClick={onTryTop}>
          Search everything
        </button>
      ) : null}
    </div>
  );
}

/* ── recents and popular (the empty box) ───────────────────── */

export interface RecentSearchesProps {
  items: RecentSearch[];
  status: ViewStatus;
  onSelect: (query: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onRetry: () => void;
}

export function RecentSearches({ items, status, onSelect, onRemove, onClearAll, onRetry }: RecentSearchesProps) {
  const [confirming, setConfirming] = useState(false);
  if (status === "loading") {
    return (
      <section className="srch-section" aria-labelledby="srch-recent-title">
        <h2 id="srch-recent-title" className="srch-section__title">Recent searches</h2>
        <RowsSkeleton rows={3} />
      </section>
    );
  }
  if (status === "error") {
    return (
      <section className="srch-section" aria-labelledby="srch-recent-title">
        <h2 id="srch-recent-title" className="srch-section__title">Recent searches</h2>
        <div className="srch-inline-error" role="alert">
          <span>Couldn&apos;t load your recent searches.</span>
          <button type="button" className="srch-link" onClick={onRetry}>Retry</button>
        </div>
      </section>
    );
  }
  if (items.length === 0) return null;
  return (
    <section className="srch-section" aria-labelledby="srch-recent-title" data-section="recent">
      <div className="srch-section__head">
        <h2 id="srch-recent-title" className="srch-section__title">Recent searches</h2>
        {confirming ? (
          <span className="srch-confirm">
            <span>Clear all recent searches?</span>
            <button
              type="button"
              className="srch-link srch-link--danger"
              onClick={() => {
                setConfirming(false);
                onClearAll();
              }}
            >
              Clear
            </button>
            <button type="button" className="srch-link" onClick={() => setConfirming(false)}>Cancel</button>
          </span>
        ) : (
          <button type="button" className="srch-link" onClick={() => setConfirming(true)}>Clear all</button>
        )}
      </div>
      <ul className="srch-list">
        {items.map((item) => (
          <li key={item.id} className="srch-recent" data-recent-id={item.id}>
            <button type="button" className="srch-recent__query" onClick={() => onSelect(item.query)}>
              <Clock size={16} aria-hidden />
              <span>{item.query}</span>
            </button>
            <button
              type="button"
              className="srch-icon-button"
              aria-label={`Remove “${item.query}” from recent searches`}
              onClick={() => onRemove(item.id)}
            >
              <X size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PopularSearches({ items, status, onSelect }: { items: string[]; status: ViewStatus; onSelect: (q: string) => void }) {
  // An empty or failed popular list hides the section; it is a suggestion, not content.
  if (status !== "ready" || items.length === 0) return null;
  return (
    <section className="srch-section" aria-labelledby="srch-popular-title" data-section="popular">
      <h2 id="srch-popular-title" className="srch-section__title">Popular searches</h2>
      <ul className="srch-chips">
        {items.map((q) => (
          <li key={q}>
            <button type="button" className="disco-pill" onClick={() => onSelect(q)}>
              <TrendingUp size={14} aria-hidden /> {q}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SignedOutRecentsNote({ signInHref }: { signInHref: string }) {
  return (
    <p className="srch-note" data-section="signed-out">
      <Link href={signInHref} className="srch-link">Sign in</Link> to keep your recent searches.
    </p>
  );
}

export function StartPrompt() {
  return (
    <div className="srch-state" data-state="start">
      <h2 className="srch-state__title">Search Momentum</h2>
      <p className="srch-state__text">Find people, videos, reels, sounds and hashtags. Type and press Enter.</p>
    </div>
  );
}

/* ── rows ──────────────────────────────────────────────────── */

export function PersonRow({ person, onClick }: { person: PersonResult; onClick?: () => void }) {
  const meta = [person.handle ? `@${person.handle}` : "", `${formatCount(person.followerCount)} follower${person.followerCount === 1 ? "" : "s"}`]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link href={`/u/${encodeURIComponent(person.linkName)}`} className="disco-row" data-kind="person" onClick={onClick}>
      <span className="disco-row__avatar">
        {person.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.avatarUrl} alt="" loading="lazy" />
        ) : (
          <UserRound strokeWidth={1.75} aria-hidden />
        )}
      </span>
      <span className="disco-row__body">
        <p className="disco-row__title srch-title-line">
          <span>{person.name}</span>
          {person.isVerified ? <BadgeCheck size={14} className="srch-verified" aria-label="Verified" /> : null}
        </p>
        <p className="disco-row__meta">{meta}</p>
        {person.bio ? <p className="disco-row__meta">{person.bio}</p> : null}
      </span>
    </Link>
  );
}

export function HashtagRow({ tag, onClick }: { tag: HashtagResult; onClick?: () => void }) {
  return (
    <Link href={hashtagHref(tag.tag)} className="disco-row" data-kind="hashtag" onClick={onClick}>
      <span className="disco-row__avatar">
        <Hash strokeWidth={1.75} aria-hidden />
      </span>
      <span className="disco-row__body">
        <p className="disco-row__title">#{tag.tag}</p>
        {tag.useCount > 0 ? <p className="disco-row__meta">{formatCount(tag.useCount)} posts</p> : null}
      </span>
    </Link>
  );
}

export function SoundRow({ sound }: { sound: ReelSound }) {
  const meta = [sound.artist, soundReelCount(sound.useCount)].filter(Boolean).join(" · ");
  return (
    <Link href={soundPageHref(sound.id)} className="disco-row" data-kind="sound">
      <span className="disco-row__avatar">
        <Music2 strokeWidth={1.75} aria-hidden />
      </span>
      <span className="disco-row__body">
        <p className="disco-row__title">{sound.title}</p>
        <p className="disco-row__meta">{meta}</p>
      </span>
    </Link>
  );
}

export function TopPostRow({ post, onClick }: { post: TopPostResult; onClick?: () => void }) {
  const kindLabel = post.kind === "video" ? "Video" : post.kind === "reel" ? "Reel" : "Post";
  const meta = [kindLabel, post.authorName, post.likeCount > 0 ? `${formatCount(post.likeCount)} likes` : ""].filter(Boolean).join(" · ");
  return (
    <Link href={post.href} className="disco-row" data-kind={`top-${post.kind}`} onClick={onClick}>
      {post.kind === "post" && !post.thumbnailUrl ? null : (
        <span className={post.kind === "reel" ? "disco-row__thumb srch-thumb--portrait" : "disco-row__thumb"}>
          {post.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.thumbnailUrl} alt="" loading="lazy" />
          ) : (
            <span className="disco-row__thumb-empty" aria-hidden>
              <Play strokeWidth={1.75} />
            </span>
          )}
        </span>
      )}
      <span className="disco-row__body">
        <p className="disco-row__title">{post.title}</p>
        <p className="disco-row__meta">{meta}</p>
      </span>
    </Link>
  );
}

export function ReelTiles({ reels }: { reels: ReelItem[] }) {
  return (
    <ul className="liked-reels__grid">
      {reels.map((reel) => (
        <li key={reel.id}>
          <Link
            href={`/reels?reelId=${encodeURIComponent(reel.id)}`}
            className="liked-reels__tile"
            aria-label={`${reel.title || reel.caption || `Reel by ${reel.authorName}`}, ${formatCount(reel.likeCount)} likes`}
          >
            {reel.media.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reel.media.posterUrl} alt="" loading="lazy" decoding="async" />
            ) : null}
            <span className="liked-reels__tile-meta" aria-hidden>
              <Heart size={13} className="fill-current" /> {formatCount(reel.likeCount)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ── one tab's results ─────────────────────────────────────── */

export interface ResultsViewProps {
  tab: SearchTabId;
  query: string;
  status: ViewStatus;
  data: TabResults | undefined;
  onRetry: () => void;
  onSelectTab: (tab: SearchTabId) => void;
  /** Top only: analytics for a tapped result (entity, id, position). */
  onTopClick?: (entity: "users" | "posts" | "hashtags", id: string, position: number) => void;
}

const TOP_PEOPLE_SHOWN = 3;
const TOP_TAGS_SHOWN = 6;

export function ResultsView({ tab, query, status, data, onRetry, onSelectTab, onTopClick }: ResultsViewProps) {
  if (status === "error") return <ErrorNotice message="Couldn't search right now" onRetry={onRetry} />;
  if (status === "loading" || !data || data.tab !== tab) {
    return tab === "reels" ? <TilesSkeleton /> : <RowsSkeleton />;
  }

  const tryTop = () => onSelectTab("top");

  switch (data.tab) {
    case "top": {
      const top = data.top;
      if (isTopEmpty(top)) return <EmptyResult tab="top" query={query} />;
      return (
        <div className="srch-top">
          {top.people.length > 0 ? (
            <section className="srch-section" aria-labelledby="srch-top-people">
              <div className="srch-section__head">
                <h2 id="srch-top-people" className="srch-section__title">People</h2>
                {top.people.length > TOP_PEOPLE_SHOWN ? (
                  <button type="button" className="srch-link" onClick={() => onSelectTab("people")}>See all</button>
                ) : null}
              </div>
              <div className="disco-rows">
                {top.people.slice(0, TOP_PEOPLE_SHOWN).map((p, i) => (
                  <PersonRow key={p.id} person={p} onClick={() => onTopClick?.("users", p.id, i)} />
                ))}
              </div>
            </section>
          ) : null}
          {top.posts.length > 0 ? (
            <section className="srch-section" aria-labelledby="srch-top-posts">
              <h2 id="srch-top-posts" className="srch-section__title">Posts and videos</h2>
              <div className="disco-rows">
                {top.posts.map((p, i) => (
                  <TopPostRow key={p.id} post={p} onClick={() => onTopClick?.("posts", p.id, i)} />
                ))}
              </div>
            </section>
          ) : null}
          {top.hashtags.length > 0 ? (
            <section className="srch-section" aria-labelledby="srch-top-tags">
              <div className="srch-section__head">
                <h2 id="srch-top-tags" className="srch-section__title">Hashtags</h2>
                {top.hashtags.length > TOP_TAGS_SHOWN ? (
                  <button type="button" className="srch-link" onClick={() => onSelectTab("hashtags")}>See all</button>
                ) : null}
              </div>
              <ul className="srch-chips">
                {top.hashtags.slice(0, TOP_TAGS_SHOWN).map((h, i) => (
                  <li key={h.tag}>
                    <Link href={hashtagHref(h.tag)} className="disco-pill" onClick={() => onTopClick?.("hashtags", h.tag, i)}>
                      #{h.tag}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      );
    }
    case "people":
      if (data.people.length === 0) return <EmptyResult tab="people" query={query} onTryTop={tryTop} />;
      return (
        <div className="disco-rows">
          {data.people.map((p) => (
            <PersonRow key={p.id} person={p} />
          ))}
        </div>
      );
    case "videos":
      if (data.videos.length === 0) return <EmptyResult tab="videos" query={query} onTryTop={tryTop} />;
      return (
        <div className="disco-rows">
          {data.videos.map((v) => (
            <VideoResultRow key={v.id} video={v} />
          ))}
        </div>
      );
    case "reels":
      if (data.reels.length === 0) return <EmptyResult tab="reels" query={query} onTryTop={tryTop} />;
      return <ReelTiles reels={data.reels} />;
    case "sounds":
      if (data.sounds.length === 0) return <EmptyResult tab="sounds" query={query} onTryTop={tryTop} />;
      return (
        <div className="disco-rows">
          {data.sounds.map((s) => (
            <SoundRow key={s.id} sound={s} />
          ))}
        </div>
      );
    case "hashtags":
      if (data.hashtags.length === 0) return <EmptyResult tab="hashtags" query={query} onTryTop={tryTop} />;
      return (
        <div className="disco-rows">
          {data.hashtags.map((h) => (
            <HashtagRow key={h.tag} tag={h} />
          ))}
        </div>
      );
  }
}

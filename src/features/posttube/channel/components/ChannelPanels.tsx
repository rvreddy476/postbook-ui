"use client";

import Link from "next/link";
import { Eye, Heart, Layers, ListVideo, MessageCircle, Play, Radio, Rows3, Tv, Zap } from "lucide-react";
import type { ReactNode } from "react";

import { VideoCard } from "../../components/VideoCard";
import { VideoGridSkeleton } from "../../components/HomePage";
import { EmptyState, ErrorState, LoadMore } from "../../discovery/components/DiscoveryState";
import { PillRow } from "../../discovery/components/Pills";
import type { Collection } from "../../library/libraryApi";
import { formatCount, timeAgo } from "../../model";
import type { PostTubeVideo } from "../../types";
import type { ChannelPostCard, ChannelVideo } from "../channelApi";
import type { ChannelTab, VideoSort } from "../channelModel";

/*
  The tab bodies, presentational only (the tabs' queries live in
  ChannelScreen). Long videos reuse the tube tile (VideoCard) on the
  tube-grid; shorts are 9:16 tiles opening in Reels; collections are a
  stacked poster with the count; posts are compact text cards.
*/

export type PanelStatus = "loading" | "error" | "ready";

export interface PanelFrameProps {
  status: PanelStatus;
  /** Rows after the in-channel search. */
  count: number;
  /** Rows before the search, to tell "empty channel" from "no match". */
  total: number;
  query: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  empty: { icon: ReactNode; title: string; body?: string; actionHref?: string; actionLabel?: string };
  what: string;
  skeleton?: ReactNode;
  head?: ReactNode;
  children: ReactNode;
}

/** Loading / error / empty / no-match / content, the same for every tab. */
export function PanelFrame({ status, count, total, query, hasMore, loadingMore, onLoadMore, onRetry, empty, what, skeleton, head, children }: PanelFrameProps) {
  let body: ReactNode;
  if (status === "loading") body = skeleton ?? <VideoGridSkeleton count={6} />;
  else if (status === "error") body = <ErrorState onRetry={onRetry} what={what} />;
  else if (total === 0 && !hasMore) body = <EmptyState icon={empty.icon} title={empty.title} body={empty.body} actionHref={empty.actionHref} actionLabel={empty.actionLabel} />;
  else if (count === 0)
    body = (
      <EmptyState
        title={query.trim() ? `Nothing here matches “${query.trim()}”` : empty.title}
        body={
          query.trim()
            ? hasMore
              ? "Only what is loaded is searched. Show more to look further."
              : "Try another word."
            : hasMore
              ? "None in what is loaded so far. Show more to look further back."
              : empty.body
        }
      />
    );
  else body = children;
  return (
    <section className="tube-chan-panel">
      {head && status === "ready" && total > 0 ? head : null}
      {body}
      {status === "ready" ? <LoadMore hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} /> : null}
    </section>
  );
}

export function SortPills({ value, onChange }: { value: VideoSort; onChange: (v: VideoSort) => void }) {
  return (
    <div className="tube-chan-panel__head">
      <PillRow<VideoSort>
        name="Order"
        value={value}
        onChange={onChange}
        options={[
          { value: "latest", label: "Latest" },
          { value: "popular", label: "Popular" },
        ]}
      />
    </div>
  );
}

export function VideoGrid({ videos }: { videos: readonly PostTubeVideo[] }) {
  return (
    <div className="tube-grid">
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
    </div>
  );
}

export function ShortTile({ short }: { short: ChannelVideo }) {
  return (
    <Link href={`/reels?reelId=${encodeURIComponent(short.id)}`} className="tube-tile tube-chan-short">
      <div className="tube-tile__poster tube-chan-short__poster">
        <div className="tube-tile__poster-fallback" aria-hidden>
          <Play />
        </div>
        {short.thumbnail_url ? <img src={short.thumbnail_url} alt="" loading="lazy" /> : null}
        {short.view_count > 0 ? (
          <span className="tube-tile__views">
            <Eye aria-hidden />
            <span>{formatCount(short.view_count)}</span>
          </span>
        ) : null}
      </div>
      <h3 className="tube-tile__title">{short.title}</h3>
    </Link>
  );
}

export function ShortGrid({ shorts }: { shorts: readonly ChannelVideo[] }) {
  return (
    <div className="tube-chan-shorts">
      {shorts.map((s) => (
        <ShortTile key={s.id} short={s} />
      ))}
    </div>
  );
}

const VISIBILITY_LABEL: Record<string, string> = { public: "Public", unlisted: "Unlisted", private: "Private" };

export function CollectionTile({ collection, isOwner }: { collection: Collection; isOwner: boolean }) {
  const meta = [
    `${formatCount(collection.itemCount)} ${collection.itemCount === 1 ? "video" : "videos"}`,
    isOwner ? VISIBILITY_LABEL[collection.visibility] ?? null : null,
    collection.updatedAt ? `Updated ${timeAgo(collection.updatedAt)}` : null,
  ].filter(Boolean);
  return (
    <Link href={`/posttube/playlists/${encodeURIComponent(collection.id)}`} className="tube-tile tube-chan-coll">
      <div className="tube-tile__poster tube-chan-coll__poster">
        <span className="tube-chan-coll__stack" aria-hidden />
        <span className="tube-chan-coll__icon" aria-hidden>
          <Layers />
        </span>
        <span className="tube-tile__duration">
          <ListVideo aria-hidden className="tube-chan-coll__count-icon" />
          {formatCount(collection.itemCount)}
        </span>
      </div>
      <div className="tube-tile__text">
        <h3 className="tube-tile__title">{collection.title}</h3>
        <p className="tube-tile__meta">{meta.join(" · ")}</p>
      </div>
    </Link>
  );
}

export function CollectionGrid({ collections, isOwner }: { collections: readonly Collection[]; isOwner: boolean }) {
  return (
    <div className="tube-grid">
      {collections.map((c) => (
        <CollectionTile key={c.id} collection={c} isOwner={isOwner} />
      ))}
    </div>
  );
}

export function PostCard({ post }: { post: ChannelPostCard }) {
  return (
    <Link href={`/post/${encodeURIComponent(post.id)}`} className="tube-chan-post">
      <div className="tube-chan-post__body">
        <p className="tube-chan-post__text">{post.text || "Photo post"}</p>
        <p className="tube-chan-post__meta">
          {post.createdAt ? <span>{timeAgo(post.createdAt)}</span> : null}
          <span className="tube-chan-post__count" aria-label={`${post.loves} loves`}>
            <Heart aria-hidden />
            {formatCount(post.loves)}
          </span>
          <span className="tube-chan-post__count" aria-label={`${post.comments} comments`}>
            <MessageCircle aria-hidden />
            {formatCount(post.comments)}
          </span>
        </p>
      </div>
      {post.imageUrl ? <img className="tube-chan-post__thumb" src={post.imageUrl} alt="" loading="lazy" /> : null}
    </Link>
  );
}

export function PostList({ posts }: { posts: readonly ChannelPostCard[] }) {
  return (
    <div className="tube-chan-posts">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}

export function ShortsSkeleton() {
  return (
    <div className="tube-chan-shorts" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="tube-tile is-skeleton">
          <div className="tube-tile__poster tube-chan-short__poster" />
          <div className="tube-tile__bone tube-tile__bone--title" />
        </div>
      ))}
    </div>
  );
}

export function PostsSkeleton() {
  return (
    <div className="tube-chan-posts" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="tube-chan-post is-skeleton">
          <div className="tube-chan-post__body">
            <div className="tube-tile__bone tube-tile__bone--title" />
            <div className="tube-tile__bone tube-tile__bone--line" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Our words for an empty tab; the owner also gets the next step. */
export function emptyCopy(tab: ChannelTab, isOwner: boolean): PanelFrameProps["empty"] {
  switch (tab) {
    case "videos":
      return isOwner
        ? { icon: <Tv size={20} strokeWidth={1.75} />, title: "No videos yet", body: "Your long videos land here once they are published.", actionHref: "/posttube/upload?type=long", actionLabel: "Upload a video" }
        : { icon: <Tv size={20} strokeWidth={1.75} />, title: "No videos yet" };
    case "shorts":
      return isOwner
        ? { icon: <Zap size={20} strokeWidth={1.75} />, title: "No shorts yet", body: "Shorts you post in Reels show up here.", actionHref: "/reels/create", actionLabel: "Make a short" }
        : { icon: <Zap size={20} strokeWidth={1.75} />, title: "No shorts yet" };
    case "live":
      return isOwner
        ? { icon: <Radio size={20} strokeWidth={1.75} />, title: "No live recordings yet", body: "A stream's recording arrives unlisted; make it public from Creator Hub to show it here.", actionHref: "/posttube/hub/library", actionLabel: "Open Creator Hub" }
        : { icon: <Radio size={20} strokeWidth={1.75} />, title: "No live recordings yet" };
    case "collections":
      return isOwner
        ? { icon: <Layers size={20} strokeWidth={1.75} />, title: "No collections yet", body: "Group your videos into collections and they appear here.", actionHref: "/posttube/playlists", actionLabel: "Your collections" }
        : { icon: <Layers size={20} strokeWidth={1.75} />, title: "No collections yet" };
    default:
      return { icon: <Rows3 size={20} strokeWidth={1.75} />, title: "No posts yet" };
  }
}

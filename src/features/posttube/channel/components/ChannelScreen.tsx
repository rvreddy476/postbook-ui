"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Tv, UserX } from "lucide-react";

import { useAuthUser } from "@/store/auth";
import { ShareSheet } from "@/features/reels/components/ShareSheet";
import { VideoCard } from "../../components/VideoCard";
import { EmptyState, ErrorState, LoadingState } from "../../discovery/components/DiscoveryState";
import type { PostTubeVideo } from "../../types";
import { thinChannel, type ChannelView } from "../channelApi";
import { filterByText, liveOnly, resolveTab, sortVideos, visibleTabs, type ChannelTab, type VideoSort } from "../channelModel";
import { useChannelCollections, useChannelLookup, useChannelPosts, useChannelVideos, useFeaturedVideo } from "../hooks/useChannel";
import { ChannelMasthead } from "./ChannelMasthead";
import { ChannelTabs } from "./ChannelTabs";
import {
  CollectionGrid,
  emptyCopy,
  PanelFrame,
  PostList,
  PostsSkeleton,
  ShortGrid,
  ShortsSkeleton,
  SortPills,
  VideoGrid,
  type PanelStatus,
} from "./ChannelPanels";
import { ReportChannelDialog } from "./ReportChannelDialog";

import "@/features/reels/components/reels-screen.css";
import "../../components/tube.css";
import "../../discovery/discovery.css";
import "../channel.css";

/*
  One channel screen for both routes:
    /posttube/channel          own    → GET /v1/channels/me (404 NO_CHANNEL → the create card)
    /posttube/channel/[handle] public → GET /v1/channels/:ref (a bare user id with no
                                        channel still lists that user's videos)
  Masthead, the featured video, then the pill tabs (?tab=) and one panel.
  The tabs' requests go out only when their tab is open.
*/

export type ChannelScreenMode = { kind: "own" } | { kind: "public"; ref: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ChannelScreen({ mode }: { mode: ChannelScreenMode }) {
  const user = useAuthUser();
  const lookup = useChannelLookup(mode.kind === "own" ? { kind: "own", enabled: !!user } : { kind: "public", ref: mode.ref });

  // A public ref that is a user id without a channel row: draw a thin masthead over that user's videos.
  const thinId = mode.kind === "public" && lookup.data?.kind === "missing" && UUID_RE.test(mode.ref) ? mode.ref : undefined;
  const thinVideos = useChannelVideos(thinId, "long_video", !!thinId);
  const firstThin = thinVideos.data?.pages[0]?.items[0];

  const channel: ChannelView | null = useMemo(() => {
    if (lookup.data?.kind === "ok") return lookup.data.channel;
    if (thinId) return thinChannel(thinId, firstThin?.channel_name, firstThin?.channel_avatar_url);
    return null;
  }, [lookup.data, thinId, firstThin?.channel_name, firstThin?.channel_avatar_url]);

  if (mode.kind === "own" && !user) {
    return (
      <div className="tube-chan">
        <EmptyState icon={<Tv size={20} strokeWidth={1.75} />} title="Your channel" body="Sign in to see your channel." actionHref="/login?next=%2Fposttube%2Fchannel" actionLabel="Sign in" />
      </div>
    );
  }
  if (lookup.isPending) {
    return (
      <div className="tube-chan">
        <LoadingState label="Loading channel…" />
      </div>
    );
  }
  if (lookup.isError) {
    return (
      <div className="tube-chan">
        <ErrorState what="this channel" onRetry={() => void lookup.refetch()} />
      </div>
    );
  }
  if (!channel) {
    return (
      <div className="tube-chan">
        {mode.kind === "own" ? <NoChannelCard /> : <EmptyState icon={<UserX size={20} strokeWidth={1.75} />} title="Channel not found" body="It may have been renamed or removed." actionHref="/posttube" actionLabel="Back to Watch" />}
      </div>
    );
  }

  const isOwner = mode.kind === "own" || (!!user && user.id === channel.userId);
  return <ChannelBody key={channel.userId} channel={channel} isOwner={isOwner} signedIn={!!user} />;
}

/** Own page, no channel yet: the upload route opens the channel-create gate first. */
export function NoChannelCard() {
  return (
    <EmptyState
      icon={<Tv size={20} strokeWidth={1.75} />}
      title="You don't have a channel yet"
      body="A channel gives your long videos a home: a name, a handle, a banner and followers. Create it and upload your first video."
      actionHref="/posttube/upload?type=long"
      actionLabel="Create your channel"
    />
  );
}

function ChannelBody({ channel, isOwner, signedIn }: { channel: ChannelView; isOwner: boolean; signedIn: boolean }) {
  const pathname = usePathname() || "/posttube/channel";
  const params = useSearchParams();
  const tabs = useMemo(() => visibleTabs(channel.counts, isOwner), [channel.counts, isOwner]);
  const active = resolveTab(params?.get("tab"), tabs);

  // Follow / unfollow moves the count locally; a fresh count from the server replaces the local step.
  const [follow, setFollow] = useState({ base: channel.followerCount, delta: 0 });
  const followers = Math.max(0, channel.followerCount + (follow.base === channel.followerCount ? follow.delta : 0));
  const onFollowChange = (following: boolean) =>
    setFollow((f) => ({ base: channel.followerCount, delta: (f.base === channel.followerCount ? f.delta : 0) + (following ? 1 : -1) }));

  // The search belongs to the tab it was typed on; switching tabs starts empty.
  const [search, setSearch] = useState<{ tab: ChannelTab | null; q: string }>({ tab: active, q: "" });
  const query = search.tab === active ? search.q : "";
  const setQuery = (q: string) => setSearch({ tab: active, q });
  const [sort, setSort] = useState<VideoSort>("latest");

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const closeReport = useCallback(() => setReportOpen(false), []);
  const share = () => {
    const path = `/posttube/channel/${encodeURIComponent(channel.handle || channel.userId)}`;
    setShareUrl(typeof window !== "undefined" ? `${window.location.origin}${path}` : path);
  };

  const featured = useFeaturedVideo(channel.featuredPostId);

  return (
    <div className="tube-chan">
      <ChannelMasthead
        channel={channel}
        isOwner={isOwner}
        signedIn={signedIn}
        followerCount={followers}
        onFollowChange={onFollowChange}
        onShare={share}
        onReport={() => setReportOpen(true)}
      />

      {featured.data ? <FeaturedVideo video={featured.data} /> : null}

      {active ? (
        <>
          <ChannelTabs pathname={pathname} tabs={tabs} active={active} counts={channel.counts} query={query} onQuery={setQuery} />
          <TabPanel tab={active} ownerId={channel.userId} isOwner={isOwner} query={query} sort={sort} onSort={setSort} />
        </>
      ) : (
        <EmptyState icon={<Tv size={20} strokeWidth={1.75} />} title="Nothing here yet" body="This channel has not posted anything public." />
      )}

      <ShareSheet open={!!shareUrl} onClose={() => setShareUrl(null)} url={shareUrl ?? ""} title={channel.name} />
      {!isOwner && signedIn ? <ReportChannelDialog open={reportOpen} onClose={closeReport} ownerId={channel.userId} channelName={channel.name} /> : null}
    </div>
  );
}

export function FeaturedVideo({ video }: { video: PostTubeVideo }) {
  return (
    <section className="tube-chan-featured" aria-labelledby="tube-chan-featured-label">
      <h2 id="tube-chan-featured-label" className="tube-chan-featured__label">
        Featured
      </h2>
      <VideoCard video={video} variant="wide" />
    </section>
  );
}

interface TabPanelProps {
  tab: ChannelTab;
  ownerId: string;
  isOwner: boolean;
  query: string;
  sort: VideoSort;
  onSort: (s: VideoSort) => void;
}

function TabPanel(props: TabPanelProps) {
  switch (props.tab) {
    case "videos":
    case "live":
      return <LongVideosTab {...props} />;
    case "shorts":
      return <ShortsTab {...props} />;
    case "collections":
      return <CollectionsTab {...props} />;
    default:
      return <PostsTab {...props} />;
  }
}

function statusOf(q: { isPending: boolean; isError: boolean; data?: unknown }): PanelStatus {
  if (q.isError && !q.data) return "error";
  if (q.isPending) return "loading";
  return "ready";
}

/** Videos and Live share the long-video pages; Live keeps the rows that came from a stream. */
function LongVideosTab({ tab, ownerId, isOwner, query, sort, onSort }: TabPanelProps) {
  const q = useChannelVideos(ownerId, "long_video", true);
  const all = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const live = tab === "live";
  const base = live ? liveOnly(all) : all;
  const rows = filterByText(live ? base : sortVideos(base, sort), query, (v) => v.title);
  return (
    <PanelFrame
      status={statusOf(q)}
      count={rows.length}
      total={base.length}
      query={query}
      hasMore={!!q.hasNextPage}
      loadingMore={q.isFetchingNextPage}
      onLoadMore={() => void q.fetchNextPage()}
      onRetry={() => void q.refetch()}
      empty={emptyCopy(tab, isOwner)}
      what={live ? "live recordings" : "videos"}
      head={live ? undefined : <SortPills value={sort} onChange={onSort} />}
    >
      <VideoGrid videos={rows} />
    </PanelFrame>
  );
}

function ShortsTab({ ownerId, isOwner, query }: TabPanelProps) {
  const q = useChannelVideos(ownerId, "flick", true);
  const all = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const rows = filterByText(all, query, (v) => v.title);
  return (
    <PanelFrame
      status={statusOf(q)}
      count={rows.length}
      total={all.length}
      query={query}
      hasMore={!!q.hasNextPage}
      loadingMore={q.isFetchingNextPage}
      onLoadMore={() => void q.fetchNextPage()}
      onRetry={() => void q.refetch()}
      empty={emptyCopy("shorts", isOwner)}
      what="shorts"
      skeleton={<ShortsSkeleton />}
    >
      <ShortGrid shorts={rows} />
    </PanelFrame>
  );
}

function CollectionsTab({ ownerId, isOwner, query }: TabPanelProps) {
  const q = useChannelCollections(ownerId, isOwner, true);
  const all = q.data ?? [];
  const rows = filterByText(all, query, (c) => c.title);
  return (
    <PanelFrame
      status={statusOf(q)}
      count={rows.length}
      total={all.length}
      query={query}
      hasMore={false}
      loadingMore={false}
      onLoadMore={() => undefined}
      onRetry={() => void q.refetch()}
      empty={emptyCopy("collections", isOwner)}
      what="collections"
    >
      <CollectionGrid collections={rows} isOwner={isOwner} />
    </PanelFrame>
  );
}

function PostsTab({ ownerId, isOwner, query }: TabPanelProps) {
  const q = useChannelPosts(ownerId, true);
  const all = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const rows = filterByText(all, query, (p) => p.text);
  return (
    <PanelFrame
      status={statusOf(q)}
      count={rows.length}
      total={all.length}
      query={query}
      hasMore={!!q.hasNextPage}
      loadingMore={q.isFetchingNextPage}
      onLoadMore={() => void q.fetchNextPage()}
      onRetry={() => void q.refetch()}
      empty={emptyCopy("posts", isOwner)}
      what="posts"
      skeleton={<PostsSkeleton />}
    >
      <PostList posts={rows} />
    </PanelFrame>
  );
}


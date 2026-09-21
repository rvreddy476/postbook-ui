'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Play, TrendingUp, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { useTrending } from '@/hooks/useSearch';
import { getCategoryFeed } from '@/features/posttube/data/posttubeApi';
import { useAuthUser } from '@/store/auth';
import { useFriendSuggestions } from '@/hooks/useConnections';
import { useLiveStreams } from '@/hooks/useLiveV2';
import { FriendRequestButton } from '@/components/connections/FriendRequestButton';
import Avatar from '@/components/ui/Avatar';
import { User } from '../types';

interface RightPanelProps {
  onContactClick: (contact: User) => void;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Home right rail: people first, then what is trending.
 *
 * Three changes from what was here, each for a reason:
 *
 * - It used to show Events and News cards that were hard-coded placeholders
 *   ("will show up here", "on its way"). With Trending also empty on a quiet
 *   network, a third of the screen said the app had nothing in it. Those two
 *   are gone, and every remaining card renders only when it has content.
 * - People you may know leads, with faces and an Add friend button, because
 *   people are what make a social feed feel inhabited. The same suggestions
 *   also appear inline in the feed, but only below this breakpoint, so no one
 *   sees the same faces twice.
 * - The cards used to reshuffle every 12 seconds. Content that moves while you
 *   are reading it takes control away from you, so the order is fixed now.
 */
const RightPanel: React.FC<RightPanelProps> = () => {
  const router = useRouter();
  const authUser = useAuthUser();
  const { data: suggestions, isLoading: suggestionsLoading } = useFriendSuggestions(authUser?.id, 5);
  const { data: trendingData, isLoading: trendingLoading } = useTrending();
  const { data: tubeFeed } = useQuery({
    queryKey: ['posttube-trending-rail'],
    queryFn: () => getCategoryFeed('trending', { limit: 3 }),
    staleTime: 120_000,
  });
  const people = (suggestions ?? []).slice(0, 5);
  // Only streams that are actually live right now.
  const { data: livePages } = useLiveStreams(10);
  const liveNow = (livePages?.pages ?? []).flatMap((p: any) => p.items ?? p.data ?? []).filter((s: any) => s?.status === "live");

  /**
   * Thumbnails whose URL was present but failed to load. A present URL is not
   * a working one, and without this an unreachable image renders its alt TEXT
   * inside the tile — the "Untitled" and "My bangaram" words over grey boxes.
   */
  const [brokenThumbs, setBrokenThumbs] = useState<Set<string>>(new Set());

  const tubeVideos = tubeFeed?.items ?? [];
  const trends = trendingData?.trending ?? [];

  const cards: { key: string; show: boolean; node: React.ReactNode }[] = [
    {
      key: 'people',
      show: suggestionsLoading || people.length > 0,
      node: (
        <div className="rounded-3xl border border-brand-divider bg-brand-card p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-text/50" />
              <h5 className="text-sm font-semibold text-brand-text">People you may know</h5>
            </div>
            <button
              onClick={() => router.push('/connections')}
              className="text-xs font-medium text-primary-ink transition-colors hover:text-primary-hover"
            >
              See all
            </button>
          </div>
          {suggestionsLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-brand-secondary" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 rounded-sm bg-brand-secondary" />
                    <div className="h-2 w-16 rounded-sm bg-brand-secondary" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-3.5">
              {people.map((p) => {
                const name = p.display_name || p.username || 'Someone';
                return (
                  <li key={p.user_id} className="flex items-center gap-3">
                    <button
                      onClick={() => router.push(`/u/${p.username || p.user_id}`)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Avatar
                        src={p.avatar_media_id ? `/v1/media/${p.avatar_media_id}/serve` : undefined}
                        name={name}
                        className="h-10 w-10"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-brand-text">{name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.mutual_friend_count
                            ? `${p.mutual_friend_count} mutual friend${p.mutual_friend_count === 1 ? '' : 's'}`
                            : p.username ? `@${p.username}` : 'Suggested for you'}
                        </span>
                      </span>
                    </button>
                    <FriendRequestButton
                      targetUserId={p.user_id}
                      targetUsername={p.username}
                      addLabel="Add"
                      showIncomingActions={false}
                      allowCancel={false}
                      className="shrink-0 rounded-full bg-primary-ink px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
                      sentClassName="bg-brand-secondary text-muted-foreground"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ),
    },
    {
      key: 'live',
      // Real live streams. Hidden entirely when nobody is broadcasting, which
      // is the honest version of the mockup's "rooms" card.
      show: liveNow.length > 0,
      node: (
        <div className="rounded-3xl border border-brand-divider bg-brand-card p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
              </span>
              <h5 className="text-sm font-semibold text-brand-text">Live now</h5>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{liveNow.length}</span>
          </div>
          <ul className="space-y-3">
            {liveNow.slice(0, 3).map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => router.push(`/live/${s.id}`)}
                  className="group flex w-full items-center gap-3 text-left"
                >
                  <div className="h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-brand-secondary">
                    {s.cover_media_id && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/v1/media/${s.cover_media_id}/serve`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-brand-text transition-colors group-hover:text-primary-ink">
                      {s.title || 'Live'}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground tabular-nums">
                      {s.viewer_peak > 0 ? `${s.viewer_peak} watching` : 'Just started'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      key: 'trending',
      // Hidden when the network has nothing trending, rather than saying so.
      show: trendingLoading || trends.length > 0,
      node: (
        <div className="rounded-3xl border border-brand-divider bg-brand-card p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-text/50" />
            <h5 className="text-sm font-semibold text-brand-text">Trending</h5>
          </div>
          {trendingLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-24 rounded-sm bg-brand-secondary" />
                  <div className="h-2 w-16 rounded-sm bg-brand-secondary" />
                </div>
              ))}
            </div>
          ) : trends.length > 0 ? (
            <div className="space-y-3.5">
              {trends.slice(0, 5).map((trend) => (
                <button
                  key={trend.hashtag}
                  onClick={() => router.push(`/hashtag/${trend.hashtag}`)}
                  className="group block w-full cursor-pointer text-left"
                >
                  <h6 className="text-xs font-bold text-brand-text transition-colors group-hover:text-primary-ink">#{trend.hashtag}</h6>
                  <p className="text-[10px] tracking-widest text-brand-text/40">
                    {trend.score >= 1000 ? `${(trend.score / 1000).toFixed(1)}k` : Math.round(trend.score)} posts
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-brand-text/40">Nothing trending yet — start a conversation.</p>
          )}
        </div>
      ),
    },
    {
      key: 'posttube',
      show: tubeVideos.length > 0,
      node: (
        <div className="rounded-3xl border border-brand-divider bg-brand-card p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-brand-text/50" />
              <h5 className="text-sm font-semibold text-brand-text">Trending videos</h5>
            </div>
            <a
              href="/posttube"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-primary-ink transition-colors hover:text-primary-hover"
            >
              More
            </a>
          </div>
          {tubeVideos.length > 0 ? (
            <div className="space-y-3">
              {tubeVideos.map((v) => (
                <a
                  key={v.id}
                  href={`/posttube/watch/${v.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex gap-3"
                >
                  <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-brand-secondary">
                    {v.thumbnail_url && !brokenThumbs.has(v.id) ? (
                      // alt is empty on purpose: the title sits beside the tile,
                      // so alt text here would be both redundant to a screen
                      // reader and the thing that renders when the image 404s.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.thumbnail_url}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setBrokenThumbs((prev) => new Set(prev).add(v.id))}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Play className="h-5 w-5 text-brand-text/30" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-bold leading-snug text-brand-text transition-colors group-hover:text-primary-ink">
                      {v.title || 'Untitled video'}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-brand-text/40">
                      {v.channel_name} · {formatViews(v.view_count)} views
                    </p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-brand-text/40">No trending videos right now.</p>
          )}
        </div>
      ),
    },
  ];

  const visible = cards.filter((c) => c.show);

  return (
    <div className="sticky top-28 h-fit space-y-5">
      {visible.map((card, i) => (
        // Eases in once, in order, instead of moving around afterwards.
        <motion.div
          key={card.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36, delay: i * 0.05 }}
        >
          {card.node}
        </motion.div>
      ))}

      {/* Footer */}
      <footer className="space-y-2 px-6 text-[10px] tracking-[0.2em] text-brand-text/40">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a href="#" className="transition-colors hover:text-primary-ink">About</a>
          <a href="#" className="transition-colors hover:text-primary-ink">Privacy</a>
          <a href="#" className="transition-colors hover:text-primary-ink">Terms</a>
        </div>
        <p>&copy; 2026 VChat</p>
      </footer>
    </div>
  );
};

export default RightPanel;

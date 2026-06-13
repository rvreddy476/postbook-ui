'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, Newspaper, Play, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { useTrending } from '@/hooks/useSearch';
import { getCategoryFeed } from '@/features/posttube/data/posttubeApi';
import { User } from '../types';

interface RightPanelProps {
  onContactClick: (contact: User) => void;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const ROTATE_MS = 12_000;

/**
 * Home right rail. Friend suggestions moved inline into the feed
 * (PeopleYouMayKnowStrip) — this panel now hosts a rotating stack of
 * content cards: Trending, PostTube trending videos, Events, News.
 * Every ROTATE_MS the top card moves to the back so the rail keeps
 * changing without user input.
 */
const RightPanel: React.FC<RightPanelProps> = () => {
  const router = useRouter();
  const { data: trendingData, isLoading: trendingLoading } = useTrending();
  const { data: tubeFeed } = useQuery({
    queryKey: ['posttube-trending-rail'],
    queryFn: () => getCategoryFeed('trending', { limit: 3 }),
    staleTime: 120_000,
  });

  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setRotation((r) => r + 1), ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  const tubeVideos = tubeFeed?.items ?? [];
  const trends = trendingData?.trending ?? [];

  const cards: { key: string; node: React.ReactNode }[] = [
    {
      key: 'trending',
      node: (
        <div className="rounded-3xl border border-brand-divider bg-brand-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-text/50" />
            <h5 className="text-[10px] font-black uppercase tracking-widest text-brand-text/60">Trending</h5>
          </div>
          {trendingLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-24 rounded bg-brand-secondary" />
                  <div className="h-2 w-16 rounded bg-brand-secondary" />
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
                  <h6 className="text-xs font-bold text-brand-text transition-colors group-hover:text-brand-accent">#{trend.hashtag}</h6>
                  <p className="text-[10px] uppercase tracking-widest text-brand-text/40">
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
      node: (
        <div className="rounded-3xl border border-brand-divider bg-brand-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-brand-text/50" />
              <h5 className="text-[10px] font-black uppercase tracking-widest text-brand-text/60">PostTube Trending</h5>
            </div>
            <a
              href="/posttube"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-bold uppercase tracking-widest text-brand-highlight hover:text-brand-text"
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
                  <div className="relative h-14 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-brand-secondary">
                    {v.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnail_url} alt={v.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Play className="h-5 w-5 text-brand-text/30" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-bold leading-snug text-brand-text transition-colors group-hover:text-brand-accent">
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
    {
      key: 'events',
      node: (
        <div className="rounded-3xl border border-brand-divider bg-brand-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-text/50" />
            <h5 className="text-[10px] font-black uppercase tracking-widest text-brand-text/60">Events</h5>
          </div>
          <p className="text-xs leading-relaxed text-brand-text/50">
            Events from your spaces will show up here — meetups, lives, and launches near you.
          </p>
          <button
            onClick={() => router.push('/groups')}
            className="mt-3 rounded-full border border-brand-divider bg-brand-secondary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-text/70 transition hover:bg-brand-secondary/80"
          >
            Browse spaces
          </button>
        </div>
      ),
    },
    {
      key: 'news',
      node: (
        <div className="rounded-3xl border border-brand-divider bg-brand-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-brand-text/50" />
            <h5 className="text-[10px] font-black uppercase tracking-widest text-brand-text/60">News</h5>
          </div>
          <p className="text-xs leading-relaxed text-brand-text/50">
            A daily digest of what&apos;s happening across VChat is on its way. Until then, the
            trending tags above are the pulse.
          </p>
        </div>
      ),
    },
  ];

  // Rotate: every tick the front card moves to the back.
  const shift = rotation % cards.length;
  const ordered = [...cards.slice(shift), ...cards.slice(0, shift)];

  return (
    <div className="sticky top-28 h-fit space-y-5">
      {ordered.map((card) => (
        <motion.div key={card.key} layout transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
          {card.node}
        </motion.div>
      ))}

      {/* Footer */}
      <footer className="space-y-2 px-6 text-[10px] uppercase tracking-[0.2em] text-brand-text/40">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a href="#" className="transition-colors hover:text-brand-accent">About</a>
          <a href="#" className="transition-colors hover:text-brand-accent">Privacy</a>
          <a href="#" className="transition-colors hover:text-brand-accent">Terms</a>
        </div>
        <p>&copy; 2026 VChat</p>
      </footer>
    </div>
  );
};

export default RightPanel;

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { useReelsFeed } from '@/hooks/useReelsFeed';
import ReelCard from './ReelCard';
import type { PostDetail } from '@/types/profile';

// Demo fallback reels for when API returns no data
const DEMO_REELS: PostDetail[] = [
  {
    id: 'demo-1',
    author_id: 'demo-author-1',
    text: 'Visualizing the Prismatic Mesh Architecture #web3 #postbook',
    visibility: 'public',
    content_type: 'reel',
    is_pinned: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    media: [{ media_id: 'demo-video-1', kind: 'video' }],
    counts: { likes: 124000, comments: 1200, shares: 450 },
    hashtags: ['web3', 'postbook'],
  },
  {
    id: 'demo-2',
    author_id: 'demo-author-2',
    text: 'Cyberpunk vibes in the neural forge tonight #tech #future',
    visibility: 'public',
    content_type: 'reel',
    is_pinned: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    media: [{ media_id: 'demo-video-2', kind: 'video' }],
    counts: { likes: 89000, comments: 3400, shares: 780 },
    hashtags: ['tech', 'future'],
  },
  {
    id: 'demo-3',
    author_id: 'demo-author-3',
    text: 'Manifesting digital dreams with AI Generators #ai #creation',
    visibility: 'public',
    content_type: 'reel',
    is_pinned: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    media: [{ media_id: 'demo-video-3', kind: 'video' }],
    counts: { likes: 230000, comments: 560, shares: 1200 },
    hashtags: ['ai', 'creation'],
  },
];

const ShortsGallery: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const reelRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useReelsFeed();

  // Flatten all pages into a single array, fallback to demo reels
  const allReels = data?.pages?.flatMap(p => p.data) ?? [];
  const reels = allReels.length > 0 ? allReels : DEMO_REELS;

  // Set up IntersectionObserver for snap detection
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-reel-index'));
            if (!isNaN(idx)) {
              setActiveIndex(idx);
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.7,
      }
    );

    return () => observerRef.current?.disconnect();
  }, []);

  // Observe reel elements
  const setReelRef = useCallback((el: HTMLDivElement | null, index: number) => {
    if (el) {
      reelRefs.current.set(index, el);
      observerRef.current?.observe(el);
    } else {
      const existing = reelRefs.current.get(index);
      if (existing) {
        observerRef.current?.unobserve(existing);
        reelRefs.current.delete(index);
      }
    }
  }, []);

  // Prefetch next page when near the end
  useEffect(() => {
    if (activeIndex >= reels.length - 3 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [activeIndex, reels.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        navigateReel(1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        navigateReel(-1);
      } else if (e.key === 'm') {
        setIsMuted(m => !m);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, reels.length]);

  const navigateReel = (direction: number) => {
    const nextIdx = activeIndex + direction;
    if (nextIdx >= 0 && nextIdx < reels.length) {
      const el = reelRefs.current.get(nextIdx);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-fuchsia-400 animate-spin" />
          <p className="text-white/40 text-xs font-medium tracking-wider uppercase">Loading Reels</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      {/* Scrollable reel container */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory scrollbar-hide"
      >
        {reels.map((reel, index) => (
          <div
            key={reel.id}
            ref={(el) => setReelRef(el, index)}
            data-reel-index={index}
            className="h-full w-full snap-start snap-always"
          >
            <ReelCard
              post={reel}
              isActive={activeIndex === index}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              index={index}
            />
          </div>
        ))}

        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <div className="h-20 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-fuchsia-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Navigation arrows (desktop only) */}
      <div className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 flex-col gap-2 z-30">
        <button
          onClick={() => navigateReel(-1)}
          disabled={activeIndex === 0}
          className="w-10 h-10 rounded-full bg-brand-card/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-brand-card/20 transition-colors disabled:opacity-20 disabled:cursor-not-allowed border border-white/10"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          onClick={() => navigateReel(1)}
          disabled={activeIndex === reels.length - 1}
          className="w-10 h-10 rounded-full bg-brand-card/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-brand-card/20 transition-colors disabled:opacity-20 disabled:cursor-not-allowed border border-white/10"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Reel counter pill */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <div className="px-3 py-1 rounded-full bg-black/30 backdrop-blur-md border border-white/10">
          <span className="text-white/60 text-[10px] font-bold tracking-wider">
            {activeIndex + 1} / {reels.length}
          </span>
        </div>
      </div>

      {/* Scroll hint on first reel */}
      <AnimatePresence>
        {activeIndex === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 2, duration: 0.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: 3, ease: 'easeInOut' }}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-white/30 text-[10px] font-medium tracking-wider uppercase">Swipe up</span>
              <ChevronUp className="w-4 h-4 text-white/30 rotate-180" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShortsGallery;

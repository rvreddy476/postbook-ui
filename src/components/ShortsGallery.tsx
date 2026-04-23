'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { useReelsFeed } from '@/hooks/useReelsFeed';
import ReelCard from './ReelCard';


const ShortsGallery: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const reelRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useReelsFeed();

  // Flatten all pages into a single array
  const allReels = data?.pages?.flatMap(p => p.data) ?? [];
  const reels = allReels;

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

  if (reels.length === 0) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-16 h-16 text-white/20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
          <p className="text-white/50 text-sm font-semibold">No reels yet</p>
          <p className="text-white/30 text-xs">Reels will appear here once they are uploaded.</p>
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

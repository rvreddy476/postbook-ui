'use client';
import { useEffect, useRef, useState } from 'react';

export function alignedSearchWidth(feedWidth: number, available: number) {
  return available >= 180 ? Math.min(feedWidth, available) : 0;
}

/** Use the rendered reading column, including its sidebar and discovery rail. */
export function useFeedSearchAlignment(enabled: boolean) {
  const headerRef = useRef<HTMLElement>(null);
  const [alignment, setAlignment] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const header = headerRef.current;
    if (!enabled || !header) { setAlignment(null); return; }
    const feed = document.querySelector('.home-feed');
    const actions = header.querySelector('.app-header__actions');
    const toggle = header.querySelector('.app-header__search-toggle');
    if (!feed || !actions || !toggle) return;
    const measure = () => {
      const h = header.getBoundingClientRect();
      const f = feed.getBoundingClientRect();
      const a = actions.getBoundingClientRect();
      const t = toggle.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(actions).gap) || 0;
      const actionWidth = a.width - (t.width > 0 ? t.width + gap : 0);
      const padding = parseFloat(getComputedStyle(header).paddingRight) || 0;
      const width = alignedSearchWidth(f.width, h.right - padding - actionWidth - 16 - f.left);
      const left = f.left - h.left;
      setAlignment(old => old?.left === left && old.width === width ? old : { left, width });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(feed);
    observer.observe(actions);
    const main = feed.closest('main');
    if (main) observer.observe(main);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [enabled]);
  return { headerRef, alignment };
}

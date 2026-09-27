"use client";

import { useEffect, useRef } from "react";

import { formatChapterClock, type Chapter } from "../chapters";

/*
  The chapter strip under the title: one small pill per chapter with its
  start time, scrollable sideways, the playing one inverted and kept in
  view. A click seeks the player.
*/

export function ChapterStrip({ chapters, currentIndex, onSeek }: { chapters: Chapter[]; currentIndex: number; onSeek: (ms: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = ref.current;
    if (!strip || currentIndex < 0) return;
    const pill = strip.children[currentIndex] as HTMLElement | undefined;
    if (!pill) return;
    const left = pill.offsetLeft - strip.clientWidth / 2 + pill.offsetWidth / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [currentIndex]);

  if (chapters.length === 0) return null;
  return (
    <div ref={ref} className="tube-chapters" role="list" aria-label="Chapters">
      {chapters.map((c, i) => (
        <button key={c.startMs} type="button" role="listitem" className="tube-chapters__pill" aria-current={i === currentIndex ? "true" : undefined} onClick={() => onSeek(c.startMs)}>
          <time>{formatChapterClock(c.startMs)}</time>
          {c.title}
        </button>
      ))}
    </div>
  );
}

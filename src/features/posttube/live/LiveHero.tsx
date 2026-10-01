"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

import { heroShouldConnect, isLive, liveWatchHref, type StreamRow } from "@/features/live/discovery";
import { LivePlayer } from "@/features/live/components/LivePlayer";
import { mediaServeUrl } from "../model";
import { CreatorLine, LiveChip, ViewersChip } from "./LiveCards";

import "./live.css";

/** True while the element is at least half on screen. False until measured, so nothing connects on the server or before layout. */
function useInView<T extends Element>(threshold = 0.5) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), { threshold });
    io.observe(el);
    return () => {
      io.disconnect();
      setInView(false);
    };
  }, [threshold]);
  return [ref, inView] as const;
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const read = () => setVisible(document.visibilityState === "visible");
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, []);
  return visible;
}

/**
 * The most-watched live stream, previewing muted through a viewer token.
 * It holds a room connection only while it is live, on screen and in a
 * foreground tab (heroShouldConnect); scrolled away, backgrounded or
 * unmounted, it disconnects. The whole stage opens the watch page.
 */
export function LiveHero({ row, topic }: { row: StreamRow; topic?: string }) {
  const [stageRef, inView] = useInView<HTMLDivElement>(0.5);
  const pageVisible = usePageVisible();
  const connect = heroShouldConnect({ live: isLive(row), inView, pageVisible });
  const href = liveWatchHref(row);
  return (
    <section className="tube-live-hero" aria-label="Most watched right now" data-stream={row.id} data-connect={connect}>
      <div className="tube-live-hero__stage" ref={stageRef}>
        <LivePlayer
          streamId={row.id}
          creatorId={row.creator_user_id}
          connect={connect}
          muted
          controls={false}
          fit="cover"
          poster={row.cover_media_id ? mediaServeUrl(row.cover_media_id) : undefined}
        />
        <div className="tube-live-hero__chips">
          <LiveChip row={row} />
          <ViewersChip count={row.viewer_count} />
        </div>
        <Link href={href} className="tube-live-hero__hit" aria-label={`Watch live: ${row.title || "Untitled stream"}`} />
      </div>
      <div className="tube-live-hero__info">
        <p className="tube-live-hero__eyebrow">Most watched right now</p>
        <h2 className="tube-live-hero__title">{row.title || "Untitled stream"}</h2>
        <CreatorLine row={row} />
        {topic ? <span className="tube-live-topic tube-live-hero__cta">{topic}</span> : null}
        {row.description ? <p className="tube-live-hero__desc">{row.description}</p> : null}
        <Link href={href} className="tube-live-btn is-primary tube-live-hero__cta">
          <Play aria-hidden />
          Watch live
        </Link>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { CHIP_ALL, CHIP_SUBSCRIPTIONS } from "../model";
import { STRIP_CHIPS, type Topic } from "./discoveryApi";
import { useTopics } from "./hooks/useDiscovery";
import "../components/tube.css";
import "./discovery.css";

/*
  The strip at the top of Watch (the home page): All · Following · Fresh ·
  Seen · New to you · then every topic from the taxonomy, ending in a link
  to the Topics page. Drawn with tube.css's tube-strip__* (the sticky band
  and the 30px pills the foundations lane pinned); this file adds only the
  order and the meaning. Its value is what the home grid narrows on —
  "all", "subscriptions", a feed chip or a topic slug — and
  hooks/useDiscovery.useStripFeed turns that into the one right query
  (`subscribed_only`, `chip=` or `category=`).

  Mount (HomePage.tsx, two lines): replace the "Topic strip" block with
    <TopicStrip value={chip} onChange={setChip} />
  and `useLongVideosFeed(chip, 20)` with `useStripFeed(chip, 20)` from
  "@/features/posttube/discovery" — the page shape is identical.
*/

export interface TopicStripViewProps {
  value: string;
  onChange: (value: string) => void;
  topics: readonly Topic[];
  loading?: boolean;
  /** Show the "Following" pill (subscribed channels only). Default true. */
  showFollowing?: boolean;
}

export function TopicStripView({ value, onChange, topics, loading = false, showFollowing = true }: TopicStripViewProps) {
  const pill = (v: string, label: string) => (
    <button key={v} type="button" aria-pressed={value === v} className="tube-strip__pill" onClick={() => onChange(v)}>
      {label}
    </button>
  );
  return (
    <div className="tube-strip" data-strip="topics">
      <div role="group" aria-label="Narrow the feed" className="tube-strip__scroller">
        {pill(CHIP_ALL, "All")}
        {showFollowing ? pill(CHIP_SUBSCRIPTIONS, "Following") : null}
        {STRIP_CHIPS.map((c) => pill(c.value, c.label))}
        {topics.length > 0 ? <span className="disco-strip__sep" aria-hidden /> : null}
        {topics.map((t) => pill(t.slug, t.label))}
        {loading ? <Loader2 className="tube-strip__spinner disco-spin" size={14} aria-label="Loading topics" /> : null}
        <Link href="/posttube/topics" className="tube-strip__pill disco-strip__more" aria-label="All topics">
          <ChevronRight size={14} strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export function TopicStrip({ value, onChange, showFollowing }: { value: string; onChange: (value: string) => void; showFollowing?: boolean }) {
  const topics = useTopics();
  return <TopicStripView value={value} onChange={onChange} topics={topics.topics} loading={topics.isLoading} showFollowing={showFollowing} />;
}

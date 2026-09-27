"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";

import { formatCount } from "../../model";
import type { ChannelCounts } from "../channelApi";
import { TAB_LABELS, tabCount, tabHref, type ChannelTab } from "../channelModel";

/*
  The pill tabs (the tube-strip pill: 30px, 12px/600, the current one
  inverted), kept in the URL as ?tab= so a tab is shareable; they scroll
  sideways on a phone. The search field sits at the end of the row and
  narrows the current tab's loaded rows (see channelModel.filterByText).
*/

export interface ChannelTabsProps {
  pathname: string;
  tabs: readonly ChannelTab[];
  active: ChannelTab;
  counts: ChannelCounts;
  query: string;
  onQuery: (q: string) => void;
}

export function ChannelTabs({ pathname, tabs, active, counts, query, onQuery }: ChannelTabsProps) {
  return (
    <div className="tube-chan-tabs">
      <nav aria-label="Channel sections" className="tube-chan-tabs__scroller">
        {tabs.map((t) => {
          const n = tabCount(t, counts);
          return (
            <Link key={t} href={tabHref(pathname, t)} scroll={false} className="tube-chan-tabs__pill" aria-current={t === active ? "page" : undefined}>
              {TAB_LABELS[t]}
              {typeof n === "number" ? <span className="tube-chan-tabs__count">{formatCount(n)}</span> : null}
            </Link>
          );
        })}
      </nav>
      <label className="tube-chan-search">
        <Search aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={`Search ${TAB_LABELS[active].toLowerCase()}`}
          aria-label={`Search this channel's ${TAB_LABELS[active].toLowerCase()}`}
          enterKeyHint="search"
        />
        {query ? (
          <button type="button" className="tube-chan-search__clear" aria-label="Clear search" onClick={() => onQuery("")}>
            <X aria-hidden />
          </button>
        ) : null}
      </label>
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { Flag, MoreHorizontal, Rss, Share2 } from "lucide-react";

import { ChoiceMenuRow } from "@/features/reels/components/ChoiceMenu";
import { Popover } from "@/features/reels/components/Popover";

/*
  The masthead's More, ascending alphabetical like every More menu.
    visitor  Report (signed in only) · RSS feed · Share channel
    owner    RSS feed (Branding and Creator Hub sit beside the menu)
  `hasFeed` is false for a page drawn from a user id with no channel row:
  there is no feed to point at.
*/

export type ChannelMoreKey = "report" | "rss" | "share";

export function channelMoreRows(signedIn: boolean, isOwner = false, hasFeed = true): { key: ChannelMoreKey; label: string }[] {
  const rows: { key: ChannelMoreKey; label: string }[] = [];
  if (hasFeed) rows.push({ key: "rss", label: "RSS feed" });
  if (!isOwner) {
    rows.push({ key: "share", label: "Share channel" });
    if (signedIn) rows.push({ key: "report", label: "Report" });
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export interface ChannelMoreMenuProps {
  signedIn: boolean;
  isOwner?: boolean;
  hasFeed?: boolean;
  onShare: () => void;
  onReport: () => void;
  onFeed: () => void;
}

export function ChannelMoreMenu({ signedIn, isOwner = false, hasFeed = true, onShare, onReport, onFeed }: ChannelMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const rows = channelMoreRows(signedIn, isOwner, hasFeed);
  if (rows.length === 0) return null;
  const icon: Record<ChannelMoreKey, ReactNode> = { report: <Flag />, rss: <Rss />, share: <Share2 /> };
  const action: Record<ChannelMoreKey, () => void> = { report: onReport, rss: onFeed, share: onShare };
  return (
    <span className="tube-chan-more">
      <button
        type="button"
        className="tube-chan-btn is-icon"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal aria-hidden />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="right" placement="down" label="More" className="reel-more-menu tube-chan-menu">
        <div className="reel-more-menu__list">
          {rows.map((r) => (
            <ChoiceMenuRow key={r.key} icon={icon[r.key]} label={r.label} danger={r.key === "report"} dataRow={r.key} onClick={run(action[r.key])} />
          ))}
        </div>
      </Popover>
    </span>
  );
}

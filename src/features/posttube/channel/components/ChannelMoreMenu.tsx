"use client";

import { useState, type ReactNode } from "react";
import { Flag, MoreHorizontal, Share2 } from "lucide-react";

import { ChoiceMenuRow } from "@/features/reels/components/ChoiceMenu";
import { Popover } from "@/features/reels/components/Popover";

/*
  The masthead's More for a visitor: Report (signed in only) and Share
  channel, ascending alphabetical like every More menu. The owner has no
  More; Branding and Creator Hub sit beside it instead.
*/

export function channelMoreRows(signedIn: boolean): { key: "report" | "share"; label: string }[] {
  const rows: { key: "report" | "share"; label: string }[] = [{ key: "share", label: "Share channel" }];
  if (signedIn) rows.push({ key: "report", label: "Report" });
  return rows.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export function ChannelMoreMenu({ signedIn, onShare, onReport }: { signedIn: boolean; onShare: () => void; onReport: () => void }) {
  const [open, setOpen] = useState(false);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const icon: Record<"report" | "share", ReactNode> = { report: <Flag />, share: <Share2 /> };
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
          {channelMoreRows(signedIn).map((r) => (
            <ChoiceMenuRow
              key={r.key}
              icon={icon[r.key]}
              label={r.label}
              danger={r.key === "report"}
              dataRow={r.key}
              onClick={run(r.key === "report" ? onReport : onShare)}
            />
          ))}
        </div>
      </Popover>
    </span>
  );
}

"use client";

import { AlignLeft, CircleSlash, Download, Flag, Info, Link2, UserX } from "lucide-react";

import { MenuRow, Popover } from "@/features/reels/components/Popover";
import type { ReelItem } from "@/features/reels/model";

interface ReelMoreMenuProps {
  open: boolean;
  onClose: () => void;
  reel: ReelItem;
  isOwn: boolean;
  onCopyLink: () => void;
  onDescription: () => void;
  onNotInterested: () => void;
  onDontRecommend: () => void;
  onReport: () => void;
}

/* Every row here does something real; nothing is a placeholder. */
export function ReelMoreMenu({
  open,
  onClose,
  reel,
  isOwn,
  onCopyLink,
  onDescription,
  onNotInterested,
  onDontRecommend,
  onReport,
}: ReelMoreMenuProps) {
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Popover open={open} onClose={onClose} align="right" label="More options">
      <div className="py-1">
        <MenuRow icon={<Link2 className="h-[18px] w-[18px]" />} label="Copy link" onClick={run(onCopyLink)} />
        {reel.caption || reel.hashtags.length ? (
          <MenuRow icon={<AlignLeft className="h-[18px] w-[18px]" />} label="Description" onClick={run(onDescription)} />
        ) : null}
        {reel.downloadAllowed ? (
          <a
            role="menuitem"
            href={reel.media.downloadUrl}
            download={`reel-${reel.id}.mp4`}
            onClick={onClose}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] font-medium text-brand-text transition hover:bg-brand-secondary"
          >
            <Download className="h-[18px] w-[18px] text-current/80" /> Download
          </a>
        ) : null}
        {reel.reasonText ? (
          <MenuRow icon={<Info className="h-[18px] w-[18px]" />} label="Why you're seeing this" hint={reel.reasonText} />
        ) : null}
        {!isOwn ? (
          <>
            <div className="my-1 border-t border-border" />
            <MenuRow icon={<CircleSlash className="h-[18px] w-[18px]" />} label="Not interested" onClick={run(onNotInterested)} />
            <MenuRow
              icon={<UserX className="h-[18px] w-[18px]" />}
              label={`Don't recommend ${reel.authorUsername ? `@${reel.authorUsername}` : "this creator"}`}
              onClick={run(onDontRecommend)}
            />
            <MenuRow icon={<Flag className="h-[18px] w-[18px]" />} label="Report" danger onClick={run(onReport)} />
          </>
        ) : null}
      </div>
    </Popover>
  );
}

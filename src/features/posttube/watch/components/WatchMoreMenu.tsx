"use client";

import type { ReactNode } from "react";
import { AudioLines, Ban, CircleSlash, Download, Flag, Pencil, Share2, Trash2, UserX } from "lucide-react";

import { ChoiceMenuRow } from "@/features/reels/components/ChoiceMenu";
import { Popover } from "@/features/reels/components/Popover";

/*
  The ⋯ menu in the action row: the reels choice-pane shell with our
  rows, ascending alphabetical (the founder's rule). A viewer sees Block,
  Don't recommend this channel, Keep a copy (only when downloads are
  allowed), Not interested, Report, Share; the owner sees Audio tracks,
  Delete, Edit, Keep a copy, Share. The card hangs under the button; a
  bottom sheet on phones (the Popover does both).
*/

export interface WatchMoreMenuProps {
  open: boolean;
  onClose: () => void;
  isOwner: boolean;
  channelName: string;
  /** Absent hides Share (the creator turned sharing off). */
  onShare?: () => void;
  /** Absent hides Keep a copy (downloads off and not the owner). */
  onKeep?: () => void;
  onNotInterested: () => void;
  onDontRecommend: () => void;
  onReport: () => void;
  onBlock: () => void;
  onEdit: () => void;
  onAudioTracks: () => void;
  onDelete: () => void;
}

export function watchMoreMenuRows(isOwner: boolean, channelName: string, opts: { share?: boolean; keep?: boolean } = {}): { key: string; label: string }[] {
  const rows = isOwner
    ? [
        { key: "audio", label: "Audio tracks" },
        { key: "delete", label: "Delete" },
        { key: "edit", label: "Edit" },
      ]
    : [
        { key: "block", label: `Block ${channelName}` },
        { key: "dont-recommend", label: "Don't recommend this channel" },
        { key: "not-interested", label: "Not interested" },
        { key: "report", label: "Report" },
      ];
  if (opts.share) rows.push({ key: "share", label: "Share" });
  if (opts.keep) rows.push({ key: "keep", label: "Keep a copy" });
  return rows.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export function WatchMoreMenu({ open, onClose, isOwner, channelName, onShare, onKeep, onNotInterested, onDontRecommend, onReport, onBlock, onEdit, onAudioTracks, onDelete }: WatchMoreMenuProps) {
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const render = (key: string, label: string): ReactNode => {
    switch (key) {
      case "audio":
        return <ChoiceMenuRow key={key} icon={<AudioLines />} label={label} hint="Upload or generate a dub" dataRow="audio" onClick={run(onAudioTracks)} />;
      case "delete":
        return <ChoiceMenuRow key={key} icon={<Trash2 />} label={label} danger dataRow="delete" onClick={run(onDelete)} />;
      case "edit":
        return <ChoiceMenuRow key={key} icon={<Pencil />} label={label} hint="Title, description, topic, visibility" dataRow="edit" onClick={run(onEdit)} />;
      case "block":
        return <ChoiceMenuRow key={key} icon={<Ban />} label={label} danger dataRow="block" onClick={run(onBlock)} />;
      case "dont-recommend":
        return <ChoiceMenuRow key={key} icon={<UserX />} label={label} hint={channelName} dataRow="dont-recommend" onClick={run(onDontRecommend)} />;
      case "not-interested":
        return <ChoiceMenuRow key={key} icon={<CircleSlash />} label={label} dataRow="not-interested" onClick={run(onNotInterested)} />;
      case "report":
        return <ChoiceMenuRow key={key} icon={<Flag />} label={label} danger dataRow="report" onClick={run(onReport)} />;
      case "share":
        return onShare ? <ChoiceMenuRow key={key} icon={<Share2 />} label={label} dataRow="share" onClick={run(onShare)} /> : null;
      case "keep":
        return onKeep ? <ChoiceMenuRow key={key} icon={<Download />} label={label} hint="Download the video" dataRow="keep" onClick={run(onKeep)} /> : null;
      default:
        return null;
    }
  };
  return (
    <Popover open={open} onClose={onClose} belowTrigger placement="down" label="More" tone="stage" className="reel-more-menu tube-more-menu">
      <div className="reel-more-menu__list" data-pane="root">
        {watchMoreMenuRows(isOwner, channelName, { share: !!onShare, keep: !!onKeep }).map((r) => render(r.key, r.label))}
      </div>
    </Popover>
  );
}

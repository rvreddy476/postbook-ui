"use client";

import type { ReactNode } from "react";
import { AudioLines, Ban, CircleSlash, Flag, Pencil, Trash2, UserX } from "lucide-react";

import { ChoiceMenuRow } from "@/features/reels/components/ChoiceMenu";
import { Popover } from "@/features/reels/components/Popover";

/*
  The rail's More: the reels choice-pane shell with our rows, ascending
  alphabetical (the founder's rule). A viewer sees Block, Don't recommend
  this channel, Not interested, Report; the owner sees Audio tracks,
  Delete, Edit. The card opens to the left of the rail growing upward; a
  bottom sheet on phones (the Popover does both).
*/

export interface WatchMoreMenuProps {
  open: boolean;
  onClose: () => void;
  isOwner: boolean;
  channelName: string;
  onNotInterested: () => void;
  onDontRecommend: () => void;
  onReport: () => void;
  onBlock: () => void;
  onEdit: () => void;
  onAudioTracks: () => void;
  onDelete: () => void;
}

export function watchMoreMenuRows(isOwner: boolean, channelName: string): { key: string; label: string }[] {
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
  return rows.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export function WatchMoreMenu({ open, onClose, isOwner, channelName, onNotInterested, onDontRecommend, onReport, onBlock, onEdit, onAudioTracks, onDelete }: WatchMoreMenuProps) {
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
      default:
        return null;
    }
  };
  return (
    <Popover open={open} onClose={onClose} align="right" placement="up" label="More" tone="stage" className="reel-more-menu tube-more-menu">
      <div className="reel-more-menu__list" data-pane="root">
        {watchMoreMenuRows(isOwner, channelName).map((r) => render(r.key, r.label))}
      </div>
    </Popover>
  );
}

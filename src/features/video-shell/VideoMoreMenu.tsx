"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AlignLeft,
  AudioLines,
  Ban,
  Captions,
  ChevronsDown,
  CircleSlash,
  Download,
  Flag,
  Gauge,
  Languages,
  Link2,
  Music2,
  Pencil,
  Share2,
  SlidersHorizontal,
  Trash2,
  UserX,
} from "lucide-react";

import {
  ChoiceMenuBack as Back,
  ChoiceMenuChoiceRow as ChoiceRow,
  ChoiceMenuOption as Option,
  ChoiceMenuRow as Row,
  ChoiceMenuSwitchRow as SwitchRow,
  SpeedPanel,
} from "@/features/reels/components/ChoiceMenu";
import { Popover } from "@/features/reels/components/Popover";
import { MENU_SPEEDS } from "@/features/reels/menu";
import { speedChipLabel } from "@/features/reels/playback/playerPrefs";

import type { MoreRow, MoreRowKey } from "./moreRows";

/*
  The More options card of a video: one component for the reels stage and
  the long-video watch page, drawn from the rows of moreRows.ts (so both
  list the same rows, in the same words, in ascending order). It is the
  reels choice-pane shell (reels-screen.css, .reel-more-menu): Audio track,
  Captions, Playback speed and Quality show their current value and open a
  pane inside the same card; Auto scroll is a switch; the rest are actions
  that close the card.

  The surface hands in the state the panes drive (`playback`) and one
  handler per action row (`actions`). A row with nothing behind it is not
  drawn: there are no dead rows.
*/

export type MoreActionKey = Exclude<MoreRowKey, "audio" | "auto-scroll" | "captions" | "quality" | "speed">;

export interface MorePlayback {
  speed: number;
  onSpeed: (speed: number) => void;
  /** "auto" | "720p" | … */
  quality: string;
  /** Heights the current manifest offers. */
  qualityHeights: readonly number[];
  onQuality: (quality: string) => void;
  captions: {
    on: boolean;
    /** Named caption languages; absent or empty = a plain On / Off choice. */
    tracks?: readonly { lang: string; label: string }[];
    lang?: string | null;
    onChange: (on: boolean, lang?: string) => void;
  };
  audio: {
    options: readonly { id: string; label: string }[];
    current: string;
    onChange: (id: string) => void;
  };
  /** The reels stage only. */
  autoScroll?: { on: boolean; onToggle: () => void };
}

export interface VideoMoreMenuProps {
  open: boolean;
  onClose: () => void;
  rows: readonly MoreRow[];
  /** Under "Don't recommend this channel". */
  channelName: string;
  playback: MorePlayback;
  actions: Partial<Record<MoreActionKey, () => void>>;
  /** Action rows that wait on a request in flight. */
  pending?: Partial<Record<MoreActionKey, boolean>>;
  /**
   * "below": the card hangs under its trigger. "beside": it opens to the
   * left of the trigger, growing upward. A bottom sheet on phones either way.
   */
  anchor?: "beside" | "below";
  className?: string;
}

type Pane = "root" | "audio" | "captions" | "quality" | "speed";

/** "Normal" at 1×, else "1.25x" — the value shown beside Playback speed. */
export function speedValueLabel(speed: number): string {
  return speed === 1 ? "Normal" : `${speedChipLabel(speed)}x`;
}

const ACTION_ICONS: Record<MoreActionKey, ReactNode> = {
  block: <Ban />,
  "copy-link": <Link2 />,
  delete: <Trash2 />,
  description: <AlignLeft />,
  "dont-recommend": <UserX />,
  edit: <Pencil />,
  keep: <Download />,
  "manage-audio": <Languages />,
  "not-interested": <CircleSlash />,
  report: <Flag />,
  share: <Share2 />,
  "use-sound": <Music2 />,
};

const DANGER: ReadonlySet<MoreRowKey> = new Set<MoreRowKey>(["block", "delete", "report"]);

export function VideoMoreMenu({ open, onClose, rows, channelName, playback, actions, pending, anchor = "below", className = "" }: VideoMoreMenuProps) {
  const [pane, setPane] = useState<Pane>("root");
  // Reopening always lands on the root pane, however the menu was closed.
  useEffect(() => {
    if (!open) setPane("root");
  }, [open]);

  const close = () => {
    setPane("root");
    onClose();
  };
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  const { captions, audio, autoScroll } = playback;
  const rungs = Array.from(new Set(playback.qualityHeights.filter((h) => h > 0))).sort((a, b) => b - a);
  const qualityLabel = playback.quality === "auto" ? "Auto" : playback.quality;
  const captionTracks = captions.tracks ?? [];
  const captionsLabel = !captions.on ? "Off" : captionTracks.find((c) => c.lang === captions.lang)?.label ?? "On";
  const audioLabel = audio.options.find((t) => t.id === audio.current)?.label ?? audio.options[0]?.label ?? "Original";

  const hints: Partial<Record<MoreRowKey, string>> = {
    "dont-recommend": channelName,
    edit: "Title, description, topic, visibility",
    keep: "Download the video",
    "manage-audio": "Upload or generate a dub",
  };

  const render = (row: MoreRow): ReactNode => {
    switch (row.key) {
      case "audio":
        return <ChoiceRow key={row.key} icon={<AudioLines />} label={row.label} value={audioLabel} dataRow="audio" onClick={() => setPane("audio")} />;
      case "auto-scroll":
        return autoScroll ? <SwitchRow key={row.key} icon={<ChevronsDown />} label={row.label} dataRow="auto-scroll" on={autoScroll.on} onToggle={autoScroll.onToggle} /> : null;
      case "captions":
        return <ChoiceRow key={row.key} icon={<Captions />} label={row.label} value={captionsLabel} dataRow="captions" onClick={() => setPane("captions")} />;
      case "quality":
        return <ChoiceRow key={row.key} icon={<SlidersHorizontal />} label={row.label} value={qualityLabel} dataRow="quality" onClick={() => setPane("quality")} />;
      case "speed":
        return <ChoiceRow key={row.key} icon={<Gauge />} label={row.label} value={speedValueLabel(playback.speed)} dataRow="speed" onClick={() => setPane("speed")} />;
      default: {
        const action = actions[row.key];
        if (!action) return null;
        return (
          <Row
            key={row.key}
            icon={ACTION_ICONS[row.key]}
            label={row.label}
            hint={hints[row.key]}
            danger={DANGER.has(row.key)}
            disabled={pending?.[row.key] === true}
            dataRow={row.key}
            onClick={run(action)}
          />
        );
      }
    }
  };

  const panes: Record<Exclude<Pane, "root">, ReactNode> = {
    audio: (
      <div className="reel-more-menu__list" data-pane="audio">
        <Back label="Audio track" onClick={() => setPane("root")} />
        {audio.options.map((t) => (
          <Option key={t.id} label={t.label} selected={t.id === audio.current} onClick={() => audio.onChange(t.id)} />
        ))}
      </div>
    ),
    captions: (
      <div className="reel-more-menu__list" data-pane="captions">
        <Back label="Captions" onClick={() => setPane("root")} />
        <Option label="Off" selected={!captions.on} onClick={() => captions.onChange(false)} />
        {captionTracks.length > 0 ? (
          captionTracks.map((c) => <Option key={c.lang} label={c.label} selected={captions.on && captions.lang === c.lang} onClick={() => captions.onChange(true, c.lang)} />)
        ) : (
          <Option label="On" selected={captions.on} onClick={() => captions.onChange(true)} />
        )}
      </div>
    ),
    quality: (
      <div className="reel-more-menu__list" data-pane="quality">
        <Back label="Quality" onClick={() => setPane("root")} />
        <Option label="Auto" selected={playback.quality === "auto"} onClick={() => playback.onQuality("auto")} />
        {rungs.map((h) => (
          <Option key={h} label={`${h}p`} selected={playback.quality === `${h}p`} onClick={() => playback.onQuality(`${h}p`)} />
        ))}
      </div>
    ),
    speed: (
      <div className="reel-more-menu__list" data-pane="speed">
        <Back label="Playback speed" onClick={() => setPane("root")} />
        <SpeedPanel speed={playback.speed} presets={MENU_SPEEDS} onChange={playback.onSpeed} />
      </div>
    ),
  };

  return (
    <Popover
      open={open}
      onClose={close}
      align="right"
      label="More options"
      placement={anchor === "below" ? "down" : "up"}
      belowTrigger={anchor === "below"}
      tone="stage"
      className={`reel-more-menu ${className}`.trim()}
    >
      {pane === "root" ? (
        <div className="reel-more-menu__list" data-pane="root">
          {rows.map(render)}
        </div>
      ) : (
        panes[pane]
      )}
    </Popover>
  );
}

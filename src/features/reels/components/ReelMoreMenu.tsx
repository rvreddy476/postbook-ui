"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AlignLeft,
  AudioLines,
  Ban,
  Captions,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsDown,
  CircleSlash,
  Download,
  EyeOff,
  Flag,
  Gauge,
  Info,
  Link2,
  Minus,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  UserX,
} from "lucide-react";

import { Popover } from "@/features/reels/components/Popover";
import { MENU_SPEEDS, moreMenuItems, type MoreMenuItemKey } from "@/features/reels/menu";
import type { ReelItem } from "@/features/reels/model";
import { clampSpeed, SPEED_MAX, SPEED_MIN, SPEED_STEP, speedChipLabel, type PlayerPrefs, type PrefsPatch, type Speed } from "@/features/reels/playback/playerPrefs";
export { speedChipLabel };

/** One selectable audio track for the reel; the original is always first. */
export interface AudioTrackOption {
  id: string;
  label: string;
}
export const ORIGINAL_AUDIO_ID = "original";

interface ReelMoreMenuProps {
  open: boolean;
  onClose: () => void;
  reel: ReelItem;
  isOwn: boolean;
  /** undefined = relationship not known yet (no Follow row). */
  following: boolean | undefined;
  followPending?: boolean;
  /** The viewer's playback preferences; the playback rows read and write them. */
  prefs: PlayerPrefs;
  onPrefsChange: (patch: PrefsPatch) => void;
  /** Heights the current manifest offers; empty = Auto only. */
  qualityHeights: number[];
  captionsAvailable: "unknown" | "yes" | "no";
  /** Alternate audio for this reel (original first). One entry = no choice, row hidden. */
  audioTracks?: AudioTrackOption[];
  currentAudioTrack?: string;
  onAudioTrack?: (id: string) => void;
  /** Own reel: opens the creator's audio-tracks dialog. */
  onManageAudio?: () => void;
  onCopyLink: () => void;
  onDescription: () => void;
  onInterested: () => void;
  onToggleFollow: () => void;
  onBlock: () => void;
  onDelete: () => void;
  onClearScreen: () => void;
  onNotInterested: () => void;
  onDontRecommend: () => void;
  onReport: () => void;
  /**
   * "beside" (default): the card opens to the left of its trigger, growing
   * upward — the theater bar and the phone rail. "below": right-aligned
   * under the trigger — the More circle at the frame's top-right.
   */
  anchor?: "beside" | "below";
}

type Pane = "root" | "speed" | "quality" | "captions" | "audio";

/** "Normal" at 1×, else "1.25x" — the value shown beside Playback speed. */
export function speedValueLabel(speed: number): string {
  return speed === 1 ? "Normal" : `${speedChipLabel(speed)}x`;
}

/*
  YouTube Shorts' More card, with our rows: Description · Captions · Audio
  track · Playback speed · Quality · Auto scroll · Not interested · Don't
  recommend this channel · Report. Rows that hold a choice show the current
  value and a chevron and open a pane inside the same card (speed is
  YouTube's slider panel: the big readout, − / + in 0.05 steps, preset
  chips). The card is the theme's surface (white in light mode, dark in
  dark mode) through reels-screen.css (.reel-more-menu). The choice panes
  keep the menu open; the actions close it.
*/
export function ReelMoreMenu({
  open,
  onClose,
  reel,
  isOwn,
  following,
  followPending,
  prefs,
  onPrefsChange,
  qualityHeights,
  captionsAvailable,
  audioTracks = [],
  currentAudioTrack = ORIGINAL_AUDIO_ID,
  onAudioTrack,
  onManageAudio,
  onCopyLink,
  onDescription,
  onInterested,
  onToggleFollow,
  onBlock,
  onDelete,
  onClearScreen,
  onNotInterested,
  onDontRecommend,
  onReport,
  anchor = "beside",
}: ReelMoreMenuProps) {
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
  const handle = reel.authorUsername ? `@${reel.authorUsername}` : "this creator";
  const items = moreMenuItems(reel, { isOwn, relationshipKnown: following !== undefined, following: following === true });
  const rungs = Array.from(new Set(qualityHeights)).sort((a, b) => b - a);
  const qualityLabel = prefs.quality === "auto" ? "Auto" : prefs.quality;
  const noCaptions = captionsAvailable === "no";
  const captionsLabel = noCaptions ? "None" : prefs.captions ? "On" : "Off";
  const hasAudioChoice = audioTracks.length > 1;
  const audioLabel = audioTracks.find((t) => t.id === currentAudioTrack)?.label ?? audioTracks[0]?.label ?? "Original";
  const setSpeed = (s: number) => onPrefsChange({ speed: clampSpeed(s) as Speed });
  const stepSpeed = (dir: 1 | -1) => onPrefsChange((p) => ({ speed: clampSpeed(p.speed + dir * SPEED_STEP) as Speed }));

  const row = (key: MoreMenuItemKey) => {
    switch (key) {
      case "copy-link":
        return <Row key={key} icon={<Link2 />} label="Copy link" onClick={run(onCopyLink)} />;
      case "description":
        return <Row key={key} icon={<AlignLeft />} label="Description" dataRow="description" onClick={run(onDescription)} />;
      case "download":
        return (
          <a key={key} role="menuitem" href={reel.media.downloadUrl} download={`reel-${reel.id}.mp4`} onClick={close} className="reel-more-menu__row">
            <span className="reel-more-menu__icon"><Download /></span>
            <span className="reel-more-menu__label">Download</span>
          </a>
        );
      case "why":
        return <Row key={key} icon={<Info />} label="Why you're seeing this" hint={reel.reasonText ?? undefined} />;
      case "interested":
        return <Row key={key} icon={<Sparkles />} label="Interested" hint="Show more like this" onClick={run(onInterested)} />;
      case "follow":
        return <Row key={key} icon={<UserPlus />} label={`Follow ${handle}`} disabled={followPending} onClick={run(onToggleFollow)} />;
      case "unfollow":
        return <Row key={key} icon={<UserMinus />} label={`Unfollow ${handle}`} disabled={followPending} onClick={run(onToggleFollow)} />;
      case "block":
        return <Row key={key} icon={<Ban />} label={`Block ${handle}`} onClick={run(onBlock)} />;
      case "delete":
        return <Row key={key} icon={<Trash2 />} label="Delete reel" danger onClick={run(onDelete)} />;
      case "clear-screen":
        return <Row key={key} icon={<EyeOff />} label="Clear screen" hint="Hide the controls · H" onClick={run(onClearScreen)} />;
      case "not-interested":
        return <Row key={key} icon={<CircleSlash />} label="Not interested" dataRow="not-interested" onClick={run(onNotInterested)} />;
      case "dont-recommend":
        return <Row key={key} icon={<UserX />} label="Don't recommend this channel" hint={handle} dataRow="dont-recommend" onClick={run(onDontRecommend)} />;
      case "report":
        return <Row key={key} icon={<Flag />} label="Report" dataRow="report" danger onClick={run(onReport)} />;
      default:
        return null;
    }
  };

  const root = (
    <div className="reel-more-menu__list" data-pane="root">
      {items.includes("description") ? row("description") : null}
      <ChoiceRow icon={<Captions />} label="Captions" value={captionsLabel} dataRow="captions" disabled={noCaptions} onClick={() => setPane("captions")} />
      {hasAudioChoice ? <ChoiceRow icon={<AudioLines />} label="Audio track" value={audioLabel} dataRow="audio" onClick={() => setPane("audio")} /> : null}
      {onManageAudio ? <ChoiceRow icon={<AudioLines />} label="Audio tracks" value={`${Math.max(0, audioTracks.length - 1)} added`} dataRow="manage-audio" onClick={run(onManageAudio)} /> : null}
      <ChoiceRow icon={<Gauge />} label="Playback speed" value={speedValueLabel(prefs.speed)} dataRow="speed" onClick={() => setPane("speed")} />
      <ChoiceRow icon={<SlidersHorizontal />} label="Quality" value={qualityLabel} dataRow="quality" onClick={() => setPane("quality")} />
      <SwitchRow icon={<ChevronsDown />} label="Auto scroll" dataRow="auto-scroll" on={prefs.onEnd === "next"} onToggle={() => onPrefsChange({ onEnd: prefs.onEnd === "next" ? "loop" : "next" })} />
      {items.filter((k) => k !== "description").map(row)}
    </div>
  );

  const speedPane = (
    <div className="reel-more-menu__list" data-pane="speed">
      <Back label="Playback speed" onClick={() => setPane("root")} />
      <div className="reel-speed-panel" role="group" aria-label="Playback speed">
        <div className="reel-speed-panel__readout" aria-live="polite">{speedChipLabel(prefs.speed)}x</div>
        <div className="reel-speed-panel__slider">
          <button type="button" aria-label="Slower" disabled={prefs.speed <= SPEED_MIN} onClick={() => stepSpeed(-1)}><Minus /></button>
          <input
            type="range"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={SPEED_STEP}
            value={prefs.speed}
            aria-label="Playback speed"
            aria-valuetext={`${speedChipLabel(prefs.speed)}x`}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
          <button type="button" aria-label="Faster" disabled={prefs.speed >= SPEED_MAX} onClick={() => stepSpeed(1)}><Plus /></button>
        </div>
        <div className="reel-speed-panel__chips" role="radiogroup" aria-label="Preset speeds">
          {MENU_SPEEDS.map((s) => (
            <span key={s} className="reel-speed-panel__chip-wrap">
              <button type="button" role="radio" aria-checked={prefs.speed === s} className="reel-more-menu__chip" onClick={() => setSpeed(s)}>
                {speedChipLabel(s)}
              </button>
              {s === 1 ? <span className="reel-speed-panel__normal">Normal</span> : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const qualityPane = (
    <div className="reel-more-menu__list" data-pane="quality">
      <Back label="Quality" onClick={() => setPane("root")} />
      <Option label="Auto" selected={prefs.quality === "auto"} onClick={() => onPrefsChange({ quality: "auto" })} />
      {rungs.map((h) => (
        <Option key={h} label={`${h}p`} selected={prefs.quality === `${h}p`} onClick={() => onPrefsChange({ quality: `${h}p` })} />
      ))}
      {rungs.length === 0 ? <p className="reel-more-menu__note">Only Auto is available for this reel.</p> : null}
    </div>
  );

  const captionsPane = (
    <div className="reel-more-menu__list" data-pane="captions">
      <Back label="Captions" onClick={() => setPane("root")} />
      <Option label="Off" selected={!prefs.captions} onClick={() => onPrefsChange({ captions: false })} />
      <Option label="On" selected={prefs.captions} onClick={() => onPrefsChange({ captions: true })} />
    </div>
  );

  const audioPane = (
    <div className="reel-more-menu__list" data-pane="audio">
      <Back label="Audio track" onClick={() => setPane("root")} />
      {audioTracks.map((t) => (
        <Option key={t.id} label={t.label} selected={t.id === currentAudioTrack} onClick={() => onAudioTrack?.(t.id)} />
      ))}
    </div>
  );

  return (
    <Popover
      open={open}
      onClose={close}
      align="right"
      label="More options"
      placement={anchor === "below" ? "down" : "up"}
      belowTrigger={anchor === "below"}
      tone="stage"
      className="reel-more-menu"
    >
      {pane === "speed" ? speedPane : pane === "quality" ? qualityPane : pane === "captions" ? captionsPane : pane === "audio" ? audioPane : root}
    </Popover>
  );
}

function Back({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="reel-more-menu__row reel-more-menu__back" onClick={onClick}>
      <span className="reel-more-menu__icon"><ChevronLeft /></span>
      <span className="reel-more-menu__label">{label}</span>
    </button>
  );
}

function Row({
  icon,
  label,
  hint,
  onClick,
  danger,
  disabled,
  dataRow,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  dataRow?: string;
}) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick} data-row={dataRow} className={`reel-more-menu__row${danger ? " is-danger" : ""}`}>
      <span className="reel-more-menu__icon">{icon}</span>
      <span className="reel-more-menu__label">
        <span className="reel-more-menu__title">{label}</span>
        {hint ? <span className="reel-more-menu__hint">{hint}</span> : null}
      </span>
    </button>
  );
}

/** A row that opens a pane: label, the current value, a chevron. */
function ChoiceRow({
  icon,
  label,
  value,
  onClick,
  disabled,
  dataRow,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onClick: () => void;
  disabled?: boolean;
  dataRow?: string;
}) {
  return (
    <button type="button" role="menuitem" aria-haspopup="menu" disabled={disabled} onClick={onClick} data-row={dataRow} className="reel-more-menu__row">
      <span className="reel-more-menu__icon">{icon}</span>
      <span className="reel-more-menu__label">
        <span className="reel-more-menu__title">{label}</span>
      </span>
      <span className="reel-more-menu__value">
        {value}
        <ChevronRight />
      </span>
    </button>
  );
}

function SwitchRow({
  icon,
  label,
  hint,
  on,
  onToggle,
  disabled,
  dataRow,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  dataRow?: string;
}) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={on} disabled={disabled} onClick={onToggle} data-row={dataRow} className="reel-more-menu__row">
      <span className="reel-more-menu__icon">{icon}</span>
      <span className="reel-more-menu__label">
        <span className="reel-more-menu__title">{label}</span>
        {hint ? <span className="reel-more-menu__hint">{hint}</span> : null}
      </span>
      <span className="reel-more-menu__switch" data-on={on ? "" : undefined} aria-hidden>
        <span className="reel-more-menu__knob" />
      </span>
    </button>
  );
}

function Option({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={selected} onClick={onClick} className="reel-more-menu__row">
      <span className="reel-more-menu__icon">{selected ? <Check /> : null}</span>
      <span className="reel-more-menu__label">{label}</span>
    </button>
  );
}

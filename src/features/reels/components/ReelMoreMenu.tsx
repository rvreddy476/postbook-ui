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
  EyeOff,
  Flag,
  Gauge,
  Info,
  Link2,
  Music2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
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
import { MENU_SPEEDS, moreMenuItems, type MoreMenuItemKey } from "@/features/reels/menu";
import type { ReelItem } from "@/features/reels/model";
import { clampSpeed, speedChipLabel, type PlayerPrefs, type PrefsPatch, type Speed } from "@/features/reels/playback/playerPrefs";
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
  /** "Use this sound": takes the reel's sound to the studio. */
  onUseSound: () => void;
  /** That request is in flight: the row waits. */
  useSoundPending?: boolean;
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
  YouTube Shorts' More card with our rows, always in ascending alphabetical
  order (the founder's rule): Audio track · Auto scroll · Captions ·
  Description · Don't recommend this channel · Not interested · Playback
  speed · Quality · Report · Use this sound. Rows that hold a choice show the current value
  and a chevron and open a pane inside the same card (speed is YouTube's
  slider panel: the readout, − / + in 0.05 steps, preset chips). Audio
  track is always offered; with no alternate the pane says so, and the
  owner manages tracks from a row at the bottom of that pane. The card is
  the theme's surface through reels-screen.css (.reel-more-menu). The
  choice panes keep the menu open; the actions close it.
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
  onUseSound,
  useSoundPending,
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
  const audioLabel = audioTracks.find((t) => t.id === currentAudioTrack)?.label ?? audioTracks[0]?.label ?? "Original";
  const audioChoices = audioTracks.length > 0 ? audioTracks : [{ id: ORIGINAL_AUDIO_ID, label: "Original" }];
  const setSpeed = (s: number) => onPrefsChange({ speed: clampSpeed(s) as Speed });

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
      case "use-sound":
        return <Row key={key} icon={<Music2 />} label="Use this sound" dataRow="use-sound" disabled={useSoundPending} onClick={run(onUseSound)} />;
      default:
        return null;
    }
  };

  const mappedLabel = (key: MoreMenuItemKey): string => {
    switch (key) {
      case "description": return "Description";
      case "not-interested": return "Not interested";
      case "dont-recommend": return "Don't recommend this channel";
      case "report": return "Report";
      case "use-sound": return "Use this sound";
      case "copy-link": return "Copy link";
      case "download": return "Download";
      case "why": return "Why you're seeing this";
      case "interested": return "Interested";
      case "follow": return `Follow ${handle}`;
      case "unfollow": return `Unfollow ${handle}`;
      case "block": return `Block ${handle}`;
      case "delete": return "Delete reel";
      case "clear-screen": return "Clear screen";
      default: return key;
    }
  };
  const rows: { label: string; node: ReactNode }[] = [
    { label: "Audio track", node: <ChoiceRow key="audio" icon={<AudioLines />} label="Audio track" value={audioLabel} dataRow="audio" onClick={() => setPane("audio")} /> },
    { label: "Auto scroll", node: <SwitchRow key="auto-scroll" icon={<ChevronsDown />} label="Auto scroll" dataRow="auto-scroll" on={prefs.onEnd === "next"} onToggle={() => onPrefsChange({ onEnd: prefs.onEnd === "next" ? "loop" : "next" })} /> },
    { label: "Captions", node: <ChoiceRow key="captions" icon={<Captions />} label="Captions" value={captionsLabel} dataRow="captions" disabled={noCaptions} onClick={() => setPane("captions")} /> },
    { label: "Playback speed", node: <ChoiceRow key="speed" icon={<Gauge />} label="Playback speed" value={speedValueLabel(prefs.speed)} dataRow="speed" onClick={() => setPane("speed")} /> },
    { label: "Quality", node: <ChoiceRow key="quality" icon={<SlidersHorizontal />} label="Quality" value={qualityLabel} dataRow="quality" onClick={() => setPane("quality")} /> },
    ...items.map((k) => ({ label: mappedLabel(k), node: row(k) })),
  ].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  const root = (
    <div className="reel-more-menu__list" data-pane="root">
      {rows.map((r) => r.node)}
    </div>
  );

  const speedPane = (
    <div className="reel-more-menu__list" data-pane="speed">
      <Back label="Playback speed" onClick={() => setPane("root")} />
      <SpeedPanel speed={prefs.speed} presets={MENU_SPEEDS} onChange={setSpeed} />
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
      {audioChoices.map((t) => (
        <Option key={t.id} label={t.label} selected={t.id === currentAudioTrack} onClick={() => onAudioTrack?.(t.id)} />
      ))}
      {audioChoices.length < 2 ? <p className="reel-more-menu__note">No other languages for this reel yet.</p> : null}
      {onManageAudio ? <Row icon={<AudioLines />} label="Manage tracks" hint="Upload or generate a dub" dataRow="manage-audio" onClick={run(onManageAudio)} /> : null}
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

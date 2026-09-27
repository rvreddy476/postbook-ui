"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AlignLeft,
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
  Maximize,
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
import type { PlayerPrefs, Speed } from "@/features/reels/playback/playerPrefs";

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
  onPrefsChange: (patch: Partial<PlayerPrefs>) => void;
  /** Heights the current manifest offers; empty = Auto only. */
  qualityHeights: number[];
  captionsAvailable: "unknown" | "yes" | "no";
  onCopyLink: () => void;
  onDescription: () => void;
  onInterested: () => void;
  onToggleFollow: () => void;
  onBlock: () => void;
  onDelete: () => void;
  onClearScreen: () => void;
  /** Enters theater mode (fullscreen with the side panel). */
  onTheater: () => void;
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

const MENU_GROUPS: readonly (readonly MoreMenuItemKey[])[] = [
  ["copy-link", "description", "download", "why"],
  ["interested", "follow", "unfollow", "block", "delete"],
  ["clear-screen"],
  ["not-interested", "dont-recommend", "report"],
];

/** "0.75", "1.0", "1.25", "1.5", "2.0" — the chip labels. */
export function speedChipLabel(s: number): string {
  return Number.isInteger(s) ? s.toFixed(1) : String(s);
}

/*
  TikTok's More card, with our rows: the playback controls first (Speed as
  an inline segmented control, Quality opening a sub-list in the same card,
  Auto scroll and Captions as switches, Theater mode), a divider, then the
  mapped rows moreMenuItems decides (pure, tested). Every row does
  something real. The playback rows keep the menu open; the rest close it.
  Colour is the on-video pair (--reel-stage / --reel-on-stage) through
  reels-screen.css (.reel-more-menu).
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
  onCopyLink,
  onDescription,
  onInterested,
  onToggleFollow,
  onBlock,
  onDelete,
  onClearScreen,
  onTheater,
  onNotInterested,
  onDontRecommend,
  onReport,
  anchor = "beside",
}: ReelMoreMenuProps) {
  const [pane, setPane] = useState<"root" | "quality">("root");
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

  const row = (key: MoreMenuItemKey) => {
    switch (key) {
      case "copy-link":
        return <Row key={key} icon={<Link2 />} label="Copy link" onClick={run(onCopyLink)} />;
      case "description":
        return <Row key={key} icon={<AlignLeft />} label="Description" onClick={run(onDescription)} />;
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
        return <Row key={key} icon={<CircleSlash />} label="Not interested" onClick={run(onNotInterested)} />;
      case "dont-recommend":
        return <Row key={key} icon={<UserX />} label={`Don't recommend ${handle}`} onClick={run(onDontRecommend)} />;
      case "report":
        return <Row key={key} icon={<Flag />} label="Report" danger onClick={run(onReport)} />;
      default:
        return null;
    }
  };

  // Visual groups: info · relationship · clear screen · feedback/report.
  const groups = MENU_GROUPS
    .map((g) => g.filter((k) => items.includes(k)))
    .filter((g) => g.length > 0);

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
      {pane === "quality" ? (
        <div className="reel-more-menu__list" data-pane="quality">
          <button type="button" className="reel-more-menu__row reel-more-menu__back" onClick={() => setPane("root")}>
            <span className="reel-more-menu__icon"><ChevronLeft /></span>
            <span className="reel-more-menu__label">Quality</span>
          </button>
          <Divider />
          <Option label="Auto" selected={prefs.quality === "auto"} onClick={() => onPrefsChange({ quality: "auto" })} />
          {rungs.map((h) => (
            <Option key={h} label={`${h}p`} selected={prefs.quality === `${h}p`} onClick={() => onPrefsChange({ quality: `${h}p` })} />
          ))}
          {rungs.length === 0 ? <p className="reel-more-menu__note">Only Auto is available for this reel.</p> : null}
        </div>
      ) : (
        <div className="reel-more-menu__list" data-pane="root">
          {/* 1. Speed: an inline segmented control; the row itself is not a menu item. */}
          <div className="reel-more-menu__row is-static" role="group" aria-label="Speed" data-row="speed">
            <span className="reel-more-menu__icon"><Gauge /></span>
            <span className="reel-more-menu__label">Speed</span>
            <span className="reel-more-menu__segmented" role="radiogroup" aria-label="Playback speed">
              {MENU_SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={prefs.speed === s}
                  className="reel-more-menu__chip"
                  onClick={() => onPrefsChange({ speed: s as Speed })}
                >
                  {speedChipLabel(s)}
                </button>
              ))}
            </span>
          </div>
          {/* 2. Quality: the current value, a chevron, and a sub-list in the same card. */}
          <button type="button" role="menuitem" aria-haspopup="menu" className="reel-more-menu__row" data-row="quality" onClick={() => setPane("quality")}>
            <span className="reel-more-menu__icon"><SlidersHorizontal /></span>
            <span className="reel-more-menu__label">Quality</span>
            <span className="reel-more-menu__value">
              {qualityLabel}
              <ChevronRight />
            </span>
          </button>
          {/* 3. Auto scroll: on → the next reel plays when this one ends; off → it loops. */}
          <SwitchRow
            icon={<ChevronsDown />}
            label="Auto scroll"
            dataRow="auto-scroll"
            on={prefs.onEnd === "next"}
            onToggle={() => onPrefsChange({ onEnd: prefs.onEnd === "next" ? "loop" : "next" })}
          />
          {/* 4. Theater mode (TikTok's Floating player slot). */}
          <Row icon={<Maximize />} label="Theater mode" hint="Full screen with comments · F" dataRow="theater" onClick={run(onTheater)} />
          {/* 5. Captions. */}
          <SwitchRow
            icon={<Captions />}
            label="Captions"
            dataRow="captions"
            hint={noCaptions ? "None for this reel" : undefined}
            disabled={noCaptions}
            on={prefs.captions}
            onToggle={() => onPrefsChange({ captions: !prefs.captions })}
          />
          <Divider />
          {groups.map((group, gi) => (
            <div key={group[0]}>
              {gi > 0 ? <Divider /> : null}
              {group.map(row)}
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}

function Divider() {
  return <div role="separator" className="reel-more-menu__divider" />;
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
      <span className="reel-more-menu__label">{label}</span>
      {selected ? <span className="reel-more-menu__value"><Check /></span> : null}
    </button>
  );
}

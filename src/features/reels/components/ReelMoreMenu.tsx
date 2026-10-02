"use client";

import { MENU_SPEEDS } from "@/features/reels/menu";
import type { ReelItem } from "@/features/reels/model";
import { clampSpeed, speedChipLabel, type PlayerPrefs, type PrefsPatch, type Speed } from "@/features/reels/playback/playerPrefs";
import { canUseSound } from "@/features/reels/sounds";
import { moreRows, renditionCount, type MoreRow } from "@/features/video-shell/moreRows";
import { speedValueLabel, VideoMoreMenu } from "@/features/video-shell/VideoMoreMenu";
export { MENU_SPEEDS, speedChipLabel, speedValueLabel };

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
  /** The viewer's playback preferences; the playback rows read and write them. */
  prefs: PlayerPrefs;
  onPrefsChange: (patch: PrefsPatch) => void;
  /** Heights the current manifest offers; one rung or none = no Quality row. */
  qualityHeights: number[];
  /** The reel has a caption track; without one there is no Captions row. */
  hasCaptions: boolean;
  /** Alternate audio for this reel (original first). One entry = no choice, row hidden. */
  audioTracks?: AudioTrackOption[];
  currentAudioTrack?: string;
  onAudioTrack?: (id: string) => void;
  /** Own reel: opens the creator's audio-tracks dialog. */
  onManageAudio?: () => void;
  /** A download link exists; absent = no Keep a copy row. */
  onKeep?: () => void;
  onCopyLink: () => void;
  onDescription: () => void;
  onShare: () => void;
  onBlock: () => void;
  onDelete: () => void;
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

/** The name in "Block <channel name>" and under "Don't recommend this channel". */
export function reelChannelName(reel: Pick<ReelItem, "authorName" | "authorUsername">): string {
  return reel.authorName || (reel.authorUsername ? `@${reel.authorUsername}` : "this channel");
}

/**
 * The reel's rows from the shared model (video-shell/moreRows.ts): the same
 * rows, words and rules as the long-video watch page, plus the reels
 * context rows (Auto scroll, Use this sound). There is no edit screen for a
 * reel, so the owner has Audio tracks and Delete but no Edit.
 */
export function reelMoreRows(
  reel: ReelItem,
  ctx: { isOwn: boolean; audioTrackCount: number; hasCaptions: boolean; qualityHeights: readonly number[]; canKeep: boolean; canManageAudio: boolean },
): MoreRow[] {
  return moreRows({
    surface: "reels",
    post: {
      channelName: reelChannelName(reel),
      hasDescription: Boolean(reel.caption) || reel.hashtags.length > 0,
      shareHidden: reel.shareHidden,
      downloadAllowed: reel.downloadAllowed,
      audioTrackCount: ctx.audioTrackCount,
      hasCaptions: ctx.hasCaptions,
      renditionCount: renditionCount(ctx.qualityHeights),
      usableSound: canUseSound(reel, ctx.isOwn),
    },
    viewer: { isOwner: ctx.isOwn },
    can: { keep: ctx.canKeep, edit: false, delete: true, manageAudio: ctx.canManageAudio },
  });
}

/*
  The reels stage's More card: the shared video More menu (VideoMoreMenu)
  with the reel's rows. Ascending alphabetical, always. The choice panes
  keep the menu open; the actions close it.
*/
export function ReelMoreMenu({
  open,
  onClose,
  reel,
  isOwn,
  prefs,
  onPrefsChange,
  qualityHeights,
  hasCaptions,
  audioTracks = [],
  currentAudioTrack = ORIGINAL_AUDIO_ID,
  onAudioTrack,
  onManageAudio,
  onKeep,
  onCopyLink,
  onDescription,
  onShare,
  onBlock,
  onDelete,
  onNotInterested,
  onDontRecommend,
  onReport,
  onUseSound,
  useSoundPending,
  anchor = "beside",
}: ReelMoreMenuProps) {
  const rows = reelMoreRows(reel, {
    isOwn,
    audioTrackCount: onAudioTrack ? audioTracks.length : 0,
    hasCaptions,
    qualityHeights,
    canKeep: Boolean(onKeep),
    canManageAudio: Boolean(onManageAudio),
  });

  return (
    <VideoMoreMenu
      open={open}
      onClose={onClose}
      anchor={anchor}
      rows={rows}
      channelName={reelChannelName(reel)}
      playback={{
        speed: prefs.speed,
        onSpeed: (s) => onPrefsChange({ speed: clampSpeed(s) as Speed }),
        quality: prefs.quality,
        qualityHeights,
        onQuality: (quality) => onPrefsChange({ quality: quality as PlayerPrefs["quality"] }),
        captions: { on: prefs.captions, onChange: (on) => onPrefsChange({ captions: on }) },
        audio: { options: audioTracks, current: currentAudioTrack, onChange: (id) => onAudioTrack?.(id) },
        autoScroll: { on: prefs.onEnd === "next", onToggle: () => onPrefsChange({ onEnd: prefs.onEnd === "next" ? "loop" : "next" }) },
      }}
      actions={{
        block: onBlock,
        "copy-link": onCopyLink,
        delete: onDelete,
        description: onDescription,
        "dont-recommend": onDontRecommend,
        keep: onKeep,
        "manage-audio": onManageAudio,
        "not-interested": onNotInterested,
        report: onReport,
        share: onShare,
        "use-sound": onUseSound,
      }}
      pending={{ "use-sound": useSoundPending }}
    />
  );
}

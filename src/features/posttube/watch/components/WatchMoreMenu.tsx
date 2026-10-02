"use client";

import { moreRows, renditionCount, type MoreRow } from "@/features/video-shell/moreRows";
import { VideoMoreMenu, type MoreActionKey, type MorePlayback, type VideoMoreMenuProps } from "@/features/video-shell/VideoMoreMenu";

/*
  The ⋯ menu in the action row: the shared video More menu (VideoMoreMenu)
  with this video's rows from the shared model (video-shell/moreRows.ts) —
  the same rows, words and rules as the reels stage. A viewer sees Audio
  track, Block, Captions, Copy link, Description, Don't recommend this
  channel, Not interested, Playback speed, Quality, Report, Save offline
  (only when the creator allows it; Remove offline copy once saved), Share;
  the owner loses the four feedback rows and gains Audio tracks, Delete,
  Edit and Save offline. The choice rows
  drive the same state as the player's own settings menu. The card hangs
  under the button; a bottom sheet on phones (the Popover does both).
*/

export interface WatchMoreInput {
  channelName: string;
  isOwner: boolean;
  /** Description text or hashtags exist. */
  hasDescription: boolean;
  shareHidden: boolean;
  downloadAllowed: boolean;
  /** The original counts as one. */
  audioTrackCount: number;
  hasCaptions: boolean;
  /** The manifest's rung heights, as the player reports them. */
  levels: readonly number[];
  /** A copy can be saved in the app here (storage works, signed in, the media id is known). */
  canOffline: boolean;
  /** A copy is stored on this device. */
  offlineSaved?: boolean;
  /** The audio-tracks dialog can open (the media id is known). */
  canManageAudio: boolean;
}

/** The watch page's rows from the shared model. Long video has an edit screen (the hub) and no reusable sound. */
export function watchMoreRows(v: WatchMoreInput): MoreRow[] {
  return moreRows({
    surface: "watch",
    post: {
      channelName: v.channelName,
      hasDescription: v.hasDescription,
      shareHidden: v.shareHidden,
      downloadAllowed: v.downloadAllowed,
      offlineSaved: v.offlineSaved,
      audioTrackCount: v.audioTrackCount,
      hasCaptions: v.hasCaptions,
      renditionCount: renditionCount(v.levels),
      usableSound: false,
    },
    viewer: { isOwner: v.isOwner },
    can: { offline: v.canOffline, edit: true, delete: true, manageAudio: v.canManageAudio },
  });
}

export interface WatchMoreMenuProps {
  open: boolean;
  onClose: () => void;
  rows: readonly MoreRow[];
  channelName: string;
  /** The player's state: the same prefs, caption language and audio choice its settings menu drives. */
  playback: MorePlayback;
  actions: Partial<Record<MoreActionKey, () => void>>;
  /** The Save offline row's state. */
  offline?: VideoMoreMenuProps["offline"];
}

export function WatchMoreMenu({ open, onClose, rows, channelName, playback, actions, offline }: WatchMoreMenuProps) {
  return <VideoMoreMenu open={open} onClose={onClose} anchor="below" className="tube-more-menu" rows={rows} channelName={channelName} playback={playback} actions={actions} offline={offline} />;
}

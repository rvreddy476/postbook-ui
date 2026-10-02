/*
  The More options menu of a video, as data — ONE model for the reels stage
  and the long-video watch page (the founder's rule, 2 Oct 2026: "web reels
  and long video should match each other"). Pure, so the tests pin every
  rule down without rendering.

  Shared rows — the same on both surfaces, by the same rule:
    Audio track     only when the video has more than one audio track
    Block <channel> never on your own content
    Captions        only when the video has captions
    Copy link       always
    Description     only when there is a description (text or hashtags)
    Don't recommend this channel / Not interested / Report
                    never on your own content
    Playback speed  always
    Quality         only when there is more than one rendition
    Share           hidden when the post has sharing off

  Context rows — the only allowed differences:
    Auto scroll     reels only (a property of the reels stage)
    Use this sound  a reel that has a usable sound
    Keep a copy     the post allows download, or you own it
    Audio tracks / Delete / Edit
                    your own content, where that screen exists

  The rows come back in ascending alphabetical order of their label.
*/

export type MoreSurface = "reels" | "watch";

export type MoreRowKey =
  | "audio"
  | "auto-scroll"
  | "block"
  | "captions"
  | "copy-link"
  | "delete"
  | "description"
  | "dont-recommend"
  | "edit"
  | "keep"
  | "manage-audio"
  | "not-interested"
  | "quality"
  | "report"
  | "share"
  | "speed"
  | "use-sound";

export interface MorePost {
  /** The name in "Block <channel name>". */
  channelName: string;
  /** Description text or hashtags exist. */
  hasDescription: boolean;
  /** The creator turned sharing off. */
  shareHidden: boolean;
  /** The creator allows downloads. */
  downloadAllowed: boolean;
  /** The original counts as one. */
  audioTrackCount: number;
  hasCaptions: boolean;
  /** Distinct renditions the player can choose between. */
  renditionCount: number;
  /** The video carries a sound that may be reused (reels: canUseSound). */
  usableSound: boolean;
}

export interface MoreViewer {
  /** The viewer owns this content. */
  isOwner: boolean;
}

/** What this surface can actually do: a context row with no screen or call behind it is left out. */
export interface MoreCapabilities {
  /** A download link exists for this video. */
  keep: boolean;
  /** An edit screen exists for this kind of video. */
  edit: boolean;
  delete: boolean;
  /** The creator's audio-tracks dialog can open for this video. */
  manageAudio: boolean;
}

export interface MoreRowsInput {
  surface: MoreSurface;
  post: MorePost;
  viewer: MoreViewer;
  can: MoreCapabilities;
}

export interface MoreRow {
  key: MoreRowKey;
  label: string;
  /** "shared" rows are identical on both surfaces; "context" rows are the allowed differences. */
  kind: "shared" | "context";
}

/** Distinct, real rungs in a manifest's heights. */
export function renditionCount(heights: readonly number[]): number {
  return new Set(heights.filter((h) => h > 0)).size;
}

export function compareMoreLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function moreRows({ surface, post, viewer, can }: MoreRowsInput): MoreRow[] {
  const rows: MoreRow[] = [];
  const shared = (key: MoreRowKey, label: string) => rows.push({ key, label, kind: "shared" });
  const context = (key: MoreRowKey, label: string) => rows.push({ key, label, kind: "context" });
  const own = viewer.isOwner;

  if (post.audioTrackCount > 1) shared("audio", "Audio track");
  if (!own) shared("block", `Block ${post.channelName}`);
  if (post.hasCaptions) shared("captions", "Captions");
  shared("copy-link", "Copy link");
  if (post.hasDescription) shared("description", "Description");
  if (!own) shared("dont-recommend", "Don't recommend this channel");
  if (!own) shared("not-interested", "Not interested");
  shared("speed", "Playback speed");
  if (post.renditionCount > 1) shared("quality", "Quality");
  if (!own) shared("report", "Report");
  if (!post.shareHidden) shared("share", "Share");

  if (surface === "reels") context("auto-scroll", "Auto scroll");
  if (surface === "reels" && post.usableSound) context("use-sound", "Use this sound");
  if (can.keep && (post.downloadAllowed || own)) context("keep", "Keep a copy");
  if (own && can.manageAudio) context("manage-audio", "Audio tracks");
  if (own && can.delete) context("delete", "Delete");
  if (own && can.edit) context("edit", "Edit");

  return rows.sort((a, b) => compareMoreLabels(a.label, b.label));
}

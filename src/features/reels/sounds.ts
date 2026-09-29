import {
  mediaHref,
  toReelItem,
  toReelItems,
  toReelSound,
  type FeedReelPost,
  type ReelItem,
  type ReelSound,
} from "@/features/reels/model";

/*
  Original sounds: a reel can play the audio of another creator's public
  reel. This file holds what the screens share — where a sound lives, what
  it is called, who may reuse one, and the shapes of the three sound
  answers — all pure, so the rules are pinned by tests.

    GET  /v1/audio/:id/serve            the bytes, for an <audio> element (cookies ride along)
    GET  /v1/audio/:id                  the sound row (media-service spelling)
    POST /v1/posts/:postId/sound        "use this sound": { sound }
    GET  /v1/posts/by-sound/:soundId    { sound, origin, items } + meta.next_cursor

  A sound is answered only to a viewer who may watch its source video; a
  refusal is a 404, the same as a missing one, and is shown as one.
*/

/* ── where things live ─────────────────────────────────────── */

/** The sound's bytes. Re-gated on every request, so there is no expiry to handle. */
export function soundServeHref(soundId: string): string {
  return mediaHref(`/v1/audio/${encodeURIComponent(soundId)}/serve`);
}

export function soundPageHref(soundId: string): string {
  return `/reels/sound/${encodeURIComponent(soundId)}`;
}

/** The studio with a sound preselected. */
export function createWithSoundHref(soundId: string): string {
  return `/reels/create?sound=${encodeURIComponent(soundId)}`;
}

export function reelStageHref(reelId: string): string {
  return `/reels?reelId=${encodeURIComponent(reelId)}`;
}

/**
  The sign-in page, returning to `returnTo` afterwards. Both spellings are
  set, as the route gate does: `next` is the gate's parameter, `redirect`
  is the one the login page reads today.
*/
export function signInHref(returnTo: string): string {
  const to = encodeURIComponent(returnTo);
  return `/login?next=${to}&redirect=${to}`;
}

/* ── words ─────────────────────────────────────────────────── */

/** What a reel with no added sound calls its own audio. */
export function originalSoundLabel(authorName: string): string {
  const name = authorName.trim();
  return name ? `Original sound - ${name}` : "Original sound";
}

/** "1 reel", "12 reels"; "No reels yet" at zero. */
export function soundReelCount(count: number): string {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (n === 0) return "No reels yet";
  return `${n.toLocaleString("en-US")} reel${n === 1 ? "" : "s"}`;
}

/* ── who may reuse a sound ─────────────────────────────────── */

type SoundSubject = Pick<ReelItem, "id" | "sound" | "soundReuseAllowed" | "isProcessing">;

/**
  Whether "Use this sound" is offered. A reel that plays an added sound
  offers that sound (the viewer already hears it). Otherwise the reel's own
  audio is offered when the creator allows reuse, or always to its author;
  never while the reel is still processing (there is nothing to take yet).
*/
export function canUseSound(reel: Pick<SoundSubject, "sound" | "soundReuseAllowed" | "isProcessing">, isOwn: boolean): boolean {
  if (reel.sound) return true;
  if (reel.isProcessing) return false;
  return isOwn || reel.soundReuseAllowed === true;
}

/** Where "use this sound" ends: the studio, or the sound's own page. */
export type SoundIntent = "create" | "page";

export function soundDestination(intent: SoundIntent, soundId: string): string {
  return intent === "create" ? createWithSoundHref(soundId) : soundPageHref(soundId);
}

export type SoundStep =
  /** Signed out: go and sign in, coming back to `returnTo`. */
  | { kind: "sign-in"; href: string }
  /** The sound is known: go there. */
  | { kind: "open"; href: string }
  /** The reel's own audio: ask the server for its sound first (POST /v1/posts/:id/sound). */
  | { kind: "resolve"; postId: string };

/**
  The next step when a viewer asks to use a reel's sound. Making a reel
  and taking a sound from one both need an account, so a signed-out viewer
  is sent to sign in: back to the studio when the sound is already known,
  back to the reel when it is not. Opening the page of a sound the reel
  already plays is a plain link and needs nothing.
*/
export function nextSoundStep(input: { reel: Pick<SoundSubject, "id" | "sound">; signedIn: boolean; intent: SoundIntent }): SoundStep {
  const { reel, signedIn, intent } = input;
  if (reel.sound) {
    if (intent === "create") {
      const href = studioHrefForSound(reel.sound.id, signedIn);
      return signedIn ? { kind: "open", href } : { kind: "sign-in", href };
    }
    return { kind: "open", href: soundPageHref(reel.sound.id) };
  }
  if (!signedIn) return { kind: "sign-in", href: signInHref(reelStageHref(reel.id)) };
  return { kind: "resolve", postId: reel.id };
}

/**
  Where "Use this sound" goes once the sound is known (the sound's page):
  the studio, or sign-in first for a signed-out viewer, returning to the
  studio with the sound still chosen.
*/
export function studioHrefForSound(soundId: string, signedIn: boolean): string {
  const studio = createWithSoundHref(soundId);
  return signedIn ? studio : signInHref(studio);
}

/** The line shown when "use this sound" is refused, by the server's code. */
export function soundRefusalMessage(code: string | null | undefined): string {
  switch (code) {
    case "SOUND_REUSE_NOT_ALLOWED":
      return "The creator has turned off reuse for this reel.";
    case "NOT_READY":
      return "This reel is still processing. Try again in a moment.";
    case "TOO_LONG":
    case "NOT_A_REEL":
    case "NOT_A_VIDEO":
      return "Only reels up to 5 minutes can be used as a sound.";
    case "NO_AUDIO":
      return "This reel has no sound to use.";
    case "NOT_FOUND":
    case "404":
      return "This reel is no longer available.";
    case "RATE_LIMITED":
      return "That is a lot of sounds in one hour. Try again later.";
    default:
      return "Please try again.";
  }
}

/* ── the three answers ─────────────────────────────────────── */

function record(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

/** POST /v1/posts/:postId/sound → `{ sound }`. null when the answer carries no usable sound. */
export function soundFromUseResponse(data: unknown): ReelSound | null {
  return toReelSound(record(data)?.sound);
}

/** A sound as the studio and the sound page hold it: the row plus what media-service adds. */
export interface SoundInfo extends ReelSound {
  isOriginal: boolean;
  creatorUserId: string | null;
}

const USABLE_STATUS = new Set(["", "ready", "active"]);

/**
  GET /v1/audio/:id → the media-service row (usage_count, source_post_id /
  source_reel_id). null when it is no sound, or one that is not ready to be
  played; an absent or empty status is taken as ready.
*/
export function toSoundInfo(raw: unknown): SoundInfo | null {
  const o = record(raw);
  const sound = toReelSound(o);
  if (!o || !sound) return null;
  const status = typeof o.status === "string" ? o.status.trim().toLowerCase() : "";
  if (!USABLE_STATUS.has(status)) return null;
  const creator = typeof o.creator_user_id === "string" ? o.creator_user_id.trim() : "";
  return { ...sound, startMs: 0, isOriginal: o.is_original === true, creatorUserId: creator || null };
}

export interface SoundReelsPage {
  /** The sound itself; on every page. null only when the answer is malformed. */
  sound: ReelSound | null;
  /** The reel the sound was taken from: first page only, and only when this viewer may read it. */
  origin: ReelItem | null;
  items: ReelItem[];
  nextCursor: string | undefined;
}

/** GET /v1/posts/by-sound/:soundId → the page. The origin is never repeated among the items. */
export function toSoundReelsPage(data: unknown, meta?: unknown): SoundReelsPage {
  const o = record(data);
  const originRow = record(o?.origin);
  const origin = originRow && typeof originRow.id === "string" && originRow.id ? toReelItem(originRow as unknown as FeedReelPost) : null;
  const rows = Array.isArray(o?.items) ? (o.items as unknown[]).filter((r): r is FeedReelPost => Boolean(record(r)) && typeof (r as { id?: unknown }).id === "string") : [];
  const cursor = record(meta)?.next_cursor;
  return {
    sound: toReelSound(o?.sound),
    origin,
    items: toReelItems(rows).filter((item) => item.id !== origin?.id),
    // Go zero values: an empty cursor is the end, like an absent one.
    nextCursor: typeof cursor === "string" && cursor ? cursor : undefined,
  };
}

/** Every page's tiles in order, the origin first, nothing twice. */
export function soundReelTiles(pages: readonly SoundReelsPage[] | null | undefined): { reel: ReelItem; isOrigin: boolean }[] {
  const out: { reel: ReelItem; isOrigin: boolean }[] = [];
  const seen = new Set<string>();
  const origin = pages?.[0]?.origin ?? null;
  if (origin) {
    seen.add(origin.id);
    out.push({ reel: origin, isOrigin: true });
  }
  for (const page of pages ?? []) {
    for (const reel of page.items) {
      if (seen.has(reel.id)) continue;
      seen.add(reel.id);
      out.push({ reel, isOrigin: false });
    }
  }
  return out;
}

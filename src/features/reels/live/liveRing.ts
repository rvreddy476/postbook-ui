import { liveWatchHref, type LiveCreatorRow } from "@/features/live/discovery";

/*
  The LIVE ring on a creator's avatar in the reels UI. A creator is ringed
  only when GET /creators/live lists them (that list holds status "live"
  streams only), whatever the stream's shape: a portrait stream opens in the
  Reels Live tab, a landscape one in PostTube. No entry, no ring — an
  unknown answer is never drawn as live.
*/

/** Where the ring leads; "" means no ring. */
export function reelLiveHref(authorId: string | null | undefined, live: ReadonlyMap<string, LiveCreatorRow> | null | undefined): string {
  if (!authorId || !live) return "";
  const row = live.get(authorId);
  if (!row || !row.stream_id) return "";
  return liveWatchHref({ id: row.stream_id, orientation: row.orientation });
}

/** The accessible name of a ringed avatar. */
export function liveRingLabel(name: string): string {
  return `${name || "This creator"} is live. Watch now`;
}

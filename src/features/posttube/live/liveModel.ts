import { isLive, pickHero, type StreamRow } from "@/features/live/discovery";

/*
  PostTube's own rules for the Live page. Pure: no React, no requests.
  PostTube is the wide surface, so its Live page lists landscape streams;
  portrait ones belong to the Reels Live tab.
*/

export const LIVE_PAGE_ORIENTATION = "landscape" as const;

export type LiveFilter = "all" | "following";

/** Live now on PostTube: status "live" and landscape, nothing else. */
export function landscapeLive(rows: readonly StreamRow[]): StreamRow[] {
  return rows.filter((r) => isLive(r) && r.orientation === LIVE_PAGE_ORIENTATION);
}

/** The hero (the most watched) and the grid without it, so no stream is drawn twice. */
export function splitHero(rows: readonly StreamRow[]): { hero: StreamRow | null; rest: StreamRow[] } {
  const live = landscapeLive(rows);
  const hero = pickHero(live);
  return { hero, rest: hero ? live.filter((r) => r.id !== hero.id) : live };
}

export interface EmptyCopy {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}

/**
 * What the page says when there is nothing to show. A signed-in viewer is
 * invited to go live (the go-live form answers a creator who is outside
 * the pilot); a signed-out one is only told nothing is live. Following
 * without an account asks for sign-in.
 */
export function liveEmptyCopy(input: { filter: LiveFilter; signedIn: boolean }): EmptyCopy {
  if (input.filter === "following") {
    if (!input.signedIn) {
      return { title: "Sign in to see who you follow", body: "Streams from the channels you subscribe to and the people you follow show here.", actionHref: "/login?next=%2Fposttube%2Flive", actionLabel: "Sign in" };
    }
    return { title: "Nobody you follow is live right now", body: "Streams from the channels you subscribe to show here the moment they start." };
  }
  if (input.signedIn) {
    return { title: "Nobody is live right now", body: "Streams show here the moment they start. You could be first.", actionHref: "/live/new", actionLabel: "Go live" };
  }
  return { title: "Nobody is live right now", body: "Streams show here the moment they start." };
}

/*
  Products that are built but not launched.

  Launch is four products: Social, Shorts (Reels), Long video (PostTube)
  and Commerce (MStore). Everything else is PARKED: its pages are still
  served, but no navigation offers a way in until it launches.

  PARKED_NAV_IDS is the ONE list. Every way in reads it: the rail and its
  More menu (components/sidebarNav.ts), the "Explore VChat" launcher and
  the per-app rail (lib/appBrand.ts), and the Home destinations. Take an
  id out of it and every entry for that product comes back where it was.

  The ids are the rail's own ids (sidebarNav). Other surfaces key their
  entries differently (the launcher says "match" for Pulse, and Groups
  also owns Communities), so APP_KEYS_BY_NAV_ID says which app keys each
  parked id covers. Pure: no client imports.
*/

/** Entries hidden until their product launches. Pages stay; only the ways in go. */
export const PARKED_NAV_IDS: ReadonlySet<string> = new Set([
  'Groups', // Groups (and Communities inside it)
  'Ask', // Q&A
  'Pages', // business pages
  'Feast', // food delivery
  'Doorstep', // home services
  'PostMatch', // Pulse (dating)
  'Memories',
])

/** The app keys (lib/appBrand.ts brands and launcher tiles) each rail id stands for. */
export const APP_KEYS_BY_NAV_ID: Readonly<Record<string, readonly string[]>> = {
  Groups: ['groups', 'communities'],
  Ask: ['ask'],
  Pages: ['pages'],
  Feast: ['feast'],
  Doorstep: ['doorstep'],
  PostMatch: ['match'],
  Memories: ['memories'],
}

/** Every app key covered by a parked id. */
export function parkedAppKeys(parked: ReadonlySet<string> = PARKED_NAV_IDS): Set<string> {
  const keys = new Set<string>()
  for (const id of parked) for (const key of APP_KEYS_BY_NAV_ID[id] ?? []) keys.add(key)
  return keys
}

/** True when an app key (a brand or a launcher tile) belongs to a parked product. */
export function isParkedAppKey(key: string, parked: ReadonlySet<string> = PARKED_NAV_IDS): boolean {
  return parkedAppKeys(parked).has(key)
}

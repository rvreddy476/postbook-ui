/*
  Pure reorder helpers for a collection's rows. The server's move route
  takes a 0-based target index and re-writes the whole order, so the
  client mirrors exactly that: take the row at `from`, drop it in at `to`,
  renumber. Rollback is the snapshot taken before the optimistic move.
*/

export interface Positioned {
  postId: string;
  position: number;
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), length - 1);
}

/** Moves the row at `from` to `to` and renumbers positions 0..n-1. A no-op returns the same array. */
export function moveIndex<T extends Positioned>(list: readonly T[], from: number, to: number): T[] {
  const n = list.length;
  if (n === 0) return [];
  const f = clampIndex(from, n);
  const t = clampIndex(to, n);
  if (f === t) return list as T[];
  const next = list.slice();
  const [moved] = next.splice(f, 1);
  next.splice(t, 0, moved);
  return renumber(next);
}

/** Moves the row with `postId` by `delta` places (-1 = up, +1 = down). Unknown ids and edges are no-ops. */
export function moveBy<T extends Positioned>(list: readonly T[], postId: string, delta: number): T[] {
  const from = list.findIndex((r) => r.postId === postId);
  if (from < 0) return list as T[];
  return moveIndex(list, from, from + delta);
}

export function renumber<T extends Positioned>(list: readonly T[]): T[] {
  return list.map((row, i) => (row.position === i ? row : { ...row, position: i }));
}

/** The index of `postId` in a list, or -1. */
export function indexOfPost(list: readonly Positioned[], postId: string): number {
  return list.findIndex((r) => r.postId === postId);
}

/**
 * A move plan the mutation can act on: the optimistic list to show, the
 * `position` the server wants, and the snapshot to restore on failure.
 * Returns null when the move changes nothing.
 */
export function planMove<T extends Positioned>(list: readonly T[], postId: string, to: number): { optimistic: T[]; position: number; rollback: T[] } | null {
  const from = indexOfPost(list, postId);
  if (from < 0) return null;
  const position = clampIndex(to, list.length);
  if (position === from) return null;
  return { optimistic: moveIndex(list, from, position), position, rollback: list.slice() };
}

/**
 * Reconciles the server's returned order (post ids and positions only) with
 * the hydrated rows already on screen, so a successful move never drops a
 * thumbnail. Ids the server no longer has are dropped; ids it added since
 * the last read are kept, unhydrated.
 */
export function reconcileOrder<T extends Positioned>(server: readonly T[], local: readonly T[]): T[] {
  const byId = new Map(local.map((r) => [r.postId, r] as const));
  return renumber(
    server.map((s) => {
      const known = byId.get(s.postId);
      return known ? { ...known, ...pickFilled(s) } : s;
    }),
  );
}

function pickFilled<T extends Positioned>(row: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

/*
  The swipe viewer over a chat's shared posts (CONTRACT §1.4, §9): which ids
  it walks, where it starts, how far a step may go, and which posts it still
  has to read. Pure, so the order and the paging rules are pinned by tests.

  The server's list (newest first) wins when it holds the tapped post, and
  only then may the viewer page forward with its cursor; otherwise the ids
  the thread already knows are walked as given, with the tapped one kept.
*/

/** Distinct, non-empty ids in their first order. */
export function uniqueIds(ids: ReadonlyArray<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export interface ViewerList {
  ids: string[]
  /** True when the list came from the server, so its cursor may extend it. */
  pageable: boolean
}

/**
 * The list the viewer walks. `fetched` is null when the shared route is
 * missing (or failed); `given` is what the thread passed in.
 */
export function initialViewerList(
  fetched: ReadonlyArray<string> | null,
  given: ReadonlyArray<string> | undefined,
  startPostId: string,
): ViewerList {
  const server = fetched ? uniqueIds(fetched) : []
  if (server.includes(startPostId)) return { ids: server, pageable: true }
  const local = uniqueIds(given ?? [])
  if (local.includes(startPostId)) return { ids: local, pageable: false }
  return { ids: uniqueIds([startPostId, ...local]), pageable: false }
}

/** Where the viewer opens: the tapped post, else the first. */
export function startIndexOf(ids: ReadonlyArray<string>, startPostId: string): number {
  const i = ids.indexOf(startPostId)
  return i < 0 ? 0 : i
}

/** One step (±1) from `index`, held inside the list. */
export function stepIndex(index: number, delta: number, length: number): number {
  if (length <= 0) return 0
  const next = index + (delta > 0 ? 1 : delta < 0 ? -1 : 0)
  return Math.min(Math.max(next, 0), length - 1)
}

export function canStep(index: number, delta: number, length: number): boolean {
  if (delta > 0) return index < length - 1
  if (delta < 0) return index > 0 && length > 0
  return false
}

/** Append a further page, keeping order and dropping repeats. */
export function appendIds(ids: ReadonlyArray<string>, more: ReadonlyArray<string>): string[] {
  return uniqueIds([...ids, ...more])
}

export const PREFETCH_BEHIND = 1
export const PREFETCH_AHEAD = 4
export const LOAD_MORE_WITHIN = 3
/** POST /v1/posts/batch reads at most 100 ids. */
export const BATCH_MAX = 100

/** Ids around `index` that have not been asked for yet (current first). */
export function idsToHydrate(
  ids: ReadonlyArray<string>,
  index: number,
  asked: ReadonlySet<string>,
  behind = PREFETCH_BEHIND,
  ahead = PREFETCH_AHEAD,
): string[] {
  if (ids.length === 0) return []
  const at = Math.min(Math.max(index, 0), ids.length - 1)
  const order: number[] = [at]
  for (let d = 1; d <= Math.max(behind, ahead); d++) {
    if (d <= ahead && at + d < ids.length) order.push(at + d)
    if (d <= behind && at - d >= 0) order.push(at - d)
  }
  return uniqueIds(order.map((i) => ids[i]).filter((id) => !asked.has(id))).slice(0, BATCH_MAX)
}

/** Ask the server for the next page when the viewer is near the end of what it has. */
export function shouldLoadMore(index: number, length: number, list: { pageable: boolean; cursor: string | null; loading: boolean }): boolean {
  if (!list.pageable || !list.cursor || list.loading) return false
  return length - 1 - index < LOAD_MORE_WITHIN
}

export type ViewerEntry<R> =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'unavailable' }
  | { kind: 'row'; row: R }

/**
 * What one slot shows. A post the batch was asked for and did not return is
 * unavailable (deleted, hidden, private, blocked) — never a guess at it.
 */
export function viewerEntry<R>(
  id: string,
  rows: ReadonlyMap<string, R>,
  asked: ReadonlySet<string>,
  failed: ReadonlySet<string>,
): ViewerEntry<R> {
  const row = rows.get(id)
  if (row) return { kind: 'row', row }
  if (failed.has(id)) return { kind: 'error' }
  if (asked.has(id)) return { kind: 'unavailable' }
  return { kind: 'loading' }
}

/** Wheel deltas add up to one step at this much travel. */
export const WHEEL_STEP = 60
export const SWIPE_STEP = 48

/** Accumulate a wheel delta: the step to take (0, ±1) and what is carried over. */
export function wheelStep(acc: number, deltaY: number): { step: number; acc: number } {
  const next = acc + deltaY
  if (Math.abs(next) >= WHEEL_STEP) return { step: next > 0 ? 1 : -1, acc: 0 }
  return { step: 0, acc: next }
}

/** A vertical swipe (end − start, in px): up moves on, down goes back. */
export function swipeStep(dy: number): number {
  if (Math.abs(dy) < SWIPE_STEP) return 0
  return dy < 0 ? 1 : -1
}

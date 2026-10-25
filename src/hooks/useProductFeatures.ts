'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import api from '@/lib/api'
import {
  hiddenAppKeys,
  hiddenNavIds,
  parseFeatures,
  productEntryVisible,
  productPageAvailable,
  type FeatureState,
  type ProductKey,
} from '@/lib/productFeatures'

/*
  GET /v1/features, read once per session and kept in memory (lib/
  productFeatures.ts says what the answer means). It is read again only when
  the tab comes back into focus and the last read is ten minutes old, the
  same rhythm as the Android client's resume. One request at a time; every
  surface shares the one answer.

  Until the route answers, and whenever it fails, the state is null: the
  client's built-in default (the parked list; broadcast channels and
  communities hidden).
*/

export const FEATURES_PATH = '/v1/features'
export const FEATURES_REFRESH_MS = 10 * 60 * 1000

export interface FeatureSnapshot {
  /** The route's flags, or null (not answered yet, or failed). */
  state: FeatureState
  /** The route has answered or failed at least once. */
  settled: boolean
}

export interface FeatureStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => FeatureSnapshot
  /** Read the route unless a read is in flight or the last one is under ten minutes old. */
  ensure: () => Promise<void>
}

export function createFeatureStore(fetchBody: () => Promise<unknown>, now: () => number = Date.now): FeatureStore {
  let snapshot: FeatureSnapshot = { state: null, settled: false }
  let readAt: number | null = null
  let inflight: Promise<void> | null = null
  const listeners = new Set<() => void>()

  const set = (next: FeatureSnapshot) => {
    snapshot = next
    listeners.forEach((listener) => listener())
  }

  const ensure = (): Promise<void> => {
    if (inflight) return inflight
    if (readAt !== null && now() - readAt < FEATURES_REFRESH_MS) return Promise.resolve()
    readAt = now()
    inflight = (async () => {
      try {
        const flags = parseFeatures(await fetchBody())
        // A body that is not the features document counts as a failure; a
        // refresh that fails keeps the last answer rather than reopening
        // nothing or closing everything.
        set({ state: flags ?? snapshot.state, settled: true })
      } catch {
        set({ state: snapshot.state, settled: true })
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    ensure,
  }
}

const store = createFeatureStore(async () => (await api.get(FEATURES_PATH)).data)
const SERVER_SNAPSHOT: FeatureSnapshot = { state: null, settled: false }

let focusWired = false
function wireFocus() {
  if (focusWired || typeof window === 'undefined') return
  focusWired = true
  const onFocus = () => { if (document.visibilityState !== 'hidden') void store.ensure() }
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onFocus)
}

/** The shared features answer; starts the read on first use. */
export function useProductFeatures(): FeatureSnapshot {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => SERVER_SNAPSHOT)
  useEffect(() => {
    wireFocus()
    void store.ensure()
  }, [])
  return snapshot
}

/** May a way into this product (a lane, a menu row, a tile) be shown? */
export function useProductEntryVisible(product: ProductKey): boolean {
  return productEntryVisible(product, useProductFeatures().state)
}

/**
 * Is this product open at all (the page rule, without the loading state)?
 * For a launched surface's lane into a product, such as the messenger's
 * Groups lane: hidden when the gateway closes the product, whatever the
 * parked list says, because the lane is messaging, not the product's hub.
 */
export function useProductOpen(product: ProductKey): boolean {
  return productPageAvailable(product, useProductFeatures().state)
}

/** Rail ids and app keys to leave out right now. */
export function useHiddenProducts(): { navIds: ReadonlySet<string>; appKeys: ReadonlySet<string>; state: FeatureState } {
  const { state } = useProductFeatures()
  return useMemo(() => ({ navIds: hiddenNavIds(state), appKeys: hiddenAppKeys(state), state }), [state])
}

/** A direct visit: 'loading' until the route has answered once, then whether the page may render. */
export function useProductPage(product: ProductKey | null): 'loading' | 'open' | 'closed' {
  const { state, settled } = useProductFeatures()
  if (!product) return 'open'
  if (!settled) return 'loading'
  return productPageAvailable(product, state) ? 'open' : 'closed'
}

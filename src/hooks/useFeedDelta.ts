import { useState, useEffect, useCallback, useRef } from 'react'
import api from '@/lib/api'

interface FeedDeltaResult {
  newCount: number
  newestAnchor: string
  hasMore: boolean
  new_count?: number
  newest_anchor?: string
}

interface UseFeedDeltaOptions {
  /*
    The viewer's own feeds only. feed-service dropped the group, channel,
    community and space counts: they ran with no membership check, so any
    signed-in user could watch a private group's activity.
  */
  feedType: 'home' | 'following' | 'flicks' | 'posttube'
  enabled?: boolean
  /** Overrides the feed type's interval below. */
  intervalMs?: number
}

/*
  Polling intervals per feed type (ms).

  home and following are TEN MINUTES, at the founder's request: the banner
  should not interrupt for each post as it arrives. Checking every 15 seconds
  turned it into a live ticker that grew by one while you were reading, which
  is exactly the nagging a "catch up when you want to" affordance is supposed
  to avoid. Ten minutes makes it a periodic invitation instead.

  The count is still accurate whenever it does appear — the server counts
  everything since the anchor, so a longer interval means a later banner, never
  a smaller number. Refreshing the page always shows the current state.

  following is ONE MINUTE (founder, 18 Oct): it no longer drives a banner but
  the small dot on the Following tab of the full-screen feed, which is quiet
  however often it is checked. The caller turns polling off while Following
  is the tab on screen, and no poll is sent while the page is hidden.
*/
export const POLL_INTERVALS: Record<UseFeedDeltaOptions['feedType'], number> = {
  home: 600000,
  following: 60000,
  flicks: 20000,
  posttube: 60000,
}

export function useFeedDelta(options: UseFeedDeltaOptions) {
  const { feedType, enabled = true, intervalMs } = options
  const [newCount, setNewCount] = useState(0)
  const [newestAnchor, setNewestAnchor] = useState<string | null>(null)
  const anchorRef = useRef<string | null>(null)
  /*
    The polling effect below is guarded on having an anchor, and the anchor
    lives in a REF — so setting it changed no dependency, the effect never
    re-ran, and the interval was never started. The hook could not poll at
    all. This mirrors the ref into state purely so the effect has something
    to depend on; the ref stays the value the request reads, because
    consumeNew has to advance it without waiting for a render.
  */
  const [hasAnchor, setHasAnchor] = useState(false)
  /*
    Bumped by setAnchor and consumeNew. A check that was in flight when the
    caller cleared the count must not put the old count back when it lands.
  */
  const generationRef = useRef(0)

  const checkDelta = useCallback(async () => {
    if (!anchorRef.current) return
    // A hidden tab asks nothing; the next tick after it returns does.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    const generation = generationRef.current
    try {
      const params = new URLSearchParams({
        feed_type: feedType,
        anchor: anchorRef.current,
      })

      const res = await api.get<{ data: FeedDeltaResult }>(`/v1/feed/delta?${params}`)
      const data = res.data.data
      if (data && generation === generationRef.current) {
        setNewCount(data.newCount ?? data.new_count ?? 0)
        // The newest counted item's created_at (the server now returns a
        // timestamp, a valid anchor). Still NOT used as the next anchor —
        // see consumeNew.
        const anchor = data.newestAnchor ?? data.newest_anchor
        if (anchor) {
          setNewestAnchor(anchor)
        }
      }
    } catch {
      // silently fail — delta is non-critical
    }
  }, [feedType])

  // Set initial anchor
  const setAnchor = useCallback((anchor: string) => {
    anchorRef.current = anchor
    generationRef.current += 1
    setHasAnchor(true)
    setNewCount(0)
  }, [])

  /*
    Consume new items: clear the count and let the CALLER re-anchor.

    This used to set the anchor to the response's `newest_anchor`, which was
    then a post ID; the server parses the anchor as an RFC3339 timestamp, so
    the first tap poisoned the anchor and every poll after it failed (the
    hook swallows errors, so the count simply stopped updating). The server
    now returns a timestamp there, and answers a bad anchor with 400.

    Anchoring from the newest post the caller has actually RENDERED is also
    the more honest measure: it counts from what the reader has seen, not from
    what the server last knew about.
  */
  const consumeNew = useCallback(() => {
    generationRef.current += 1
    setNewCount(0)
  }, [])

  // Polling
  useEffect(() => {
    if (!enabled || !hasAnchor) return
    const interval = intervalMs ?? POLL_INTERVALS[feedType] ?? 30000
    const timer = setInterval(checkDelta, interval)
    return () => clearInterval(timer)
  }, [enabled, hasAnchor, feedType, checkDelta, intervalMs])

  return { newCount, setAnchor, consumeNew, checkDelta }
}

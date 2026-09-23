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
  feedType: 'home' | 'following' | 'group' | 'group_channel' | 'channel' | 'community' | 'community_space' | 'flicks' | 'posttube'
  groupId?: string
  channelId?: string
  communityId?: string
  spaceId?: string
  enabled?: boolean
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
*/
const POLL_INTERVALS: Record<string, number> = {
  home: 600000,
  following: 600000,
  group: 30000,
  group_channel: 30000,
  channel: 30000,
  community: 30000,
  community_space: 45000,
  flicks: 20000,
  posttube: 60000,
}

export function useFeedDelta(options: UseFeedDeltaOptions) {
  const { feedType, groupId, channelId, communityId, spaceId, enabled = true } = options
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

  const checkDelta = useCallback(async () => {
    if (!anchorRef.current) return
    try {
      const params = new URLSearchParams({
        feed_type: feedType,
        anchor: anchorRef.current,
      })
      if (groupId) params.set('group_id', groupId)
      if (channelId) params.set('channel_id', channelId)
      if (communityId) params.set('community_id', communityId)
      if (spaceId) params.set('space_id', spaceId)

      const res = await api.get<{ data: FeedDeltaResult }>(`/v1/feed/delta?${params}`)
      const data = res.data.data
      if (data) {
        setNewCount(data.newCount ?? data.new_count ?? 0)
        // Kept for callers that want to know the newest id; NOT used as the
        // next anchor — see consumeNew.
        const anchor = data.newestAnchor ?? data.newest_anchor
        if (anchor) {
          setNewestAnchor(anchor)
        }
      }
    } catch {
      // silently fail — delta is non-critical
    }
  }, [feedType, groupId, channelId, communityId, spaceId])

  // Set initial anchor
  const setAnchor = useCallback((anchor: string) => {
    anchorRef.current = anchor
    setHasAnchor(true)
    setNewCount(0)
  }, [])

  /*
    Consume new items: clear the count and let the CALLER re-anchor.

    This used to set the anchor to the response's `newest_anchor`. That field
    is a post ID, and the server parses the anchor as an RFC3339 timestamp
    only (feed-service/internal/service/delta.go:25) — so the first tap poisoned
    the anchor and every poll after it answered 500. The hook swallows errors,
    so the count would simply have stopped updating with nothing to show why.
    Verified against the running service: an ISO anchor returns a count, the
    same call with a post ID returns INTERNAL_ERROR.

    Anchoring from the newest post the caller has actually RENDERED is also
    the more honest measure: it counts from what the reader has seen, not from
    what the server last knew about.
  */
  const consumeNew = useCallback(() => {
    setNewCount(0)
  }, [])

  // Polling
  useEffect(() => {
    if (!enabled || !hasAnchor) return
    const interval = POLL_INTERVALS[feedType] ?? 30000
    const timer = setInterval(checkDelta, interval)
    return () => clearInterval(timer)
  }, [enabled, hasAnchor, feedType, checkDelta])

  return { newCount, setAnchor, consumeNew, checkDelta }
}

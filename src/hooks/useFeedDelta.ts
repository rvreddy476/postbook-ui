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

// Polling intervals per feed type (ms)
const POLL_INTERVALS: Record<string, number> = {
  home: 15000,
  following: 20000,
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
    setNewCount(0)
  }, [])

  // Consume new items (reset count, advance anchor)
  const consumeNew = useCallback(() => {
    if (newestAnchor) {
      anchorRef.current = newestAnchor
    }
    setNewCount(0)
  }, [newestAnchor])

  // Polling
  useEffect(() => {
    if (!enabled || !anchorRef.current) return
    const interval = POLL_INTERVALS[feedType] ?? 30000
    const timer = setInterval(checkDelta, interval)
    return () => clearInterval(timer)
  }, [enabled, feedType, checkDelta])

  return { newCount, setAnchor, consumeNew, checkDelta }
}

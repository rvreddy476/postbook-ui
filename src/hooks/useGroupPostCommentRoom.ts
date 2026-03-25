"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  subscribeToGroupPostRoom,
  unsubscribeFromGroupPostRoom,
  subscribeToGroupCommentUpdates,
  type GroupCommentUpdate,
} from "@/services/messageService"

/**
 * Subscribes to real-time comment updates for a group post via WebSocket.
 * On mount (when postId is set): sends subscribe_group_post to ws-gateway.
 * On unmount or when postId changes: sends unsubscribe_group_post.
 * Deduplicates by event_id using a capped Set (max 500).
 */
export function useGroupPostCommentRoom(
  postId: string | undefined,
  groupId: string | undefined,
  onRealtimeEvent?: (event: GroupCommentUpdate) => void,
) {
  const qc = useQueryClient()
  const dedupRef = useRef<Set<string>>(new Set())
  const onEventRef = useRef(onRealtimeEvent)
  onEventRef.current = onRealtimeEvent

  useEffect(() => {
    if (!postId) return

    subscribeToGroupPostRoom(postId)

    const unsub = subscribeToGroupCommentUpdates((event: GroupCommentUpdate) => {
      if (event.post_id !== postId) return

      // Deduplicate by event_id
      if (event.event_id && dedupRef.current.has(event.event_id)) return
      if (event.event_id) {
        dedupRef.current.add(event.event_id)
        if (dedupRef.current.size > 500) {
          const first = dedupRef.current.values().next().value
          if (first) dedupRef.current.delete(first)
        }
      }

      // Invoke the callback for local state merge
      onEventRef.current?.(event)

      // Invalidate React Query caches
      if (groupId) {
        qc.invalidateQueries({ queryKey: ["group-post-comments", groupId, postId] })
        qc.invalidateQueries({ queryKey: ["group-feed-v2", groupId] })
      }
    })

    return () => {
      unsubscribeFromGroupPostRoom(postId)
      unsub()
      dedupRef.current.clear()
    }
  }, [postId, groupId, qc])
}

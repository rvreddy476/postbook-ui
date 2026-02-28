"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
    subscribeToPostRoom,
    unsubscribeFromPostRoom,
    subscribeToPostUpdates,
    type PostInteractionUpdate,
} from "@/services/messageService"

/**
 * Subscribes to real-time per-post updates via WebSocket.
 * On mount: sends subscribe_post to ws-gateway.
 * On unmount: sends unsubscribe_post.
 * Invalidates comment queries on comment events, updates engagement counts on reaction/share.
 */
export function usePostRoom(postId: string | undefined) {
    const qc = useQueryClient()

    useEffect(() => {
        if (!postId) return

        // Subscribe to per-post Redis channel via WS
        subscribeToPostRoom(postId)

        // Listen for post_update events matching this post
        const unsub = subscribeToPostUpdates((update: PostInteractionUpdate) => {
            if (update.post_id !== postId) return

            if (update.update_type === "comment" || update.update_type === "comment_deleted") {
                // Refetch comments for this post
                qc.invalidateQueries({ queryKey: ["comments", postId] })
                qc.invalidateQueries({ queryKey: ["comments-around", postId] })
            }

            // Update engagement counts in cached feed/post queries
            if (update.likes !== undefined || update.comments !== undefined || update.shares !== undefined) {
                // Invalidate post detail cache so counts refresh
                qc.invalidateQueries({ queryKey: ["post-detail", postId] })
                qc.invalidateQueries({ queryKey: ["home-feed"] })
                qc.invalidateQueries({ queryKey: ["feed-posts"] })
            }
        })

        return () => {
            unsubscribeFromPostRoom(postId)
            unsub()
        }
    }, [postId, qc])
}

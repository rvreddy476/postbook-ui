"use client"

import { useEffect, useRef, useCallback } from "react"
import api from "@/lib/api"

interface ImpressionEntry {
    post_id: string
    dwell_seconds: number
}

const BATCH_INTERVAL = 10_000 // 10 seconds
const MIN_DWELL = 1 // minimum 1 second to count

/**
 * Tracks post impressions (viewport visibility + dwell time) using IntersectionObserver.
 * Sends batched impressions to the backend every 10 seconds.
 */
export function useImpressionTracker() {
    const activeTimers = useRef<Map<string, number>>(new Map())
    const pendingBatch = useRef<ImpressionEntry[]>([])
    const observerRef = useRef<IntersectionObserver | null>(null)

    const flushBatch = useCallback(async () => {
        if (pendingBatch.current.length === 0) return
        const batch = [...pendingBatch.current]
        pendingBatch.current = []

        try {
            await Promise.all(
                batch.map((entry) =>
                    api.post("/v1/feed/signal", {
                        post_id: entry.post_id,
                        signal: "impression",
                        dwell_seconds: entry.dwell_seconds,
                    }).catch(() => {})
                )
            )
        } catch {
            // Best-effort; don't block UI
        }
    }, [])

    useEffect(() => {
        const interval = setInterval(flushBatch, BATCH_INTERVAL)
        return () => {
            clearInterval(interval)
            flushBatch()
        }
    }, [flushBatch])

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const postId = (entry.target as HTMLElement).dataset.postId
                    if (!postId) continue

                    if (entry.isIntersecting) {
                        // Post entered viewport — start timer
                        activeTimers.current.set(postId, Date.now())
                    } else {
                        // Post left viewport — record dwell time
                        const startTime = activeTimers.current.get(postId)
                        if (startTime) {
                            const dwellSeconds = (Date.now() - startTime) / 1000
                            activeTimers.current.delete(postId)
                            if (dwellSeconds >= MIN_DWELL) {
                                pendingBatch.current.push({
                                    post_id: postId,
                                    dwell_seconds: Math.round(dwellSeconds * 10) / 10,
                                })
                            }
                        }
                    }
                }
            },
            { threshold: 0.5 }
        )

        observerRef.current = observer

        return () => {
            observer.disconnect()
        }
    }, [])

    /** Call this ref callback on each post card element. Set data-post-id on the element. */
    const observe = useCallback((el: HTMLElement | null) => {
        if (el && observerRef.current) {
            observerRef.current.observe(el)
        }
    }, [])

    return { observe }
}

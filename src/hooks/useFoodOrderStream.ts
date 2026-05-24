// Dedicated SSE subscription to the food-service realtime gateway
// for partner-facing kitchen / restaurant screens.
//
// Flow:
//   1. POST /v1/food/realtime/token  → HMAC-signed topic token.
//   2. Filter to `food.restaurant.{restaurantId}.orders` topics from
//      the returned allow-list (the token also carries food.order.*
//      and food.delivery_partner.* topics, but the kitchen UI only
//      cares about the restaurant feed).
//   3. EventSource → /v1/realtime/sse?token=…&topics=…
//   4. On any frame, fire the caller's listener so they can invalidate
//      whatever query is rendering the queue.
//
// Auth note: EventSource can't set custom headers, but the token is
// passed via query string + the gateway verifies it from there, so
// no cookie / Authorization header is required for the SSE leg.
// The /realtime/token POST itself still goes through the shared axios
// client which attaches the access token in the normal way.

"use client"

import { useEffect, useRef } from "react"

import api from "@/lib/api"

type Listener = (frame: { event: string; data: unknown }) => void

interface TokenResponse {
  data: { token: string; topics: string[] }
}

async function fetchFoodRealtimeToken(): Promise<{
  token: string
  topics: string[]
}> {
  const { data } = await api.post<TokenResponse>("/v1/food/realtime/token")
  return {
    token: data.data?.token ?? "",
    topics: data.data?.topics ?? [],
  }
}

/**
 * Subscribe to food.restaurant.{restaurantId}.orders SSE frames for
 * the lifetime of the calling component. Listener is called on every
 * frame; caller decides what to do (typically: invalidate a query).
 *
 * Idempotent on a stable restaurantId; the EventSource is re-opened
 * when restaurantId changes.
 */
export function useFoodOrderStream(
  restaurantId: string | undefined,
  listener: Listener,
) {
  const ref = useRef(listener)
  ref.current = listener

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    let source: EventSource | null = null

    ;(async () => {
      try {
        const { token, topics } = await fetchFoodRealtimeToken()
        if (cancelled || !token) return
        const wanted = topics.filter(
          (t) => t === `food.restaurant.${restaurantId}.orders`,
        )
        if (wanted.length === 0) return // user doesn't own this restaurant
        const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
        const url =
          `${base}/v1/realtime/sse?token=${encodeURIComponent(token)}` +
          `&topics=${encodeURIComponent(wanted.join(","))}`
        source = new EventSource(url, { withCredentials: true })

        // The gateway uses the topic name as the event name on every
        // frame; a generic onmessage doesn't fire for named events,
        // so we wire one listener per topic.
        wanted.forEach((topic) => {
          source!.addEventListener(topic, (e: MessageEvent) => {
            try {
              const envelope = JSON.parse(e.data)
              ref.current({ event: topic, data: envelope?.data ?? envelope })
            } catch {
              // Malformed frame — skip; the next push will correct us.
            }
          })
        })
      } catch {
        // Token fetch failed or SSE rejected — fall back to polling.
      }
    })()

    return () => {
      cancelled = true
      if (source) source.close()
    }
  }, [restaurantId])
}

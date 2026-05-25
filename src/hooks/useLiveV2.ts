"use client"

import * as React from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { AxiosError } from "axios"
import api from "@/lib/api"
import { getSharedNotificationSocket } from "@/lib/notificationSocket"

// ── Types ─────────────────────────────────────────────────────────────
//
// Mirrors the Go `LiveStream` row from
// Architecture/services/live-service-v2/internal/store/postgres/store.go.
export type LiveStreamStatus = "scheduled" | "live" | "ended" | "failed"
export type LiveVisibility = "public" | "followers" | "paid"

export interface LiveStream {
  id: string
  creator_user_id: string
  livekit_room: string
  title: string
  description: string
  cover_media_id: string | null
  status: LiveStreamStatus
  visibility: LiveVisibility
  scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  viewer_peak: number
  recording_url: string | null
  recording_duration_seconds: number | null
  created_at: string
  updated_at: string
}

export interface CreateStreamInput {
  title: string
  description?: string
  visibility: LiveVisibility
  cover_media_id?: string | null
  scheduled_at?: string | null
}

export interface StartStreamResult {
  stream: LiveStream
  publisher_token: string
  room: string
  server_url: string
}

export interface ViewerTokenResult {
  token: string
  room: string
  server_url: string
}

export interface LiveStreamListPage {
  items: LiveStream[]
  next_cursor: string
}

// ── Envelope helpers ──────────────────────────────────────────────────
//
// Backend wraps responses as `{ data, error, meta }` but we tolerate the
// raw form too — same defensive pattern used in usePresence.ts.

function unwrap<T>(body: unknown, fallback: T): T {
  if (body && typeof body === "object" && "data" in body) {
    const inner = (body as { data: unknown }).data
    return (inner ?? fallback) as T
  }
  return (body ?? fallback) as T
}

function unwrapList(body: unknown): { items: LiveStream[]; next_cursor: string } {
  // The list endpoint serialises the stream array directly into `data`
  // and the cursor into `meta.next_cursor` (see api.JSON in handler.go).
  if (body && typeof body === "object") {
    const obj = body as { data?: unknown; meta?: { next_cursor?: string } }
    const items = Array.isArray(obj.data)
      ? (obj.data as LiveStream[])
      : Array.isArray((obj as { items?: LiveStream[] }).items)
        ? ((obj as { items: LiveStream[] }).items)
        : []
    const next_cursor = obj.meta?.next_cursor ?? ""
    return { items, next_cursor }
  }
  return { items: [], next_cursor: "" }
}

// ── Query keys ────────────────────────────────────────────────────────

export const liveV2Keys = {
  all: ["liveV2"] as const,
  list: () => [...liveV2Keys.all, "list"] as const,
  stream: (id: string) => [...liveV2Keys.all, "stream", id] as const,
  viewerToken: (id: string) => [...liveV2Keys.all, "viewerToken", id] as const,
}

// ── List currently-live streams (infinite scroll) ─────────────────────

export function useLiveStreams(limit = 20) {
  return useInfiniteQuery<LiveStreamListPage>({
    queryKey: [...liveV2Keys.list(), limit],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { limit }
      if (pageParam) params.cursor = String(pageParam)
      const res = await api.get("/v1/livestream/streams", { params })
      return unwrapList(res.data)
    },
    initialPageParam: "",
    getNextPageParam: (last) => (last.next_cursor ? last.next_cursor : undefined),
    staleTime: 30_000,
  })
}

// ── Single-stream detail (polls so the viewer counter stays live) ────

export function useLiveStream(streamId: string | null | undefined, pollMs = 5000) {
  return useQuery<LiveStream>({
    queryKey: streamId ? liveV2Keys.stream(streamId) : ["liveV2", "stream", "none"],
    queryFn: async () => {
      const res = await api.get(`/v1/livestream/streams/${streamId}`)
      return unwrap<LiveStream>(res.data, {} as LiveStream)
    },
    enabled: !!streamId,
    refetchInterval: pollMs,
    staleTime: 0,
  })
}

// ── Broadcaster mutations ─────────────────────────────────────────────

export function useCreateStream() {
  const qc = useQueryClient()
  return useMutation<LiveStream, AxiosError, CreateStreamInput>({
    mutationFn: async (input) => {
      const res = await api.post("/v1/livestream/streams", {
        title: input.title,
        description: input.description ?? "",
        visibility: input.visibility,
        cover_media_id: input.cover_media_id ?? null,
        scheduled_at: input.scheduled_at ?? null,
      })
      return unwrap<LiveStream>(res.data, {} as LiveStream)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: liveV2Keys.list() })
    },
  })
}

export function useStartStream() {
  const qc = useQueryClient()
  return useMutation<StartStreamResult, AxiosError, string>({
    mutationFn: async (streamId) => {
      const res = await api.post(`/v1/livestream/streams/${streamId}/start`)
      return unwrap<StartStreamResult>(res.data, {} as StartStreamResult)
    },
    onSuccess: (data, streamId) => {
      qc.invalidateQueries({ queryKey: liveV2Keys.stream(streamId) })
      qc.invalidateQueries({ queryKey: liveV2Keys.list() })
    },
  })
}

export function useEndStream() {
  const qc = useQueryClient()
  return useMutation<void, AxiosError, string>({
    mutationFn: async (streamId) => {
      await api.post(`/v1/livestream/streams/${streamId}/end`)
    },
    onSuccess: (_, streamId) => {
      qc.invalidateQueries({ queryKey: liveV2Keys.stream(streamId) })
      qc.invalidateQueries({ queryKey: liveV2Keys.list() })
    },
  })
}

// ── Viewer token ──────────────────────────────────────────────────────
//
// Backend returns 403 for non-followers and 402 for paid streams — both
// surface as AxiosErrors here so the caller can show the right fallback.

export function useViewerToken(
  streamId: string | null | undefined,
  enabled = true,
) {
  return useQuery<ViewerTokenResult, AxiosError>({
    queryKey: streamId ? liveV2Keys.viewerToken(streamId) : ["liveV2", "viewerToken", "none"],
    queryFn: async () => {
      const res = await api.get(`/v1/livestream/streams/${streamId}/viewer-token`)
      return unwrap<ViewerTokenResult>(res.data, {} as ViewerTokenResult)
    },
    enabled: !!streamId && enabled,
    // Tokens are good for 4h — no need to retry on 403/402.
    retry: (failureCount, error) => {
      const status = error?.response?.status
      if (status === 401 || status === 402 || status === 403 || status === 404) return false
      return failureCount < 2
    },
    staleTime: 30 * 60_000,
  })
}

// ── Visibility-error helper ───────────────────────────────────────────
//
// Turns an AxiosError into a user-facing reason string. Used by both the
// viewer page and the broadcaster studio when the gate trips.

export function visibilityErrorReason(err: unknown): {
  code: "forbidden_follower" | "payment_required" | "not_found" | "unauthorized" | "unknown"
  message: string
} | null {
  if (!err || typeof err !== "object") return null
  const ax = err as AxiosError<{ error?: { code?: string; message?: string } }>
  const status = ax.response?.status
  const code = ax.response?.data?.error?.code
  switch (status) {
    case 401:
      return { code: "unauthorized", message: "Sign in to watch this stream." }
    case 402:
      return {
        code: "payment_required",
        message: "Subscribe to watch this paid stream.",
      }
    case 403:
      if (code === "NOT_FOLLOWER") {
        return {
          code: "forbidden_follower",
          message: "Only the creator's followers can watch this stream.",
        }
      }
      return { code: "forbidden_follower", message: "You don't have access to this stream." }
    case 404:
      return { code: "not_found", message: "This stream no longer exists." }
    default:
      return null
  }
}

// ── Chat overlay (Phase A) ────────────────────────────────────────────
//
// REST surface from live-service-v2:
//   GET  /v1/livestream/streams/:id/chat?limit=N  — replay buffer
//   POST /v1/livestream/streams/:id/chat          — append
// Live tail arrives via the shared notification socket using the
// existing `subscribe_live_stream` message + `live_chat_message`
// pub/sub event type.

export interface LiveChatMessage {
  id: string
  stream_id: string
  user_id: string
  text: string
  created_at: string
}

const chatKeys = {
  list: (streamId: string) => [...liveV2Keys.all, "chat", streamId] as const,
}

// useLiveChatList — initial replay buffer + live-merge subscription.
// Returns messages oldest-first so the UI just appends as new arrives.
export function useLiveChatList(streamId: string | null | undefined, limit = 50) {
  const qc = useQueryClient()
  const query = useQuery<LiveChatMessage[]>({
    queryKey: streamId ? chatKeys.list(streamId) : ["liveV2", "chat", "none"],
    queryFn: async () => {
      const res = await api.get(`/v1/livestream/streams/${streamId}/chat`, {
        params: { limit },
      })
      const items = unwrap<LiveChatMessage[]>(res.data, [])
      // Backend returns newest-first; we keep oldest-first locally so
      // append-on-event is natural.
      return [...items].reverse()
    },
    enabled: !!streamId,
    staleTime: 0,
  })

  // Live-tail subscription. Subscribes to the ws-gateway's
  // live:stream:{streamID} pub/sub channel via the existing
  // subscribe_live_stream message and merges new messages into the
  // query cache.
  React.useEffect(() => {
    if (!streamId) return
    const sock = getSharedNotificationSocket()
    if (!sock) return
    // Tell the gateway to attach our connection to this stream's
    // pub/sub channel.
    sock.send({ type: "subscribe_live_stream", stream_id: streamId })
    const unsub = sock.on("live_chat_message", (raw: unknown) => {
      const env = raw as { payload?: LiveChatMessage } | LiveChatMessage
      const msg =
        typeof env === "object" && env && "payload" in env
          ? (env as { payload?: LiveChatMessage }).payload
          : (env as LiveChatMessage)
      if (!msg || msg.stream_id !== streamId) return
      qc.setQueryData<LiveChatMessage[]>(chatKeys.list(streamId), (prev) => {
        const list = prev ?? []
        // Dedup on id — the broadcaster's own send echoes back via
        // pub/sub and we don't want the double-render.
        if (list.some((m) => m.id === msg.id)) return list
        return [...list, msg]
      })
    })
    return () => {
      unsub()
      sock.send({ type: "unsubscribe_live_stream", stream_id: streamId })
    }
  }, [streamId, qc])

  return query
}

// useSendLiveChat — appends a chat message. The broadcaster's own
// message also arrives via the pub/sub echo; useLiveChatList's
// id-dedup prevents the double-render.
export function useSendLiveChat(streamId: string) {
  const qc = useQueryClient()
  return useMutation<LiveChatMessage, AxiosError, { text: string }>({
    mutationFn: async ({ text }) => {
      const res = await api.post(`/v1/livestream/streams/${streamId}/chat`, { text })
      return unwrap<LiveChatMessage>(res.data, {} as LiveChatMessage)
    },
    onSuccess: (msg) => {
      qc.setQueryData<LiveChatMessage[]>(chatKeys.list(streamId), (prev) => {
        const list = prev ?? []
        if (list.some((m) => m.id === msg.id)) return list
        return [...list, msg]
      })
    },
  })
}

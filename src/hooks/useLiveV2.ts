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
import {
  isHubOpen,
  subscribeToHubConnected,
  subscribeToLiveEvents,
  subscribeToLiveStream,
  unsubscribeFromLiveStream,
} from "@/services/messageService"
import type {
  CreateStreamInput,
  LiveChatMessage,
  LiveStream,
  LiveStreamListPage,
  StartStreamResult,
  ViewerTokenResult,
} from "@/features/live/model"
import { parseBanList, parseModeratorList, parseStreamList } from "@/features/live/model"
import { chatReducer, initialChatState, type ChatState, type ChatAction } from "@/features/live/chat"
import { viewerTokenRetry } from "@/features/live/errors"
import {
  applyStreamFrame,
  chatPollInterval,
  nextTransport,
  shouldPollChat,
  type ChatTransport,
} from "@/features/live/realtime"
import type { LiveReportBody } from "@/features/live/report"

// live-service-v2 (LiveKit) is the only live stack. Routes (handler.go,
// moderation_routes.go, 1 Oct 2026):
//   GET    /v1/livestream/streams                      live now (data[], meta.next_cursor)
//   POST   /v1/livestream/streams                      create   (403 LIVE_NOT_ENABLED | LIVE_BANNED)
//   GET    /v1/livestream/streams/:id                  detail
//   POST   /v1/livestream/streams/:id/start            data.stream.status "starting" + publisher token
//   POST   /v1/livestream/streams/:id/end              data = the stream row
//   GET    /v1/livestream/streams/:id/viewer-token     409 STREAM_NOT_LIVE unless starting|live|reconnecting
//   GET    /v1/livestream/streams/:id/chat?limit=N     replay (newest first)
//   POST   /v1/livestream/streams/:id/chat             {text}
//   DELETE /v1/livestream/streams/:id/chat/:messageId  host, moderators
//   POST   /v1/livestream/streams/:id/bans             {user_id, reason?}  host, moderators
//   DELETE /v1/livestream/streams/:id/bans/:userId     host, moderators
//   GET    /v1/livestream/streams/:id/bans             host, moderators
//   PUT    /v1/livestream/streams/:id/moderators       {user_ids} (host, max 5)
//   GET    /v1/livestream/streams/:id/moderators       anyone who can see the stream
//   POST   /v1/livestream/streams/:id/reports          {reason, message_id?, note?} → 201
// Real-time: ws `subscribe_live_stream` (see features/live/realtime.ts).

export type {
  CreateStreamInput,
  LiveChatMessage,
  LiveEndedReason,
  LiveStream,
  LiveStreamListPage,
  LiveStreamStatus,
  LiveVisibility,
  StartStreamResult,
  ViewerTokenResult,
} from "@/features/live/model"

// ── Envelope helpers ──────────────────────────────────────────────────

function unwrap<T>(body: unknown, fallback: T): T {
  if (body && typeof body === "object" && "data" in body) {
    const inner = (body as { data: unknown }).data
    return (inner ?? fallback) as T
  }
  return (body ?? fallback) as T
}

// ── Query keys ────────────────────────────────────────────────────────

export const liveV2Keys = {
  all: ["liveV2"] as const,
  list: () => [...liveV2Keys.all, "list"] as const,
  stream: (id: string) => [...liveV2Keys.all, "stream", id] as const,
  viewerToken: (id: string) => [...liveV2Keys.all, "viewerToken", id] as const,
  chat: (id: string) => [...liveV2Keys.all, "chat", id] as const,
  bans: (id: string) => [...liveV2Keys.all, "bans", id] as const,
  moderators: (id: string) => [...liveV2Keys.all, "moderators", id] as const,
}

// ── List currently-live streams (infinite scroll) ─────────────────────

export function useLiveStreams(limit = 20) {
  return useInfiniteQuery<LiveStreamListPage>({
    queryKey: [...liveV2Keys.list(), limit],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = { limit }
      if (pageParam) params.cursor = String(pageParam)
      const res = await api.get("/v1/livestream/streams", { params })
      return parseStreamList(res.data)
    },
    initialPageParam: "",
    getNextPageParam: (last) => (last.next_cursor ? last.next_cursor : undefined),
    staleTime: 30_000,
  })
}

// ── Single-stream detail ──────────────────────────────────────────────
//
// Polled as a backstop: status.changed frames update it immediately, the
// poll catches anything a lost frame missed (the server sweeper is the
// truth for timeouts).

export function useLiveStream(streamId: string | null | undefined, pollMs: number | false = 10_000) {
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
      // data.stream.status is "starting" (or the current status on a rejoin);
      // only the host's published track makes it "live", server-side.
      if (data?.stream?.id) qc.setQueryData(liveV2Keys.stream(streamId), data.stream)
      qc.invalidateQueries({ queryKey: liveV2Keys.stream(streamId) })
      qc.invalidateQueries({ queryKey: liveV2Keys.list() })
    },
  })
}

export function useEndStream() {
  const qc = useQueryClient()
  return useMutation<LiveStream, AxiosError, string>({
    mutationFn: async (streamId) => {
      const res = await api.post(`/v1/livestream/streams/${streamId}/end`)
      return unwrap<LiveStream>(res.data, {} as LiveStream)
    },
    onSuccess: (row, streamId) => {
      // The answer is the stream row: status ended (host_ended) or failed.
      if (row?.id) qc.setQueryData(liveV2Keys.stream(streamId), row)
      qc.invalidateQueries({ queryKey: liveV2Keys.stream(streamId) })
      qc.invalidateQueries({ queryKey: liveV2Keys.list() })
    },
  })
}

// ── Viewer token ──────────────────────────────────────────────────────
//
// Final refusals and the brief STREAM_NOT_LIVE retry: viewerTokenRetry and
// watchErrorCopy in features/live/errors.ts.

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
    retry: viewerTokenRetry,
    retryDelay: 2000,
    staleTime: 30 * 60_000,
  })
}

// ── Live room: chat + real-time frames ────────────────────────────────

export interface LiveRoom {
  chat: ChatState
  dispatch: React.Dispatch<ChatAction>
  transport: ChatTransport
  /** True while chat is read over HTTP because frames can't arrive. */
  polling: boolean
  chatLoading: boolean
}

/**
 * One owner per page: the page component that renders the stream. Key the
 * component by stream id so the reducer starts fresh per stream.
 */
export function useLiveRoom(streamId: string, limit = 50): LiveRoom {
  const qc = useQueryClient()
  const [chat, dispatch] = React.useReducer(chatReducer, streamId, (id) => initialChatState(id))
  const [transport, setTransport] = React.useState<ChatTransport>("subscribing")
  const [socketOpen, setSocketOpen] = React.useState<boolean>(() => isHubOpen())

  const polling = shouldPollChat(transport, socketOpen)

  const chatQuery = useQuery<LiveChatMessage[]>({
    queryKey: liveV2Keys.chat(streamId),
    queryFn: async () => {
      const res = await api.get(`/v1/livestream/streams/${streamId}/chat`, { params: { limit } })
      const items = unwrap<LiveChatMessage[]>(res.data, [])
      return Array.isArray(items) ? items : []
    },
    enabled: !!streamId,
    staleTime: 0,
    refetchInterval: chatPollInterval(transport, socketOpen),
  })

  React.useEffect(() => {
    if (chatQuery.data) dispatch({ type: "replay", messages: chatQuery.data })
  }, [chatQuery.data])

  // Moderators for everyone (chat badges, the moderator's own tools); the
  // stream row's moderator_user_ids only reaches the host and moderators.
  const moderatorsQuery = useQuery<string[]>({
    queryKey: liveV2Keys.moderators(streamId),
    queryFn: async () => parseModeratorList((await api.get(`/v1/livestream/streams/${streamId}/moderators`)).data),
    enabled: !!streamId,
    staleTime: 60_000,
  })
  React.useEffect(() => {
    if (moderatorsQuery.data) dispatch({ type: "moderators_seed", user_ids: moderatorsQuery.data })
  }, [moderatorsQuery.data])

  React.useEffect(() => {
    if (!streamId) return
    subscribeToLiveStream(streamId)
    const offFrames = subscribeToLiveEvents((frame) => {
      if (frame.stream_id !== streamId) return
      switch (frame.kind) {
        case "refused":
          setTransport((t) => nextTransport(t, streamId, { type: "refused", stream_id: frame.stream_id }))
          return
        case "status":
          qc.setQueryData<LiveStream>(liveV2Keys.stream(streamId), (prev) => applyStreamFrame(prev, frame))
          void qc.invalidateQueries({ queryKey: liveV2Keys.stream(streamId) })
          return
        case "viewers":
          qc.setQueryData<LiveStream>(liveV2Keys.stream(streamId), (prev) => applyStreamFrame(prev, frame))
          return
        default:
          dispatch({ type: "frame", frame })
      }
    })
    const offOpen = subscribeToHubConnected(() => {
      setSocketOpen(true)
      setTransport((t) => nextTransport(t, streamId, { type: "socket_open" }))
    })
    // The hub has no close event for listeners; sample it so a dead socket
    // falls back to polling instead of a silent chat.
    const sample = setInterval(() => setSocketOpen(isHubOpen()), 2000)
    return () => {
      clearInterval(sample)
      offOpen()
      offFrames()
      unsubscribeFromLiveStream(streamId)
    }
  }, [streamId, qc])

  return { chat, dispatch, transport, polling, chatLoading: chatQuery.isLoading }
}

export function useSendLiveChat(streamId: string) {
  return useMutation<LiveChatMessage, AxiosError, { text: string }>({
    mutationFn: async ({ text }) => {
      const res = await api.post(`/v1/livestream/streams/${streamId}/chat`, { text })
      return unwrap<LiveChatMessage>(res.data, {} as LiveChatMessage)
    },
  })
}

// ── Moderation (host, stream moderators) ──────────────────────────────

export function useRemoveChatMessage(streamId: string) {
  return useMutation<void, AxiosError, string>({
    mutationFn: async (messageId) => {
      await api.delete(`/v1/livestream/streams/${streamId}/chat/${messageId}`)
    },
  })
}

/** GET /bans — host and moderators only (403 for anyone else). */
export function useStreamBans(streamId: string, enabled: boolean) {
  return useQuery<string[]>({
    queryKey: liveV2Keys.bans(streamId),
    queryFn: async () => parseBanList((await api.get(`/v1/livestream/streams/${streamId}/bans`)).data),
    enabled: !!streamId && enabled,
    staleTime: 30_000,
    retry: false,
  })
}

export const BAN_REASON = "Banned from the live stream"

export function useBanUser(streamId: string) {
  const qc = useQueryClient()
  return useMutation<void, AxiosError, string>({
    mutationFn: async (userId) => {
      await api.post(`/v1/livestream/streams/${streamId}/bans`, { user_id: userId, reason: BAN_REASON })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: liveV2Keys.bans(streamId) })
    },
  })
}

export function useUnbanUser(streamId: string) {
  const qc = useQueryClient()
  return useMutation<void, AxiosError, string>({
    mutationFn: async (userId) => {
      await api.delete(`/v1/livestream/streams/${streamId}/bans/${userId}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: liveV2Keys.bans(streamId) })
    },
  })
}

/** PUT /moderators answers {"data":{"user_ids":[...]}}: the list as stored. */
export function useSetModerators(streamId: string) {
  const qc = useQueryClient()
  return useMutation<string[], AxiosError, string[]>({
    mutationFn: async (userIds) => {
      const res = await api.put(`/v1/livestream/streams/${streamId}/moderators`, { user_ids: userIds })
      return parseModeratorList(res.data)
    },
    onSuccess: (ids) => {
      qc.setQueryData(liveV2Keys.moderators(streamId), ids)
      void qc.invalidateQueries({ queryKey: liveV2Keys.stream(streamId) })
    },
  })
}

// ── Viewer report ─────────────────────────────────────────────────────

export function useReportLive(streamId: string) {
  return useMutation<void, AxiosError, LiveReportBody>({
    mutationFn: async (body) => {
      await api.post(`/v1/livestream/streams/${streamId}/reports`, body)
    },
  })
}

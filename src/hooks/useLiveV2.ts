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
import { isPilotRefusal, viewerTokenRetry } from "@/features/live/errors"
import { parseChatList, parseChatMessage } from "@/features/live/author"
import {
  ELIGIBILITY_PATH,
  gateRequirements,
  goLiveGate,
  parseEligibility,
  requirementsFromError,
  type GoLiveGate,
  type LiveEligibility,
  type LiveRequirement,
} from "@/features/live/eligibility"
import {
  applyStreamFrame,
  chatPollInterval,
  nextTransport,
  shouldPollChat,
  type ChatTransport,
} from "@/features/live/realtime"
import type { LiveReportBody } from "@/features/live/report"
import { requestIngress, resetIngress, type StreamIngress } from "@/features/live/encoder"
import {
  LIVE_ROUTES,
  liveNowParams,
  parseLiveCategories,
  parseLiveCreators,
  parseStream,
  parseStreamPage,
  parseUserBadges,
  patchReminder,
  streamCreateBody,
  toggleReminder,
  upcomingParams,
  userStreamsParams,
  type LiveCategory,
  type LiveCreatorRow,
  type LiveListFilters,
  type ReminderState,
  type StreamPage,
  type StreamRow,
  type UserStreamsStatus,
} from "@/features/live/discovery"
import {
  HeartsController,
  heartsPath,
  parseSupporters,
  supportersPath,
  supportersRefetchMs,
  type HeartsSnapshot,
  type Supporter,
} from "@/features/live/hearts"

// live-service-v2 (LiveKit) is the only live stack. Routes (handler.go,
// moderation_routes.go, 1 Oct 2026):
//   GET    /v1/livestream/streams                      live now (data[], meta.next_cursor)
//   GET    /v1/livestream/eligibility                  who may go live (mode, eligible, requirements, viewer_cap)
//   POST   /v1/livestream/streams                      create   (403 LIVE_NOT_ENABLED | LIVE_NOT_ELIGIBLE | LIVE_BANNED, 503 AUTHORITY_UNAVAILABLE)
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
//   POST   /v1/livestream/streams/:id/ingress          host, encoder streams: {server_url, stream_key, ingress_id}
//   DELETE /v1/livestream/streams/:id/ingress          host; the next POST issues a new key
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
  eligibility: () => [...liveV2Keys.all, "eligibility"] as const,
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
      const res = await api.post("/v1/livestream/streams", streamCreateBody(input))
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
      // Every row carries its author card (name, handle, avatar, badges, role).
      return parseChatList(res.data)
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
      // The answer is the stored row, author card included; a body with no id reads as "nothing to show yet".
      return parseChatMessage(unwrap<unknown>(res.data, null)) ?? ({} as LiveChatMessage)
    },
  })
}

// ── Who may go live ───────────────────────────────────────────────────
//
// GET /v1/livestream/eligibility (features/live/eligibility.ts). Asked before
// a go-live form is shown. A failed or unreadable answer is an error here and
// the caller falls back to the form: the server decides again on submit.

export function useLiveEligibility(enabled = true) {
  return useQuery<LiveEligibility>({
    queryKey: liveV2Keys.eligibility(),
    queryFn: async () => {
      const parsed = parseEligibility((await api.get(ELIGIBILITY_PATH)).data)
      if (!parsed) throw new Error("eligibility: unreadable answer")
      return parsed
    },
    enabled,
    retry: false,
    // The server caches a user's answer for 60 s; coming back from "Create a post" asks again.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}

export interface GoLiveGateState {
  /** loading · form · pilot (PilotNotice) · nearly (NearlyReady). */
  gate: GoLiveGate
  /** The rows for the "nearly ready" panel. */
  requirements: LiveRequirement[]
  /** The new-streamer viewer cap while it applies. */
  viewerCap: number | null
  rechecking: boolean
  /** Give it the error of a create / start: true when it was a pilot or eligibility refusal (now on screen). */
  refuse: (err: unknown) => boolean
  /** "Check again". */
  recheck: () => void
}

/**
 * What a go-live form shows before and after it is submitted. `enabled`
 * false skips the question (editing a stream that already exists).
 */
export function useGoLiveGate(enabled = true): GoLiveGateState {
  const query = useLiveEligibility(enabled)
  const [pilotRefused, setPilotRefused] = React.useState(false)
  const [refused, setRefused] = React.useState<LiveRequirement[] | null>(null)
  const { refetch } = query

  const refuse = React.useCallback((err: unknown) => {
    if (isPilotRefusal(err)) {
      setPilotRefused(true)
      return true
    }
    const rows = requirementsFromError(err)
    if (!rows) return false
    setRefused(rows)
    return true
  }, [])

  const recheck = React.useCallback(() => {
    setRefused(null)
    void refetch()
  }, [refetch])

  return {
    gate: goLiveGate({ loading: enabled && query.isLoading, eligibility: enabled ? query.data : null, pilotRefused, refused }),
    requirements: gateRequirements(refused, enabled ? query.data : null),
    viewerCap: enabled ? query.data?.viewer_cap ?? null : null,
    rechecking: query.isFetching,
    refuse,
    recheck,
  }
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

// ── Live surfaces: discovery, scheduling, reminders ───────────────────
//
// Contract 2 Oct 2026. Every wire name is read in features/live/discovery.ts
// (routes, params, parsers); these hooks only fetch and cache. Shared by
// PostTube live and the Reels Live tab.
//   GET   /v1/livestream/streams?status=live&orientation=&category=&following=true&sort=
//   GET   /v1/livestream/streams/upcoming?orientation=&category=&following=
//   GET   /v1/livestream/categories/live
//   GET   /v1/livestream/creators/live?limit=
//   GET   /v1/livestream/users/:userId/streams?status=live|upcoming|past
//   GET   /v1/livestream/users/:userId/badges
//   PATCH /v1/livestream/streams/:id                 host, only while scheduled
//   PUT | DELETE /v1/livestream/streams/:id/reminder
//   POST  /v1/livestream/streams/:id/hearts          {count}
//   GET   /v1/livestream/streams/:id/supporters?limit=

export type { LiveCategory, LiveCreatorRow, LiveListFilters, ReminderState, StreamPage, StreamRow, UserStreamsStatus }

const filterKey = (f: LiveListFilters) => [f.orientation ?? "", f.category ?? "", !!f.following, f.sort ?? "", f.limit ?? 0] as const

export const liveDiscoveryKeys = {
  // Under liveV2Keys.list() so create / start / end refresh it too.
  liveNow: (f: LiveListFilters) => [...liveV2Keys.list(), "now", ...filterKey(f)] as const,
  upcoming: (f: LiveListFilters) => [...liveV2Keys.all, "upcoming", ...filterKey(f)] as const,
  categories: () => [...liveV2Keys.all, "categories"] as const,
  creators: (limit: number) => [...liveV2Keys.all, "creators", limit] as const,
  userStreams: (userId: string, status: UserStreamsStatus) => [...liveV2Keys.all, "user", userId, status] as const,
  badges: (userId: string) => [...liveV2Keys.all, "badges", userId] as const,
  supporters: (streamId: string) => [...liveV2Keys.all, "supporters", streamId] as const,
}

interface ListOptions {
  enabled?: boolean
  /** Re-read on this interval (viewer counts move); off by default. */
  refetchMs?: number | false
}

/** Live now, most watched first unless `sort` says otherwise. */
export function useLiveNow(filters: LiveListFilters = {}, opts: ListOptions = {}) {
  return useInfiniteQuery<StreamPage>({
    queryKey: liveDiscoveryKeys.liveNow(filters),
    queryFn: async ({ pageParam }) => {
      const res = await api.get(LIVE_ROUTES.streams, { params: liveNowParams({ ...filters, cursor: pageParam ? String(pageParam) : undefined }) })
      return parseStreamPage(res.data)
    },
    initialPageParam: "",
    getNextPageParam: (last) => last.next_cursor || undefined,
    enabled: opts.enabled ?? true,
    staleTime: 30_000,
    refetchInterval: opts.refetchMs ?? false,
  })
}

/** Scheduled streams still ahead, soonest first; rows carry reminder_set and reminder_count. */
export function useUpcomingStreams(filters: LiveListFilters = {}, opts: ListOptions = {}) {
  return useInfiniteQuery<StreamPage>({
    queryKey: liveDiscoveryKeys.upcoming(filters),
    queryFn: async ({ pageParam }) => {
      const res = await api.get(LIVE_ROUTES.upcoming, { params: upcomingParams({ ...filters, cursor: pageParam ? String(pageParam) : undefined }) })
      return parseStreamPage(res.data)
    },
    initialPageParam: "",
    getNextPageParam: (last) => last.next_cursor || undefined,
    enabled: opts.enabled ?? true,
    staleTime: 60_000,
  })
}

/** Topics with at least one stream live, most watched first. */
export function useLiveCategories(enabled = true) {
  return useQuery<LiveCategory[]>({
    queryKey: liveDiscoveryKeys.categories(),
    queryFn: async () => parseLiveCategories((await api.get(LIVE_ROUTES.categories)).data),
    enabled,
    staleTime: 60_000,
  })
}

/** Creators who are live right now, by viewers (suggested creators; the LIVE ring through liveByCreator). */
export function useLiveCreators(limit = 12, enabled = true) {
  return useQuery<LiveCreatorRow[]>({
    queryKey: liveDiscoveryKeys.creators(limit),
    queryFn: async () => parseLiveCreators((await api.get(LIVE_ROUTES.creators, { params: { limit } })).data),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/** One creator's streams: live, upcoming or past (the channel Live tab, the Creator Hub). */
export function useUserStreams(userId: string | null | undefined, status: UserStreamsStatus, opts: ListOptions & { limit?: number } = {}) {
  return useInfiniteQuery<StreamPage>({
    queryKey: liveDiscoveryKeys.userStreams(userId ?? "", status),
    queryFn: async ({ pageParam }) => {
      const res = await api.get(LIVE_ROUTES.userStreams(userId as string), {
        params: userStreamsParams(status, { limit: opts.limit, cursor: pageParam ? String(pageParam) : undefined }),
      })
      return parseStreamPage(res.data)
    },
    initialPageParam: "",
    getNextPageParam: (last) => last.next_cursor || undefined,
    enabled: !!userId && (opts.enabled ?? true),
    staleTime: 30_000,
    refetchInterval: opts.refetchMs ?? false,
    retry: false,
  })
}

/** The detail row, parsed (orientation, category, creator card, reminder, recording, hearts). */
export function useLiveStreamRow(streamId: string | null | undefined, pollMs: number | false = 10_000) {
  const query = useLiveStream(streamId, pollMs)
  const row = React.useMemo(() => parseStream(query.data), [query.data])
  return { ...query, row }
}

/** A creator's badge keys. Absent or failed reads as none: a badge is never a reason to show an error. */
export function useUserBadges(userId: string | null | undefined) {
  return useQuery<string[]>({
    queryKey: liveDiscoveryKeys.badges(userId ?? ""),
    queryFn: async () => parseUserBadges((await api.get(LIVE_ROUTES.userBadges(userId as string))).data),
    enabled: !!userId,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

/** PATCH a scheduled stream. `body` comes from streamPatchBody (only what changed). */
export function useUpdateStream() {
  const qc = useQueryClient()
  return useMutation<StreamRow | null, AxiosError, { streamId: string; body: Record<string, unknown> }>({
    mutationFn: async ({ streamId, body }) => {
      const res = await api.patch(LIVE_ROUTES.stream(streamId), body)
      return parseStream(unwrap<unknown>(res.data, null))
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: liveV2Keys.all })
    },
  })
}

/**
 * Notify me / Reminder set. Every cached list and row that holds the
 * stream changes at once; the server's answer replaces the guess and a
 * failure puts the caches back (features/live/discovery.ts toggleReminder).
 */
export function useStreamReminder() {
  const qc = useQueryClient()
  return useMutation<ReminderState, AxiosError, { streamId: string; on: boolean; current: ReminderState }>({
    mutationFn: async ({ streamId, on, current }) => {
      await qc.cancelQueries({ queryKey: [...liveV2Keys.all, "upcoming"] })
      return toggleReminder(api, {
        read: () => current,
        write: (id, state) => { qc.setQueriesData({ queryKey: liveV2Keys.all }, (data: unknown) => patchReminder(data, id, state)) },
        snapshot: () => qc.getQueriesData({ queryKey: liveV2Keys.all }),
        restore: (snapshot) => { for (const [key, data] of snapshot) qc.setQueryData(key, data) },
      }, streamId, on)
    },
  })
}

// ── Free hearts and top supporters ────────────────────────────────────
//
// One HeartsController per stream on the page, shared by every component
// that shows the count or the button (features/live/hearts.ts). It keeps
// the stream's room subscription too, so hearts arrive without the chat.

interface HeartsEntry { controller: HeartsController; refs: number; stop: () => void }
const heartsRegistry = new Map<string, HeartsEntry>()

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function acquireHearts(streamId: string): HeartsController {
  const existing = heartsRegistry.get(streamId)
  if (existing) {
    existing.refs += 1
    return existing.controller
  }
  const controller = new HeartsController({
    send: async (count) => (await api.post(heartsPath(streamId), { count })).data,
    schedule: (fn, ms) => setTimeout(fn, ms),
    cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    now: () => Date.now(),
    reducedMotion: prefersReducedMotion,
  })
  subscribeToLiveStream(streamId)
  const offFrames = subscribeToLiveEvents((frame) => {
    if (frame.kind === "hearts" && frame.stream_id === streamId) controller.frame(frame)
  })
  heartsRegistry.set(streamId, {
    controller,
    refs: 1,
    stop: () => {
      offFrames()
      unsubscribeFromLiveStream(streamId)
      controller.dispose()
    },
  })
  return controller
}

function releaseHearts(streamId: string) {
  const entry = heartsRegistry.get(streamId)
  if (!entry) return
  entry.refs -= 1
  if (entry.refs > 0) return
  heartsRegistry.delete(streamId)
  entry.stop()
}

const NO_HEARTS: HeartsSnapshot = { count: 0, floating: [], blocked: null }
const noSubscribe = () => () => {}
const noHearts = () => NO_HEARTS

export interface LiveHearts extends HeartsSnapshot {
  /** One tap; false when hearts are blocked. */
  tap: () => boolean
  /** Clears a server refusal once its cause is gone (the stream is on air again). */
  unblock: () => void
}

/** `heartCount` is the stream row's heart_count: it seeds the total and never lowers it. */
export function useLiveHearts(streamId: string, heartCount?: number | null): LiveHearts {
  const [controller, setController] = React.useState<HeartsController | null>(null)
  React.useEffect(() => {
    if (!streamId) return
    setController(acquireHearts(streamId))
    return () => {
      setController(null)
      releaseHearts(streamId)
    }
  }, [streamId])
  React.useEffect(() => {
    controller?.seed(heartCount)
  }, [controller, heartCount])
  const snapshot = React.useSyncExternalStore(controller ? controller.subscribe : noSubscribe, controller ? controller.getSnapshot : noHearts, noHearts)
  const tap = React.useCallback(() => controller?.tap() ?? false, [controller])
  const unblock = React.useCallback(() => controller?.unblock(), [controller])
  return { ...snapshot, tap, unblock }
}

/** Top supporters: refreshed every 15 s while the stream is on air, read once after it ended. */
export function useSupporters(streamId: string | null | undefined, status: unknown, limit = 10) {
  return useQuery<Supporter[]>({
    queryKey: liveDiscoveryKeys.supporters(streamId ?? ""),
    queryFn: async () => parseSupporters((await api.get(supportersPath(streamId as string), { params: { limit } })).data),
    enabled: !!streamId,
    staleTime: 10_000,
    refetchInterval: supportersRefetchMs(status),
    retry: false,
  })
}

// ── Streaming software (encoder streams) ──────────────────────────────
//
// The server URL and stream key for the host's streaming software. The key
// is a secret: it lives in this component's state only, never in the query
// cache, a URL, storage or a log, and it is dropped as soon as `enabled`
// goes false (the stream is live or over).

export interface StreamIngressState {
  ingress: StreamIngress | null
  loading: boolean
  resetting: boolean
  error: unknown
  /** Ask again after a failure. */
  retry: () => void
  /** "Reset key": DELETE then POST. The old key stops working. */
  reset: () => Promise<void>
}

export function useStreamIngress(streamId: string, enabled: boolean): StreamIngressState {
  const [ingress, setIngress] = React.useState<StreamIngress | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)
  const [attempt, setAttempt] = React.useState(0)
  // One POST per (stream, attempt): StrictMode runs the effect twice, and
  // the answer of a superseded request is ignored.
  const askedRef = React.useRef("")
  const seqRef = React.useRef(0)

  React.useEffect(() => {
    if (!enabled || !streamId) {
      askedRef.current = ""
      seqRef.current += 1
      setIngress(null)
      setLoading(false)
      setError(null)
      return
    }
    const key = `${streamId}:${attempt}`
    if (askedRef.current === key) return
    askedRef.current = key
    const seq = ++seqRef.current
    setLoading(true)
    setError(null)
    requestIngress(api, streamId)
      .then((row) => { if (seqRef.current === seq) setIngress(row) })
      .catch((err: unknown) => { if (seqRef.current === seq) setError(err) })
      .finally(() => { if (seqRef.current === seq) setLoading(false) })
  }, [streamId, enabled, attempt])

  const retry = React.useCallback(() => setAttempt((n) => n + 1), [])

  const reset = React.useCallback(async () => {
    const seq = ++seqRef.current
    setResetting(true)
    setError(null)
    // The old key is dead from the DELETE on: never leave it on screen.
    setIngress(null)
    try {
      const row = await resetIngress(api, streamId)
      if (seqRef.current === seq) setIngress(row)
    } catch (err) {
      if (seqRef.current === seq) setError(err)
    } finally {
      setResetting(false)
    }
  }, [streamId])

  return { ingress, loading, resetting, error, retry, reset }
}

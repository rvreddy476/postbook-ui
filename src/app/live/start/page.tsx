"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
  Heart,
  Loader2,
  MessageSquare,
  MonitorPlay,
  Pin,
  Radio,
  Send,
  Shield,
  Users,
  Video,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

import { AppShell } from "@/features/reels/components/AppShell";
import { ReelPlayer } from "@/features/reels/components/ReelPlayer";
import { useMyProfile } from "@/hooks/useEditProfile";
import { useBatchProfiles } from "@/hooks/useProfile";
import {
  addWordFilter,
  createLiveStream,
  endLiveStream,
  getLiveChatMessages,
  getLiveStream,
  getMutedUsers,
  getViewerCount,
  getWordFilters,
  goLive,
  listHostStreams,
  listUpcomingLiveStreams,
  muteLiveUser,
  pinLiveChatMessage,
  removeWordFilter,
  scheduleLiveStream,
  sendLiveChatMessage,
  unmuteLiveUser,
} from "@/features/live/api";
import { applyLiveRealtimeEvent } from "@/features/live/cache";
import { liveKeys } from "@/features/live/queryKeys";
import { useLiveStreamRoom } from "@/features/live/useLiveStreamRoom";
import {
  formatDateTime,
  formatRelativeTime,
  getPreferredLiveVideoUrl,
  messageFromError,
  resolvePinnedLiveMessage,
  shortUserId,
} from "@/features/live/utils";
import { Avatar } from "@/components/LetterAvatar";

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "followers", label: "Followers Only" },
  { value: "private", label: "Private" },
] as const;

function nextDayLocalValue() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

export default function LiveStartPage() {
  const queryClient = useQueryClient();
  const { data: myProfile } = useMyProfile();
  const hostId = myProfile?.id;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  const [scheduleAt, setScheduleAt] = useState(nextDayLocalValue);
  const [cameraOn, setCameraOn] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [wordFilterDraft, setWordFilterDraft] = useState("");
  const [previewMuted, setPreviewMuted] = useState(true);

  const hostStreamsQuery = useQuery({
    queryKey: liveKeys.hostStreams(hostId),
    queryFn: () => listHostStreams(hostId!, 10),
    enabled: !!hostId,
    staleTime: 15_000,
  });

  const currentStream =
    hostStreamsQuery.data?.find((stream) => stream.status === "live") ??
    hostStreamsQuery.data?.find((stream) => stream.status === "idle") ??
    null;

  const currentStreamQuery = useQuery({
    queryKey: liveKeys.stream(currentStream?.id),
    queryFn: () => getLiveStream(currentStream!.id),
    enabled: !!currentStream?.id,
    staleTime: 10_000,
  });

  const viewerCountQuery = useQuery({
    queryKey: liveKeys.viewerCount(currentStream?.id),
    queryFn: () => getViewerCount(currentStream!.id),
    enabled: !!currentStream?.id,
    staleTime: 0,
  });

  const upcomingQuery = useQuery({
    queryKey: liveKeys.upcoming(),
    queryFn: () => listUpcomingLiveStreams(20),
    staleTime: 30_000,
  });

  const streamDetail = currentStreamQuery.data ?? currentStream;

  const chatQuery = useQuery({
    queryKey: liveKeys.chat(streamDetail?.id),
    queryFn: () => getLiveChatMessages(streamDetail!.id, 100),
    enabled: !!streamDetail?.id,
    staleTime: 0,
  });

  const mutesQuery = useQuery({
    queryKey: liveKeys.mutes(streamDetail?.id),
    queryFn: () => getMutedUsers(streamDetail!.id),
    enabled: !!streamDetail?.id,
    staleTime: 0,
  });

  const wordFiltersQuery = useQuery({
    queryKey: liveKeys.wordFilters(streamDetail?.id),
    queryFn: () => getWordFilters(streamDetail!.id),
    enabled: !!streamDetail?.id,
    staleTime: 0,
  });

  useLiveStreamRoom(streamDetail?.id, (event) => {
    applyLiveRealtimeEvent(queryClient, event);
  });

  const chatMessages = chatQuery.data ?? [];
  const pinnedMessage = resolvePinnedLiveMessage(chatMessages);
  const mutedUsers = mutesQuery.data ?? [];
  const mutedUserIds = new Set(mutedUsers.map((mute) => mute.user_id));
  const wordFilters = wordFiltersQuery.data ?? [];
  const myScheduledStreams = (upcomingQuery.data ?? []).filter((stream) => stream.host_id === hostId);
  const hasValidTitle = title.trim().length > 0;
  const isScheduleValid = scheduleAt ? new Date(scheduleAt).getTime() > Date.now() : false;
  const currentViewerCount = viewerCountQuery.data ?? 0;
  const preferredVideoUrl = getPreferredLiveVideoUrl(streamDetail);

  const authorIds = [
    ...new Set([
      ...(streamDetail ? [streamDetail.host_id] : []),
      ...chatMessages.map((message) => message.user_id),
      ...mutedUsers.map((mute) => mute.user_id),
    ]),
  ];
  const profilesQuery = useBatchProfiles(authorIds);

  const getProfileLabel = (userId: string) => {
    const profile = profilesQuery.data?.get(userId);
    return profile?.display_name || profile?.username || shortUserId(userId);
  };

  const getAvatarSrc = (userId: string) => {
    const profile = profilesQuery.data?.get(userId);
    return profile?.avatar_media_id ? `${apiBaseUrl}/v1/media/${profile.avatar_media_id}/serve` : null;
  };

  const refreshLiveQueries = async (streamId = currentStream?.id ?? null) => {
    const tasks: Promise<unknown>[] = [
      queryClient.invalidateQueries({ queryKey: liveKeys.hostStreams(hostId) }),
      queryClient.invalidateQueries({ queryKey: liveKeys.upcoming() }),
      queryClient.invalidateQueries({ queryKey: liveKeys.streams() }),
    ];
    if (streamId) {
      tasks.push(queryClient.invalidateQueries({ queryKey: liveKeys.stream(streamId) }));
      tasks.push(queryClient.invalidateQueries({ queryKey: liveKeys.viewerCount(streamId) }));
      tasks.push(queryClient.invalidateQueries({ queryKey: liveKeys.chat(streamId) }));
      tasks.push(queryClient.invalidateQueries({ queryKey: liveKeys.mutes(streamId) }));
      tasks.push(queryClient.invalidateQueries({ queryKey: liveKeys.wordFilters(streamId) }));
    }
    await Promise.all(tasks);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createLiveStream({
        title: title.trim(),
        description: description.trim(),
        visibility,
      }),
    onSuccess: async (stream) => {
      queryClient.setQueryData(liveKeys.stream(stream.id), stream);
      await refreshLiveQueries(stream.id);
    },
  });

  const goLiveMutation = useMutation({
    mutationFn: (streamId: string) => goLive(streamId),
    onSuccess: async (_result, streamId) => {
      await refreshLiveQueries(streamId);
    },
  });

  const endMutation = useMutation({
    mutationFn: (streamId: string) => endLiveStream(streamId),
    onSuccess: async (_result, streamId) => {
      await refreshLiveQueries(streamId);
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: () =>
      scheduleLiveStream({
        title: title.trim(),
        description: description.trim(),
        scheduled_at: new Date(scheduleAt).toISOString(),
      }),
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setScheduleAt(nextDayLocalValue());
      await refreshLiveQueries();
    },
  });

  const sendChatMutation = useMutation({
    mutationFn: (input: { streamId: string; message: string }) => sendLiveChatMessage(input),
    onSuccess: (message, variables) => {
      setChatDraft("");
      applyLiveRealtimeEvent(queryClient, {
        type: "live_chat_message",
        stream_id: variables.streamId,
        message_id: message.id,
        user_id: message.user_id,
        message: message.message,
        is_pinned: message.is_pinned,
        created_at: message.created_at,
      });
    },
  });

  const pinChatMutation = useMutation({
    mutationFn: (input: { streamId: string; messageId: string }) => pinLiveChatMessage(input),
    onSuccess: (_result, variables) => {
      applyLiveRealtimeEvent(queryClient, {
        type: "live_message_pinned",
        stream_id: variables.streamId,
        message_id: variables.messageId,
      });
    },
  });

  const muteMutation = useMutation({
    mutationFn: (input: { streamId: string; userId: string }) => muteLiveUser(input.streamId, input.userId),
    onSuccess: (_result, variables) => {
      applyLiveRealtimeEvent(queryClient, {
        type: "live_user_muted",
        stream_id: variables.streamId,
        user_id: variables.userId,
        muted_by: hostId ?? undefined,
        muted_at: new Date().toISOString(),
      });
    },
  });

  const unmuteMutation = useMutation({
    mutationFn: (input: { streamId: string; userId: string }) => unmuteLiveUser(input.streamId, input.userId),
    onSuccess: (_result, variables) => {
      applyLiveRealtimeEvent(queryClient, {
        type: "live_user_unmuted",
        stream_id: variables.streamId,
        user_id: variables.userId,
        unmuted_by: hostId ?? undefined,
        updated_at: new Date().toISOString(),
      });
    },
  });

  const addWordFilterMutation = useMutation({
    mutationFn: (input: { streamId: string; word: string }) => addWordFilter(input.streamId, input.word),
    onSuccess: (_result, variables) => {
      setWordFilterDraft("");
      applyLiveRealtimeEvent(queryClient, {
        type: "live_word_filter_added",
        stream_id: variables.streamId,
        word: variables.word,
        added_by: hostId ?? undefined,
        updated_at: new Date().toISOString(),
      });
    },
  });

  const removeWordFilterMutation = useMutation({
    mutationFn: (input: { streamId: string; word: string }) => removeWordFilter(input.streamId, input.word),
    onSuccess: (_result, variables) => {
      applyLiveRealtimeEvent(queryClient, {
        type: "live_word_filter_removed",
        stream_id: variables.streamId,
        word: variables.word,
        removed_by: hostId ?? undefined,
        updated_at: new Date().toISOString(),
      });
    },
  });

  const actionError =
    createMutation.error ??
    goLiveMutation.error ??
    endMutation.error ??
    scheduleMutation.error ??
    viewerCountQuery.error;
  const chatError = chatQuery.error ?? sendChatMutation.error;
  const moderationError =
    mutesQuery.error ??
    wordFiltersQuery.error ??
    pinChatMutation.error ??
    muteMutation.error ??
    unmuteMutation.error ??
    addWordFilterMutation.error ??
    removeWordFilterMutation.error;
  const moderationBusy =
    pinChatMutation.isPending ||
    muteMutation.isPending ||
    unmuteMutation.isPending ||
    addWordFilterMutation.isPending ||
    removeWordFilterMutation.isPending;

  const handleCopy = async () => {
    if (!streamDetail?.stream_key) return;
    await navigator.clipboard.writeText(streamDetail.stream_key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell sectionLabel="Live">
      <div className="mx-auto max-w-[1100px] px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
            <Radio className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-brand-text">Live Control Room</h1>
            <p className="text-[12px] text-brand-text/60">Create a stream key, schedule a broadcast, moderate chat live, or take your prepared stream live.</p>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <div className="overflow-hidden rounded-2xl border border-brand-divider bg-black shadow-sm" style={{ aspectRatio: "16/9" }}>
              {streamDetail && preferredVideoUrl ? (
                <ReelPlayer
                  videoUrl={preferredVideoUrl}
                  posterUrl={streamDetail.thumbnail_url || ""}
                  muted={previewMuted}
                  active
                  contain
                  onToggleMuted={() => setPreviewMuted((current) => !current)}
                  onBoost={() => {}}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  {cameraOn ? (
                    <div className="flex flex-col items-center gap-3">
                      <Video className="h-8 w-8 text-white/40" />
                      <p className="text-[13px] text-white/50">
                        {streamDetail?.status === "live"
                          ? "Waiting for live playback to appear from the ingest origin"
                          : "Camera preview placeholder"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <MonitorPlay className="h-8 w-8 text-white/40" />
                      <p className="text-[13px] text-white/50">Screen share mode placeholder</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setCameraOn((current) => !current)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-semibold transition-all ${
                  cameraOn ? "bg-slate-900 text-white" : "bg-brand-secondary text-brand-highlight hover:bg-brand-secondary"
                }`}
              >
                <Video className="h-3.5 w-3.5" />
                Camera {cameraOn ? "On" : "Off"}
              </button>
              <button
                type="button"
                onClick={() => setChatEnabled((current) => !current)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-semibold transition-all ${
                  chatEnabled ? "bg-slate-900 text-white" : "bg-brand-secondary text-brand-highlight hover:bg-brand-secondary"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Chat {chatEnabled ? "On" : "Off"}
              </button>
            </div>

            {streamDetail ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-brand-divider/60 bg-brand-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-text/50">Current Stream</p>
                    <h2 className="mt-1 text-[16px] font-bold text-brand-text">{streamDetail.title}</h2>
                    {streamDetail.description ? (
                      <p className="mt-1 text-[12px] leading-relaxed text-brand-text/60">{streamDetail.description}</p>
                    ) : null}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
                    streamDetail.status === "live"
                      ? "bg-rose-100 text-rose-600"
                      : streamDetail.status === "idle"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                  }`}>
                    {streamDetail.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-brand-secondary px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] text-brand-text/60">
                      <Users className="h-3.5 w-3.5" />
                      Live Viewers
                    </div>
                    <p className="mt-1 text-[16px] font-bold text-brand-text">{currentViewerCount}</p>
                  </div>
                  <div className="rounded-xl bg-brand-secondary px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] text-brand-text/60">
                      <Heart className="h-3.5 w-3.5" />
                      Likes
                    </div>
                    <p className="mt-1 text-[16px] font-bold text-brand-text">{streamDetail.like_count}</p>
                  </div>
                  <div className="rounded-xl bg-brand-secondary px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] text-brand-text/60">
                      <Users className="h-3.5 w-3.5" />
                      Peak
                    </div>
                    <p className="mt-1 text-[16px] font-bold text-brand-text">{streamDetail.peak_viewers}</p>
                  </div>
                  <div className="rounded-xl bg-brand-secondary px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] text-brand-text/60">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Visibility
                    </div>
                    <p className="mt-1 text-[16px] font-bold capitalize text-brand-text">{streamDetail.visibility}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-brand-divider bg-[#FAFAF8] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-brand-text">Stream key</p>
                      <p className="mt-1 truncate font-mono text-[12px] text-brand-text/70">
                        {currentStreamQuery.isLoading ? "Loading stream key..." : streamDetail.stream_key || "Hidden until the stream detail loads."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopy}
                      disabled={!streamDetail.stream_key}
                      className="shrink-0 rounded-lg border border-brand-divider bg-brand-card px-3 py-2 text-[12px] font-semibold text-brand-highlight transition-colors hover:bg-brand-secondary disabled:opacity-40"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-brand-text/60">
                    Publish to {streamDetail.ingest_url || "your configured ingest origin"} with this key before pressing {streamDetail.status === "idle" ? "Go Live" : "End Stream"}.
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-brand-divider bg-[#FAFAF8] p-4">
                    <p className="text-[12px] font-semibold text-brand-text">Ingest Endpoint</p>
                    <p className="mt-1 break-all font-mono text-[12px] text-brand-text/70">
                      {streamDetail.ingest_url || "No ingest endpoint configured."}
                    </p>
                    <p className="mt-2 text-[11px] text-brand-text/60">
                      Publish using {(streamDetail.ingest_protocol || "rtmp").toUpperCase()} and the stream key above.
                    </p>
                  </div>
                  <div className="rounded-xl border border-brand-divider bg-[#FAFAF8] p-4">
                    <p className="text-[12px] font-semibold text-brand-text">Playback Endpoint</p>
                    <p className="mt-1 break-all font-mono text-[12px] text-brand-text/70">
                      {streamDetail.playback_url || streamDetail.replay_url || "Playback will appear once the stream is live."}
                    </p>
                    <p className="mt-2 text-[11px] text-brand-text/60">
                      {streamDetail.playback_url
                        ? `${(streamDetail.playback_protocol || "hls").toUpperCase()} playback is available for viewers now.`
                        : streamDetail.status === "live"
                          ? "Waiting for the playback manifest to appear from the media origin."
                          : "Viewer playback activates after you go live."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {streamDetail.status === "idle" ? (
                    <button
                      type="button"
                      onClick={() => goLiveMutation.mutate(streamDetail.id)}
                      disabled={goLiveMutation.isPending}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-5 py-3 text-[13px] font-bold text-white shadow-lg shadow-rose-200 transition-all hover:shadow-xl hover:shadow-rose-300 disabled:opacity-40"
                    >
                      {goLiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                      Go Live
                    </button>
                  ) : streamDetail.status === "live" ? (
                    <button
                      type="button"
                      onClick={() => endMutation.mutate(streamDetail.id)}
                      disabled={endMutation.isPending}
                      className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-[13px] font-bold text-white transition-colors hover:bg-brand-text disabled:opacity-40"
                    >
                      {endMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                      End Stream
                    </button>
                  ) : null}

                  {streamDetail.status === "live" ? (
                    <Link
                      href={`/live?streamId=${streamDetail.id}`}
                      className="rounded-xl border border-brand-divider bg-brand-card px-5 py-3 text-[13px] font-semibold text-brand-text transition-colors hover:bg-brand-secondary"
                    >
                      Open Viewer Page
                    </Link>
                  ) : null}

                  <p className="text-[12px] text-brand-text/60">
                    {streamDetail.status === "idle"
                      ? "Prepared and waiting for you to begin broadcasting."
                      : streamDetail.status === "live"
                        ? `Started ${formatDateTime(streamDetail.started_at)}`
                        : `Ended ${formatDateTime(streamDetail.ended_at)}`}
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="rounded-2xl border border-dashed border-brand-divider bg-brand-card px-5 py-4 text-[13px] text-brand-text/60">
                No prepared stream yet. Create a stream key from the control panel to begin.
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-brand-divider/60 bg-brand-card p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[14px] font-bold text-brand-text">Live Comments</h2>
                  <p className="text-[12px] text-brand-text/60">Host view of the current stream chat with live moderation.</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  chatEnabled ? "bg-slate-900 text-white" : "bg-brand-secondary text-brand-highlight"
                }`}>
                  {chatEnabled ? "Realtime On" : "Chat Paused"}
                </span>
              </div>

              {pinnedMessage ? (
                <div className="mt-4 rounded-xl border border-[#E5A93D]/20 bg-[#E5A93D]/5 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#A46D12]">
                    <Pin className="h-3.5 w-3.5" />
                    Pinned Comment
                  </div>
                  <p className="mt-2 text-[12px] font-semibold text-brand-text/75">{getProfileLabel(pinnedMessage.user_id)}</p>
                  <p className="mt-1 text-[13px] text-brand-text">{pinnedMessage.message}</p>
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-brand-divider bg-[#FAFAF8]">
                <div className="max-h-[360px] overflow-y-auto px-4 py-3">
                  {!streamDetail ? (
                    <p className="text-[12px] text-brand-text/60">Prepare a stream to start collecting live comments.</p>
                  ) : !chatEnabled ? (
                    <p className="text-[12px] text-brand-text/60">Chat updates are paused in the control room. Re-enable chat to review the live backlog.</p>
                  ) : chatQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-[12px] text-brand-text/60">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading comments...
                    </div>
                  ) : chatMessages.length > 0 ? (
                    <div className="space-y-3">
                      {chatMessages.map((message) => (
                        <div key={message.id} className="rounded-xl bg-brand-card px-3 py-3 shadow-sm">
                          <div className="flex items-start gap-3">
                            <Avatar src={getAvatarSrc(message.user_id)} name={getProfileLabel(message.user_id)} seed={message.user_id} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-[12px] font-semibold text-brand-text">{getProfileLabel(message.user_id)}</p>
                                <span className="text-[11px] text-brand-text/50">{formatRelativeTime(message.created_at)}</span>
                                {message.is_pinned ? (
                                  <span className="rounded-full bg-[#E5A93D]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#A46D12]">
                                    Pinned
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-brand-text/80">{message.message}</p>
                            </div>
                            {message.user_id !== hostId ? (
                              <div className="flex shrink-0 flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => streamDetail && pinChatMutation.mutate({ streamId: streamDetail.id, messageId: message.id })}
                                  disabled={!streamDetail || pinChatMutation.isPending || message.is_pinned}
                                  className="rounded-lg border border-brand-divider bg-brand-card px-2.5 py-1.5 text-[11px] font-semibold text-brand-highlight transition-colors hover:bg-brand-secondary disabled:opacity-40"
                                >
                                  Pin
                                </button>
                                {!mutedUserIds.has(message.user_id) ? (
                                  <button
                                    type="button"
                                    onClick={() => streamDetail && muteMutation.mutate({ streamId: streamDetail.id, userId: message.user_id })}
                                    disabled={!streamDetail || muteMutation.isPending}
                                    className="rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-40"
                                  >
                                    Mute
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-brand-text/60">
                      {streamDetail.status === "live"
                        ? "No comments yet. Messages will appear here as viewers chat."
                        : "Comments will start appearing once the stream is live."}
                    </p>
                  )}
                </div>

                <div className="border-t border-brand-divider bg-brand-card px-4 py-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={chatDraft}
                      onChange={(event) => setChatDraft(event.target.value)}
                      rows={2}
                      maxLength={500}
                      disabled={!streamDetail || !chatEnabled || streamDetail.status !== "live" || sendChatMutation.isPending}
                      placeholder={
                        !streamDetail
                          ? "Prepare a stream first"
                          : streamDetail.status !== "live"
                            ? "Go live to send comments"
                            : !chatEnabled
                              ? "Chat is paused in the control room"
                              : "Send a message as host"
                      }
                      className="min-h-[52px] flex-1 rounded-xl border border-brand-divider bg-[#FAFAF8] px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => streamDetail && sendChatMutation.mutate({ streamId: streamDetail.id, message: chatDraft.trim() })}
                      disabled={!streamDetail || !chatEnabled || streamDetail.status !== "live" || !chatDraft.trim() || sendChatMutation.isPending}
                      className="flex h-[52px] shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[12px] font-semibold text-white transition-colors hover:bg-brand-text disabled:opacity-40"
                    >
                      {sendChatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-brand-text/50">
                    <span>{chatDraft.length}/500</span>
                    <span>{streamDetail?.status === "live" ? "Host chat is live" : "Chat send unlocks once the stream is live"}</span>
                  </div>
                </div>
              </div>

              {chatError ? (
                <p className="mt-4 rounded-xl border border-[#E8527A]/20 bg-[#E8527A]/5 px-4 py-3 text-[12px] text-[#E8527A]">
                  {messageFromError(chatError)}
                </p>
              ) : null}
            </motion.div>
          </div>

          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-brand-divider/60 bg-brand-card p-5 shadow-sm"
            >
              <h2 className="mb-4 text-[14px] font-bold text-brand-text">Stream Setup</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">
                    Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={100}
                    className="h-10 w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10"
                    placeholder="What are you streaming?"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">Description</label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2.5 text-[13px] text-brand-text outline-none focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10"
                    placeholder="Tell followers what this stream is about."
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">Visibility</label>
                  <div className="relative">
                    <select
                      value={visibility}
                      onChange={(event) => setVisibility(event.target.value as typeof visibility)}
                      className="h-10 w-full appearance-none rounded-xl border border-brand-divider bg-brand-secondary px-3 pr-8 text-[13px] text-brand-text outline-none focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10"
                    >
                      {VISIBILITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-text/60" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-brand-highlight">Schedule For Later</label>
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(event) => setScheduleAt(event.target.value)}
                    className="h-10 w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10"
                  />
                </div>
              </div>

              {actionError ? (
                <p className="mt-4 rounded-xl border border-[#E8527A]/20 bg-[#E8527A]/5 px-4 py-3 text-[12px] text-[#E8527A]">
                  {messageFromError(actionError)}
                </p>
              ) : null}

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={!hasValidTitle || !!currentStream || createMutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 py-3 text-[14px] font-bold text-white shadow-lg shadow-rose-200 transition-all hover:shadow-xl hover:shadow-rose-300 disabled:opacity-40 disabled:shadow-none"
                >
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                  {currentStream ? "Current Stream Already Prepared" : "Prepare Stream Key"}
                </button>

                <button
                  type="button"
                  onClick={() => scheduleMutation.mutate()}
                  disabled={!hasValidTitle || !isScheduleValid || scheduleMutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-divider bg-brand-card py-3 text-[13px] font-semibold text-brand-text transition-colors hover:bg-brand-secondary disabled:opacity-40"
                >
                  {scheduleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                  Schedule Stream
                </button>
              </div>

              <p className="mt-3 text-center text-[11px] text-brand-text/60">
                Preparing a stream creates your host session and stream key. Scheduling creates a future reminder entry.
              </p>
            </motion.div>

            <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-rose-500" />
                  <h2 className="text-[14px] font-bold text-brand-text">Moderation</h2>
                </div>
                <span className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-600">Realtime</span>
              </div>

              <p className="mt-3 text-[12px] text-brand-text/60">Pin chat messages, mute viewers, and maintain blocked words without leaving the control room.</p>

              <div className="mt-5">
                <p className="text-[12px] font-semibold text-brand-text">Muted Viewers</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {mutedUsers.length > 0 ? (
                    mutedUsers.map((mute) => (
                      <div key={mute.user_id} className="inline-flex items-center gap-2 rounded-full border border-brand-divider bg-[#FAFAF8] px-3 py-1.5 text-[12px] text-brand-text">
                        <span>{getProfileLabel(mute.user_id)}</span>
                        <button
                          type="button"
                          onClick={() => streamDetail && unmuteMutation.mutate({ streamId: streamDetail.id, userId: mute.user_id })}
                          disabled={!streamDetail || unmuteMutation.isPending}
                          className="text-brand-text/45 transition-colors hover:text-brand-text disabled:opacity-40"
                          aria-label={`Unmute ${getProfileLabel(mute.user_id)}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-brand-text/60">No one is muted right now.</p>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-[12px] font-semibold text-brand-text">Blocked Words</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {wordFilters.length > 0 ? (
                    wordFilters.map((filter) => (
                      <div key={filter.word} className="inline-flex items-center gap-2 rounded-full border border-brand-divider bg-[#FAFAF8] px-3 py-1.5 text-[12px] text-brand-text">
                        <span>{filter.word}</span>
                        <button
                          type="button"
                          onClick={() => streamDetail && removeWordFilterMutation.mutate({ streamId: streamDetail.id, word: filter.word })}
                          disabled={!streamDetail || removeWordFilterMutation.isPending}
                          className="text-brand-text/45 transition-colors hover:text-brand-text disabled:opacity-40"
                          aria-label={`Remove blocked word ${filter.word}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-brand-text/60">No blocked words configured.</p>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    value={wordFilterDraft}
                    onChange={(event) => setWordFilterDraft(event.target.value)}
                    placeholder="Add blocked word or phrase"
                    className="h-10 flex-1 rounded-xl border border-brand-divider bg-brand-secondary px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10"
                  />
                  <button
                    type="button"
                    onClick={() => streamDetail && addWordFilterMutation.mutate({ streamId: streamDetail.id, word: wordFilterDraft.trim() })}
                    disabled={!streamDetail || !wordFilterDraft.trim() || addWordFilterMutation.isPending}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-text disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>

              {moderationError ? (
                <p className="mt-4 rounded-xl border border-[#E8527A]/20 bg-[#E8527A]/5 px-4 py-3 text-[12px] text-[#E8527A]">
                  {messageFromError(moderationError)}
                </p>
              ) : moderationBusy ? (
                <p className="mt-4 text-[12px] text-brand-text/50">Applying moderation update...</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-text/60" />
                <h2 className="text-[14px] font-bold text-brand-text">Upcoming Scheduled Streams</h2>
              </div>

              <div className="mt-4 space-y-3">
                {upcomingQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-[12px] text-brand-text/60">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading scheduled streams...
                  </div>
                ) : myScheduledStreams.length > 0 ? (
                  myScheduledStreams.map((stream) => (
                    <div key={stream.id} className="rounded-xl border border-brand-divider bg-[#FAFAF8] p-4">
                      <p className="text-[13px] font-semibold text-brand-text">{stream.title}</p>
                      {stream.description ? (
                        <p className="mt-1 text-[12px] text-brand-text/60">{stream.description}</p>
                      ) : null}
                      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-brand-text/50">
                        {formatDateTime(stream.scheduled_at)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-brand-divider px-4 py-4 text-[12px] text-brand-text/60">
                    No upcoming streams scheduled from this account yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}



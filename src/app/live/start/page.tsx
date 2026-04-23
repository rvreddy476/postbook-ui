"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  Heart,
  Loader2,
  MessageSquare,
  MonitorPlay,
  Pin,
  Radio,
  Send,
  Shield,
  Signal,
  Users,
  Video,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { AppShell } from "@/features/reels/components/AppShell";
import { ReelPlayer } from "@/features/reels/components/ReelPlayer";
import { useBrowserLivePublisher } from "@/features/live/browserPublish";
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

/* ───────────────────────────── page ───────────────────────────── */

export default function LiveStartPage() {
  const queryClient = useQueryClient();
  const { data: myProfile } = useMyProfile();
  const hostId = myProfile?.id;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  const [scheduleAt, setScheduleAt] = useState(nextDayLocalValue);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedIngest, setCopiedIngest] = useState(false);
  const [copiedPublish, setCopiedPublish] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [wordFilterDraft, setWordFilterDraft] = useState("");
  const [previewMuted, setPreviewMuted] = useState(true);
  const [activeTab, setActiveTab] = useState<"setup" | "moderation">("setup");

  /* ── queries ── */
  const hostStreamsQuery = useQuery({
    queryKey: liveKeys.hostStreams(hostId),
    queryFn: () => listHostStreams(hostId!, 10),
    enabled: !!hostId,
    staleTime: 15_000,
  });

  const currentStream =
    hostStreamsQuery.data?.find((s) => s.status === "live") ??
    hostStreamsQuery.data?.find((s) => s.status === "idle") ??
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
  const browserPublisher = useBrowserLivePublisher(streamDetail?.publish_url ?? null);

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

  /* ── derived ── */
  const chatMessages = chatQuery.data ?? [];
  const pinnedMessage = resolvePinnedLiveMessage(chatMessages);
  const mutedUsers = mutesQuery.data ?? [];
  const mutedUserIds = new Set(mutedUsers.map((m) => m.user_id));
  const wordFilters = wordFiltersQuery.data ?? [];
  const myScheduledStreams = (upcomingQuery.data ?? []).filter((s) => s.host_id === hostId);
  const hasValidTitle = title.trim().length > 0;
  const isScheduleValid = scheduleAt ? new Date(scheduleAt).getTime() > Date.now() : false;
  const currentViewerCount = viewerCountQuery.data ?? 0;
  const preferredVideoUrl = getPreferredLiveVideoUrl(streamDetail);
  const hasEncoderSignal = !!(streamDetail && preferredVideoUrl);
  const isWaitingForEncoder = !!(streamDetail && (streamDetail.status === "idle" || streamDetail.status === "live") && !preferredVideoUrl);
  const hasBrowserPreview = !!browserPublisher.localStream;
  const isBrowserPublishing = browserPublisher.status === "requesting" || browserPublisher.status === "publishing";

  const authorIds = [
    ...new Set([
      ...(streamDetail ? [streamDetail.host_id] : []),
      ...chatMessages.map((m) => m.user_id),
      ...mutedUsers.map((m) => m.user_id),
    ]),
  ];
  const profilesQuery = useBatchProfiles(authorIds);

  const getProfileLabel = (userId: string) => {
    const p = profilesQuery.data?.get(userId);
    return p?.display_name || p?.username || shortUserId(userId);
  };
  const getAvatarSrc = (userId: string) => {
    const p = profilesQuery.data?.get(userId);
    return p?.avatar_media_id ? `${apiBaseUrl}/v1/media/${p.avatar_media_id}/serve` : null;
  };

  /* ── auto-scroll chat ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  /* ── refresh helper ── */
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

  /* ── mutations ── */
  const createMutation = useMutation({
    mutationFn: () => createLiveStream({ title: title.trim(), description: description.trim(), visibility }),
    onSuccess: async (stream) => {
      queryClient.setQueryData(liveKeys.stream(stream.id), stream);
      await refreshLiveQueries(stream.id);
    },
  });

  const goLiveMutation = useMutation({
    mutationFn: (streamId: string) => goLive(streamId),
    onSuccess: async (_r, streamId) => { await refreshLiveQueries(streamId); },
  });

  const endMutation = useMutation({
    mutationFn: (streamId: string) => endLiveStream(streamId),
    onSuccess: async (_r, streamId) => { await refreshLiveQueries(streamId); },
  });

  const scheduleMutation = useMutation({
    mutationFn: () => scheduleLiveStream({ title: title.trim(), description: description.trim(), scheduled_at: new Date(scheduleAt).toISOString() }),
    onSuccess: async () => { setTitle(""); setDescription(""); setScheduleAt(nextDayLocalValue()); await refreshLiveQueries(); },
  });

  const sendChatMutation = useMutation({
    mutationFn: (input: { streamId: string; message: string }) => sendLiveChatMessage(input),
    onSuccess: (message, variables) => {
      setChatDraft("");
      applyLiveRealtimeEvent(queryClient, { type: "live_chat_message", stream_id: variables.streamId, message_id: message.id, user_id: message.user_id, message: message.message, is_pinned: message.is_pinned, created_at: message.created_at });
    },
  });

  const pinChatMutation = useMutation({
    mutationFn: (input: { streamId: string; messageId: string }) => pinLiveChatMessage(input),
    onSuccess: (_r, v) => { applyLiveRealtimeEvent(queryClient, { type: "live_message_pinned", stream_id: v.streamId, message_id: v.messageId }); },
  });

  const muteMutation = useMutation({
    mutationFn: (input: { streamId: string; userId: string }) => muteLiveUser(input.streamId, input.userId),
    onSuccess: (_r, v) => { applyLiveRealtimeEvent(queryClient, { type: "live_user_muted", stream_id: v.streamId, user_id: v.userId, muted_by: hostId ?? undefined, muted_at: new Date().toISOString() }); },
  });

  const unmuteMutation = useMutation({
    mutationFn: (input: { streamId: string; userId: string }) => unmuteLiveUser(input.streamId, input.userId),
    onSuccess: (_r, v) => { applyLiveRealtimeEvent(queryClient, { type: "live_user_unmuted", stream_id: v.streamId, user_id: v.userId, unmuted_by: hostId ?? undefined, updated_at: new Date().toISOString() }); },
  });

  const addWordFilterMutation = useMutation({
    mutationFn: (input: { streamId: string; word: string }) => addWordFilter(input.streamId, input.word),
    onSuccess: (_r, v) => { setWordFilterDraft(""); applyLiveRealtimeEvent(queryClient, { type: "live_word_filter_added", stream_id: v.streamId, word: v.word, added_by: hostId ?? undefined, updated_at: new Date().toISOString() }); },
  });

  const removeWordFilterMutation = useMutation({
    mutationFn: (input: { streamId: string; word: string }) => removeWordFilter(input.streamId, input.word),
    onSuccess: (_r, v) => { applyLiveRealtimeEvent(queryClient, { type: "live_word_filter_removed", stream_id: v.streamId, word: v.word, removed_by: hostId ?? undefined, updated_at: new Date().toISOString() }); },
  });

  const actionError = createMutation.error ?? goLiveMutation.error ?? endMutation.error ?? scheduleMutation.error;
  const moderationBusy = pinChatMutation.isPending || muteMutation.isPending || unmuteMutation.isPending || addWordFilterMutation.isPending || removeWordFilterMutation.isPending;

  /* ── copy helpers ── */
  const handleCopy = async () => {
    if (!streamDetail?.stream_key) return;
    await navigator.clipboard.writeText(streamDetail.stream_key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  const handleCopyIngest = async () => {
    if (!streamDetail?.ingest_url) return;
    await navigator.clipboard.writeText(streamDetail.ingest_url);
    setCopiedIngest(true);
    window.setTimeout(() => setCopiedIngest(false), 2000);
  };
  const handleCopyPublish = async () => {
    if (!streamDetail?.publish_url) return;
    await navigator.clipboard.writeText(streamDetail.publish_url);
    setCopiedPublish(true);
    window.setTimeout(() => setCopiedPublish(false), 2000);
  };

  /* ───────────────────────────── render ───────────────────────────── */

  return (
    <AppShell sectionLabel="Live">
      <div className="flex h-full flex-col">
        {/* ── Theater: Preview + Right panel ── */}
        <div className="flex min-h-0 flex-1">
          {/* Video / Preview column */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="relative flex-1 bg-black">
              {hasEncoderSignal ? (
                <ReelPlayer
                  videoUrl={preferredVideoUrl!}
                  posterUrl={streamDetail?.thumbnail_url || ""}
                  muted={previewMuted}
                  active
                  contain
                  loadingTitle="Connecting to your stream..."
                  errorTitle="Preview unavailable"
                  errorHint="Check your OBS connection and stream key."
                  onToggleMuted={() => setPreviewMuted((m) => !m)}
                  onBoost={() => {}}
                />
              ) : hasBrowserPreview ? (
                <div className="flex h-full flex-col bg-black">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[11px] uppercase tracking-wider text-white/45">
                    <span className="inline-flex items-center gap-2 font-bold text-cyan-300">
                      <Video className="h-3.5 w-3.5" />
                      Browser Camera Preview
                    </span>
                    <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-cyan-300">
                      {isBrowserPublishing ? "Publishing" : "Preview"}
                    </span>
                  </div>
                  <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
                    <video ref={browserPublisher.previewRef} autoPlay playsInline muted className="h-full w-full object-contain" />
                    <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-black/60 px-3 py-1.5 text-[11px] text-white/70 backdrop-blur-sm">
                      Camera and microphone are live locally.
                    </div>
                  </div>
                </div>
              ) : isWaitingForEncoder ? (
                <div className="flex h-full flex-col items-center justify-center gap-5 px-8">
                  <div className="relative">
                    <Wifi className="h-12 w-12 text-amber-400/70" />
                    <span className="absolute -right-1 -top-1 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-[16px] font-bold text-white/80">Waiting for encoder...</p>
                    <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/35">
                      Open OBS, paste the Server URL and Stream Key from the panel, and click Start Streaming.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-5 px-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
                    <MonitorPlay className="h-8 w-8 text-white/25" />
                  </div>
                  <div className="text-center">
                    <p className="text-[16px] font-bold text-white/60">Connect Your Encoder</p>
                    <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/30">
                      Create a stream key, then use OBS Studio to publish your broadcast.
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-5 py-3">
                    <ol className="space-y-1 text-[12px] text-white/40">
                      <li>1. Fill in a title &rarr; <strong className="text-white/60">Prepare Stream Key</strong></li>
                      <li>2. Copy <strong className="text-white/60">Server URL</strong> + <strong className="text-white/60">Stream Key</strong></li>
                      <li>3. OBS &rarr; Settings &rarr; Stream &rarr; Custom &rarr; paste</li>
                      <li>4. Start Streaming in OBS, then <strong className="text-white/60">Go Live</strong> here</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Overlays */}
              <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
                {streamDetail?.status === "live" && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold uppercase text-white shadow-lg">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    Live
                  </span>
                )}
                {streamDetail && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                    <Eye className="h-3 w-3" />
                    {currentViewerCount}
                  </span>
                )}
              </div>

              {/* Connection status */}
              <div className="absolute right-4 top-4">
                <span className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium backdrop-blur-sm ${
                  hasEncoderSignal
                    ? "bg-emerald-500/20 text-emerald-400"
                    : isWaitingForEncoder
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-white/10 text-white/40"
                }`}>
                  {hasEncoderSignal ? (
                    <><CheckCircle2 className="h-3.5 w-3.5" /> Signal OK</>
                  ) : isBrowserPublishing ? (
                    <><Video className="h-3.5 w-3.5 animate-pulse" /> Browser live</>
                  ) : isWaitingForEncoder ? (
                    <><Signal className="h-3.5 w-3.5 animate-pulse" /> Waiting</>
                  ) : (
                    <><WifiOff className="h-3.5 w-3.5" /> No stream</>
                  )}
                </span>
              </div>
            </div>

            {/* Control bar */}
            <div className="flex items-center justify-between gap-4 border-t border-brand-divider bg-brand-card px-5 py-3">
              <div className="flex items-center gap-3">
                {streamDetail ? (
                  <>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                      streamDetail.status === "live" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-600"
                    }`}>
                      {streamDetail.status}
                    </span>
                    <span className="text-[13px] font-bold text-brand-text">{streamDetail.title}</span>
                  </>
                ) : (
                  <span className="text-[13px] text-brand-text/40">No stream prepared</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {streamDetail?.status === "idle" && (
                  <button
                    type="button"
                    onClick={() => goLiveMutation.mutate(streamDetail.id)}
                    disabled={goLiveMutation.isPending}
                    className="flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-rose-600 disabled:opacity-40"
                  >
                    {goLiveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                    Go Live
                  </button>
                )}
                {streamDetail?.status === "live" && (
                  <>
                    <Link
                      href={`/live?streamId=${streamDetail.id}`}
                      className="rounded-lg border border-brand-divider px-4 py-2 text-[12px] font-semibold text-brand-text transition-colors hover:bg-brand-secondary"
                    >
                      Viewer Page
                    </Link>
                    <button
                      type="button"
                      onClick={() => endMutation.mutate(streamDetail.id)}
                      disabled={endMutation.isPending}
                      className="flex items-center gap-2 rounded-lg bg-brand-text px-4 py-2 text-[12px] font-bold text-brand-card transition-colors hover:opacity-90 disabled:opacity-40"
                    >
                      {endMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                      End Stream
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Right panel: Tabs ── */}
          <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-brand-divider bg-brand-card">
            {/* Tab bar */}
            <div className="flex border-b border-brand-divider">
              {(["setup", "moderation"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-[12px] font-bold uppercase tracking-wider transition-colors ${
                    activeTab === tab
                      ? "border-b-2 border-rose-500 text-rose-500"
                      : "text-brand-text/40 hover:text-brand-text/60"
                  }`}
                >
                  {tab === "setup" ? "Setup" : "Moderation"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {activeTab === "setup" ? (
                <div className="space-y-5 p-4">
                  {/* Stream setup form */}
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-text/40">
                        Title <span className="text-rose-400">*</span>
                      </label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={100}
                        className="h-9 w-full rounded-lg border border-brand-divider bg-brand-secondary px-3 text-[13px] text-brand-text outline-none focus:border-brand-text/20 focus:ring-1 focus:ring-brand-text/10"
                        placeholder="What are you streaming?"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-text/40">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-brand-divider bg-brand-secondary px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-text/20 focus:ring-1 focus:ring-brand-text/10"
                        placeholder="Optional description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-text/40">Visibility</label>
                        <select
                          value={visibility}
                          onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                          className="h-9 w-full appearance-none rounded-lg border border-brand-divider bg-brand-secondary px-3 text-[12px] text-brand-text outline-none"
                        >
                          {VISIBILITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-brand-text/40">Schedule</label>
                        <input
                          type="datetime-local"
                          value={scheduleAt}
                          onChange={(e) => setScheduleAt(e.target.value)}
                          className="h-9 w-full rounded-lg border border-brand-divider bg-brand-secondary px-3 text-[12px] text-brand-text outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => createMutation.mutate()}
                      disabled={!hasValidTitle || !!currentStream || createMutation.isPending}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-500 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-rose-600 disabled:opacity-30"
                    >
                      {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                      {currentStream ? "Stream Active" : "Prepare Stream Key"}
                    </button>
                    <button
                      type="button"
                      onClick={() => scheduleMutation.mutate()}
                      disabled={!hasValidTitle || !isScheduleValid || scheduleMutation.isPending}
                      className="flex items-center gap-2 rounded-lg border border-brand-divider px-3 py-2.5 text-[12px] font-semibold text-brand-text transition-colors hover:bg-brand-secondary disabled:opacity-30"
                    >
                      {scheduleMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
                      Schedule
                    </button>
                  </div>

                  {actionError && (
                    <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500">{messageFromError(actionError)}</p>
                  )}

                  {/* Browser Camera Publish */}
                  {streamDetail && (
                    <div className="space-y-3 rounded-xl border border-brand-divider bg-brand-secondary p-4">
                      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                        <Video className="h-3.5 w-3.5" />
                        Browser Camera / Mic
                      </p>

                      <CopyRow label="Publish URL" value={streamDetail.publish_url || "Not configured"} copied={copiedPublish} onCopy={handleCopyPublish} disabled={!streamDetail.publish_url} />

                      <div className="overflow-hidden rounded-xl border border-brand-divider bg-black">
                        {browserPublisher.localStream ? (
                          <video ref={browserPublisher.previewRef} autoPlay playsInline muted className="h-48 w-full object-cover" />
                        ) : (
                          <div className="flex h-48 items-center justify-center px-4 text-center text-[12px] text-white/30">
                            Start browser publish to see your camera preview.
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => browserPublisher.startPublishing()}
                          disabled={!streamDetail.publish_url || !browserPublisher.isSupported || browserPublisher.status === "requesting" || browserPublisher.status === "publishing" || streamDetail.status === "ended"}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-cyan-600 disabled:opacity-30"
                        >
                          {browserPublisher.status === "requesting" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
                          {browserPublisher.isPublishing ? "Publishing" : "Start Browser Publish"}
                        </button>
                        <button
                          type="button"
                          onClick={() => browserPublisher.stopPublishing()}
                          disabled={browserPublisher.status === "idle"}
                          className="rounded-lg border border-brand-divider px-4 py-2 text-[12px] font-semibold text-brand-text transition-colors hover:bg-brand-secondary disabled:opacity-30"
                        >
                          Stop
                        </button>
                      </div>

                      {!browserPublisher.isSupported && (
                        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[12px] text-amber-500">
                          Browser publishing needs camera and WebRTC support in your browser.
                        </p>
                      )}
                      {browserPublisher.error && (
                        <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500">{browserPublisher.error}</p>
                      )}
                      <p className="text-[11px] leading-relaxed text-brand-text/40">
                        Use your browser camera and microphone here. The OBS / encoder path stays available below.
                      </p>
                    </div>
                  )}

                  {/* OBS Settings */}
                  {streamDetail && (
                    <div className="space-y-3 rounded-xl border border-brand-divider bg-brand-secondary p-4">
                      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand-text/60">
                        <Video className="h-3.5 w-3.5" />
                        OBS / Encoder
                      </p>

                      <CopyRow label="Server URL" value={streamDetail.ingest_url || "Not configured"} copied={copiedIngest} onCopy={handleCopyIngest} disabled={!streamDetail.ingest_url} />
                      <CopyRow label="Stream Key" value={currentStreamQuery.isLoading ? "Loading..." : streamDetail.stream_key || "..."} copied={copied} onCopy={handleCopy} disabled={!streamDetail.stream_key} />

                      <p className="text-[11px] leading-relaxed text-brand-text/40">
                        OBS &rarr; Settings &rarr; Stream &rarr; Custom &rarr; paste both values.
                      </p>
                    </div>
                  )}

                  {/* Stats */}
                  {streamDetail && (
                    <div className="grid grid-cols-3 gap-2">
                      <StatBox icon={<Users className="h-3 w-3" />} label="Viewers" value={currentViewerCount} />
                      <StatBox icon={<Heart className="h-3 w-3" />} label="Likes" value={streamDetail.like_count} />
                      <StatBox icon={<Users className="h-3 w-3" />} label="Peak" value={streamDetail.peak_viewers} />
                    </div>
                  )}

                  {/* Playback endpoint */}
                  {streamDetail && (
                    <div className="rounded-xl border border-brand-divider bg-brand-secondary p-3">
                      <p className="text-[11px] font-bold text-brand-text/50">Playback</p>
                      <p className="mt-1 break-all font-mono text-[10px] text-brand-text/60">
                        {streamDetail.playback_url || streamDetail.replay_url || "Available after going live"}
                      </p>
                    </div>
                  )}

                  {/* Scheduled streams */}
                  {myScheduledStreams.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-text/40">Scheduled</p>
                      {myScheduledStreams.map((s) => (
                        <div key={s.id} className="rounded-lg border border-brand-divider bg-brand-secondary px-3 py-2">
                          <p className="text-[12px] font-semibold text-brand-text">{s.title}</p>
                          <p className="text-[10px] text-brand-text/40">{formatDateTime(s.scheduled_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Moderation tab ── */
                <div className="space-y-5 p-4">
                  {/* Chat */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/40">Live Chat</p>
                      <button
                        type="button"
                        onClick={() => setChatEnabled((c) => !c)}
                        className={`rounded-md px-2 py-1 text-[10px] font-bold ${chatEnabled ? "bg-emerald-500/10 text-emerald-500" : "bg-brand-secondary text-brand-text/40"}`}
                      >
                        {chatEnabled ? "On" : "Paused"}
                      </button>
                    </div>

                    <div className="rounded-xl border border-brand-divider bg-brand-secondary">
                      <div className="max-h-[240px] overflow-y-auto px-3 py-2">
                        {chatMessages.length > 0 ? (
                          <div className="space-y-1">
                            {chatMessages.map((msg) => (
                              <div key={msg.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-brand-card/50">
                                <Avatar src={getAvatarSrc(msg.user_id)} name={getProfileLabel(msg.user_id)} seed={msg.user_id} size="xs" className="mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <span className="text-[11px] font-bold text-brand-text/60">{getProfileLabel(msg.user_id)}</span>
                                  <span className="ml-1 text-[11px] text-brand-text/70">{msg.message}</span>
                                </div>
                                {msg.user_id !== hostId && (
                                  <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                                    <button
                                      type="button"
                                      onClick={() => streamDetail && pinChatMutation.mutate({ streamId: streamDetail.id, messageId: msg.id })}
                                      disabled={!streamDetail || msg.is_pinned}
                                      className="rounded px-1.5 py-0.5 text-[10px] text-brand-text/40 hover:bg-brand-secondary disabled:opacity-30"
                                    >
                                      Pin
                                    </button>
                                    {!mutedUserIds.has(msg.user_id) && (
                                      <button
                                        type="button"
                                        onClick={() => streamDetail && muteMutation.mutate({ streamId: streamDetail.id, userId: msg.user_id })}
                                        className="rounded px-1.5 py-0.5 text-[10px] text-rose-400 hover:bg-rose-500/10"
                                      >
                                        Mute
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            <div ref={chatEndRef} />
                          </div>
                        ) : (
                          <p className="py-4 text-center text-[11px] text-brand-text/30">No messages yet</p>
                        )}
                      </div>

                      {/* Host composer */}
                      <div className="border-t border-brand-divider px-3 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            value={chatDraft}
                            onChange={(e) => setChatDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && chatDraft.trim() && streamDetail) {
                                e.preventDefault();
                                sendChatMutation.mutate({ streamId: streamDetail.id, message: chatDraft.trim() });
                              }
                            }}
                            maxLength={500}
                            disabled={!streamDetail || !chatEnabled || streamDetail.status !== "live"}
                            placeholder="Message as host..."
                            className="h-8 flex-1 rounded-md border border-brand-divider bg-brand-card px-2.5 text-[11px] text-brand-text outline-none disabled:opacity-40"
                          />
                          <button
                            type="button"
                            onClick={() => streamDetail && sendChatMutation.mutate({ streamId: streamDetail.id, message: chatDraft.trim() })}
                            disabled={!streamDetail || !chatEnabled || streamDetail.status !== "live" || !chatDraft.trim()}
                            className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-500 text-white disabled:opacity-30"
                          >
                            <Send className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Muted viewers */}
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-text/40">Muted Viewers</p>
                    <div className="flex flex-wrap gap-1.5">
                      {mutedUsers.length > 0 ? mutedUsers.map((m) => (
                        <span key={m.user_id} className="inline-flex items-center gap-1.5 rounded-full border border-brand-divider bg-brand-secondary px-2.5 py-1 text-[11px] text-brand-text">
                          {getProfileLabel(m.user_id)}
                          <button
                            type="button"
                            onClick={() => streamDetail && unmuteMutation.mutate({ streamId: streamDetail.id, userId: m.user_id })}
                            className="text-brand-text/40 hover:text-brand-text"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )) : (
                        <p className="text-[11px] text-brand-text/30">No muted viewers</p>
                      )}
                    </div>
                  </div>

                  {/* Word filters */}
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-text/40">Blocked Words</p>
                    <div className="flex flex-wrap gap-1.5">
                      {wordFilters.length > 0 ? wordFilters.map((f) => (
                        <span key={f.word} className="inline-flex items-center gap-1.5 rounded-full border border-brand-divider bg-brand-secondary px-2.5 py-1 text-[11px] text-brand-text">
                          {f.word}
                          <button
                            type="button"
                            onClick={() => streamDetail && removeWordFilterMutation.mutate({ streamId: streamDetail.id, word: f.word })}
                            className="text-brand-text/40 hover:text-brand-text"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )) : (
                        <p className="text-[11px] text-brand-text/30">No blocked words</p>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={wordFilterDraft}
                        onChange={(e) => setWordFilterDraft(e.target.value)}
                        placeholder="Add word..."
                        className="h-8 flex-1 rounded-md border border-brand-divider bg-brand-secondary px-2.5 text-[11px] text-brand-text outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => streamDetail && wordFilterDraft.trim() && addWordFilterMutation.mutate({ streamId: streamDetail.id, word: wordFilterDraft.trim() })}
                        disabled={!streamDetail || !wordFilterDraft.trim()}
                        className="rounded-md bg-brand-text px-3 text-[11px] font-bold text-brand-card disabled:opacity-30"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {moderationBusy && <p className="text-[11px] text-brand-text/40">Updating...</p>}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

/* ───────────────────────────── small components ───────────────────────────── */

function CopyRow({ label, value, copied, onCopy, disabled }: { label: string; value: string; copied: boolean; onCopy: () => void; disabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-card px-3 py-2 ring-1 ring-brand-divider">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text/40">{label}</p>
        <p className="mt-0.5 truncate font-mono text-[11px] text-brand-text">{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        disabled={disabled}
        className="shrink-0 rounded-md p-1.5 text-brand-text/40 transition-colors hover:bg-brand-secondary hover:text-brand-text disabled:opacity-30"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-brand-secondary px-3 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-brand-text/40">{icon}<span className="text-[10px]">{label}</span></div>
      <p className="mt-0.5 text-[16px] font-bold text-brand-text">{value}</p>
    </div>
  );
}
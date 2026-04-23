"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  Heart,
  Loader2,
  MessageSquare,
  Pin,
  Radio,
  Send,
  Users,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { AppShell } from "@/features/reels/components/AppShell";
import { ReelPlayer } from "@/features/reels/components/ReelPlayer";
import { Avatar } from "@/components/LetterAvatar";
import { useMyProfile } from "@/hooks/useEditProfile";
import { useBatchProfiles } from "@/hooks/useProfile";
import {
  getLiveChatMessages,
  getLiveStream,
  getMutedUsers,
  getViewerCount,
  joinLiveStream,
  leaveLiveStream,
  likeLiveStream,
  listLiveStreams,
  sendLiveChatMessage,
} from "@/features/live/api";
import { applyLiveRealtimeEvent } from "@/features/live/cache";
import { liveKeys } from "@/features/live/queryKeys";
import type { LiveStream } from "@/features/live/types";
import { useLiveStreamRoom } from "@/features/live/useLiveStreamRoom";
import {
  formatRelativeTime,
  getPreferredLiveVideoUrl,
  messageFromError,
  resolvePinnedLiveMessage,
  shortUserId,
} from "@/features/live/utils";

/* ───────────────────────────── main content ───────────────────────────── */

function LivePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: myProfile } = useMyProfile();
  const joinedStreamRef = useRef<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  const [chatDraft, setChatDraft] = useState("");
  const [likedStreamId, setLikedStreamId] = useState<string | null>(null);
  const [playerMuted, setPlayerMuted] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);

  /* ── queries ── */
  const liveStreamsQuery = useQuery({
    queryKey: liveKeys.streams(),
    queryFn: () => listLiveStreams(20),
    staleTime: 10_000,
  });

  const selectedStreamId = searchParams.get("streamId") ?? liveStreamsQuery.data?.[0]?.id ?? null;

  const streamQuery = useQuery({
    queryKey: liveKeys.stream(selectedStreamId),
    queryFn: () => getLiveStream(selectedStreamId!),
    enabled: !!selectedStreamId,
    staleTime: 5_000,
  });

  const viewerCountQuery = useQuery({
    queryKey: liveKeys.viewerCount(selectedStreamId),
    queryFn: () => getViewerCount(selectedStreamId!),
    enabled: !!selectedStreamId,
    staleTime: 0,
  });

  const chatQuery = useQuery({
    queryKey: liveKeys.chat(selectedStreamId),
    queryFn: () => getLiveChatMessages(selectedStreamId!, 100),
    enabled: !!selectedStreamId,
    staleTime: 0,
  });

  const mutesQuery = useQuery({
    queryKey: liveKeys.mutes(selectedStreamId),
    queryFn: () => getMutedUsers(selectedStreamId!),
    enabled: !!selectedStreamId,
    staleTime: 0,
  });

  useLiveStreamRoom(selectedStreamId, (event) => {
    applyLiveRealtimeEvent(queryClient, event);
  });

  /* ── derived ── */
  const selectedStream = streamQuery.data ?? liveStreamsQuery.data?.find((s) => s.id === selectedStreamId) ?? null;
  const chatMessages = chatQuery.data ?? [];
  const pinnedMessage = resolvePinnedLiveMessage(chatMessages);
  const mutedUsers = mutesQuery.data ?? [];
  const currentUserMuted = !!myProfile?.id && mutedUsers.some((m) => m.user_id === myProfile.id);
  const effectiveViewerCount = viewerCountQuery.data ?? 0;
  const preferredVideoUrl = getPreferredLiveVideoUrl(selectedStream);
  const liveStreams = liveStreamsQuery.data ?? [];

  const authorIds = [
    ...new Set([
      ...liveStreams.map((s) => s.host_id),
      ...(selectedStream ? [selectedStream.host_id] : []),
      ...chatMessages.map((m) => m.user_id),
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

  /* ── join/leave ── */
  useEffect(() => {
    setLikedStreamId(null);
  }, [selectedStreamId]);

  useEffect(() => {
    if (!selectedStreamId || !selectedStream || selectedStream.status !== "live" || !myProfile?.id) return;
    if (joinedStreamRef.current === selectedStreamId) return;
    joinedStreamRef.current = selectedStreamId;
    void joinLiveStream(selectedStreamId)
      .then((vc) => queryClient.setQueryData(liveKeys.viewerCount(selectedStreamId), vc))
      .catch(() => { if (joinedStreamRef.current === selectedStreamId) joinedStreamRef.current = null; });
    return () => {
      if (joinedStreamRef.current !== selectedStreamId) return;
      joinedStreamRef.current = null;
      void leaveLiveStream(selectedStreamId).catch(() => {});
    };
  }, [myProfile?.id, queryClient, selectedStream, selectedStreamId]);

  /* ── mutations ── */
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

  const likeMutation = useMutation({
    mutationFn: (streamId: string) => likeLiveStream(streamId),
    onMutate: async (streamId) => {
      await queryClient.cancelQueries({ queryKey: liveKeys.stream(streamId) });
      await queryClient.cancelQueries({ queryKey: liveKeys.streams() });
      const previousStream = queryClient.getQueryData<LiveStream>(liveKeys.stream(streamId));
      const previousStreams = queryClient.getQueryData<LiveStream[]>(liveKeys.streams());
      setLikedStreamId(streamId);
      queryClient.setQueryData<LiveStream | undefined>(liveKeys.stream(streamId), (s) =>
        s ? { ...s, like_count: s.like_count + 1 } : s,
      );
      queryClient.setQueryData<LiveStream[] | undefined>(liveKeys.streams(), (ss) =>
        ss?.map((s) => (s.id === streamId ? { ...s, like_count: s.like_count + 1 } : s)),
      );
      return { previousStream, previousStreams };
    },
    onError: (_err, streamId, ctx) => {
      if (likedStreamId === streamId) setLikedStreamId(null);
      queryClient.setQueryData(liveKeys.stream(streamId), ctx?.previousStream);
      queryClient.setQueryData(liveKeys.streams(), ctx?.previousStreams);
    },
  });

  const composerDisabled = selectedStream?.status !== "live" || sendChatMutation.isPending || currentUserMuted;
  const actionError = streamQuery.error ?? viewerCountQuery.error ?? chatQuery.error ?? mutesQuery.error ?? sendChatMutation.error ?? likeMutation.error;

  /* ───────────────────────────── render ───────────────────────────── */

  // Empty state
  if (!selectedStream && !liveStreamsQuery.isLoading) {
    return (
      <AppShell sectionLabel="Live">
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/10">
            <Radio className="h-9 w-9 text-rose-500" />
          </div>
          <h2 className="mt-6 text-[22px] font-bold text-brand-text">No one is live right now</h2>
          <p className="mt-2 max-w-sm text-[14px] text-brand-text/50">
            Check back later or start your own broadcast from the control room.
          </p>
          <button
            type="button"
            onClick={() => router.push("/live/start")}
            className="mt-6 rounded-xl bg-rose-500 px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-rose-600"
          >
            Go Live
          </button>
        </div>
      </AppShell>
    );
  }

  // Loading state
  if (!selectedStream) {
    return (
      <AppShell sectionLabel="Live">
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-text/30" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell sectionLabel="Live">
      <div className="flex h-full flex-col">
        {/* ── Theater: Video + Chat ── */}
        <div className="flex min-h-0 flex-1">
          {/* Video column */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Player */}
            <div className="relative flex-1 bg-black">
              {preferredVideoUrl ? (
                <ReelPlayer
                  videoUrl={preferredVideoUrl}
                  posterUrl={selectedStream.thumbnail_url || ""}
                  muted={playerMuted}
                  active
                  contain
                  loadingTitle="Connecting to live stream..."
                  errorTitle="Stream unavailable"
                  errorHint="The encoder may have disconnected. Try refreshing."
                  onToggleMuted={() => setPlayerMuted((m) => !m)}
                  onBoost={() => selectedStreamId && likeMutation.mutate(selectedStreamId)}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                  <Radio className="h-10 w-10 text-white/25" />
                  <p className="text-[15px] font-semibold text-white/60">{selectedStream.title}</p>
                  <p className="max-w-md text-[13px] text-white/30">
                    {selectedStream.status === "live"
                      ? "Waiting for the live stream to begin playback..."
                      : "This stream has ended."}
                  </p>
                </div>
              )}

              {/* LIVE badge + viewer count overlay */}
              <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
                {selectedStream.status === "live" && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold uppercase text-white shadow-lg">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    Live
                  </span>
                )}
                <span className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                  <Eye className="h-3 w-3" />
                  {effectiveViewerCount}
                </span>
              </div>

              {/* Chat toggle (mobile + desktop) */}
              <button
                type="button"
                onClick={() => setChatOpen((o) => !o)}
                className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/80"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {chatOpen ? "Hide Chat" : "Show Chat"}
              </button>
            </div>

            {/* Host bar */}
            <div className="flex items-center justify-between gap-4 border-t border-brand-divider bg-brand-card px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  src={getAvatarSrc(selectedStream.host_id)}
                  name={getProfileLabel(selectedStream.host_id)}
                  seed={selectedStream.host_id}
                  size="sm"
                />
                <div className="min-w-0">
                  <h2 className="truncate text-[14px] font-bold text-brand-text">{selectedStream.title}</h2>
                  <p className="truncate text-[12px] text-brand-text/50">{getProfileLabel(selectedStream.host_id)}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg bg-brand-secondary px-3 py-2 text-[12px] text-brand-text/60">
                  <Users className="h-3.5 w-3.5" />
                  <span className="font-bold text-brand-text">{effectiveViewerCount}</span>
                </div>
                <button
                  type="button"
                  onClick={() => selectedStreamId && likeMutation.mutate(selectedStreamId)}
                  disabled={!selectedStreamId || selectedStream.status !== "live" || likedStreamId === selectedStreamId}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold transition-all disabled:opacity-40 ${
                    likedStreamId === selectedStreamId
                      ? "bg-rose-500 text-white"
                      : "bg-brand-secondary text-brand-text hover:bg-rose-50 hover:text-rose-600"
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${likedStreamId === selectedStreamId ? "fill-current" : ""}`} />
                  {selectedStream.like_count}
                </button>
              </div>
            </div>
          </div>

          {/* ── Chat sidebar ── */}
          <AnimatePresence>
            {chatOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 360, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex h-full flex-col border-l border-brand-divider bg-brand-card"
                style={{ minWidth: 0 }}
              >
                {/* Chat header */}
                <div className="flex items-center justify-between border-b border-brand-divider px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-brand-text/50" />
                    <span className="text-[13px] font-bold text-brand-text">Live Chat</span>
                    {selectedStream.status === "live" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setChatOpen(false)}
                    className="rounded-md p-1 text-brand-text/40 transition-colors hover:bg-brand-secondary hover:text-brand-text"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Pinned message */}
                {pinnedMessage && (
                  <div className="border-b border-amber-200/30 bg-amber-500/5 px-4 py-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                      <Pin className="h-3 w-3" />
                      Pinned
                    </div>
                    <p className="mt-1 text-[12px] text-brand-text/80">{pinnedMessage.message}</p>
                  </div>
                )}

                {/* Muted notice */}
                {currentUserMuted && (
                  <div className="border-b border-rose-200/30 bg-rose-500/5 px-4 py-2 text-[11px] text-rose-500">
                    You are muted by the host.
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-2">
                  {chatQuery.isLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-brand-text/30" />
                    </div>
                  ) : chatMessages.length > 0 ? (
                    <div className="space-y-1">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className="group rounded-lg px-2 py-1.5 transition-colors hover:bg-brand-secondary/50">
                          <div className="flex items-start gap-2">
                            <Avatar
                              src={getAvatarSrc(msg.user_id)}
                              name={getProfileLabel(msg.user_id)}
                              seed={msg.user_id}
                              size="xs"
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-bold text-brand-text/70">
                                {getProfileLabel(msg.user_id)}
                              </span>
                              {msg.is_pinned && (
                                <Pin className="ml-1 inline h-2.5 w-2.5 text-amber-500" />
                              )}
                              <span className="ml-1.5 text-[12px] text-brand-text/80">
                                {msg.message}
                              </span>
                            </div>
                            <span className="shrink-0 text-[10px] text-brand-text/30 opacity-0 group-hover:opacity-100">
                              {formatRelativeTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <MessageSquare className="h-8 w-8 text-brand-text/15" />
                      <p className="mt-2 text-[12px] text-brand-text/40">
                        {selectedStream.status === "live" ? "No messages yet. Say hello!" : "Chat is closed."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Composer */}
                <div className="border-t border-brand-divider px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && chatDraft.trim() && selectedStreamId) {
                          e.preventDefault();
                          sendChatMutation.mutate({ streamId: selectedStreamId, message: chatDraft.trim() });
                        }
                      }}
                      maxLength={500}
                      disabled={composerDisabled}
                      placeholder={
                        selectedStream.status !== "live"
                          ? "Chat closed"
                          : currentUserMuted
                            ? "You are muted"
                            : "Send a message..."
                      }
                      className="h-9 flex-1 rounded-lg border border-brand-divider bg-brand-secondary px-3 text-[12px] text-brand-text outline-none placeholder:text-brand-text/30 focus:border-brand-text/20 focus:ring-1 focus:ring-brand-text/10 disabled:opacity-40"
                    />
                    <button
                      type="button"
                      onClick={() => selectedStreamId && chatDraft.trim() && sendChatMutation.mutate({ streamId: selectedStreamId, message: chatDraft.trim() })}
                      disabled={composerDisabled || !chatDraft.trim()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white transition-colors hover:bg-rose-600 disabled:opacity-30"
                    >
                      {sendChatMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        {/* ── Now Live strip ── */}
        {liveStreams.length > 1 && (
          <div className="border-t border-brand-divider bg-brand-card px-5 py-3">
            <div className="flex items-center gap-4 overflow-x-auto">
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-brand-text/40">Now Live</span>
              {liveStreams.map((stream) => {
                const isSelected = stream.id === selectedStreamId;
                return (
                  <button
                    key={stream.id}
                    type="button"
                    onClick={() => router.replace(`/live?streamId=${stream.id}`)}
                    className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all ${
                      isSelected
                        ? "bg-rose-500/10 ring-1 ring-rose-500/30"
                        : "bg-brand-secondary hover:bg-brand-secondary/80"
                    }`}
                  >
                    <Avatar
                      src={getAvatarSrc(stream.host_id)}
                      name={getProfileLabel(stream.host_id)}
                      seed={stream.host_id}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <p className={`truncate text-[12px] font-semibold ${isSelected ? "text-rose-600" : "text-brand-text"}`}>
                        {stream.title}
                      </p>
                      <p className="text-[10px] text-brand-text/40">
                        {getProfileLabel(stream.host_id)} &middot; {stream.total_viewers} viewers
                      </p>
                    </div>
                    {isSelected && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Error toast */}
        {actionError && (
          <div className="border-t border-rose-200/30 bg-rose-500/5 px-5 py-2 text-[12px] text-rose-500">
            {messageFromError(actionError)}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ───────────────────────────── page export ───────────────────────────── */

export default function LivePage() {
  return (
    <Suspense
      fallback={
        <AppShell sectionLabel="Live">
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-text/30" />
          </div>
        </AppShell>
      }
    >
      <LivePageContent />
    </Suspense>
  );
}

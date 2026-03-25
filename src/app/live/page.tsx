"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Heart,
  Loader2,
  MessageSquare,
  Pin,
  Radio,
  Send,
  Users,
} from "lucide-react";

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
  formatDateTime,
  formatRelativeTime,
  getPreferredLiveVideoUrl,
  messageFromError,
  resolvePinnedLiveMessage,
  shortUserId,
  upsertLiveChatMessage,
} from "@/features/live/utils";

function LivePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: myProfile } = useMyProfile();
  const joinedStreamRef = useRef<string | null>(null);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  const [chatDraft, setChatDraft] = useState("");
  const [likedStreamId, setLikedStreamId] = useState<string | null>(null);
  const [playerMuted, setPlayerMuted] = useState(true);

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

  const selectedStream =
    streamQuery.data ??
    liveStreamsQuery.data?.find((stream) => stream.id === selectedStreamId) ??
    null;
  const chatMessages = chatQuery.data ?? [];
  const pinnedMessage = resolvePinnedLiveMessage(chatMessages);
  const liveStreamIds = new Set((liveStreamsQuery.data ?? []).map((stream) => stream.id));
  const mutedUsers = mutesQuery.data ?? [];
  const currentUserMuted = !!myProfile?.id && mutedUsers.some((mute) => mute.user_id === myProfile.id);

  const authorIds = [
    ...new Set([
      ...(liveStreamsQuery.data ?? []).map((stream) => stream.host_id),
      ...(selectedStream ? [selectedStream.host_id] : []),
      ...chatMessages.map((message) => message.user_id),
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

  useEffect(() => {
    setLikedStreamId(null);
  }, [selectedStreamId]);

  useEffect(() => {
    if (!selectedStreamId || !selectedStream || selectedStream.status !== "live" || !myProfile?.id) {
      return;
    }
    if (joinedStreamRef.current === selectedStreamId) {
      return;
    }

    joinedStreamRef.current = selectedStreamId;
    void joinLiveStream(selectedStreamId)
      .then((viewerCount) => {
        queryClient.setQueryData(liveKeys.viewerCount(selectedStreamId), viewerCount);
      })
      .catch(() => {
        if (joinedStreamRef.current === selectedStreamId) {
          joinedStreamRef.current = null;
        }
      });

    return () => {
      if (joinedStreamRef.current !== selectedStreamId) {
        return;
      }
      joinedStreamRef.current = null;
      void leaveLiveStream(selectedStreamId).catch(() => {});
    };
  }, [myProfile?.id, queryClient, selectedStream, selectedStreamId]);

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

      queryClient.setQueryData<LiveStream | undefined>(liveKeys.stream(streamId), (stream) =>
        stream ? { ...stream, like_count: stream.like_count + 1 } : stream,
      );
      queryClient.setQueryData<LiveStream[] | undefined>(liveKeys.streams(), (streams) =>
        streams?.map((stream) =>
          stream.id === streamId ? { ...stream, like_count: stream.like_count + 1 } : stream,
        ),
      );

      return { previousStream, previousStreams };
    },
    onError: (_error, streamId, context) => {
      if (likedStreamId === streamId) {
        setLikedStreamId(null);
      }
      queryClient.setQueryData(liveKeys.stream(streamId), context?.previousStream);
      queryClient.setQueryData(liveKeys.streams(), context?.previousStreams);
    },
  });

  const actionError =
    streamQuery.error ??
    viewerCountQuery.error ??
    chatQuery.error ??
    mutesQuery.error ??
    sendChatMutation.error ??
    likeMutation.error;
  const effectiveViewerCount = viewerCountQuery.data ?? 0;
  const composerDisabled = selectedStream?.status !== "live" || sendChatMutation.isPending || currentUserMuted;
  const preferredVideoUrl = getPreferredLiveVideoUrl(selectedStream);

  return (
    <AppShell sectionLabel="Live">
      <div className="mx-auto max-w-[1280px] px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
            <Radio className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-brand-text">Live Streams</h1>
            <p className="text-[12px] text-brand-text/60">Browse current broadcasts, join live chat, and track audience activity without polling.</p>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {selectedStream ? (
              <>
                <div className="overflow-hidden rounded-2xl border border-brand-divider bg-black shadow-sm" style={{ aspectRatio: "16/9" }}>
                  {preferredVideoUrl ? (
                    <ReelPlayer
                      videoUrl={preferredVideoUrl}
                      posterUrl={selectedStream.thumbnail_url || ""}
                      muted={playerMuted}
                      active
                      onToggleMuted={() => setPlayerMuted((current) => !current)}
                      onBoost={() => {}}
                    />
                  ) : selectedStream.thumbnail_url ? (
                    <div className="relative h-full w-full">
                      <img src={selectedStream.thumbnail_url} alt={selectedStream.title} className="h-full w-full object-cover opacity-70" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 px-8 text-center">
                        <Radio className="h-8 w-8 text-white/90" />
                        <p className="mt-3 text-[16px] font-bold text-white">{selectedStream.title}</p>
                        <p className="mt-2 max-w-md text-[13px] text-white/75">
                          {selectedStream.status === "live"
                            ? "Live playback is wired for this page, but the media origin has not produced a manifest for this stream yet."
                            : selectedStream.status === "ended"
                              ? "This stream ended before a replay manifest was generated."
                              : "Prepare the stream in the control room and start publishing to expose live playback here."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                      <Radio className="h-8 w-8 text-white/70" />
                      <p className="mt-3 text-[16px] font-bold text-white">{selectedStream.title}</p>
                      <p className="mt-2 max-w-md text-[13px] text-white/65">
                        {selectedStream.status === "live"
                          ? "Waiting for the live HLS manifest to appear from the playback origin."
                          : "Playback is unavailable for this stream right now, but realtime chat and moderation remain active."}
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
                          selectedStream.status === "live"
                            ? "bg-rose-100 text-rose-600"
                            : selectedStream.status === "ended"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-amber-100 text-amber-700"
                        }`}>
                          {selectedStream.status}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.14em] text-brand-text/50">
                          {selectedStream.status === "live" ? "Watching live" : "Stream detail"}
                        </span>
                      </div>

                      <h2 className="mt-3 text-[22px] font-bold text-brand-text">{selectedStream.title}</h2>
                      {selectedStream.description ? (
                        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-brand-text/70">{selectedStream.description}</p>
                      ) : null}

                      <div className="mt-4 flex items-center gap-3">
                        <Avatar
                          src={getAvatarSrc(selectedStream.host_id)}
                          name={getProfileLabel(selectedStream.host_id)}
                          seed={selectedStream.host_id}
                          size="sm"
                        />
                        <div>
                          <p className="text-[13px] font-semibold text-brand-text">{getProfileLabel(selectedStream.host_id)}</p>
                          <p className="text-[11px] text-brand-text/50">{formatDateTime(selectedStream.started_at || selectedStream.created_at)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-xl bg-brand-secondary px-4 py-3">
                        <div className="flex items-center gap-2 text-[11px] text-brand-text/60">
                          <Users className="h-3.5 w-3.5" />
                          Live Viewers
                        </div>
                        <p className="mt-1 text-[18px] font-bold text-brand-text">{effectiveViewerCount}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectedStreamId && likeMutation.mutate(selectedStreamId)}
                        disabled={!selectedStreamId || selectedStream.status !== "live" || likedStreamId === selectedStreamId || likeMutation.isPending}
                        className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-[13px] font-bold text-white transition-colors hover:bg-brand-text disabled:opacity-40"
                      >
                        {likeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
                        {selectedStream.like_count} Likes
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-[14px] font-bold text-brand-text">Live Comments</h2>
                      <p className="text-[12px] text-brand-text/60">Join the conversation while the stream is active.</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                      selectedStream.status === "live" ? "bg-rose-100 text-rose-600" : "bg-brand-secondary text-brand-highlight"
                    }`}>
                      {selectedStream.status === "live" ? "Chat Open" : "Chat Read Only"}
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
                      {currentUserMuted ? (
                        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600">
                          The host has muted you in this stream. You can keep reading chat, but you cannot send messages.
                        </div>
                      ) : null}

                      {chatQuery.isLoading ? (
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
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[12px] text-brand-text/60">
                          {selectedStream.status === "live"
                            ? "No comments yet. Say hello to start the chat."
                            : "Comments are unavailable once the stream is no longer live."}
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
                          disabled={composerDisabled}
                          placeholder={
                            selectedStream.status !== "live"
                              ? "Chat is closed for this stream"
                              : currentUserMuted
                                ? "You are muted in this stream"
                                : "Send a comment"
                          }
                          className="min-h-[52px] flex-1 rounded-xl border border-brand-divider bg-[#FAFAF8] px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-text/30 focus:bg-brand-card focus:ring-2 focus:ring-brand-text/10 disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => selectedStreamId && sendChatMutation.mutate({ streamId: selectedStreamId, message: chatDraft.trim() })}
                          disabled={composerDisabled || !chatDraft.trim()}
                          className="flex h-[52px] shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[12px] font-semibold text-white transition-colors hover:bg-brand-text disabled:opacity-40"
                        >
                          {sendChatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : liveStreamsQuery.isLoading ? (
              <div className="flex h-[420px] items-center justify-center rounded-2xl border border-brand-divider bg-brand-card">
                <Loader2 className="h-8 w-8 animate-spin text-brand-text/40" />
              </div>
            ) : (
              <div className="flex h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-brand-divider bg-brand-card px-6 text-center">
                <Radio className="h-8 w-8 text-brand-text/30" />
                <h2 className="mt-4 text-[18px] font-bold text-brand-text">No live streams right now</h2>
                <p className="mt-2 text-[13px] text-brand-text/60">Check back later or open the control room to start broadcasting.</p>
              </div>
            )}

            {actionError ? (
              <p className="rounded-xl border border-[#E8527A]/20 bg-[#E8527A]/5 px-4 py-3 text-[12px] text-[#E8527A]">
                {messageFromError(actionError)}
              </p>
            ) : null}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-rose-500" />
                <h2 className="text-[14px] font-bold text-brand-text">Now Live</h2>
              </div>

              <div className="mt-4 space-y-3">
                {(liveStreamsQuery.data ?? []).length > 0 ? (
                  (liveStreamsQuery.data ?? []).map((stream) => {
                    const isSelected = stream.id === selectedStreamId;

                    return (
                      <button
                        key={stream.id}
                        type="button"
                        onClick={() => router.replace(`/live?streamId=${stream.id}`)}
                        className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                          isSelected
                            ? "border-rose-200 bg-rose-50/70"
                            : "border-brand-divider bg-[#FAFAF8] hover:bg-brand-secondary"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar src={getAvatarSrc(stream.host_id)} name={getProfileLabel(stream.host_id)} seed={stream.host_id} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-brand-text">{stream.title}</p>
                            <p className="mt-1 text-[11px] text-brand-text/60">{getProfileLabel(stream.host_id)}</p>
                            <div className="mt-2 flex items-center gap-3 text-[11px] text-brand-text/50">
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {stream.total_viewers}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Heart className="h-3.5 w-3.5" />
                                {stream.like_count}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="rounded-xl border border-dashed border-brand-divider px-4 py-4 text-[12px] text-brand-text/60">
                    No active live streams found.
                  </p>
                )}
              </div>
            </div>

            {selectedStreamId && !liveStreamIds.has(selectedStreamId) && selectedStream ? (
              <div className="rounded-2xl border border-brand-divider/60 bg-brand-card p-5 shadow-sm">
                <h2 className="text-[14px] font-bold text-brand-text">Direct Stream Link</h2>
                <p className="mt-2 text-[12px] text-brand-text/60">
                  This stream is not currently in the live listing. You are viewing it directly by ID.
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
export default function LivePage() {
  return (
    <Suspense
      fallback={
        <AppShell sectionLabel="Live">
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-text/40" />
          </div>
        </AppShell>
      }
    >
      <LivePageContent />
    </Suspense>
  );
}


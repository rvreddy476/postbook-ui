"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Flag, Link2, MessageCircle, MoreHorizontal, RefreshCw, Tv, Volume2, VolumeX } from "lucide-react";

import { VideoShell } from "@/features/video-shell";
import { connectToHub } from "@/services/messageService";
import { useAuthUser } from "@/store/auth";
import { useGlobalToast } from "@/contexts/ToastContext";
import { useBatchRelationships } from "@/hooks/useConnections";
import { useFollowUser, useUnfollowUser } from "@/hooks/useEditProfile";
import { useBatchProfiles } from "@/hooks/useProfile";
import {
  liveV2Keys,
  useLiveCreators,
  useLiveNow,
  useLiveRoom,
  useLiveStreamRow,
  useSendLiveChat,
  useUpcomingStreams,
  useViewerToken,
} from "@/hooks/useLiveV2";
import { canSendChat, chatRole, streamTools } from "@/features/live/chat";
import { liveWatchHref, rowStatusView, type CreatorCard, type StreamRow } from "@/features/live/discovery";
import { chatSendErrorCopy, isChatBan, isStreamFull, isStreamNotLive, watchErrorCopy } from "@/features/live/errors";
import { errorCode } from "@/features/live/model";
import { LiveChat } from "@/features/live/components/LiveChat";
import { HeartCount, StageHearts } from "@/features/live/components/LiveHearts";
import { LivePlayer } from "@/features/live/components/LivePlayer";
import { ReminderButton } from "@/features/live/components/ReminderButton";
import { ReportSheet } from "@/features/live/components/ReportSheet";
import { SupportersCard, TopSupporters } from "@/features/live/components/TopSupporters";
import { mediaServeUrl } from "@/features/posttube/model";
import { Popover } from "@/features/reels/components/Popover";
import { DESKTOP_QUERY, useMediaQuery } from "@/features/reels/hooks/useMediaQuery";
import { usePageVisible } from "@/features/reels/hooks/usePageVisible";
import { usePlayerPrefs } from "@/features/reels/hooks/usePlayerPrefs";
import { COMMENTS_TRACK_WIDTH, STAGE_DEFAULT_ASPECT } from "@/features/reels/stage";
import {
  LIVE_CREATORS_LIMIT,
  LIVE_TAB_BASE,
  activeIndex,
  canStep,
  liveEmptyCopy,
  liveStageState,
  liveTabFilters,
  liveTabFromSearch,
  neighbours,
  shouldConnect,
  stageList,
  stepIndex,
  upcomingPortrait,
  type HeldRow,
  type LiveTab,
} from "../liveStage";
import { liveMoreItems, type LiveMoreKey } from "../liveMenu";
import { liveMuted, toggleLiveSound } from "../liveSound";
import { overlayMessages } from "../overlayChat";
import { LiveCreatorsList, LiveEmpty, LiveHeader, LiveStatusCard, LiveTabs, LiveWaitingCard, OverlayChat } from "./LiveStageViews";

import "@/features/live/live.css";
import "@/features/reels/components/reels-screen.css";
import "../reels-live.css";

/*
  /reels/live and /reels/live/[streamId] — the Reels Live tab: the reels
  stage (one tall frame, prev/next by swipe, keys, wheel or the arrows)
  showing live PORTRAIT streams. A stream opened by id is first whatever its
  shape or status: a landscape one is letterboxed with "Watch on PostTube",
  a scheduled one is a waiting card, an ended one says why and links to the
  recording.

  ONE ROOM AT A TIME. Only the stream on stage mounts a player, and the
  slide is keyed by the stream id: moving on unmounts it (its effect cleanup
  leaves the LiveKit room and drops the realtime subscription) before the
  next one mounts and joins. A hidden tab turns `connect` off, which leaves
  the room too. Neighbours are covers, fetched ahead; never a connection.

  Everything drawn comes from the server's row (liveStage.ts): LIVE means
  status === "live" and nothing else. Live streams are not part of the
  normal reels feed; this tab is the only place they play.
*/

const NAV_COOLDOWN_MS = 320;
const WHEEL_THRESHOLD = 24;
const SWIPE_THRESHOLD = 48;
const STAGE_STYLE = { "--reel-ar": STAGE_DEFAULT_ASPECT } as CSSProperties;

type ProfileLite = { display_name?: string; first_name?: string; username?: string; avatar_url?: string; avatar_media_id?: string };

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || t.isContentEditable || Boolean(t.closest("[data-reel-side-panel]"));
}

export function ReelsLiveScreen({ streamId }: { streamId?: string }) {
  const searchParams = useSearchParams();
  const tab = liveTabFromSearch(searchParams);
  const user = useAuthUser();
  const meId = user?.id ?? null;
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const pageVisible = usePageVisible();
  const { prefs, update: updatePrefs } = usePlayerPrefs();
  const muted = liveMuted(prefs);

  useEffect(() => {
    // The realtime socket carries chat, viewer counts and hearts.
    void connectToHub(() => {});
  }, []);

  /* ── data ──────────────────────────────────────────────── */
  const liveNow = useLiveNow(liveTabFilters(tab), { refetchMs: 30_000 });
  // The slide polls the stream it shows; this reads the same cached row for the list.
  const pinned = useLiveStreamRow(streamId ?? null, false);
  const creators = useLiveCreators(LIVE_CREATORS_LIMIT);

  const rows = useMemo(() => liveNow.data?.pages.flatMap((p) => p.items) ?? [], [liveNow.data]);
  const [activeId, setActiveId] = useState<string | null>(streamId ?? null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [sideOpen, setSideOpen] = useState(true);
  const heldRef = useRef<HeldRow | null>(null);

  const held = heldRef.current && heldRef.current.row.id === activeId ? heldRef.current : null;
  const list = stageList(streamId ? pinned.row : null, rows, held);
  const index = activeIndex(list, activeId);
  const pinLoading = Boolean(streamId) && pinned.isPending;
  const pinMissing = Boolean(streamId) && !pinned.isPending && !pinned.row && activeId === streamId;
  const active: StreamRow | undefined = pinLoading || pinMissing ? undefined : list[index];

  // The stream on stage keeps its place if it leaves the live list; an unset id settles on the top one.
  useEffect(() => {
    heldRef.current = active ? { row: active, index } : null;
    if (active && activeId !== active.id) setActiveId(active.id);
  }, [active, index, activeId]);

  // Switching tabs starts from the top of the new list.
  const firstTab = useRef(tab);
  useEffect(() => {
    if (firstTab.current === tab) return;
    firstTab.current = tab;
    heldRef.current = null;
    setActiveId(streamId ?? null);
    setDirection(1);
  }, [tab, streamId]);

  // Load ahead so the last swipe never lands on a spinner.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = liveNow;
  useEffect(() => {
    if (list.length - index <= 3 && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [index, list.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  /* ── navigation ────────────────────────────────────────── */
  const navRef = useRef({ index, list });
  navRef.current = { index, list };
  const navAtRef = useRef(0);
  const wheelAccRef = useRef(0);
  const touchStartRef = useRef<number | null>(null);

  const go = useCallback((delta: 1 | -1) => {
    const now = Date.now();
    if (now - navAtRef.current < NAV_COOLDOWN_MS) return;
    const { index: at, list: items } = navRef.current;
    const next = stepIndex(at, delta, items.length);
    if (next === at || !items[next]) return;
    navAtRef.current = now;
    setDirection(delta);
    setActiveId(items[next].id);
  }, []);

  const onToggleSound = useCallback(() => updatePrefs((prev) => toggleLiveSound(prev)), [updatePrefs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="search"], button, a, [role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          go(1);
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          go(-1);
          break;
        case "m":
          onToggleSound();
          break;
        case "c":
          setSideOpen((v) => !v);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onToggleSound]);

  const onWheel = (e: React.WheelEvent) => {
    if (isTypingTarget(e.target)) return;
    const target = e.target as Node | null;
    if (!target || !e.currentTarget.contains(target)) return;
    if (target instanceof HTMLElement && target.closest('[role="menu"], [role="dialog"], .reel-comments-panel, .reel-live-empty')) return;
    wheelAccRef.current += e.deltaY;
    if (Math.abs(wheelAccRef.current) >= WHEEL_THRESHOLD) {
      go(wheelAccRef.current > 0 ? 1 : -1);
      wheelAccRef.current = 0;
    }
  };
  const onTouchStart = (e: React.TouchEvent) => {
    if (isTypingTarget(e.target) || (e.target instanceof HTMLElement && e.target.closest('button, a, [role="menu"], [role="dialog"], .reel-live-empty'))) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (start === null) return;
    const dy = (e.changedTouches[0]?.clientY ?? start) - start;
    if (Math.abs(dy) >= SWIPE_THRESHOLD) go(dy < 0 ? 1 : -1);
  };

  /* ── states ────────────────────────────────────────────── */
  const loading = pinLoading || (liveNow.isLoading && list.length === 0);
  const errored = !loading && !pinMissing && liveNow.isError && list.length === 0;
  const empty = !loading && !pinMissing && !errored && list.length === 0;

  const upcoming = useUpcomingStreams(liveTabFilters(tab), { enabled: empty });
  const upcomingRows = useMemo(() => upcomingPortrait(upcoming.data?.pages.flatMap((p) => p.items) ?? []), [upcoming.data]);

  const tabs = <LiveTabs tab={tab} />;
  const arrows = list.length > 1 ? (
    <div className="reels-navigation is-edge">
      <button type="button" aria-label="Previous stream" disabled={!canStep(index, -1, list.length)} onClick={() => go(-1)} className="reel-nav-button">
        <ChevronUp className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" aria-label="Next stream" disabled={!canStep(index, 1, list.length) && !hasNextPage} onClick={() => go(1)} className="reel-nav-button">
        <ChevronDown className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  ) : null;
  const liveCreators = creators.data ?? [];
  const creatorsList = liveCreators.length > 0 ? <LiveCreatorsList rows={liveCreators} currentStreamId={active?.id} /> : null;
  // A stream opened by id that cannot be shown: a refusal (its own words), gone, or a failed read (Retry).
  const pinCopy = pinMissing ? watchErrorCopy(pinned.error) : null;
  const pinTransient = pinMissing && Boolean(pinned.error) && !pinCopy;

  return (
    <VideoShell app="reels" chrome="sidebar" immersive compactSearch={desktop && sideOpen && Boolean(active)}>
      <div className="reels-workspace" style={{ "--reel-comments-w": `${COMMENTS_TRACK_WIDTH}px` } as CSSProperties}>
        <main className="reels-main" data-screen="reels-live" data-tab={tab} onWheel={onWheel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {loading ? (
            <StateLayout tabs={tabs}>
              <p className="reel-live-loading">Loading live streams…</p>
            </StateLayout>
          ) : pinMissing ? (
            <StateLayout tabs={tabs}>
              <LiveStatusCard
                kind="missing"
                title={pinCopy ?? (pinTransient ? "Couldn't load this stream" : "This stream no longer exists.")}
                body={pinTransient ? "Check your connection and try again." : ""}
                action={
                  <>
                    {pinTransient ? (
                      <button type="button" className="reel-state-action" onClick={() => void pinned.refetch()}>
                        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
                      </button>
                    ) : null}
                    <Link href={LIVE_TAB_BASE} className="reel-state-action">Go to Live</Link>
                  </>
                }
              />
            </StateLayout>
          ) : errored ? (
            <StateLayout tabs={tabs}>
              <LiveStatusCard
                kind="error"
                title="Couldn't load live streams"
                body="Check your connection and try again."
                action={
                  <button type="button" className="reel-state-action" onClick={() => void liveNow.refetch()}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
                  </button>
                }
              />
            </StateLayout>
          ) : empty ? (
            <StateLayout tabs={tabs} side={desktop ? creatorsList : null}>
              <LiveEmpty
                copy={liveEmptyCopy({ tab, signedIn: Boolean(meId) })}
                upcoming={upcomingRows}
                reminderFor={(row) => <ReminderButton streamId={row.id} state={row} signedIn={Boolean(meId)} returnTo={liveWatchHref(row)} />}
              />
            </StateLayout>
          ) : active ? (
            <LiveSlide
              key={active.id}
              listRow={active}
              meId={meId}
              tab={tab}
              pageVisible={pageVisible}
              muted={muted}
              onToggleSound={onToggleSound}
              desktop={desktop}
              direction={direction}
              sideOpen={sideOpen}
              onToggleSide={() => setSideOpen((v) => !v)}
              tabs={tabs}
              arrows={arrows}
              creatorsList={creatorsList}
            />
          ) : null}
          {/* Neighbours are their covers only, fetched ahead; they never join a room. */}
          {active ? (
            <div className="reel-live-preload" aria-hidden="true">
              {neighbours(list, index).map((row) => (row.cover_media_id ? <img key={row.id} src={mediaServeUrl(row.cover_media_id)} alt="" /> : null))}
            </div>
          ) : null}
        </main>
      </div>
    </VideoShell>
  );
}

/* ── the stream on stage ───────────────────────────────────── */

interface LiveSlideProps {
  listRow: StreamRow;
  meId: string | null;
  tab: LiveTab;
  pageVisible: boolean;
  muted: boolean;
  onToggleSound: () => void;
  desktop: boolean;
  direction: 1 | -1;
  sideOpen: boolean;
  onToggleSide: () => void;
  tabs: ReactNode;
  arrows: ReactNode;
  creatorsList: ReactNode;
}

/**
 * One stream, mounted only while it is on stage (the parent keys it by
 * stream id). It owns that stream's room: the realtime subscription
 * (useLiveRoom) and, through LivePlayer, the LiveKit connection. Unmounting
 * leaves both.
 */
function LiveSlide({ listRow, meId, tab, pageVisible, muted, onToggleSound, desktop, direction, sideOpen, onToggleSide, tabs, arrows, creatorsList }: LiveSlideProps) {
  const toast = useGlobalToast();
  const qc = useQueryClient();
  const { row: detail, error: rowError, refetch } = useLiveStreamRow(listRow.id);
  // The polled row (kept current by status and viewer frames) wins over the list's copy.
  const row = detail ?? listRow;
  const room = useLiveRoom(row.id);
  const state = liveStageState(row);
  const view = rowStatusView(row, "viewer");
  const role = chatRole(meId, row.creator_user_id, room.chat.moderators);
  const isHost = role === "host";
  const tools = streamTools(role);
  const banned = Boolean(meId) && room.chat.banned.includes(meId as string);

  const tokenQuery = useViewerToken(row.id, state.player && pageVisible);
  const watchError = watchErrorCopy(tokenQuery.error) ?? (detail ? null : watchErrorCopy(rowError));
  const connect = shouldConnect({ active: true, pageVisible, player: state.player, refused: Boolean(watchError) });

  // 409 STREAM_NOT_LIVE after the retries: our row says on air but the server no longer does. Re-read it.
  const tokenNotLive = isStreamNotLive(tokenQuery.error);
  useEffect(() => {
    if (tokenNotLive) void refetch();
  }, [tokenNotLive, refetch]);

  /* names: chat rows carry their own author card; only the host is looked up, when the card came with an id alone */
  const overlay = overlayMessages(room.chat);
  const needsProfile = !row.creator.name && !row.creator.handle;
  const profileIds = useMemo(
    () => (needsProfile && row.creator_user_id ? [row.creator_user_id] : []),
    [needsProfile, row.creator_user_id],
  );
  const profiles = useBatchProfiles(profileIds);
  const profileOf = (id: string) => (profiles.data instanceof Map ? (profiles.data.get(id) as ProfileLite | undefined) : undefined);
  const hostProfile = needsProfile ? profileOf(row.creator_user_id) : undefined;
  const creator: CreatorCard = hostProfile
    ? {
        ...row.creator,
        name: hostProfile.display_name || "",
        handle: row.creator.handle || hostProfile.username || "",
        avatar_url: row.creator.avatar_url || hostProfile.avatar_url || (hostProfile.avatar_media_id ? mediaServeUrl(hostProfile.avatar_media_id) : ""),
      }
    : row.creator;

  /* follow */
  const canFollow = Boolean(meId) && !isHost && Boolean(creator.handle) && Boolean(creator.user_id);
  const relationships = useBatchRelationships(meId ?? "", canFollow ? [creator.user_id] : []);
  const following = canFollow ? relationships.data?.get(creator.user_id)?.following : undefined;
  const followMut = useFollowUser();
  const unfollowMut = useUnfollowUser();
  const followPending = followMut.isPending || unfollowMut.isPending;
  const toggleFollow = async () => {
    if (!creator.handle) return;
    try {
      if (following) await unfollowMut.mutateAsync(creator.handle);
      else await followMut.mutateAsync(creator.handle);
      void qc.invalidateQueries({ queryKey: ["relationships", "batch"] });
    } catch {
      toast({ type: "error", title: following ? "Could not unfollow" : "Could not follow" });
    }
  };
  const here = liveWatchHref({ id: row.id, orientation: "portrait" });
  const signIn = `/login?next=${encodeURIComponent(here)}`;
  const follow = isHost ? null : !meId ? (
    <Link href={signIn} className="reel-live-follow">Follow</Link>
  ) : following === undefined ? null : (
    <button type="button" className={`reel-live-follow${following ? " is-on" : ""}`} aria-pressed={following} disabled={followPending} onClick={() => void toggleFollow()}>
      {following ? "Following" : "Follow"}
    </button>
  );

  /* overlay chat composer */
  const send = useSendLiveChat(row.id);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const mayType = canSendChat({ role, meId, banned: room.chat.banned, chatOpen: view.chatOpen });
  const chatNote = role === "guest" ? "Sign in to chat" : banned ? "You've been removed from this stream." : !mayType ? "Chat opens when the stream is live." : "";
  const sendDraft = async () => {
    const text = draft.trim();
    if (!text || !mayType || send.isPending) return;
    setSendError(null);
    try {
      const msg = await send.mutateAsync({ text });
      if (msg?.id) room.dispatch({ type: "sent", message: { ...msg, stream_id: msg.stream_id || row.id } });
      setDraft("");
    } catch (err) {
      setSendError(chatSendErrorCopy(err));
      if (isChatBan(err) && meId) room.dispatch({ type: "frame", frame: { kind: "ban", stream_id: row.id, user_id: meId } });
      if (errorCode(err) === "STREAM_NOT_LIVE") void qc.invalidateQueries({ queryKey: liveV2Keys.stream(row.id) });
    }
  };

  /* More menu and report */
  const [moreOpen, setMoreOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const onMore = async (key: LiveMoreKey) => {
    setMoreOpen(false);
    if (key === "report") {
      setReportOpen(true);
      return;
    }
    if (key === "copy-link") {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}${liveWatchHref(row)}`);
        toast({ type: "success", title: "Link copied" });
      } catch {
        toast({ type: "error", title: "Could not copy the link" });
      }
    }
  };
  const moreItems = liveMoreItems({ canReport: tools.reportStream, landscape: state.letterbox });
  const moreIcon = (key: LiveMoreKey) => (key === "report" ? <Flag /> : key === "watch-on-posttube" ? <Tv /> : <Link2 />);

  const showSide = desktop && sideOpen;
  const showPlayer = state.player && !watchError;
  const showOverlayChat = showPlayer && !showSide;
  const cover = row.cover_media_id ? mediaServeUrl(row.cover_media_id) : "";

  const header = (
    <LiveHeader
      row={row}
      state={state}
      view={view}
      creator={creator}
      follow={follow}
      hearts={<HeartCount streamId={row.id} heartCount={row.heart_count} />}
      supporters={showPlayer && !showSide ? <TopSupporters streamId={row.id} status={row.status} /> : null}
    />
  );

  return (
    <div className="reels-content reel-live" style={STAGE_STYLE} data-comments-open={showSide ? "true" : "false"} data-live-state={state.kind} data-live-stream={row.id}>
      <div className="reel-stage-area">
        <div className="reel-stage-cluster">
          <div className="reel-stage reel-live-frame" style={STAGE_STYLE} data-direction={direction} data-letterbox={state.letterbox ? "" : undefined} data-overlay-chat={showOverlayChat ? "true" : "false"}>
            <div className="reel-portrait-content reel-live-enter">
              {watchError ? (
                <LiveStatusCard
                  kind="refused"
                  title={watchError}
                  cover={cover}
                  action={
                    !meId ? (
                      <Link href={signIn} className="reel-state-action">Sign in</Link>
                    ) : isStreamFull(tokenQuery.error) ? (
                      // 403 STREAM_FULL (a new streamer's viewer cap): a seat may free up.
                      <button type="button" className="reel-state-action" onClick={() => void tokenQuery.refetch()}>Try again</button>
                    ) : undefined
                  }
                />
              ) : state.player ? (
                <LivePlayer
                  streamId={row.id}
                  creatorId={row.creator_user_id}
                  connect={connect}
                  muted={muted}
                  controls={false}
                  fit={state.letterbox ? "contain" : "cover"}
                  poster={cover || undefined}
                  waiting={view.kind === "reconnecting" ? "Waiting for the host to reconnect…" : undefined}
                >
                  <StageHearts streamId={row.id} heartCount={row.heart_count} status={row.status} signedIn={Boolean(meId)} banned={banned} />
                </LivePlayer>
              ) : state.kind === "waiting" ? (
                <LiveWaitingCard
                  row={row}
                  state={state}
                  cover={cover}
                  isHost={isHost}
                  reminder={<ReminderButton streamId={row.id} state={row} signedIn={Boolean(meId)} returnTo={here} />}
                />
              ) : (
                <LiveStatusCard
                  title={view.title || "This stream isn't available right now"}
                  body={view.body}
                  cover={cover}
                  state={state}
                  supporters={state.kind === "ended" && !showSide ? <TopSupporters streamId={row.id} status={row.status} /> : null}
                />
              )}

              {tabs}
              {header}

              {showPlayer ? (
                <div className="reel-live-bottom">
                  <h1 className="reel-live-title" title={row.title || undefined}>{row.title || "Live stream"}</h1>
                  {showOverlayChat ? (
                    <OverlayChat
                      messages={overlay}
                      note={chatNote}
                      signInHref={role === "guest" ? signIn : undefined}
                      draft={draft}
                      onDraft={setDraft}
                      onSend={() => void sendDraft()}
                      sending={send.isPending}
                      error={sendError}
                    />
                  ) : null}
                </div>
              ) : null}

              <div className="reel-live-actions" onClick={(e) => e.stopPropagation()}>
                {showPlayer ? (
                  <button type="button" className="reel-live-action" aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} onClick={onToggleSound}>
                    {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
                  </button>
                ) : null}
                <div className="reel-live-action-wrap">
                  <button type="button" className="reel-live-action" aria-label="More" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
                    <MoreHorizontal size={18} aria-hidden="true" />
                  </button>
                  <Popover open={moreOpen} onClose={closeMore} align="right" label="More options" placement="down" belowTrigger tone="stage" className="reel-more-menu">
                    <div className="reel-more-menu__list">
                      {moreItems.map((item) =>
                        item.key === "watch-on-posttube" ? (
                          <Link key={item.key} role="menuitem" href={state.posttubeHref} className="reel-more-menu__row" data-row={item.key} onClick={closeMore}>
                            <span className="reel-more-menu__icon">{moreIcon(item.key)}</span>
                            <span className="reel-more-menu__label"><span className="reel-more-menu__title">{item.label}</span></span>
                          </Link>
                        ) : (
                          <button key={item.key} type="button" role="menuitem" className="reel-more-menu__row" data-row={item.key} onClick={() => void onMore(item.key)}>
                            <span className="reel-more-menu__icon">{moreIcon(item.key)}</span>
                            <span className="reel-more-menu__label"><span className="reel-more-menu__title">{item.label}</span></span>
                          </button>
                        ),
                      )}
                    </div>
                  </Popover>
                </div>
              </div>
            </div>
          </div>

          <div className="reel-desktop-rail">
            <div className="reel-action-rail is-desktop" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="reel-action-button" aria-label={sideOpen ? "Hide chat" : "Show chat"} aria-pressed={sideOpen} onClick={onToggleSide}>
                <span className="reel-action-icon"><MessageCircle size={18} aria-hidden="true" /></span>
                <span className="reel-action-count">Chat</span>
              </button>
            </div>
          </div>
          <div className="reel-stage-reserve" aria-hidden="true" />
        </div>
        {arrows}
      </div>

      {desktop ? (
        <div className="reel-comments-column" data-reel-side-panel>
          {showSide ? (
            <aside className="reel-comments-panel is-column reel-live-side" aria-label="Live chat and creators" data-live-tab={tab}>
              {creatorsList}
              {state.chat && !watchError ? (
                <LiveChat streamId={row.id} hostId={row.creator_user_id} meId={meId} room={room} view={view} />
              ) : state.kind === "ended" ? (
                <div className="reel-live-side__pad"><SupportersCard streamId={row.id} status={row.status} /></div>
              ) : (
                <p className="reel-live-side__note">Chat opens when the stream is live.</p>
              )}
            </aside>
          ) : null}
        </div>
      ) : null}

      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} streamId={row.id} />
    </div>
  );
}

/** Loading / error / empty: a stage-sized frame in the stage's place, tabs on top. */
function StateLayout({ tabs, side, children }: { tabs: ReactNode; side?: ReactNode; children: ReactNode }) {
  return (
    <div className="reels-content reel-live" style={STAGE_STYLE} data-comments-open={side ? "true" : "false"} data-single-column={side ? undefined : ""}>
      <div className="reel-stage-area">
        <div className="reel-stage-cluster">
          <div className="reel-stage reel-live-frame" style={STAGE_STYLE}>
            <div className="reel-portrait-content">
              {children}
              {tabs}
            </div>
          </div>
          <div className="reel-desktop-rail" aria-hidden="true" />
          <div className="reel-stage-reserve" aria-hidden="true" />
        </div>
      </div>
      {side ? (
        <div className="reel-comments-column" data-reel-side-panel>
          <aside className="reel-comments-panel is-column reel-live-side" aria-label="Live creators">{side}</aside>
        </div>
      ) : null}
    </div>
  );
}

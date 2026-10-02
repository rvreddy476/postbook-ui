"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CalendarClock, Flag, MonitorPlay, Play, Radio, Users } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import { useLiveRoom, useLiveStreamRow, useViewerToken } from "@/hooks/useLiveV2";
import { useBatchProfiles } from "@/hooks/useProfile";
import { useAuthUser } from "@/store/auth";
import { chatRole, streamTools } from "@/features/live/chat";
import {
  categoryLabel,
  creatorHref,
  creatorName,
  formatLocalDateTime,
  hostScreenHref,
  reminderCountLabel,
  rowStatusView,
  watchState,
  type CreatorCard,
  type StreamRow,
  type WatchState,
} from "@/features/live/discovery";
import { isStreamFull, isStreamNotLive, watchErrorCopy } from "@/features/live/errors";
import { currentViewerCount, viewerCountLabel, type LiveStatusView } from "@/features/live/status";
import { Countdown } from "@/features/live/components/Countdown";
import { FoundingBadge } from "@/features/live/components/FoundingBadge";
import { LiveChat } from "@/features/live/components/LiveChat";
import { HeartCount, StageHearts } from "@/features/live/components/LiveHearts";
import { LivePlayer } from "@/features/live/components/LivePlayer";
import { LiveStatusBadge, LiveStatusPanel, ReconnectingNotice } from "@/features/live/components/LiveStatus";
import { ReminderButton } from "@/features/live/components/ReminderButton";
import { ReportSheet } from "@/features/live/components/ReportSheet";
import { SupportersCard } from "@/features/live/components/TopSupporters";
import { SubscribeButton } from "../components/SubscribeButton";
import { useTopics } from "../discovery/hooks/useDiscovery";
import { EmptyState, ErrorState, LoadingState } from "../discovery/components/DiscoveryState";
import { mediaServeUrl } from "../model";

import "@/features/live/live.css";
import "../discovery/discovery.css";
import "./live.css";

/*
  /posttube/live/[streamId] — the wide watch page.
    live / reconnecting  the player with the chat beside it
    starting             a calm panel, chat visible
    scheduled            the waiting card: cover, countdown, the time in the viewer's zone, Notify me
    ended / failed       the reason and, when the recording became a video, a link to it
  Everything shown comes from the server's row (features/live/discovery.ts
  watchState); the chat, report and moderation tools are the shared live
  components, and /live/[streamId] stays as it was.
*/

type ProfileLite = { display_name?: string; username?: string; avatar_url?: string; avatar_media_id?: string };

export function LiveWatchPage({ streamId }: { streamId: string }) {
  return <LiveWatch key={streamId} streamId={streamId} />;
}

function LiveWatch({ streamId }: { streamId: string }) {
  const user = useAuthUser();
  const meId = user?.id ?? null;
  const { row, error, refetch, isPending } = useLiveStreamRow(streamId);
  const room = useLiveRoom(streamId);
  const state = row ? watchState(row) : null;
  const tokenQuery = useViewerToken(streamId, !!state?.player);
  const topics = useTopics();

  // The row carries the host card; a card with only an id (a failed lookup, an older backend) falls back to the profile.
  const needsProfile = !!row && !row.creator.name && !row.creator.handle;
  const profiles = useBatchProfiles(needsProfile && row ? [row.creator_user_id] : []);
  const profile = (needsProfile && row && profiles.data instanceof Map ? profiles.data.get(row.creator_user_id) : null) as ProfileLite | null | undefined;

  // 409 STREAM_NOT_LIVE after the retries: our row says on air but the server no longer does. Re-read it.
  const tokenNotLive = isStreamNotLive(tokenQuery.error);
  useEffect(() => {
    if (tokenNotLive) void refetch();
  }, [tokenNotLive, refetch]);

  const [reportOpen, setReportOpen] = useState(false);

  if (!row || !state) {
    const copy = error ? watchErrorCopy(error) : null;
    return (
      <div className="tube-live-watch">
        {error ? (
          copy ? (
            <EmptyState icon={<Radio size={20} strokeWidth={1.75} />} title={copy} actionHref="/posttube/live" actionLabel="Back to Live" />
          ) : (
            <ErrorState what="this stream" onRetry={() => void refetch()} />
          )
        ) : isPending ? (
          <LoadingState label="Loading stream…" />
        ) : (
          <EmptyState icon={<Radio size={20} strokeWidth={1.75} />} title="This stream no longer exists." actionHref="/posttube/live" actionLabel="Back to Live" />
        )}
      </div>
    );
  }

  const creator: CreatorCard = profile
    ? {
        ...row.creator,
        name: profile.display_name || "",
        handle: row.creator.handle || profile.username || "",
        avatar_url: row.creator.avatar_url || profile.avatar_url || (profile.avatar_media_id ? mediaServeUrl(profile.avatar_media_id) : ""),
      }
    : row.creator;
  const view = rowStatusView(row, "viewer");
  const role = chatRole(meId, row.creator_user_id, room.chat.moderators);
  const tools = streamTools(role);
  const watchError = watchErrorCopy(tokenQuery.error);
  const banned = !!meId && room.chat.banned.includes(meId);

  return (
    <LiveWatchView
      row={row}
      state={state}
      view={view}
      creator={creator}
      topic={categoryLabel(row.category, topics.data ?? [])}
      isHost={role === "host"}
      signedIn={!!meId}
      watchError={watchError}
      onRetryWatch={isStreamFull(tokenQuery.error) ? () => void tokenQuery.refetch() : undefined}
      stage={
        <LivePlayer streamId={row.id} creatorId={row.creator_user_id} connect={state.player} waiting={view.kind === "reconnecting" ? "Waiting for the host to reconnect…" : undefined}>
          <StageHearts streamId={row.id} heartCount={row.heart_count} status={row.status} signedIn={!!meId} banned={banned} />
        </LivePlayer>
      }
      hearts={<HeartCount streamId={row.id} heartCount={row.heart_count} />}
      subscribe={
        <SubscribeButton channelRef={creator.handle || creator.user_id} hidden={!meId || role === "host"} size="sm" labels={{ off: "Subscribe", on: "Subscribed" }} />
      }
      reminder={<ReminderButton streamId={row.id} state={row} signedIn={!!meId} returnTo={`/posttube/live/${row.id}`} />}
      supporters={<SupportersCard streamId={row.id} status={row.status} />}
      chat={state.chat && !watchError ? <LiveChat streamId={row.id} hostId={row.creator_user_id} meId={meId} room={room} view={view} /> : null}
      onReport={tools.reportStream ? () => setReportOpen(true) : undefined}
      report={<ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} streamId={row.id} />}
    />
  );
}

export interface LiveWatchViewProps {
  row: StreamRow;
  state: WatchState;
  view: LiveStatusView;
  creator: CreatorCard;
  /** The topic's label; "" when the stream has none. */
  topic: string;
  isHost: boolean;
  signedIn: boolean;
  /** A final refusal to watch (banned, followers only, signed out); replaces the player. */
  watchError?: string | null;
  /** Set when the refusal may pass on its own (403 STREAM_FULL): draws "Try again". */
  onRetryWatch?: () => void;
  /** The player (it joins a room, so the page supplies it). */
  stage?: ReactNode;
  hearts?: ReactNode;
  subscribe?: ReactNode;
  reminder?: ReactNode;
  supporters?: ReactNode;
  chat?: ReactNode;
  report?: ReactNode;
  onReport?: () => void;
}

/** The pure page: what is drawn for each state of the row. */
export function LiveWatchView({ row, state, view, creator, topic, isHost, watchError, onRetryWatch, stage, hearts, subscribe, reminder, supporters, chat, report, onReport }: LiveWatchViewProps) {
  const name = creatorName(creator);
  const channel = creatorHref(creator);
  const viewers = currentViewerCount(row, null);
  const cover = row.cover_media_id ? mediaServeUrl(row.cover_media_id) : "";
  const when = formatLocalDateTime(row.scheduled_at);
  const reminders = reminderCountLabel(row.reminder_count);
  const creatorBlock = (
    <>
      <Avatar src={creator.avatar_url || null} name={name} seed={creator.user_id} size="md" />
      <span className="tube-live-watch__creator-text">
        <span className="tube-live-watch__creator-name">
          <span>{name}</span>
          <FoundingBadge badges={creator.badges} />
        </span>
        {creator.handle && creator.name ? <span className="tube-live-watch__creator-handle">@{creator.handle}</span> : null}
      </span>
    </>
  );

  return (
    <div className="tube-live-watch" data-screen="live-watch" data-state={state.kind}>
      <div className={chat ? "live-layout" : undefined}>
        <div className="tube-live-watch__main">
          {watchError ? (
            <LiveStatusPanel
              view={{ ...view, title: watchError, body: "" }}
              action={onRetryWatch ? <button type="button" className="tube-live-btn" onClick={onRetryWatch}>Try again</button> : undefined}
            />
          ) : state.kind === "live" ? (
            <>
              <ReconnectingNotice view={view} />
              {stage}
            </>
          ) : state.kind === "waiting" ? (
            <div className="tube-live-wait" data-wait="scheduled">
              {cover ? <img className="tube-live-wait__cover" src={cover} alt="" /> : null}
              <p className="tube-live-wait__label">{state.countdown ? "Starts in" : "Scheduled"}</p>
              <p className="tube-live-wait__count">{state.countdown ? <Countdown to={row.scheduled_at} /> : "Starting soon"}</p>
              {when ? <p className="tube-live-wait__when"><CalendarClock size={14} strokeWidth={2} aria-hidden className="mr-1 inline-block align-[-2px]" />{when}</p> : null}
              {reminders ? <p className="tube-live-wait__note">{reminders}</p> : null}
              <div className="tube-live-wait__actions">
                {isHost ? (
                  <Link href={hostScreenHref(row.id)} className="tube-live-btn is-primary">
                    <MonitorPlay aria-hidden />
                    Open host screen
                  </Link>
                ) : (
                  reminder
                )}
              </div>
            </div>
          ) : state.kind === "ended" ? (
            <>
              <LiveStatusPanel
                view={view}
                action={
                  state.recordingHref ? (
                    <Link href={state.recordingHref} className="tube-live-btn is-primary" data-recording="post">
                      <Play aria-hidden />
                      Watch the recording
                    </Link>
                  ) : state.recordingUrl ? null : (
                    <span className="live-panel__body">No recording is available for this stream.</span>
                  )
                }
              />
              {state.recordingUrl ? (
                <div className="live-stage">
                  <video src={state.recordingUrl} controls className="live-stage__video" />
                </div>
              ) : null}
            </>
          ) : (
            <LiveStatusPanel view={view} />
          )}

          <h1 className="tube-live-watch__title">{row.title || "Live stream"}</h1>
          <div className="tube-live-watch__meta">
            <LiveStatusBadge view={view} />
            {state.player ? (
              <span className="inline-flex items-center gap-1">
                <Users size={13} strokeWidth={2} aria-hidden />
                {viewerCountLabel(viewers)}
              </span>
            ) : null}
            {state.player ? hearts : null}
            {topic ? (
              <Link href={`/posttube/topics/${encodeURIComponent(row.category)}`} className="tube-live-topic">
                {topic}
              </Link>
            ) : null}
          </div>

          <div className="tube-live-watch__row">
            {channel ? (
              <Link href={channel} className="tube-live-watch__creator">
                {creatorBlock}
              </Link>
            ) : (
              <span className="tube-live-watch__creator">{creatorBlock}</span>
            )}
            <div className="tube-live-watch__actions">
              {subscribe}
              {isHost && state.kind !== "ended" && state.kind !== "failed" && state.kind !== "waiting" ? (
                <Link href={hostScreenHref(row.id)} className="tube-live-btn">
                  <MonitorPlay aria-hidden />
                  Open host screen
                </Link>
              ) : null}
              {onReport ? (
                <button type="button" className="tube-live-btn" onClick={onReport} aria-label="Report stream">
                  <Flag aria-hidden />
                  Report
                </button>
              ) : null}
            </div>
          </div>

          {row.description ? <p className="tube-live-watch__about">{row.description}</p> : null}
          {state.kind === "ended" ? supporters : null}
        </div>
        {chat}
      </div>
      {report}
    </div>
  );
}

"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { CalendarClock, MonitorPlay, Play, Radio, Send, Tv, Users } from "lucide-react";

import { Avatar } from "@/components/LetterAvatar";
import { FoundingBadge } from "@/features/live/components/FoundingBadge";
import { Countdown } from "@/features/live/components/Countdown";
import {
  creatorName,
  formatLocalDateTime,
  hostScreenHref,
  liveWatchHref,
  reminderCountLabel,
  type CreatorCard,
  type LiveCreatorRow,
  type StreamRow,
} from "@/features/live/discovery";
import type { LiveChatMessage } from "@/features/live/model";
import { viewerCountLabel, type LiveStatusView } from "@/features/live/status";
import { formatCount } from "@/features/reels/model";
import { LIVE_TABS, SIDE_CREATORS_MAX, type LiveEmptyCopy, type LiveStageState, type LiveTab } from "../liveStage";
import { liveRingLabel } from "../liveRing";
import { OVERLAY_CHAT_MAX_CHARS, overlayName, overlayTag } from "../overlayChat";

/*
  The drawn pieces of the Reels Live stage, as plain props → markup, so the
  tests render them without a room, a socket or a query client. Anything
  that joins a room or fetches (the player, hearts, reminders, supporters,
  the full chat) is passed in as a node by ReelsLiveScreen.
*/

/** For you / Following, over the top of the frame in every state. */
export function LiveTabs({ tab }: { tab: LiveTab }) {
  return (
    <nav className="reel-live-tabs" aria-label="Live feeds">
      {LIVE_TABS.map((t) => (
        <Link key={t.key} href={t.href} className="reel-live-tab" aria-current={t.key === tab ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export interface LiveHeaderProps {
  row: Pick<StreamRow, "id" | "title" | "viewer_count">;
  state: LiveStageState;
  view: LiveStatusView;
  creator: CreatorCard;
  /** The Follow pill (it mutates, so the screen supplies it). */
  follow?: ReactNode;
  /** The heart count (it listens to the room). */
  hearts?: ReactNode;
  /** Top supporters, where the full chat's header is not on screen. */
  supporters?: ReactNode;
}

/**
 * Top-left of the frame: the creator (avatar, name, founding badge, Follow),
 * then the status row. LIVE is drawn only when the state says so
 * (status === "live"); any other status shows its own word.
 */
export function LiveHeader({ row, state, view, creator, follow, hearts, supporters }: LiveHeaderProps) {
  const name = creatorName(creator);
  const profileHref = `/u/${encodeURIComponent(creator.handle || creator.user_id)}`;
  return (
    <div className="reel-live-header" onClick={(e) => e.stopPropagation()}>
      <div className="reel-live-creator">
        <Link href={profileHref} className="reel-live-creator__avatar" aria-label={`${name}'s profile`}>
          <Avatar src={creator.avatar_url || null} name={name} seed={creator.user_id} size="sm" />
        </Link>
        <span className="reel-live-creator__name">
          <Link href={profileHref}>{name}</Link>
          <FoundingBadge badges={creator.badges} compact />
        </span>
        {follow}
      </div>
      <div className="reel-live-meta">
        {state.liveBadge ? (
          <span className="reel-live-badge" data-status="live">
            <span className="reel-live-badge__dot" aria-hidden="true" />
            LIVE
          </span>
        ) : (
          <span className="reel-live-badge is-quiet" data-status={view.kind}>{view.label}</span>
        )}
        {state.player ? (
          <span className="reel-live-stat" aria-label={viewerCountLabel(row.viewer_count)}>
            <Users aria-hidden="true" />
            <span aria-hidden="true">{formatCount(row.viewer_count)}</span>
          </span>
        ) : null}
        {state.player ? hearts : null}
        {supporters}
      </div>
      {state.letterbox ? (
        <Link href={state.posttubeHref} className="reel-live-pill" data-posttube-link>
          <Tv aria-hidden="true" />
          Watch on PostTube
        </Link>
      ) : null}
    </div>
  );
}

export interface OverlayChatProps {
  messages: readonly LiveChatMessage[];
  /** The author's name for a row; defaults to the row's author card (name, @handle, "Viewer"). */
  nameOf?: (userId: string, message: LiveChatMessage) => string;
  /** Why the composer is not shown; "" shows it. */
  note: string;
  /** Where "Sign in to chat" leads; set only for a signed-out reader. */
  signInHref?: string;
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  error?: string | null;
}

/** The last few messages fading up, and the composer under them. */
export function OverlayChat({ messages, nameOf = (_id, m) => overlayName(m), note, signInHref, draft, onDraft, onSend, sending = false, error }: OverlayChatProps) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSend();
  };
  return (
    <div className="reel-live-chat" data-live-overlay-chat onClick={(e) => e.stopPropagation()}>
      <ol className="reel-live-chat__list" role="log" aria-label="Live messages" aria-live="polite" aria-relevant="additions">
        {messages.map((m) => (
          <li key={m.id} className="reel-live-chat__row">
            <span className="reel-live-chat__name">{nameOf(m.user_id, m)}</span>
            {overlayTag(m) ? <span className="reel-live-chat__role">{overlayTag(m)}</span> : null}
            <span className="reel-live-chat__text">{m.text}</span>
          </li>
        ))}
      </ol>
      {note ? (
        signInHref ? (
          <Link href={signInHref} className="reel-live-chat__note">{note}</Link>
        ) : (
          <p className="reel-live-chat__note">{note}</p>
        )
      ) : (
        <form className="reel-live-chat__form" onSubmit={submit}>
          <input
            type="text"
            className="reel-live-chat__input"
            value={draft}
            onChange={(e) => onDraft(e.target.value.slice(0, OVERLAY_CHAT_MAX_CHARS))}
            placeholder="Say something…"
            aria-label="Chat message"
            maxLength={OVERLAY_CHAT_MAX_CHARS}
          />
          <button type="submit" className="reel-live-chat__send" aria-label={sending ? "Sending message" : "Send message"} disabled={sending || !draft.trim()}>
            <Send aria-hidden="true" />
          </button>
        </form>
      )}
      {error ? <p className="reel-live-chat__error" role="alert">{error}</p> : null}
    </div>
  );
}

/** A scheduled stream: cover behind, countdown, the time in the viewer's zone, Notify me. */
export function LiveWaitingCard({ row, state, cover, isHost, reminder }: { row: StreamRow; state: LiveStageState; cover: string; isHost: boolean; reminder?: ReactNode }) {
  const when = formatLocalDateTime(row.scheduled_at);
  const reminders = reminderCountLabel(row.reminder_count);
  return (
    <div className="reel-live-card" data-wait="scheduled">
      {cover ? <img className="reel-live-card__cover" src={cover} alt="" /> : null}
      <div className="reel-live-card__body">
        <CalendarClock className="reel-live-card__icon" aria-hidden="true" />
        <p className="reel-live-card__label">{state.countdown ? "Starts in" : "Scheduled"}</p>
        <p className="reel-live-card__count">{state.countdown ? <Countdown to={row.scheduled_at} /> : "Starting soon"}</p>
        {when ? <p className="reel-live-card__hint">{when}</p> : null}
        <h1 className="reel-live-card__title">{row.title || "Live stream"}</h1>
        {reminders ? <p className="reel-live-card__hint">{reminders}</p> : null}
        <div className="reel-live-card__actions">
          {isHost ? (
            <Link href={hostScreenHref(row.id)} className="reel-state-action">
              <MonitorPlay className="h-4 w-4" aria-hidden="true" />
              Open host screen
            </Link>
          ) : (
            reminder
          )}
        </div>
      </div>
    </div>
  );
}

/** Ended, failed, starting, unavailable, or a refusal to watch: the reason, and the recording when there is one. */
export function LiveStatusCard({
  title,
  body,
  cover,
  state,
  kind,
  action,
  supporters,
}: {
  title: string;
  body?: string;
  cover?: string;
  state?: Pick<LiveStageState, "kind" | "recordingHref" | "recordingUrl">;
  kind?: string;
  action?: ReactNode;
  supporters?: ReactNode;
}) {
  return (
    <div className="reel-live-card" data-status={kind ?? state?.kind}>
      {cover ? <img className="reel-live-card__cover" src={cover} alt="" /> : null}
      <div className="reel-live-card__body">
        <Radio className="reel-live-card__icon" aria-hidden="true" />
        <h1 className="reel-live-card__title">{title}</h1>
        {body ? <p className="reel-live-card__hint">{body}</p> : null}
        {state?.kind === "ended" ? (
          state.recordingHref ? (
            <Link href={state.recordingHref} className="reel-state-action" data-recording="post">
              <Play className="h-4 w-4" aria-hidden="true" />
              Watch the recording
            </Link>
          ) : state.recordingUrl ? (
            <a href={state.recordingUrl} className="reel-state-action" data-recording="file">
              <Play className="h-4 w-4" aria-hidden="true" />
              Watch the recording
            </a>
          ) : (
            <p className="reel-live-card__hint">No recording is available for this stream.</p>
          )
        ) : null}
        {action ? <div className="reel-live-card__actions">{action}</div> : null}
        {supporters}
      </div>
    </div>
  );
}

/** Desktop side list: creators who are live right now, most watched first, each avatar ringed. */
export function LiveCreatorsList({ rows, currentStreamId }: { rows: readonly LiveCreatorRow[]; currentStreamId?: string }) {
  if (rows.length === 0) return null;
  return (
    <section className="reel-live-creators" aria-label="Live creators">
      <h2 className="reel-live-creators__title">Live creators</h2>
      <ul className="reel-live-creators__list">
        {rows.slice(0, SIDE_CREATORS_MAX).map((r) => {
          const name = creatorName(r.creator);
          return (
            <li key={r.stream_id}>
              <Link
                href={liveWatchHref({ id: r.stream_id, orientation: r.orientation })}
                className="reel-live-creators__row"
                aria-current={r.stream_id === currentStreamId ? "true" : undefined}
                aria-label={liveRingLabel(name)}
              >
                <span className="reel-live-ring is-live">
                  <Avatar src={r.creator.avatar_url || null} name={name} seed={r.creator.user_id} size="sm" />
                </span>
                <span className="reel-live-creators__name">
                  <span>{name}</span>
                  <FoundingBadge badges={r.creator.badges} compact />
                </span>
                <span className="reel-live-creators__viewers">
                  <Users aria-hidden="true" />
                  {formatCount(r.viewer_count)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Nothing live: the reason, then the portrait streams that are scheduled, each with Notify me. */
export function LiveEmpty({ copy, upcoming, reminderFor }: { copy: LiveEmptyCopy; upcoming: readonly StreamRow[]; reminderFor: (row: StreamRow) => ReactNode }) {
  return (
    <div className="reel-live-empty" data-live-empty>
      <Radio className="reel-live-card__icon" aria-hidden="true" />
      <h1 className="reel-live-card__title">{copy.title}</h1>
      <p className="reel-live-card__hint">{copy.body}</p>
      {copy.actionHref && copy.actionLabel ? (
        <Link href={copy.actionHref} className="reel-state-action">{copy.actionLabel}</Link>
      ) : null}
      {upcoming.length > 0 ? (
        <section className="reel-live-upcoming" aria-label="Upcoming live streams">
          <h2 className="reel-live-upcoming__title">Upcoming</h2>
          <ul className="reel-live-upcoming__list">
            {upcoming.map((row) => {
              const when = formatLocalDateTime(row.scheduled_at);
              return (
                <li key={row.id} className="reel-live-upcoming__row">
                  <Link href={liveWatchHref(row)} className="reel-live-upcoming__text">
                    <span className="reel-live-upcoming__name">{row.title || "Live stream"}</span>
                    <span className="reel-live-upcoming__meta">
                      {creatorName(row.creator)}
                      {when ? ` · ${when}` : ""}
                    </span>
                  </Link>
                  {reminderFor(row)}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/*
  Chat settings page (CONTRACT §1.1, §9): the switches, their wire patch,
  the optimistic value, and the words. Pure, so a switch can never send a
  field it does not own.
*/

import type { AlertTone, ConversationPrefs, SharedMediaItem } from '@/lib/chat/contract'
import type { MessageReportReason, PrefsPatch } from '@/services/chatParityApi'
import type { ReportReason } from '@/hooks/useReport'

export type PrefSwitch = 'isMuted' | 'muteCalls' | 'isPinned'

export const PREF_SWITCHES: readonly PrefSwitch[] = ['isMuted', 'muteCalls', 'isPinned']

export const PREF_SWITCH_LABELS: Record<PrefSwitch, string> = {
  isMuted: 'Mute messages',
  muteCalls: 'Mute calls',
  isPinned: 'Pin to top',
}

/** The one field a switch changes on PUT /conversations/:id/settings. */
export function prefSwitchPatch(key: PrefSwitch, on: boolean): PrefsPatch {
  switch (key) {
    case 'isMuted':
      return { is_muted: on }
    case 'muteCalls':
      return { mute_calls: on }
    case 'isPinned':
      return { is_pinned: on }
  }
}

/** The prefs as they will be once the switch lands (shown before the server answers). */
export function applyPrefSwitch(prefs: ConversationPrefs, key: PrefSwitch, on: boolean): ConversationPrefs {
  return { ...prefs, [key]: on }
}

export const ALERT_TONE_LABELS: Record<AlertTone, string> = {
  default: 'Default',
  chime: 'Chime',
  pop: 'Pop',
  bell: 'Bell',
  silent: 'Silent',
}

export function alertTonePatch(tone: AlertTone): PrefsPatch {
  return { alert_tone: tone }
}

/* ---- Disappearing messages (disappear_after_ms) ---------------------- */

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** The choices, in order; `ms: null` is Off. */
export const DISAPPEAR_OPTIONS: readonly { ms: number | null; label: string }[] = [
  { ms: null, label: 'Off' },
  { ms: DAY_MS, label: '24 hours' },
  { ms: 7 * DAY_MS, label: '7 days' },
  { ms: 90 * DAY_MS, label: '90 days' },
]

/** PUT /conversations/:id/settings body for a choice. Off is 0, never null (null is "leave as is"). */
export function disappearPatch(ms: number | null): PrefsPatch {
  return { disappear_after_ms: ms && ms > 0 ? ms : 0 }
}

/**
 * A window in words. A value set elsewhere (another client, an old build)
 * that is not one of the choices still reads sensibly.
 */
export function disappearLabel(ms: number | null): string {
  if (!ms || ms <= 0) return 'Off'
  const known = DISAPPEAR_OPTIONS.find((o) => o.ms === ms)
  if (known) return known.label
  if (ms % DAY_MS === 0) return ms === DAY_MS ? '1 day' : `${ms / DAY_MS} days`
  const hours = Math.max(1, Math.round(ms / HOUR_MS))
  return hours === 1 ? '1 hour' : `${hours} hours`
}

/** The system line in the thread while it is on; null when off. */
export function disappearingNotice(ms: number | null): string | null {
  if (!ms || ms <= 0) return null
  return `Disappearing messages are on: ${disappearLabel(ms)}`
}

/** The profile a "View profile" tap opens: the handle when known, else the id. */
export function profileHref(peer: { userId: string; username: string | null }): string {
  return `/u/${encodeURIComponent(peer.username || peer.userId)}`
}

/** A media tile's image source; null for audio (it has no picture). */
export function sharedMediaSrc(item: Pick<SharedMediaItem, 'mediaId' | 'kind'>): string | null {
  if (item.kind === 'audio') return null
  return `/v1/media/${encodeURIComponent(item.mediaId)}/serve`
}

/** The tabs block shows only when at least one of its routes answered. */
export function sharedTabsVisible(posts: unknown[] | null | undefined, media: unknown[] | null | undefined): boolean {
  return posts != null || media != null
}

export const NOT_AVAILABLE_YET = {
  clear: "Clearing chats isn't available yet",
  delete: "Deleting chats isn't available yet",
} as const

export const REPORT_THANKS = "Thanks, we'll take a look"

/**
 * Chat settings › Report goes to POST /conversations/:id/report (fix pass 2),
 * which takes the chat reasons. A server without that route yet falls back
 * to reporting the person through trust-safety's /v1/reports, whose reason
 * names differ; this maps one to the other. Groups have no fallback.
 */
export function legacyUserReportReason(reason: MessageReportReason): ReportReason {
  switch (reason) {
    case 'spam':
    case 'scam':
      return 'spam'
    case 'harassment':
      return 'harassment'
    case 'hate':
      return 'hate_speech'
    case 'violence':
      return 'violence'
    case 'sexual':
      return 'nudity'
    default:
      return 'other'
  }
}

export const REPORT_GROUP_NOT_AVAILABLE = "Reporting groups isn't available yet."

export type ConfirmKind = 'block' | 'clear' | 'delete' | 'leave'

export const CONFIRM_COPY: Record<ConfirmKind, { title: string; body: (name: string) => string; action: string }> = {
  block: {
    title: 'Block this person?',
    body: (name) => `${name} won't be able to message or call you, or find your profile.`,
    action: 'Block',
  },
  clear: {
    title: 'Clear this chat?',
    body: () => 'Messages up to now are removed for you. The other side keeps theirs.',
    action: 'Clear',
  },
  delete: {
    title: 'Delete this chat?',
    body: () => 'The chat leaves your list and its history is removed for you. A new message brings it back.',
    action: 'Delete',
  },
  leave: {
    title: 'Leave this group?',
    body: (name) => `You'll stop getting messages from ${name}.`,
    action: 'Leave',
  },
}

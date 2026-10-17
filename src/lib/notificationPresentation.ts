/*
  How an inbox row presents itself when the web has no wording of its own.

  GET /v1/notifications carries two presentation fields on every row:
  `title` (a complete sentence, actor's name included where there is one)
  and `icon` (a coarse category for the row's glyph). Older servers send
  neither, so both decode to undefined and the callers fall back to what
  they rendered before.

  The web keeps its own sentence for the types it knows well; the server's
  title only replaces the generic fallback line. A row with no actor (the
  zero UUID, or no name to show) gets a glyph chosen by `icon` instead of a
  made-up avatar.
*/

export const NOTIFICATION_ICONS = [
  'social', 'message', 'call', 'live', 'order', 'food', 'home_service',
  'ride', 'dating', 'community', 'qa', 'account', 'system',
] as const

export type NotificationIcon = (typeof NOTIFICATION_ICONS)[number]

const ICON_SET: ReadonlySet<string> = new Set(NOTIFICATION_ICONS)

/** A known icon key, or undefined for anything else (absent, empty, unknown). */
export function notificationIcon(value: unknown): NotificationIcon | undefined {
  return typeof value === 'string' && ICON_SET.has(value) ? (value as NotificationIcon) : undefined
}

/** The server's sentence, trimmed; undefined when absent or blank. */
export function notificationTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  return t ? t : undefined
}

const ZERO_UUID = /^0{8}-0{4}-0{4}-0{4}-0{12}$/

/** The actor's id, or undefined for none (missing, empty, the zero UUID). */
export function notificationActorId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const id = value.trim()
  return id && !ZERO_UUID.test(id) ? id : undefined
}

export interface NotificationActorSummary {
  id: string
  username?: string
  display_name?: string
}

/** The embedded `actor` the server hydrates at read time, when it is usable. */
export function notificationActor(value: unknown): NotificationActorSummary | undefined {
  const a = value as Record<string, unknown> | null
  if (!a || typeof a !== 'object') return undefined
  const id = notificationActorId(a.id)
  if (!id) return undefined
  const username = typeof a.username === 'string' && a.username.trim() ? a.username.trim() : undefined
  const display_name = typeof a.display_name === 'string' && a.display_name.trim() ? a.display_name.trim() : undefined
  return { id, username, display_name }
}

/** A row has an actor only when there is a real id AND a name to show for it. */
export function notificationHasActor(actorId: unknown, name: string | undefined | null): boolean {
  return !!notificationActorId(actorId) && !!name?.trim()
}

/** The presentation fields every client row carries, decoded (absent → undefined). */
export interface NotificationPresentationFields {
  title: string | undefined
  icon: NotificationIcon | undefined
  actor: NotificationActorSummary | undefined
}

export function notificationPresentationFields(row: unknown): NotificationPresentationFields {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
  return { title: notificationTitle(r.title), icon: notificationIcon(r.icon), actor: notificationActor(r.actor) }
}

/**
 * The bell's line for one row.
 *  - 'actor': "<name> <sentence>" — the web's own wording, when it has one
 *    for this type and there is an actor to name.
 *  - 'title': the server's complete sentence, shown as it is.
 * With neither a sentence nor a title the row renders as it always did:
 * the actor slot plus the generic fallback sentence.
 */
export type BellLine = { kind: 'actor'; sentence: string } | { kind: 'title'; title: string }

export const GENERIC_ACTOR_SENTENCE = 'sent you a notification'

export function bellLine(ownSentence: string | null, serverTitle: string | undefined, hasActor: boolean): BellLine {
  if (ownSentence && hasActor) return { kind: 'actor', sentence: ownSentence }
  if (serverTitle) return { kind: 'title', title: serverTitle }
  return { kind: 'actor', sentence: ownSentence ?? GENERIC_ACTOR_SENTENCE }
}

export interface BellRowPresentation {
  /** A real actor with a name: show their avatar and, when the web has one, its own sentence. */
  hasActor: boolean
  /** The name for the actor slot (the id's prefix when no name is known, as before). */
  name: string
  line: BellLine
  /** The glyph to show instead of an avatar: only for a row with no actor. */
  glyph?: NotificationIcon
}

/**
 * Everything a bell row needs to render. `ownSentence` is the header's own
 * wording for the type (null when it has none); `profileName` is the
 * client-side profile lookup, used when the server did not embed the actor.
 */
export function bellRow(
  row: { actor_user_id?: string; title?: string; icon?: NotificationIcon; actor?: NotificationActorSummary },
  ownSentence: string | null,
  profileName?: string,
): BellRowPresentation {
  const knownName = row.actor?.display_name || profileName?.trim() || row.actor?.username
  const hasActor = notificationHasActor(row.actor_user_id, knownName)
  return {
    hasActor,
    name: knownName || (row.actor_user_id ?? '').slice(0, 8),
    line: bellLine(ownSentence, row.title, hasActor),
    glyph: hasActor ? undefined : row.icon,
  }
}

/*
  In-app alert sound for an incoming chat message (CONTRACT §8, fix pass 2).

  A message in a chat that is not on screen plays that chat's alert tone
  from public/sounds: chime, pop or bell; `silent` plays nothing; `default`
  plays the pop (the web has no system message sound to borrow). A muted
  chat, my own message, or the sound switch being off plays nothing.

  Pure rules plus a small per-conversation cache; the player lives in
  src/hooks/useChatAlertTone.ts so these stay testable without audio.
*/

import { ALERT_TONES, type AlertTone } from './contract'

export const ALERT_TONE_SRC: Record<Exclude<AlertTone, 'silent' | 'default'>, string> = {
  chime: '/sounds/msg_tone_chime.wav',
  pop: '/sounds/msg_tone_pop.wav',
  bell: '/sounds/msg_tone_bell.wav',
}

/** The file a tone plays; null for silent. Unknown values play the default. */
export function alertToneSrc(tone: AlertTone | string | null | undefined): string | null {
  if (tone === 'silent') return null
  if (tone === 'chime' || tone === 'pop' || tone === 'bell') return ALERT_TONE_SRC[tone]
  return ALERT_TONE_SRC.pop
}

export function asAlertTone(v: unknown): AlertTone {
  return ALERT_TONES.includes(v as AlertTone) ? (v as AlertTone) : 'default'
}

export interface AlertPrefs {
  tone: AlertTone
  muted: boolean
  /** Mute ends here (ISO); a past value means not muted. */
  muteUntil?: string | null
}

export function isMutedNow(p: Pick<AlertPrefs, 'muted' | 'muteUntil'>, now = Date.now()): boolean {
  if (!p.muted) return false
  if (!p.muteUntil) return true
  const t = Date.parse(p.muteUntil)
  return Number.isNaN(t) || t > now
}

export interface IncomingForAlert {
  senderId: string
  conversationId: string
}

export interface AlertContext {
  myId: string
  /** The app-wide message sound switch. */
  soundEnabled: boolean
  /** The chat is open in this tab. */
  chatOnScreen: boolean
  /** This tab is visible (an open chat in a hidden tab is not on screen). */
  pageVisible: boolean
  /** Dating chats are a different product and never ring here. */
  isDating: boolean
  /** Known prefs for the chat; undefined = not known (plays the default). */
  prefs: AlertPrefs | undefined
  now?: number
}

/** The sound to play for this message, or null for none. */
export function alertSoundFor(msg: IncomingForAlert, ctx: AlertContext): string | null {
  if (!ctx.soundEnabled) return null
  if (!msg.senderId || msg.senderId === ctx.myId) return null
  if (ctx.isDating) return null
  if (ctx.chatOnScreen && ctx.pageVisible) return null
  if (ctx.prefs && isMutedNow(ctx.prefs, ctx.now)) return null
  return alertToneSrc(ctx.prefs?.tone ?? 'default')
}

/* ------------------------------------------------------------------ */
/*  Per-conversation prefs cache                                       */
/* ------------------------------------------------------------------ */

const PREFS_TTL_MS = 5 * 60_000

export class AlertPrefsCache {
  private entries = new Map<string, { prefs: AlertPrefs; at: number }>()

  constructor(private readonly clock: () => number = Date.now) {}

  set(conversationId: string, prefs: AlertPrefs): void {
    if (!conversationId) return
    this.entries.set(conversationId, { prefs, at: this.clock() })
  }

  /** Fresh prefs, or undefined when unknown or older than the TTL. */
  get(conversationId: string): AlertPrefs | undefined {
    const e = this.entries.get(conversationId)
    if (!e) return undefined
    if (this.clock() - e.at > PREFS_TTL_MS) {
      this.entries.delete(conversationId)
      return undefined
    }
    return e.prefs
  }

  /** Change only some fields of a known entry (a mute toggle, a tone pick). */
  patch(conversationId: string, patch: Partial<AlertPrefs>): void {
    const cur = this.entries.get(conversationId)?.prefs ?? { tone: 'default' as AlertTone, muted: false }
    this.set(conversationId, { ...cur, ...patch })
  }

  clear(): void {
    this.entries.clear()
  }
}

/** One cache for the app: the inbox, chat settings and the notifier share it. */
export const alertPrefsCache = new AlertPrefsCache()

/**
 * Prime the cache from conversation rows as the server sends them (inbox
 * list, conversation detail): `alert_tone`, `is_muted`, `mute_until`.
 * A row without `alert_tone` is skipped, so an older server never pins
 * "default" over a tone set elsewhere.
 */
export function primeAlertPrefs(rows: readonly unknown[], cache: AlertPrefsCache = alertPrefsCache): void {
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const id = typeof o.id === 'string' && o.id ? o.id : typeof o.conversation_id === 'string' ? o.conversation_id : ''
    if (!id || typeof o.alert_tone !== 'string' || o.alert_tone === '') continue
    cache.set(id, {
      tone: asAlertTone(o.alert_tone),
      muted: o.is_muted === true,
      muteUntil: typeof o.mute_until === 'string' && o.mute_until ? o.mute_until : null,
    })
  }
}

/* ------------------------------------------------------------------ */
/*  One tab plays                                                      */
/* ------------------------------------------------------------------ */

/** The storage subset used to agree which tab plays a message's sound. */
export interface ClaimStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const CLAIM_KEY = 'chat_alert_played'
const CLAIM_KEEP = 50

/**
 * Every open tab receives the same message. The first tab to claim its id
 * plays; the others see the claim and stay quiet. Ids are kept in a short
 * ring in localStorage. No storage (private mode) = this tab plays.
 */
export function claimAlert(messageId: string, store: ClaimStore | null): boolean {
  if (!messageId) return true
  if (!store) return true
  try {
    const raw = store.getItem(CLAIM_KEY)
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : []
    const list = Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : []
    if (list.includes(messageId)) return false
    list.push(messageId)
    store.setItem(CLAIM_KEY, JSON.stringify(list.slice(-CLAIM_KEEP)))
    return true
  } catch {
    return true
  }
}

/*
  Hidden chats wire (contract 24 Oct 2026): request builders, response
  decoders and error mapping. Pure: the calls themselves are in
  services/hiddenChatsApi.ts. Paths are relative to the chat API prefix
  (/api/chat → /v1/chat).

    GET  /hidden/settings                  {configured, strict, shortcut}
    PUT  /hidden/settings                  {secret_key?, chat_password?, current_chat_password?, strict?, shortcut?}
    POST /hidden/reset                     step-up token; {secret_key, chat_password}
    POST /conversations/:id/hide
    POST /conversations/:id/unhide         X-Chat-Open
    POST /hidden/reveal  {secret_key}      200 {reveal_token, expires_at} | 404 | 429 LOCKED {retry_after}
    GET  /hidden/conversations             X-Chat-Reveal → normal row shape | 404
    POST /hidden/open    {chat_password}   X-Chat-Reveal → 200 {open_token, expires_at} | 401 WRONG_PASSWORD {attempts_left} | 429 LOCKED
    messages / send / media / socket       X-Chat-Open (socket: in the subscribe frame) | 403 CHAT_LOCKED
*/

export const REVEAL_HEADER = 'X-Chat-Reveal'
export const OPEN_HEADER = 'X-Chat-Open'

export interface WireRequest {
  path: string
  init: { method: 'GET' | 'POST' | 'PUT'; headers?: Record<string, string>; body?: string }
}

const enc = encodeURIComponent
const json = (body: Record<string, unknown>) => JSON.stringify(body)

export const settingsRequest = (): WireRequest => ({ path: '/hidden/settings', init: { method: 'GET' } })

export interface SettingsPatch {
  secretKey?: string
  chatPassword?: string
  currentChatPassword?: string
  strict?: boolean
  shortcut?: string | null
}

/** Only the fields being set travel; an empty string is "not changing it". */
export function settingsBody(p: SettingsPatch): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (p.secretKey) body.secret_key = p.secretKey
  if (p.chatPassword) body.chat_password = p.chatPassword
  if (p.currentChatPassword) body.current_chat_password = p.currentChatPassword
  if (typeof p.strict === 'boolean') body.strict = p.strict
  if (p.shortcut !== undefined) body.shortcut = p.shortcut
  return body
}

export const updateSettingsRequest = (p: SettingsPatch): WireRequest => ({
  path: '/hidden/settings',
  init: { method: 'PUT', body: json(settingsBody(p)) },
})

/** Reset after signing in again: the step-up access token is the bearer for this one call. */
export const resetRequest = (secretKey: string, chatPassword: string, stepUpToken: string): WireRequest => ({
  path: '/hidden/reset',
  init: {
    method: 'POST',
    headers: { Authorization: `Bearer ${stepUpToken}` },
    body: json({ secret_key: secretKey, chat_password: chatPassword }),
  },
})

export const revealRequest = (secretKey: string): WireRequest => ({
  path: '/hidden/reveal',
  init: { method: 'POST', body: json({ secret_key: secretKey.trim() }) },
})

export const hiddenListRequest = (revealToken: string): WireRequest => ({
  path: '/hidden/conversations',
  init: { method: 'GET', headers: { [REVEAL_HEADER]: revealToken } },
})

export const openRequest = (chatPassword: string, revealToken: string): WireRequest => ({
  path: '/hidden/open',
  init: { method: 'POST', headers: { [REVEAL_HEADER]: revealToken }, body: json({ chat_password: chatPassword }) },
})

export const hideRequest = (conversationId: string): WireRequest => ({
  path: `/conversations/${enc(conversationId)}/hide`,
  init: { method: 'POST' },
})

export const unhideRequest = (conversationId: string, openToken: string): WireRequest => ({
  path: `/conversations/${enc(conversationId)}/unhide`,
  init: { method: 'POST', headers: { [OPEN_HEADER]: openToken } },
})

/** The socket subscribe frame for a hidden conversation: the open token rides in it. */
export function hiddenSubscribeFrame(conversationId: string, openToken: string) {
  return { type: 'conversation.subscribe', conversation_id: conversationId, open_token: openToken }
}

export function hiddenUnsubscribeFrame(conversationId: string) {
  return { type: 'conversation.unsubscribe', conversation_id: conversationId }
}

/**
 * The conversation a chat API path is about (`/conversations/<id>/...`), or
 * null. `/conversations/direct`, `/conversations/group` and the list are not
 * one conversation.
 */
export function conversationIdOfPath(path: string): string | null {
  const m = /^\/conversations\/([^/?#]+)/.exec(path)
  if (!m) return null
  let id: string
  try {
    id = decodeURIComponent(m[1])
  } catch {
    return null
  }
  if (id === 'direct' || id === 'group') return null
  return id
}

/**
 * The open token header for one chat API call: only on a call about a
 * conversation known to be hidden, and only while the token is held. Every
 * other call carries nothing, so the token never travels further than it
 * must.
 */
export function openHeaderFor(
  path: string,
  isLocked: (id: string) => boolean,
  openToken: string | null,
): Record<string, string> | null {
  if (!openToken) return null
  const id = conversationIdOfPath(path)
  if (!id || !isLocked(id)) return null
  return { [OPEN_HEADER]: openToken }
}

/* ---- Decoders --------------------------------------------------------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const dataOf = (body: unknown): unknown => (isObj(body) && 'data' in body ? body.data : body)

export interface HiddenSettings {
  configured: boolean
  strict: boolean
  shortcut: string | null
}

export function decodeHiddenSettings(body: unknown): HiddenSettings {
  const d = dataOf(body)
  const o = isObj(d) ? d : {}
  const shortcut = typeof o.shortcut === 'string' && o.shortcut.trim() ? o.shortcut.trim() : null
  return { configured: o.configured === true, strict: o.strict === true, shortcut }
}

export interface IssuedToken {
  token: string
  expiresAt: unknown
}

function decodeToken(body: unknown, field: 'reveal_token' | 'open_token'): IssuedToken | null {
  const d = dataOf(body)
  if (!isObj(d)) return null
  const token = typeof d[field] === 'string' ? (d[field] as string).trim() : ''
  return token ? { token, expiresAt: d.expires_at ?? null } : null
}

export const decodeRevealToken = (body: unknown) => decodeToken(body, 'reveal_token')
export const decodeOpenToken = (body: unknown) => decodeToken(body, 'open_token')

/* ---- Errors ----------------------------------------------------------- */

export type HiddenError =
  | { kind: 'not_found' }
  | { kind: 'wrong_password'; attemptsLeft: number | null }
  | { kind: 'locked'; retryAfterSec: number | null }
  | { kind: 'chat_locked' }
  | { kind: 'same_values' }
  | { kind: 'step_up_required' }
  | { kind: 'invalid'; message: string | null }
  | { kind: 'unavailable' }
  | { kind: 'unknown'; message: string | null }

interface ErrLike {
  status?: unknown
  code?: unknown
  body?: unknown
  message?: unknown
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

/** A field from wherever the server put it: details, the error object, or the top level. */
function errField(body: unknown, ...names: string[]): unknown {
  if (!isObj(body)) return undefined
  const err = isObj(body.error) ? body.error : null
  const details = err && isObj(err.details) ? err.details : null
  for (const src of [details, err, body]) {
    if (!src) continue
    for (const n of names) if (src[n] !== undefined && src[n] !== null) return src[n]
  }
  return undefined
}

/** Seconds until a lockout ends: retry_after (seconds or a timestamp) or locked_until. */
export function retryAfterSeconds(body: unknown, nowMs: number): number | null {
  const raw = errField(body, 'retry_after', 'retry_after_seconds', 'locked_until')
  const n = num(raw)
  if (n !== null) {
    // A big number is an epoch, not a duration.
    if (n > 1e12) return Math.max(0, Math.ceil((n - nowMs) / 1000))
    if (n > 1e9) return Math.max(0, Math.ceil(n - nowMs / 1000))
    return Math.max(0, Math.ceil(n))
  }
  if (typeof raw === 'string') {
    const t = Date.parse(raw)
    if (Number.isFinite(t)) return Math.max(0, Math.ceil((t - nowMs) / 1000))
  }
  return null
}

export function hiddenErrorOf(err: unknown, nowMs = Date.now()): HiddenError {
  const e = (isObj(err) || err instanceof Error ? err : {}) as ErrLike
  const status = typeof e.status === 'number' ? e.status : 0
  const code = typeof e.code === 'string' ? e.code.toUpperCase() : ''
  const body = e.body
  const serverMessage = (() => {
    const m = errField(body, 'message')
    return typeof m === 'string' && m.trim() ? m.trim() : null
  })()

  if (code === 'CHAT_LOCKED') return { kind: 'chat_locked' }
  if (code === 'LOCKED' || status === 429) return { kind: 'locked', retryAfterSec: retryAfterSeconds(body, nowMs) }
  if (code === 'WRONG_PASSWORD') {
    const left = num(errField(body, 'attempts_left', 'attempts_remaining'))
    return { kind: 'wrong_password', attemptsLeft: left === null ? null : Math.max(0, Math.floor(left)) }
  }
  if (code.includes('STEP_UP') || code === 'REAUTH_REQUIRED') return { kind: 'step_up_required' }
  if (/SAME|EQUAL|MUST_DIFFER/.test(code)) return { kind: 'same_values' }
  if (status === 404 || code === 'NOT_FOUND') return { kind: 'not_found' }
  if (status === 400 || status === 422) return { kind: 'invalid', message: serverMessage }
  if (status === 405 || status === 501 || status === 502 || status === 503 || status === 0) return { kind: 'unavailable' }
  return { kind: 'unknown', message: serverMessage }
}

/** "15 minutes", "1 hour", "24 hours", "40 seconds". */
export function waitWords(seconds: number): string {
  if (seconds < 60) return seconds <= 1 ? '1 second' : `${seconds} seconds`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return minutes === 1 ? '1 minute' : `${minutes} minutes`
  const hours = Math.ceil(minutes / 60)
  return hours === 1 ? '1 hour' : `${hours} hours`
}

export function lockedMessage(retryAfterSec: number | null): string {
  if (retryAfterSec === null || retryAfterSec <= 0) return 'Too many wrong tries. Try again later.'
  return `Too many wrong tries. Try again in ${waitWords(retryAfterSec)}.`
}

export function wrongPasswordMessage(attemptsLeft: number | null): string {
  if (attemptsLeft === null) return "That password isn't right."
  if (attemptsLeft === 0) return "That password isn't right. You're out of tries for now."
  return `That password isn't right. ${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} left.`
}

/** What a settings form shows for a failed save. */
export function settingsErrorMessage(e: HiddenError): string {
  switch (e.kind) {
    case 'wrong_password':
      return wrongPasswordMessage(e.attemptsLeft)
    case 'locked':
      return lockedMessage(e.retryAfterSec)
    case 'same_values':
      return 'Your chat password must be different from your secret key.'
    case 'step_up_required':
      return 'Confirm it’s you again, then try once more.'
    case 'invalid':
      return e.message ?? "Those don't meet the rules. Check them and try again."
    case 'unavailable':
    case 'not_found':
      return "Hidden chats aren't available right now. Try again later."
    default:
      return e.kind === 'unknown' && e.message ? e.message : "Couldn't save. Try again."
  }
}

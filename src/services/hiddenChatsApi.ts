/*
  Hidden chats calls (contract 24 Oct 2026) over the chat proxy. Builders,
  decoders and error mapping are in src/lib/chat/hiddenChats/requests.ts;
  tokens are kept by src/lib/chat/hiddenChats/tokenStore.ts, in memory only.

  Every secret-checking call runs with background=true: a 401 WRONG_PASSWORD
  is an answer about the chat password, not about the session, and must not
  close the chat socket the way a dead access token does.
*/

import { chatRequest, isHubOpen, sendSignaling } from '@/services/messageService'
import { ensureAccessToken } from '@/lib/accessToken'
import { decodeInboxPage, type InboxRow } from '@/lib/chat/contract'
import { hiddenChatTokens } from '@/lib/chat/hiddenChats/tokenStore'
import {
  decodeHiddenSettings,
  decodeOpenToken,
  decodeRevealToken,
  hiddenErrorOf,
  hiddenListRequest,
  hiddenSubscribeFrame,
  hiddenUnsubscribeFrame,
  hideRequest,
  openRequest,
  resetRequest,
  revealRequest,
  settingsRequest,
  unhideRequest,
  updateSettingsRequest,
  type HiddenError,
  type HiddenSettings,
  type SettingsPatch,
  type WireRequest,
} from '@/lib/chat/hiddenChats/requests'

const send = (r: WireRequest) => chatRequest(r.path, r.init as RequestInit, true)

/** The account's hidden-chats settings; null when the server has no such route yet. */
export async function fetchHiddenSettings(): Promise<HiddenSettings | null> {
  try {
    return decodeHiddenSettings(await send(settingsRequest()))
  } catch (err) {
    const e = hiddenErrorOf(err)
    if (e.kind === 'not_found' || e.kind === 'unavailable') return null
    throw err
  }
}

export async function saveHiddenSettings(patch: SettingsPatch): Promise<HiddenSettings | null> {
  const res = await send(updateSettingsRequest(patch))
  const d = res && typeof res === 'object' && 'data' in res ? (res as { data: unknown }).data : res
  return d && typeof d === 'object' && 'configured' in (d as object) ? decodeHiddenSettings(res) : null
}

export type RevealOutcome = { ok: true } | { ok: false; error: HiddenError }

/**
 * Try a secret key. A correct one stores the reveal token (memory) and
 * returns ok; a wrong one returns not_found — the same answer as "not set
 * up", by design.
 */
export async function revealHiddenChats(secretKey: string): Promise<RevealOutcome> {
  try {
    const issued = decodeRevealToken(await send(revealRequest(secretKey)))
    if (!issued) return { ok: false, error: { kind: 'not_found' } }
    hiddenChatTokens.setReveal(issued.token, issued.expiresAt)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: hiddenErrorOf(err) }
  }
}

/** The hidden list; null when the reveal token is missing or refused (it is then dropped). */
export async function fetchHiddenConversations(myId: string): Promise<InboxRow[] | null> {
  const token = hiddenChatTokens.reveal()
  if (!token) return null
  try {
    const page = decodeInboxPage(await send(hiddenListRequest(token)), myId)
    hiddenChatTokens.slide('reveal')
    hiddenChatTokens.markLocked(page.rows.map((r) => r.id))
    return page.rows
  } catch (err) {
    const e = hiddenErrorOf(err)
    if (e.kind === 'not_found') hiddenChatTokens.drop('server')
    throw err
  }
}

export type OpenOutcome = { ok: true } | { ok: false; error: HiddenError }

export async function openHiddenChats(chatPassword: string): Promise<OpenOutcome> {
  const token = hiddenChatTokens.reveal()
  if (!token) return { ok: false, error: { kind: 'not_found' } }
  try {
    const issued = decodeOpenToken(await send(openRequest(chatPassword, token)))
    if (!issued) return { ok: false, error: { kind: 'unknown', message: null } }
    hiddenChatTokens.slide('reveal')
    hiddenChatTokens.setOpen(issued.token, issued.expiresAt)
    return { ok: true }
  } catch (err) {
    const e = hiddenErrorOf(err)
    // The reveal token itself was refused: the list is locked again.
    if (e.kind === 'not_found') hiddenChatTokens.drop('server')
    return { ok: false, error: e }
  }
}

export async function hideConversation(conversationId: string): Promise<void> {
  await send(hideRequest(conversationId))
  hiddenChatTokens.markLocked([conversationId])
}

export async function unhideConversation(conversationId: string): Promise<void> {
  const token = hiddenChatTokens.open()
  if (!token) throw Object.assign(new Error('Enter your chat password first.'), { status: 403, code: 'CHAT_LOCKED' })
  await send(unhideRequest(conversationId, token))
  hiddenChatTokens.unmarkLocked(conversationId)
}

/**
 * Live messages of an open hidden chat: the open token rides in the
 * subscribe frame. Sent only on an open socket — never queued, so a token
 * dropped meanwhile is not sent later; the caller re-subscribes on reconnect.
 */
export function subscribeHiddenConversation(conversationId: string): boolean {
  const token = hiddenChatTokens.open()
  if (!token || !isHubOpen()) return false
  sendSignaling(hiddenSubscribeFrame(conversationId, token))
  return true
}

export function unsubscribeHiddenConversation(conversationId: string): void {
  sendSignaling(hiddenUnsubscribeFrame(conversationId))
}

/* ---- Reset after signing in again --------------------------------------- */

/** The server's own CSRF cookie echoed back, as lib/api.ts does; nothing when it set none. */
function csrfHeader(): Record<string, string> {
  if (typeof document === 'undefined') return {}
  const match = document.cookie.split('; ').find((c) => c.startsWith('csrf_token='))
  const value = match ? decodeURIComponent(match.slice('csrf_token='.length)) : ''
  return value ? { 'X-CSRF-Token': value } : {}
}

export type StepUpOutcome =
  | { ok: true; token: string }
  | { ok: false; reason: 'wrong_code' | 'replayed' | 'no_2fa' | 'rate_limited' | 'failed'; retryAfterSec?: number | null }

/**
 * The existing step-up (identity POST /v1/auth/step-up {otp}): re-verify the
 * authenticator code and get an access token carrying a fresh step_up_at,
 * valid 5 minutes. Plain fetch, not the axios client: its 401 handler would
 * refresh and REPLAY the same one-time code, which the server then refuses
 * as reused (and counts twice against the step-up limit).
 */
export async function stepUpWithCode(otp: string): Promise<StepUpOutcome> {
  const access = await ensureAccessToken()
  if (!access) return { ok: false, reason: 'failed' }
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '')
  let res: Response
  try {
    res = await fetch(`${base}/v1/auth/step-up`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Idempotency-Key': crypto.randomUUID(),
        ...csrfHeader(),
      },
      body: JSON.stringify({ otp: otp.trim() }),
    })
  } catch {
    return { ok: false, reason: 'failed' }
  }
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (res.ok) {
    const d = body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body
    const token = d && typeof d === 'object' ? (d as { access_token?: unknown }).access_token : null
    return typeof token === 'string' && token ? { ok: true, token } : { ok: false, reason: 'failed' }
  }
  const code = (() => {
    const e = body && typeof body === 'object' ? (body as { error?: { code?: unknown } }).error : null
    return typeof e?.code === 'string' ? e.code : ''
  })()
  if (res.status === 429) {
    const after = Number(res.headers.get('Retry-After'))
    return { ok: false, reason: 'rate_limited', retryAfterSec: Number.isFinite(after) && after > 0 ? after : null }
  }
  if (code === 'MFA_NOT_ENROLLED') return { ok: false, reason: 'no_2fa' }
  if (code === 'OTP_REPLAYED') return { ok: false, reason: 'replayed' }
  if (res.status === 401 || res.status === 400) return { ok: false, reason: 'wrong_code' }
  return { ok: false, reason: 'failed' }
}

/** New secrets after a step-up; strict mode wipes the hidden chats for me instead of keeping them. */
export async function resetHiddenChats(secretKey: string, chatPassword: string, stepUpToken: string): Promise<void> {
  await send(resetRequest(secretKey, chatPassword, stepUpToken))
  // Whatever was unlocked belonged to the old secrets.
  hiddenChatTokens.drop('lock')
}

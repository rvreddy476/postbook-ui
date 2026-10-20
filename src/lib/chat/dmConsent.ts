/*
  DM consent (founder-approved contract, 20 Oct 2026).

  Nobody lands in someone's Chats without consent; following someone IS
  consent to hear from them. The server decides (graph-service Resolve, the
  check / check-batch `message` action) and message-service enforces; this
  file is the web's pure reading of those answers:

    - which of the three outcomes a decision is (allow, message request,
      deny) and, for a deny, which of the six reasons;
    - what the profile Message control shows for it;
    - the one-message rule while my request is waiting (text only, at most
      500 characters, no links), checked here as well as on the server;
    - plain words for the errors the server returns on create and send.

  Everything degrades: a graph-service that does not send the new reasons
  yet is read through its older ones, and an unknown reason still disables
  the control (a new rule on the server must never become an enabled button
  here by default).
*/

/* ------------------------------------------------------------------ */
/*  Decision                                                           */
/* ------------------------------------------------------------------ */

export type DmDecision = 'allow' | 'message_request' | 'deny'

/** The six deny reasons of the contract (§4). */
export type DmDenyReason = 'unavailable' | 'messages_off' | 'you_paused' | 'no_one' | 'followers_only' | 'people_i_follow'

export const DM_DENY_REASONS: readonly DmDenyReason[] = [
  'unavailable',
  'messages_off',
  'you_paused',
  'no_one',
  'followers_only',
  'people_i_follow',
]

/**
 * The reasons graph-service sent before the contract, read as the new ones.
 * `blocked` is reported as `unavailable` (a block is never revealed);
 * `privacy_disallows` was the followers / friends-of-friends refusal, and
 * friends-of-friends now maps to followers; the connection reasons are the
 * old name of "only people they follow".
 */
const LEGACY_DENY_REASONS: Readonly<Record<string, DmDenyReason>> = {
  blocked: 'unavailable',
  chat_paused: 'messages_off',
  privacy_no_one: 'no_one',
  privacy_disallows: 'followers_only',
  privacy_connections_only: 'people_i_follow',
  not_connected: 'people_i_follow',
}

/** A reason string (new or legacy) as one of the six, or null when unknown. */
export function normaliseDenyReason(reason: unknown): DmDenyReason | null {
  if (typeof reason !== 'string' || !reason) return null
  if ((DM_DENY_REASONS as readonly string[]).includes(reason)) return reason as DmDenyReason
  return LEGACY_DENY_REASONS[reason] ?? null
}

/**
 * One action's answer from check / check-batch. graph-service leaves empty
 * fields out:
 *   allow    {allowed: true}
 *   request  {allowed: false, fallback: "message_request"}
 *   deny     {allowed: false, reason: <one of the six>}
 */
export interface DecisionLike {
  allowed?: boolean
  fallback?: string
  reason?: string
}

export interface ReadDecision {
  decision: DmDecision
  /** Only for a deny; null when the server gave no reason this client knows. */
  reason: DmDenyReason | null
}

/** The outcome of a `message` decision. Null while it is loading. */
export function readDecision(d: DecisionLike | null | undefined): ReadDecision | null {
  if (!d || typeof d !== 'object') return null
  const decision: DmDecision = d.allowed === true ? 'allow' : d.fallback === 'message_request' ? 'message_request' : 'deny'
  return { decision, reason: decision === 'deny' ? normaliseDenyReason(d.reason) : null }
}

/* ------------------------------------------------------------------ */
/*  Words                                                              */
/* ------------------------------------------------------------------ */

/** "@asha" when the handle is known, else the name, else "This person". */
export function who(handle?: string | null, name?: string | null): string {
  const h = (handle ?? '').trim().replace(/^@/, '')
  if (h) return `@${h}`
  const n = (name ?? '').trim()
  return n || 'This person'
}

/** Why I can't message someone, in words. Null for `unavailable`: the control is hidden. */
export function denyReasonText(reason: DmDenyReason | null, target: string): string | null {
  switch (reason) {
    case 'unavailable':
      return null
    case 'messages_off':
      return `${target} isn't taking messages`
    case 'no_one':
      return `${target} doesn't accept messages`
    case 'followers_only':
      return `Follow ${target} to send a request`
    case 'people_i_follow':
      return `${target} only accepts messages from people they follow`
    case 'you_paused':
      return 'Turn your messages on to send'
    default:
      return `${target} can't be messaged right now`
  }
}

/* ------------------------------------------------------------------ */
/*  Profile Message control                                            */
/* ------------------------------------------------------------------ */

export type MessageButtonView =
  | { kind: 'loading'; label: string }
  | { kind: 'hidden' }
  | { kind: 'message'; label: string }
  | { kind: 'request'; label: string }
  | { kind: 'requested'; label: string }
  | { kind: 'disabled'; label: string; note: string }

/**
 * What the Message control on a profile shows (contract §4):
 *   allow            → "Message"
 *   message_request  → "Send request", or "Requested" when mine is waiting
 *   deny             → disabled "Message" with the reason in words
 *   unavailable      → no control at all
 */
export function messageButtonView(
  d: DecisionLike | null | undefined,
  opts: { target: string; pendingOutgoing?: boolean },
): MessageButtonView {
  const read = readDecision(d)
  if (!read) return { kind: 'loading', label: 'Message' }
  if (read.decision === 'allow') return { kind: 'message', label: 'Message' }
  if (read.decision === 'message_request') {
    return opts.pendingOutgoing
      ? { kind: 'requested', label: 'Requested' }
      : { kind: 'request', label: 'Send request' }
  }
  if (read.reason === 'unavailable') return { kind: 'hidden' }
  return { kind: 'disabled', label: 'Message', note: denyReasonText(read.reason, opts.target) ?? '' }
}

/* ------------------------------------------------------------------ */
/*  The conversation a create returned                                 */
/* ------------------------------------------------------------------ */

export interface CreatedConversation {
  id: string | null
  /** True only when the server said so; a missing flag is a normal chat. */
  isRequest: boolean
  createdBy: string | null
}

/** Read POST /conversations/direct's body (`{data: Conversation}` or the conversation). */
export function readCreatedConversation(body: unknown): CreatedConversation {
  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const c = o.data && typeof o.data === 'object' ? (o.data as Record<string, unknown>) : o
  const id = typeof c.id === 'string' && c.id ? c.id : typeof c.conversation_id === 'string' && c.conversation_id ? c.conversation_id : null
  return {
    id,
    isRequest: c.is_request === true,
    createdBy: typeof c.created_by === 'string' && c.created_by ? c.created_by : null,
  }
}

/** Where a tap on Message / Send request / Requested lands. */
export function threadHref(conversationId: string): string {
  return `/messenger?conversation=${encodeURIComponent(conversationId)}`
}

/* ------------------------------------------------------------------ */
/*  The one message before acceptance                                  */
/* ------------------------------------------------------------------ */

export const REQUEST_MESSAGE_MAX = 500

// message-service's bareDomainRe, character for character (Go's \b is ASCII, as here).
const BARE_DOMAIN = /\b[a-z0-9][a-z0-9-]*\.(com|net|org|io|co|in|me|app|dev|xyz|info|link|to|ly|gg|sh)\b/i

/** message-service's containsLink: a scheme, "www." or a bare domain. */
export function containsLink(text: string): boolean {
  const lower = text.toLowerCase()
  if (lower.includes('http://') || lower.includes('https://') || lower.includes('www.')) return true
  return BARE_DOMAIN.test(text)
}

export type RequestComposerProblem = 'already_sent' | 'empty' | 'too_long' | 'link'

/**
 * Whether the requester may send `text` now. Characters are counted as the
 * server counts them (code points, not UTF-16 units). `alreadySent` is true
 * once one message of mine is in the thread.
 */
export function requestComposerGuard(text: string, alreadySent: boolean): { ok: true } | { ok: false; problem: RequestComposerProblem } {
  if (alreadySent) return { ok: false, problem: 'already_sent' }
  if (!text.trim()) return { ok: false, problem: 'empty' }
  if (Array.from(text).length > REQUEST_MESSAGE_MAX) return { ok: false, problem: 'too_long' }
  if (containsLink(text)) return { ok: false, problem: 'link' }
  return { ok: true }
}

export function requestComposerProblemText(problem: RequestComposerProblem, target: string): string {
  switch (problem) {
    case 'already_sent':
      return `Your message is on its way. You can send more once ${target} accepts.`
    case 'too_long':
      return `A request can be up to ${REQUEST_MESSAGE_MAX} characters.`
    case 'link':
      return `Links can't be sent until ${target} accepts.`
    case 'empty':
      return 'Write a message to send with your request.'
  }
}

/** Characters left, counted as the server counts them. */
export function requestCharsLeft(text: string): number {
  return REQUEST_MESSAGE_MAX - Array.from(text).length
}

export function requestWaitingBanner(target: string): string {
  return `Your request is waiting. You can send one message (text only, no links) until ${target} accepts.`
}

/** Mine and still waiting: a request thread I created. */
export function isOutgoingPendingRequest(conv: { isRequest: boolean; createdBy: string | null }, myId: string): boolean {
  return conv.isRequest && !!myId && conv.createdBy === myId
}

/* ------------------------------------------------------------------ */
/*  Server errors                                                      */
/* ------------------------------------------------------------------ */

/*
  The 7-day re-request cooldown (after the recipient deletes a request) is
  silent by design: POST /conversations/direct returns the existing pending
  request conversation, so the sender is never told. There is no cooldown
  error to word; "Send request" simply opens the old waiting thread, where
  AWAITING_REQUEST_ACCEPTANCE covers a second message.

  A refused create is 403 {"error": {"code": "MESSAGING_NOT_ALLOWED",
  "message", "reason", "details": {"reason"}}}; 503 RETRY_LATER and 429
  RATE_LIMITED are the other refusals.
*/

export const RETRY_LATER_TEXT = 'Try again in a moment'

interface ErrorShape {
  status?: unknown
  code?: unknown
  message?: unknown
  details?: unknown
  body?: unknown
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/**
 * The deny reason a refused call carries: `error.reason` or
 * `error.details.reason` in the body (ChatApiError keeps the body), or the
 * error's own `details`.
 */
export function errorReason(err: unknown): DmDenyReason | null {
  const e = obj(err) as ErrorShape | null
  if (!e) return null
  const candidates: unknown[] = []
  const details = obj(e.details)
  if (details) candidates.push(details.reason)
  const body = obj(e.body)
  if (body) {
    const env = obj(body.error)
    candidates.push(env?.reason, obj(env?.details)?.reason)
  }
  for (const c of candidates) {
    const r = normaliseDenyReason(c)
    if (r) return r
  }
  return null
}

function errCode(err: unknown): string {
  const c = (obj(err) as ErrorShape | null)?.code
  return typeof c === 'string' ? c : ''
}

function errMessage(err: unknown): string {
  const m = (obj(err) as ErrorShape | null)?.message
  return typeof m === 'string' ? m : ''
}

/** A refusal this file has words for (the DM consent codes). */
export function isConsentRefusal(err: unknown): boolean {
  const code = errCode(err)
  return code === 'MESSAGING_NOT_ALLOWED' || code === 'RATE_LIMITED' || code === 'RETRY_LATER'
}

/** Words for a refused POST /conversations/direct. */
export function createConversationErrorText(err: unknown, target: string): string {
  const code = errCode(err)
  if (code === 'RETRY_LATER') return RETRY_LATER_TEXT
  if (code === 'RATE_LIMITED') return "You've sent a lot of requests today. Try again tomorrow."
  if (code === 'MESSAGING_NOT_ALLOWED') {
    const reason = errorReason(err)
    if (reason === 'unavailable') return `You can't message ${target}.`
    return denyReasonText(reason, target) ?? `You can't message ${target}.`
  }
  return 'Something went wrong. Please try again.'
}

/** Words for a refused send in a request thread. */
export function requestSendErrorText(err: unknown, target: string): string | null {
  const code = errCode(err)
  if (code === 'AWAITING_REQUEST_ACCEPTANCE') return requestComposerProblemText('already_sent', target)
  if (code === 'INVALID_REQUEST_MESSAGE') {
    const m = errMessage(err).toLowerCase()
    if (m.includes('link')) return requestComposerProblemText('link', target)
    if (m.includes('500')) return requestComposerProblemText('too_long', target)
    return 'Only a text message can go with a request.'
  }
  if (code === 'RETRY_LATER') return RETRY_LATER_TEXT
  if (code === 'RATE_LIMITED') return "You're sending too fast. Wait a moment and try again."
  if (code === 'MESSAGING_NOT_ALLOWED') return createConversationErrorText(err, target)
  return null
}

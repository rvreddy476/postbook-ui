/*
  Share a post to up to five chats in one Send (CONTRACT §9 "Share sheet:
  avatar row multi-select (≤5) incl. groups, optional note, one Send").

  Each target is sent on its own — the server judges every chat separately
  (permissions, request rules), so a share can partly succeed. The optional
  note goes with the post as its text caption, to every target. A person
  without a chat yet has it opened only now, on Send, exactly as the New
  message sheet does.

  Forwarding a message (ForwardSheet) uses the same target resolution, then
  the server's forward route (§2.4) for all chats at once.
*/

import { forwardTargets, outcomeFromError } from '@/lib/chat/forward'
import type { ForwardResult } from '@/lib/chat/contract'
import { getOrCreateDirectConversation, sendPostMessage } from '@/services/messageService'
import type { ChatTarget } from './chatTargets'
import { conversationIdOf, sendPostErrorText } from './sendPost'

export interface ShareDeps {
  openDirect: (userId: string) => Promise<unknown>
  send: (conversationId: string, postId: string, caption?: string) => Promise<unknown>
}

const defaultDeps: ShareDeps = {
  openDirect: getOrCreateDirectConversation,
  send: sendPostMessage,
}

export interface ResolvedTarget {
  target: ChatTarget
  conversationId: string
}

export interface UnresolvedTarget {
  target: ChatTarget
  error: unknown
}

/**
 * Conversation ids for the picked targets, in pick order. A person target
 * gets its DM opened (or found); one that cannot be opened is returned as
 * unresolved with the reason, never dropped silently.
 */
export async function resolveTargets(
  targets: readonly ChatTarget[],
  openDirect: ShareDeps['openDirect'] = defaultDeps.openDirect,
): Promise<{ resolved: ResolvedTarget[]; unresolved: UnresolvedTarget[] }> {
  const resolved: ResolvedTarget[] = []
  const unresolved: UnresolvedTarget[] = []
  for (const target of targets) {
    if (target.kind === 'conversation' && target.conversationId) {
      resolved.push({ target, conversationId: target.conversationId })
      continue
    }
    if (!target.userId) {
      unresolved.push({ target, error: new Error('no recipient') })
      continue
    }
    try {
      const id = conversationIdOf(await openDirect(target.userId))
      if (!id) throw new Error('no conversation id')
      resolved.push({ target, conversationId: id })
    } catch (error) {
      unresolved.push({ target, error })
    }
  }
  return { resolved, unresolved }
}

/** The line for one failed target: a group refusal is about the group, not a person. */
export function shareErrorText(err: unknown, target: Pick<ChatTarget, 'name' | 'isGroup'>): string {
  if (!target.isGroup) return sendPostErrorText(err, target.name)
  const e = (err ?? {}) as { code?: unknown; status?: unknown }
  const status = typeof e.status === 'number' ? e.status : 0
  const code = typeof e.code === 'string' ? e.code : ''
  if (status === 403 || code === 'MESSAGING_NOT_ALLOWED' || code === 'NOT_A_MEMBER') return "You can't send messages in this group."
  if (status === 429 || code === 'RATE_LIMITED') return "You're sending too fast. Wait a moment and try again."
  return "Couldn't send the post. Try again."
}

export interface ShareOutcome {
  target: ChatTarget
  ok: boolean
  conversationId: string | null
  /** Plain words for a failure; null when sent. */
  error: string | null
}

/**
 * Open what needs opening, then send the post (with the note as its caption)
 * to each chat, one after another. Two targets that resolve to the same chat
 * get one copy. `onProgress` is told after each chat.
 */
export async function shareToChats(
  targets: readonly ChatTarget[],
  postId: string,
  note: string | undefined,
  deps: ShareDeps = defaultDeps,
  onProgress?: (done: number, total: number) => void,
): Promise<ShareOutcome[]> {
  const caption = note?.trim() || undefined
  const { resolved, unresolved } = await resolveTargets(targets, deps.openDirect)
  const byKey = new Map<string, ShareOutcome>()
  for (const u of unresolved) {
    byKey.set(u.target.key, { target: u.target, ok: false, conversationId: null, error: shareErrorText(u.error, u.target) })
  }
  const sentTo = new Map<string, ShareOutcome>()
  let done = unresolved.length
  for (const { target, conversationId } of resolved) {
    const earlier = sentTo.get(conversationId)
    if (earlier) {
      byKey.set(target.key, { ...earlier, target })
      done += 1
      onProgress?.(done, targets.length)
      continue
    }
    let outcome: ShareOutcome
    try {
      await deps.send(conversationId, postId, caption)
      outcome = { target, ok: true, conversationId, error: null }
    } catch (err) {
      outcome = { target, ok: false, conversationId, error: shareErrorText(err, target) }
    }
    sentTo.set(conversationId, outcome)
    byKey.set(target.key, outcome)
    done += 1
    onProgress?.(done, targets.length)
  }
  return targets.map((t) => byKey.get(t.key)).filter((o): o is ShareOutcome => Boolean(o))
}

export interface ShareSummary {
  sent: number
  failed: number
  /** "Sent to Asha", "Sent to 3 chats", "Sent to 2 of 3 · Couldn't send to Ravi: <reason>". */
  text: string
  /** What follows "Sent to " on the share surfaces: "Asha", "3 chats". */
  label: string
}

/** How the share went, in one line. */
export function shareSummary(outcomes: readonly ShareOutcome[]): ShareSummary {
  const sent = outcomes.filter((o) => o.ok)
  const failed = outcomes.filter((o) => !o.ok)
  if (outcomes.length === 0) return { sent: 0, failed: 0, text: 'Nothing to send.', label: '' }
  const label = sent.length === 1 ? sent[0].target.name : `${sent.length} chats`
  if (failed.length === 0) return { sent: sent.length, failed: 0, text: `Sent to ${label}`, label }
  // One failure carries its reason; several list the names (each reason is shown per row).
  const notSent =
    failed.length === 1
      ? `Couldn't send to ${failed[0].target.name}: ${failed[0].error ?? "Couldn't send the post. Try again."}`
      : `Couldn't send to ${failed.map((o) => o.target.name).join(', ')}`
  if (sent.length === 0) return { sent: 0, failed: failed.length, text: notSent, label: '' }
  return { sent: sent.length, failed: failed.length, text: `Sent to ${sent.length} of ${outcomes.length} · ${notSent}`, label }
}

/** A fresh idempotency key; randomUUID needs a secure context, so plain-http LAN dev gets a random fallback. */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `fwd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export type ForwardFn = (
  conversationId: string,
  message: { id: string; text?: string; type?: string },
  targetIds: readonly string[],
  idempotencyKey: string,
) => Promise<ForwardResult[]>

export interface ForwardRun {
  results: ForwardResult[]
  /** Name for a result's conversationId (unresolved people are keyed by their target key). */
  nameOf: (conversationId: string) => string
  /** The targets that did not get the message, to keep picked for a retry. */
  failedTargets: ChatTarget[]
}

/**
 * Forward one message to the picked targets (§2.4): open DMs for people
 * first, forward once to every resolved chat, and count a person whose chat
 * could not be opened as not sent.
 */
export async function forwardToTargets(
  sourceConversationId: string,
  message: { id: string; text?: string; type?: string },
  targets: readonly ChatTarget[],
  idempotencyKey: string,
  deps: { openDirect?: ShareDeps['openDirect']; forward: ForwardFn },
): Promise<ForwardRun> {
  const { resolved, unresolved } = await resolveTargets(targets, deps.openDirect ?? defaultDeps.openDirect)
  const names = new Map<string, string>()
  const targetOf = new Map<string, ChatTarget>()
  for (const r of resolved) {
    if (!names.has(r.conversationId)) names.set(r.conversationId, r.target.name)
    targetOf.set(r.conversationId, r.target)
  }
  const ids = forwardTargets(resolved.map((r) => r.conversationId))
  const results: ForwardResult[] = ids.length > 0 ? await deps.forward(sourceConversationId, message, ids, idempotencyKey) : []
  for (const u of unresolved) {
    names.set(u.target.key, u.target.name)
    targetOf.set(u.target.key, u.target)
    results.push({ conversationId: u.target.key, outcome: outcomeFromError(u.error), messageId: null })
  }
  const failedTargets = results
    .filter((r) => r.outcome !== 'sent')
    .map((r) => targetOf.get(r.conversationId))
    .filter((t): t is ChatTarget => Boolean(t))
  return { results, nameOf: (id) => names.get(id) ?? 'this chat', failedTargets }
}

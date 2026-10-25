/*
  Forward a message to up to five chats (CONTRACT §2.4), and the line that
  says how it went. Each target is judged by the server on its own
  (permissions, request rules), so a forward can partly succeed.
*/

import { FORWARD_MAX_TARGETS, type ForwardOutcome, type ForwardResult } from './contract'

/** Distinct ids, at most five, in the order they were picked. */
export function forwardTargets(ids: readonly string[]): string[] {
  const out: string[] = []
  for (const id of ids) {
    if (!id || out.includes(id)) continue
    out.push(id)
    if (out.length === FORWARD_MAX_TARGETS) break
  }
  return out
}

/** What a failed per-target fallback send counts as. */
export function outcomeFromError(err: unknown): ForwardOutcome {
  const e = (err ?? {}) as { status?: unknown; code?: unknown }
  const status = typeof e.status === 'number' ? e.status : 0
  const code = typeof e.code === 'string' ? e.code : ''
  if (status === 403 || code === 'MESSAGING_NOT_ALLOWED' || code === 'BLOCKED') return 'blocked'
  return 'unavailable'
}

export interface ForwardSummary {
  sent: number
  failed: number
  text: string
}

/** "Sent to Asha", "Sent to 3 chats", "Sent to 2 of 3 · Not sent to Ravi". */
export function forwardSummary(results: readonly ForwardResult[], nameOf: (conversationId: string) => string): ForwardSummary {
  const sent = results.filter((r) => r.outcome === 'sent')
  const failed = results.filter((r) => r.outcome !== 'sent')
  if (results.length === 0) return { sent: 0, failed: 0, text: 'Nothing to send.' }
  if (failed.length === 0) {
    return { sent: sent.length, failed: 0, text: sent.length === 1 ? `Sent to ${nameOf(sent[0].conversationId)}` : `Sent to ${sent.length} chats` }
  }
  const names = failed.map((r) => nameOf(r.conversationId)).join(', ')
  if (sent.length === 0) {
    const blocked = failed.every((r) => r.outcome === 'blocked')
    return { sent: 0, failed: failed.length, text: blocked ? `Couldn't send to ${names}. They aren't accepting messages from you.` : `Couldn't send to ${names}.` }
  }
  return { sent: sent.length, failed: failed.length, text: `Sent to ${sent.length} of ${results.length} · Not sent to ${names}` }
}

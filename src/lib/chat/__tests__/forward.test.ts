import { describe, expect, test } from 'bun:test'

import { FORWARD_MAX_TARGETS, type ForwardResult } from '../contract'
import { forwardSummary, forwardTargets, outcomeFromError } from '../forward'

const r = (conversationId: string, outcome: ForwardResult['outcome']): ForwardResult => ({ conversationId, outcome, messageId: outcome === 'sent' ? `m-${conversationId}` : null })
const names: Record<string, string> = { a: 'Asha', b: 'Ravi', c: 'Meena', d: 'Weekend Riders' }
const nameOf = (id: string) => names[id] ?? id

describe('forwardTargets', () => {
  test('keeps pick order and drops repeats and empty ids', () => {
    expect(forwardTargets(['a', 'b', 'a', '', 'c', 'b'])).toEqual(['a', 'b', 'c'])
  })

  test('never more than five chats', () => {
    expect(FORWARD_MAX_TARGETS).toBe(5)
    expect(forwardTargets(['1', '2', '3', '4', '5', '6', '7'])).toEqual(['1', '2', '3', '4', '5'])
  })

  test('repeats do not use up the five', () => {
    expect(forwardTargets(['1', '1', '2', '2', '3', '4', '5', '6'])).toEqual(['1', '2', '3', '4', '5'])
  })

  test('nothing picked is nothing to send', () => {
    expect(forwardTargets([])).toEqual([])
  })
})

describe('outcomeFromError', () => {
  test('a refusal counts as blocked', () => {
    expect(outcomeFromError({ status: 403 })).toBe('blocked')
    expect(outcomeFromError({ code: 'MESSAGING_NOT_ALLOWED' })).toBe('blocked')
    expect(outcomeFromError({ code: 'BLOCKED', status: 409 })).toBe('blocked')
  })

  test('anything else is unavailable', () => {
    expect(outcomeFromError({ status: 500 })).toBe('unavailable')
    expect(outcomeFromError(new Error('network'))).toBe('unavailable')
    expect(outcomeFromError(null)).toBe('unavailable')
    expect(outcomeFromError({ status: '403' })).toBe('unavailable')
  })
})

describe('forwardSummary', () => {
  test('nothing at all', () => {
    expect(forwardSummary([], nameOf)).toEqual({ sent: 0, failed: 0, text: 'Nothing to send.' })
  })

  test('one chat, sent: its name', () => {
    expect(forwardSummary([r('a', 'sent')], nameOf)).toEqual({ sent: 1, failed: 0, text: 'Sent to Asha' })
  })

  test('several chats, all sent: the count', () => {
    expect(forwardSummary([r('a', 'sent'), r('b', 'sent'), r('d', 'sent')], nameOf).text).toBe('Sent to 3 chats')
  })

  test('partly sent: how many of how many, and who missed out', () => {
    const s = forwardSummary([r('a', 'sent'), r('b', 'blocked'), r('c', 'sent')], nameOf)
    expect(s).toEqual({ sent: 2, failed: 1, text: 'Sent to 2 of 3 · Not sent to Ravi' })
  })

  test('none sent, every one refused: says they are not accepting messages', () => {
    expect(forwardSummary([r('b', 'blocked'), r('c', 'blocked')], nameOf).text).toBe(
      "Couldn't send to Ravi, Meena. They aren't accepting messages from you.",
    )
  })

  test('none sent, for other reasons: just who', () => {
    expect(forwardSummary([r('b', 'blocked'), r('c', 'unavailable')], nameOf)).toEqual({ sent: 0, failed: 2, text: "Couldn't send to Ravi, Meena." })
  })
})

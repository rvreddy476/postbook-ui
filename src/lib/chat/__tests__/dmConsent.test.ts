import { describe, expect, test } from 'bun:test'

import { ChatApiError } from '@/services/messageService'
import {
  containsLink,
  createConversationErrorText,
  denyReasonText,
  errorReason,
  isConsentRefusal,
  isOutgoingPendingRequest,
  messageButtonView,
  normaliseDenyReason,
  readCreatedConversation,
  readDecision,
  RETRY_LATER_TEXT,
  requestCharsLeft,
  requestComposerGuard,
  requestComposerProblemText,
  requestSendErrorText,
  requestWaitingBanner,
  threadHref,
  who,
} from '../dmConsent'

const target = '@asha'

describe('decision (graph-service check-batch `message`)', () => {
  test('the three shapes graph-service sends', () => {
    expect(readDecision({ allowed: true })).toEqual({ decision: 'allow', reason: null })
    expect(readDecision({ allowed: false, fallback: 'message_request' })).toEqual({ decision: 'message_request', reason: null })
    expect(readDecision({ allowed: false, reason: 'people_i_follow' })).toEqual({ decision: 'deny', reason: 'people_i_follow' })
  })

  test('loading is null, not a guess', () => {
    expect(readDecision(undefined)).toBeNull()
    expect(readDecision(null)).toBeNull()
  })

  test('older reason names read as the new ones; a block is unavailable', () => {
    expect(normaliseDenyReason('blocked')).toBe('unavailable')
    expect(normaliseDenyReason('chat_paused')).toBe('messages_off')
    expect(normaliseDenyReason('privacy_no_one')).toBe('no_one')
    expect(normaliseDenyReason('privacy_disallows')).toBe('followers_only')
    expect(normaliseDenyReason('privacy_connections_only')).toBe('people_i_follow')
    for (const r of ['unavailable', 'messages_off', 'you_paused', 'no_one', 'followers_only', 'people_i_follow']) {
      expect(normaliseDenyReason(r)).toBe(r as never)
    }
    expect(normaliseDenyReason('some_future_rule')).toBeNull()
    expect(normaliseDenyReason(undefined)).toBeNull()
  })

  test('a fallback that is not a message request is a deny', () => {
    expect(readDecision({ allowed: false, fallback: 'follow_request' })?.decision).toBe('deny')
  })
})

describe('profile Message control (contract §4)', () => {
  test('allow → Message', () => {
    expect(messageButtonView({ allowed: true }, { target })).toEqual({ kind: 'message', label: 'Message' })
  })

  test('message_request → Send request, or Requested when mine is waiting', () => {
    const d = { allowed: false, fallback: 'message_request' }
    expect(messageButtonView(d, { target })).toEqual({ kind: 'request', label: 'Send request' })
    expect(messageButtonView(d, { target, pendingOutgoing: true })).toEqual({ kind: 'requested', label: 'Requested' })
  })

  test('a waiting request does not change an allowed chat', () => {
    expect(messageButtonView({ allowed: true }, { target, pendingOutgoing: true }).kind).toBe('message')
  })

  test('deny → disabled Message with the reason in words', () => {
    const note = (reason: string) => {
      const v = messageButtonView({ allowed: false, reason }, { target })
      return v.kind === 'disabled' ? v.note : `not disabled: ${v.kind}`
    }
    expect(note('messages_off')).toBe("@asha isn't taking messages")
    expect(note('no_one')).toBe("@asha doesn't accept messages")
    expect(note('followers_only')).toBe('Follow @asha to send a request')
    expect(note('people_i_follow')).toBe('@asha only accepts messages from people they follow')
    expect(note('you_paused')).toBe('Turn your messages on to send')
    // unknown → still disabled (fails closed), with neutral words
    expect(note('some_future_rule')).toBe("@asha can't be messaged right now")
    expect(note('')).toBe("@asha can't be messaged right now")
  })

  test('unavailable (and an old "blocked") hides the control', () => {
    expect(messageButtonView({ allowed: false, reason: 'unavailable' }, { target })).toEqual({ kind: 'hidden' })
    expect(messageButtonView({ allowed: false, reason: 'blocked' }, { target })).toEqual({ kind: 'hidden' })
    expect(denyReasonText('unavailable', target)).toBeNull()
  })

  test('loading shows a neutral control', () => {
    expect(messageButtonView(undefined, { target }).kind).toBe('loading')
  })

  test('who: @handle, else the name, else a neutral word', () => {
    expect(who('asha')).toBe('@asha')
    expect(who('@asha')).toBe('@asha')
    expect(who('', 'Asha Rao')).toBe('Asha Rao')
    expect(who(null, null)).toBe('This person')
  })
})

describe('the conversation a create returned', () => {
  test('is_request true only when the server said so (a missing flag is a normal chat)', () => {
    expect(readCreatedConversation({ data: { id: 'c1', is_request: true, created_by: 'me' } })).toEqual({ id: 'c1', isRequest: true, createdBy: 'me' })
    expect(readCreatedConversation({ data: { id: 'c1' } })).toEqual({ id: 'c1', isRequest: false, createdBy: null })
    expect(readCreatedConversation({ id: 'c2', is_request: false })).toMatchObject({ id: 'c2', isRequest: false })
    expect(readCreatedConversation({ conversation_id: 'c3' }).id).toBe('c3')
    expect(readCreatedConversation(null).id).toBeNull()
  })

  test('outgoing pending = a request I created', () => {
    expect(isOutgoingPendingRequest({ isRequest: true, createdBy: 'me' }, 'me')).toBe(true)
    expect(isOutgoingPendingRequest({ isRequest: true, createdBy: 'them' }, 'me')).toBe(false)
    expect(isOutgoingPendingRequest({ isRequest: false, createdBy: 'me' }, 'me')).toBe(false)
    expect(isOutgoingPendingRequest({ isRequest: true, createdBy: null }, '')).toBe(false)
  })

  test('a tap opens the thread by id', () => {
    expect(threadHref('c 1')).toBe('/messenger?conversation=c%201')
  })
})

describe('request composer guard (one text message, ≤500, no links)', () => {
  test('a plain message passes', () => {
    expect(requestComposerGuard('Hi! Loved your reel.', false)).toEqual({ ok: true })
  })

  test('only one message before acceptance', () => {
    expect(requestComposerGuard('hello again', true)).toEqual({ ok: false, problem: 'already_sent' })
  })

  test('empty, too long, links', () => {
    expect(requestComposerGuard('   ', false)).toEqual({ ok: false, problem: 'empty' })
    expect(requestComposerGuard('a'.repeat(500), false)).toEqual({ ok: true })
    expect(requestComposerGuard('a'.repeat(501), false)).toEqual({ ok: false, problem: 'too_long' })
    expect(requestComposerGuard('see https://x.example', false)).toEqual({ ok: false, problem: 'link' })
  })

  test('length counts characters as the server does (code points)', () => {
    const emoji = '😀'.repeat(500)
    expect(emoji.length).toBe(1000)
    expect(requestComposerGuard(emoji, false)).toEqual({ ok: true })
    expect(requestCharsLeft(emoji)).toBe(0)
    expect(requestCharsLeft('ab')).toBe(498)
  })

  test('containsLink mirrors message-service', () => {
    for (const t of ['http://a', 'HTTPS://b', 'go to www.site', 'shop.com today', 'my.app', 'x.io', 'Visit EXAMPLE.ORG']) {
      expect([t, containsLink(t)]).toEqual([t, true])
    }
    for (const t of ['hello there', 'v1.2 is out', 'e.g. this', 'a.b', 'comet.']) {
      expect([t, containsLink(t)]).toEqual([t, false])
    }
  })

  test('words', () => {
    expect(requestWaitingBanner('@asha')).toBe(
      'Your request is waiting. You can send one message (text only, no links) until @asha accepts.',
    )
    expect(requestComposerProblemText('link', '@asha')).toBe("Links can't be sent until @asha accepts.")
    expect(requestComposerProblemText('too_long', '@asha')).toBe('A request can be up to 500 characters.')
  })
})

describe('server errors in words', () => {
  test("the deny reason is read from the server's 403 body", () => {
    // The final shape: reason both on the envelope and in details.
    const body = { error: { code: 'MESSAGING_NOT_ALLOWED', message: 'messaging this user is not permitted', reason: 'followers_only', details: { reason: 'followers_only' } } }
    expect(errorReason(new ChatApiError('x', 403, 'MESSAGING_NOT_ALLOWED', body))).toBe('followers_only')
    expect(errorReason(new ChatApiError('x', 403, 'MESSAGING_NOT_ALLOWED', { error: { details: { reason: 'no_one' } } }))).toBe('no_one')
    expect(errorReason(new ChatApiError('x', 403, 'MESSAGING_NOT_ALLOWED', { error: { reason: 'people_i_follow' } }))).toBe('people_i_follow')
    expect(errorReason({ details: { reason: 'messages_off' } })).toBe('messages_off')
    expect(errorReason(new ChatApiError('x', 403, 'MESSAGING_NOT_ALLOWED'))).toBeNull()
  })

  test('create refused: the reason text; a block is never named', () => {
    const refused = (reason?: string) =>
      new ChatApiError('messaging this user is not permitted', 403, 'MESSAGING_NOT_ALLOWED', reason ? { error: { details: { reason } } } : {})
    expect(createConversationErrorText(refused('followers_only'), target)).toBe('Follow @asha to send a request')
    expect(createConversationErrorText(refused('you_paused'), target)).toBe('Turn your messages on to send')
    expect(createConversationErrorText(refused('unavailable'), target)).toBe("You can't message @asha.")
    expect(createConversationErrorText(refused(), target)).toBe("@asha can't be messaged right now")
  })

  test('503 RETRY_LATER and 429 RATE_LIMITED', () => {
    expect(createConversationErrorText(new ChatApiError('x', 503, 'RETRY_LATER'), target)).toBe('Try again in a moment')
    expect(RETRY_LATER_TEXT).toBe('Try again in a moment')
    expect(requestSendErrorText(new ChatApiError('x', 503, 'RETRY_LATER'), target)).toBe('Try again in a moment')
    expect(createConversationErrorText(new ChatApiError('x', 429, 'RATE_LIMITED'), target)).toContain('Try again tomorrow')
    expect(isConsentRefusal(new ChatApiError('x', 503, 'RETRY_LATER'))).toBe(true)
    expect(isConsentRefusal(new ChatApiError('x', 403, 'MESSAGING_NOT_ALLOWED'))).toBe(true)
    expect(isConsentRefusal(new ChatApiError('x', 500, 'INTERNAL_ERROR'))).toBe(false)
  })

  test('there is no cooldown wording: the server silently returns the old waiting request', () => {
    // A send there is refused as AWAITING_REQUEST_ACCEPTANCE, which says only "wait for them".
    const text = requestSendErrorText(new ChatApiError('awaiting message request acceptance', 409, 'AWAITING_REQUEST_ACCEPTANCE'), target)
    expect(text).not.toMatch(/7 days|cooldown|declined|deleted/i)
    expect(createConversationErrorText(new ChatApiError('a previous request to this person was declined recently', 400, 'INVALID_REQUEST'), target)).toBe(
      'Something went wrong. Please try again.',
    )
  })

  test('a refused send in a waiting request', () => {
    expect(requestSendErrorText(new ChatApiError('x', 409, 'AWAITING_REQUEST_ACCEPTANCE'), target)).toContain('once @asha accepts')
    expect(requestSendErrorText(new ChatApiError('message request first message is invalid: links are not allowed', 422, 'INVALID_REQUEST_MESSAGE'), target)).toBe(
      "Links can't be sent until @asha accepts.",
    )
    expect(requestSendErrorText(new ChatApiError('message request first message is invalid: exceeds 500 characters', 422, 'INVALID_REQUEST_MESSAGE'), target)).toBe(
      'A request can be up to 500 characters.',
    )
    expect(requestSendErrorText(new ChatApiError('first message must be non-empty text', 422, 'INVALID_REQUEST_MESSAGE'), target)).toBe(
      'Only a text message can go with a request.',
    )
    expect(requestSendErrorText(new ChatApiError('x', 500, 'INTERNAL_ERROR'), target)).toBeNull()
  })
})

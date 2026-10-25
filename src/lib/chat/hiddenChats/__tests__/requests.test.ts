import { describe, expect, test } from 'bun:test'

import {
  conversationIdOfPath,
  decodeHiddenSettings,
  decodeOpenToken,
  decodeRevealToken,
  hiddenErrorOf,
  hiddenListRequest,
  hiddenSubscribeFrame,
  hiddenUnsubscribeFrame,
  hideRequest,
  lockedMessage,
  openHeaderFor,
  openRequest,
  resetRequest,
  retryAfterSeconds,
  revealRequest,
  settingsBody,
  settingsErrorMessage,
  settingsRequest,
  unhideRequest,
  updateSettingsRequest,
  waitWords,
  wrongPasswordMessage,
} from '../requests'

const body = (r: { init: { body?: string } }) => JSON.parse(r.init.body ?? 'null')

describe('request builders (contract routes, tokens in headers)', () => {
  test('settings GET', () => {
    expect(settingsRequest()).toEqual({ path: '/hidden/settings', init: { method: 'GET' } })
  })

  test('first set: both secrets, nothing else', () => {
    const r = updateSettingsRequest({ secretKey: 'abcd', chatPassword: 'hunter22' })
    expect(r.path).toBe('/hidden/settings')
    expect(r.init.method).toBe('PUT')
    expect(body(r)).toEqual({ secret_key: 'abcd', chat_password: 'hunter22' })
  })

  test('change carries the current chat password; empty fields do not travel', () => {
    expect(settingsBody({ secretKey: '', chatPassword: 'newpass1', currentChatPassword: 'oldpass1' })).toEqual({
      chat_password: 'newpass1',
      current_chat_password: 'oldpass1',
    })
  })

  test('strict and shortcut, including the default (null)', () => {
    expect(settingsBody({ strict: false, currentChatPassword: 'p' })).toEqual({ strict: false, current_chat_password: 'p' })
    expect(settingsBody({ shortcut: 'Ctrl+Alt+K' })).toEqual({ shortcut: 'Ctrl+Alt+K' })
    expect(settingsBody({ shortcut: null })).toEqual({ shortcut: null })
    expect(settingsBody({})).toEqual({})
  })

  test('reset presents the step-up token as the bearer', () => {
    const r = resetRequest('abcd', 'hunter22', 'stepped.up.jwt')
    expect(r).toMatchObject({ path: '/hidden/reset', init: { method: 'POST', headers: { Authorization: 'Bearer stepped.up.jwt' } } })
    expect(body(r)).toEqual({ secret_key: 'abcd', chat_password: 'hunter22' })
  })

  test('reveal sends the trimmed key and no token', () => {
    const r = revealRequest('  abcd12 ')
    expect(r.path).toBe('/hidden/reveal')
    expect(r.init.method).toBe('POST')
    expect(r.init.headers).toBeUndefined()
    expect(body(r)).toEqual({ secret_key: 'abcd12' })
  })

  test('hidden list and open carry X-Chat-Reveal', () => {
    expect(hiddenListRequest('rv-1')).toEqual({ path: '/hidden/conversations', init: { method: 'GET', headers: { 'X-Chat-Reveal': 'rv-1' } } })
    const o = openRequest('hunter22', 'rv-1')
    expect(o.path).toBe('/hidden/open')
    expect(o.init.headers).toEqual({ 'X-Chat-Reveal': 'rv-1' })
    expect(body(o)).toEqual({ chat_password: 'hunter22' })
  })

  test('hide needs no token; unhide carries X-Chat-Open', () => {
    expect(hideRequest('c 1')).toEqual({ path: '/conversations/c%201/hide', init: { method: 'POST' } })
    expect(unhideRequest('c1', 'op-1')).toEqual({ path: '/conversations/c1/unhide', init: { method: 'POST', headers: { 'X-Chat-Open': 'op-1' } } })
  })

  test('socket frames: the open token rides in the subscribe frame only', () => {
    expect(hiddenSubscribeFrame('c1', 'op-1')).toEqual({ type: 'conversation.subscribe', conversation_id: 'c1', open_token: 'op-1' })
    expect(hiddenUnsubscribeFrame('c1')).toEqual({ type: 'conversation.unsubscribe', conversation_id: 'c1' })
  })
})

describe('openHeaderFor: X-Chat-Open only where it is needed', () => {
  const locked = (id: string) => id === 'hid'

  test('a hidden conversation call while the token is held', () => {
    expect(openHeaderFor('/conversations/hid/messages?limit=30', locked, 'op')).toEqual({ 'X-Chat-Open': 'op' })
    expect(openHeaderFor('/conversations/hid', locked, 'op')).toEqual({ 'X-Chat-Open': 'op' })
  })

  test('never on another conversation, the list, or without a token', () => {
    expect(openHeaderFor('/conversations/other/messages', locked, 'op')).toBeNull()
    expect(openHeaderFor('/conversations?limit=30', locked, 'op')).toBeNull()
    expect(openHeaderFor('/search?q=hid', locked, 'op')).toBeNull()
    expect(openHeaderFor('/conversations/hid/messages', locked, null)).toBeNull()
  })

  test('conversationIdOfPath', () => {
    expect(conversationIdOfPath('/conversations/abc/messages/m1/forward')).toBe('abc')
    expect(conversationIdOfPath('/conversations/a%2Fb/settings')).toBe('a/b')
    expect(conversationIdOfPath('/conversations/direct')).toBeNull()
    expect(conversationIdOfPath('/conversations/group')).toBeNull()
    expect(conversationIdOfPath('/conversations')).toBeNull()
    expect(conversationIdOfPath('/requests/count')).toBeNull()
    expect(conversationIdOfPath('/conversations/%E0%A4%A')).toBeNull()
  })
})

describe('decoders', () => {
  test('settings: never secrets, defaults closed', () => {
    expect(decodeHiddenSettings({ data: { configured: true, strict: true, shortcut: 'Ctrl+Alt+K', secret_key: 'x' } })).toEqual({ configured: true, strict: true, shortcut: 'Ctrl+Alt+K' })
    expect(decodeHiddenSettings({ data: { configured: 'yes', shortcut: '' } })).toEqual({ configured: false, strict: false, shortcut: null })
    expect(decodeHiddenSettings(null)).toEqual({ configured: false, strict: false, shortcut: null })
  })

  test('tokens, enveloped or bare; empty is none', () => {
    expect(decodeRevealToken({ data: { reveal_token: 'rv', expires_at: '2026-10-24T10:15:00Z' } })).toEqual({ token: 'rv', expiresAt: '2026-10-24T10:15:00Z' })
    expect(decodeOpenToken({ open_token: ' op ' })).toEqual({ token: 'op', expiresAt: null })
    expect(decodeRevealToken({ data: { reveal_token: '' } })).toBeNull()
    expect(decodeOpenToken({ data: { reveal_token: 'rv' } })).toBeNull()
  })
})

const apiErr = (status: number, code: string, details?: unknown) => ({
  status,
  code,
  body: { error: { code, message: `server ${code}`, ...(details !== undefined ? { details } : {}) } },
})

describe('error mapping', () => {
  const NOW = Date.parse('2026-10-24T10:00:00Z')

  test('wrong key and "not set up" are the same: not_found', () => {
    expect(hiddenErrorOf(apiErr(404, 'NOT_FOUND'))).toEqual({ kind: 'not_found' })
    expect(hiddenErrorOf({ status: 404, code: '' })).toEqual({ kind: 'not_found' })
  })

  test('locked with retry_after in seconds, in details or the error', () => {
    expect(hiddenErrorOf(apiErr(429, 'LOCKED', { retry_after: 900 }), NOW)).toEqual({ kind: 'locked', retryAfterSec: 900 })
    expect(hiddenErrorOf({ status: 429, code: 'LOCKED', body: { error: { code: 'LOCKED', retry_after: 60 } } }, NOW)).toEqual({ kind: 'locked', retryAfterSec: 60 })
    expect(hiddenErrorOf(apiErr(429, 'RATE_LIMITED'), NOW)).toEqual({ kind: 'locked', retryAfterSec: null })
  })

  test('locked-until as a timestamp', () => {
    expect(retryAfterSeconds({ error: { details: { locked_until: '2026-10-24T11:00:00Z' } } }, NOW)).toBe(3600)
    expect(retryAfterSeconds({ error: { details: { retry_after: Math.floor(NOW / 1000) + 120 } } }, NOW)).toBe(120)
    expect(retryAfterSeconds({ error: { details: { retry_after: NOW + 30_000 } } }, NOW)).toBe(30)
    expect(retryAfterSeconds({ error: { details: { retry_after: '2026-10-24T09:00:00Z' } } }, NOW)).toBe(0)
    expect(retryAfterSeconds({}, NOW)).toBeNull()
  })

  test('wrong password with attempts left', () => {
    expect(hiddenErrorOf(apiErr(401, 'WRONG_PASSWORD', { attempts_left: 3 }))).toEqual({ kind: 'wrong_password', attemptsLeft: 3 })
    expect(hiddenErrorOf(apiErr(401, 'WRONG_PASSWORD'))).toEqual({ kind: 'wrong_password', attemptsLeft: null })
    expect(hiddenErrorOf(apiErr(401, 'WRONG_PASSWORD', { attempts_left: -1 }))).toEqual({ kind: 'wrong_password', attemptsLeft: 0 })
  })

  test('chat locked, step-up, equal secrets, validation, unavailable', () => {
    expect(hiddenErrorOf(apiErr(403, 'CHAT_LOCKED'))).toEqual({ kind: 'chat_locked' })
    expect(hiddenErrorOf(apiErr(401, 'STEP_UP_REQUIRED'))).toEqual({ kind: 'step_up_required' })
    expect(hiddenErrorOf(apiErr(400, 'SECRETS_MUST_DIFFER'))).toEqual({ kind: 'same_values' })
    expect(hiddenErrorOf(apiErr(422, 'VALIDATION_FAILED'))).toEqual({ kind: 'invalid', message: 'server VALIDATION_FAILED' })
    expect(hiddenErrorOf(apiErr(502, ''))).toEqual({ kind: 'unavailable' })
    expect(hiddenErrorOf(new Error('network'))).toEqual({ kind: 'unavailable' })
    expect(hiddenErrorOf(apiErr(500, 'INTERNAL'))).toEqual({ kind: 'unknown', message: 'server INTERNAL' })
  })

  test('the words people see', () => {
    expect(wrongPasswordMessage(2)).toBe("That password isn't right. 2 tries left.")
    expect(wrongPasswordMessage(1)).toBe("That password isn't right. 1 try left.")
    expect(wrongPasswordMessage(0)).toContain('out of tries')
    expect(wrongPasswordMessage(null)).toBe("That password isn't right.")
    expect(lockedMessage(900)).toBe('Too many wrong tries. Try again in 15 minutes.')
    expect(lockedMessage(3600)).toBe('Too many wrong tries. Try again in 1 hour.')
    expect(lockedMessage(86_400)).toBe('Too many wrong tries. Try again in 24 hours.')
    expect(lockedMessage(null)).toBe('Too many wrong tries. Try again later.')
    expect(waitWords(1)).toBe('1 second')
    expect(waitWords(45)).toBe('45 seconds')
    expect(waitWords(61)).toBe('2 minutes')
    expect(settingsErrorMessage({ kind: 'same_values' })).toContain('different')
    expect(settingsErrorMessage({ kind: 'invalid', message: null })).toContain('rules')
  })
})

/*
  Hidden chats over the real chat client (services/messageService chatRequest)
  against a stubbed proxy: what each call sends, where the tokens go, and
  what a refusal does to the in-memory tokens.
*/

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { setAccessToken } from '@/lib/accessToken'
import { hiddenChatTokens } from '@/lib/chat/hiddenChats/tokenStore'
import { chatRequest } from '../messageService'
import {
  fetchHiddenConversations,
  fetchHiddenSettings,
  hideConversation,
  openHiddenChats,
  resetHiddenChats,
  revealHiddenChats,
  saveHiddenSettings,
  unhideConversation,
} from '../hiddenChatsApi'

interface Call { url: string; method: string; headers: Headers; body: unknown }

const ACCESS = `h.${btoa('{}')}.s`
const calls: Call[] = []
let reply: (url: string) => { status: number; body: unknown } = () => ({ status: 200, body: {} })
const realFetch = globalThis.fetch

beforeEach(() => {
  calls.length = 0
  reply = () => ({ status: 200, body: {} })
  hiddenChatTokens.forgetAll()
  setAccessToken(ACCESS)
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    const r = reply(String(url))
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  hiddenChatTokens.forgetAll()
  setAccessToken(null)
})

const err = (status: number, code: string, details?: unknown) => ({ status, body: { error: { code, message: code, details } } })

describe('settings', () => {
  test('GET reads the flags; a missing route is null', async () => {
    reply = () => ({ status: 200, body: { data: { configured: true, strict: false, shortcut: null } } })
    expect(await fetchHiddenSettings()).toEqual({ configured: true, strict: false, shortcut: null })
    expect(calls[0].url).toBe('/api/chat/hidden/settings')
    reply = () => err(404, 'NOT_FOUND')
    expect(await fetchHiddenSettings()).toBeNull()
  })

  test('PUT sends only what changes', async () => {
    await saveHiddenSettings({ currentChatPassword: 'oldpass1', chatPassword: 'newpass1' })
    expect(calls[0]).toMatchObject({ url: '/api/chat/hidden/settings', method: 'PUT', body: { chat_password: 'newpass1', current_chat_password: 'oldpass1' } })
  })

  test('a wrong current password does not close the chat session (no forced re-auth)', async () => {
    reply = () => err(401, 'WRONG_PASSWORD', { attempts_left: 4 })
    await expect(saveHiddenSettings({ currentChatPassword: 'x', strict: true })).rejects.toMatchObject({ status: 401, code: 'WRONG_PASSWORD' })
  })
})

describe('reveal', () => {
  test('a correct key keeps the token in memory', async () => {
    reply = () => ({ status: 200, body: { data: { reveal_token: 'rv-1', expires_at: '2999-01-01T00:00:00Z' } } })
    expect(await revealHiddenChats(' abcd12 ')).toEqual({ ok: true })
    expect(calls[0]).toMatchObject({ url: '/api/chat/hidden/reveal', method: 'POST', body: { secret_key: 'abcd12' } })
    expect(hiddenChatTokens.reveal()).toBe('rv-1')
  })

  test('a wrong key is not_found and leaves nothing behind', async () => {
    reply = () => err(404, 'NOT_FOUND')
    expect(await revealHiddenChats('abcd12')).toEqual({ ok: false, error: { kind: 'not_found' } })
    expect(hiddenChatTokens.reveal()).toBeNull()
  })

  test('a lockout says how long', async () => {
    reply = () => err(429, 'LOCKED', { retry_after: 900 })
    expect(await revealHiddenChats('abcd12')).toEqual({ ok: false, error: { kind: 'locked', retryAfterSec: 900 } })
  })
})

describe('hidden list and open', () => {
  const reveal = () => hiddenChatTokens.setReveal('rv-1', '2999-01-01T00:00:00Z')

  test('the list is read with X-Chat-Reveal and its ids are remembered as hidden', async () => {
    reveal()
    reply = () => ({ status: 200, body: { data: [{ id: 'h1', type: 'direct', members: [{ user_id: 'me' }, { user_id: 'p' }] }] } })
    const rows = await fetchHiddenConversations('me')
    expect(rows?.map((r) => r.id)).toEqual(['h1'])
    expect(calls[0].url).toBe('/api/chat/hidden/conversations')
    expect(calls[0].headers.get('X-Chat-Reveal')).toBe('rv-1')
    expect(hiddenChatTokens.isLocked('h1')).toBe(true)
  })

  test('no token: no request at all', async () => {
    expect(await fetchHiddenConversations('me')).toBeNull()
    expect(calls).toHaveLength(0)
  })

  test('a refused reveal token (404) locks again', async () => {
    reveal()
    reply = () => err(404, 'NOT_FOUND')
    await expect(fetchHiddenConversations('me')).rejects.toBeDefined()
    expect(hiddenChatTokens.reveal()).toBeNull()
  })

  test('the chat password opens; the open token is kept in memory', async () => {
    reveal()
    reply = () => ({ status: 200, body: { data: { open_token: 'op-1', expires_at: '2999-01-01T00:00:00Z' } } })
    expect(await openHiddenChats('hunter22')).toEqual({ ok: true })
    expect(calls[0]).toMatchObject({ url: '/api/chat/hidden/open', method: 'POST', body: { chat_password: 'hunter22' } })
    expect(calls[0].headers.get('X-Chat-Reveal')).toBe('rv-1')
    expect(hiddenChatTokens.open()).toBe('op-1')
  })

  test('a wrong password reports attempts left and keeps the list revealed', async () => {
    reveal()
    reply = () => err(401, 'WRONG_PASSWORD', { attempts_left: 2 })
    expect(await openHiddenChats('nope')).toEqual({ ok: false, error: { kind: 'wrong_password', attemptsLeft: 2 } })
    expect(hiddenChatTokens.reveal()).toBe('rv-1')
    expect(hiddenChatTokens.open()).toBeNull()
  })

  test('opening without a reveal token sends nothing', async () => {
    expect(await openHiddenChats('hunter22')).toEqual({ ok: false, error: { kind: 'not_found' } })
    expect(calls).toHaveLength(0)
  })
})

describe('X-Chat-Open on hidden-chat calls', () => {
  beforeEach(() => {
    hiddenChatTokens.setReveal('rv-1', '2999-01-01T00:00:00Z')
    hiddenChatTokens.setOpen('op-1', '2999-01-01T00:00:00Z')
    hiddenChatTokens.markLocked(['h1'])
  })

  test('a hidden chat’s messages carry it; another chat’s do not', async () => {
    await chatRequest('/conversations/h1/messages?limit=30')
    await chatRequest('/conversations/c2/messages?limit=30')
    await chatRequest('/conversations?limit=30')
    expect(calls.map((c) => c.headers.get('X-Chat-Open'))).toEqual(['op-1', null, null])
    expect(calls.every((c) => c.headers.get('X-Chat-Reveal') === null)).toBe(true)
  })

  test('403 CHAT_LOCKED drops the open token, not the list', async () => {
    reply = () => err(403, 'CHAT_LOCKED')
    await expect(chatRequest('/conversations/h1/messages')).rejects.toMatchObject({ code: 'CHAT_LOCKED' })
    expect(hiddenChatTokens.open()).toBeNull()
    expect(hiddenChatTokens.reveal()).toBe('rv-1')
  })

  test('a CHAT_LOCKED on an unknown conversation marks it hidden', async () => {
    reply = () => err(403, 'CHAT_LOCKED')
    await expect(chatRequest('/conversations/zz/messages')).rejects.toBeDefined()
    expect(hiddenChatTokens.isLocked('zz')).toBe(true)
  })

  test('hide (no token) and unhide (open token)', async () => {
    await hideConversation('c9')
    expect(calls[0]).toMatchObject({ url: '/api/chat/conversations/c9/hide', method: 'POST' })
    expect(hiddenChatTokens.isLocked('c9')).toBe(true)
    await unhideConversation('h1')
    expect(calls[1]).toMatchObject({ url: '/api/chat/conversations/h1/unhide', method: 'POST' })
    expect(calls[1].headers.get('X-Chat-Open')).toBe('op-1')
    expect(hiddenChatTokens.isLocked('h1')).toBe(false)
  })

  test('unhide without an open token sends nothing', async () => {
    hiddenChatTokens.drop('lock', 'open')
    await expect(unhideConversation('h1')).rejects.toMatchObject({ code: 'CHAT_LOCKED' })
    expect(calls).toHaveLength(0)
  })
})

describe('reset after signing in again', () => {
  test('the step-up token is the bearer for that one call, and everything re-locks', async () => {
    hiddenChatTokens.setReveal('rv-1', '2999-01-01T00:00:00Z')
    await resetHiddenChats('abcd12', 'hunter22', 'stepped.up.token')
    expect(calls[0]).toMatchObject({ url: '/api/chat/hidden/reset', method: 'POST', body: { secret_key: 'abcd12', chat_password: 'hunter22' } })
    expect(calls[0].headers.get('Authorization')).toBe('Bearer stepped.up.token')
    expect(hiddenChatTokens.reveal()).toBeNull()
  })

  test('every other call keeps the session token', async () => {
    await chatRequest('/conversations?limit=1')
    expect(calls[0].headers.get('Authorization')).toBe(`Bearer ${ACCESS}`)
  })
})

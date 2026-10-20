/*
  Message pins on the wire (message-service handler.go "Pins"):
    POST   /conversations/:id/pins {message_id}
    DELETE /conversations/:id/pins/:pinId
    GET    /conversations/:id/pins
  The web once called /pin/:messageId and /pin, which do not exist; these
  pin the paths, methods and bodies so that cannot drift back.
*/

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { decodePin, getPinnedMessage, listPinnedMessages, pinMessage, unpinMessage } from '../messageService'

const PIN_ROW = {
  id: 'pin-1',
  conversation_id: 'c1',
  message_id: 'm1',
  pinned_by: 'u1',
  pinned_at: '2026-10-20T10:00:00Z',
}

describe('message pins wire', () => {
  const calls: { url: string; method: string; body: unknown }[] = []
  let reply: { status: number; body: unknown } = { status: 200, body: {} }
  const realFetch = globalThis.fetch

  // Another suite may leave a bare `window` behind with no storage; the client reads the session from it.
  const g = globalThis as { localStorage?: unknown }
  let addedStorage = false

  beforeEach(() => {
    if (typeof window !== 'undefined' && g.localStorage === undefined) {
      const mem = new Map<string, string>()
      g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
      addedStorage = true
    }
    calls.length = 0
    reply = { status: 200, body: {} }
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      // The token helper may refresh first; only chat calls are recorded.
      if (!String(url).startsWith('/api/chat/')) return new Response(JSON.stringify({}), { status: 401, headers: { 'content-type': 'application/json' } })
      calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined })
      return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch
  })
  afterEach(() => {
    if (addedStorage) {
      delete g.localStorage
      addedStorage = false
    }
    globalThis.fetch = realFetch
  })

  test('pin: POST /conversations/:id/pins with {message_id}, answers the pin row', async () => {
    reply = { status: 201, body: { data: PIN_ROW } }
    const pin = await pinMessage('c 1', 'm1')
    expect(calls).toEqual([{ url: '/api/chat/conversations/c%201/pins', method: 'POST', body: { message_id: 'm1' } }])
    expect(pin).toEqual({ ...PIN_ROW, message: undefined })
  })

  test('unpin: DELETE /conversations/:id/pins/:pinId by the PIN id, no body', async () => {
    reply = { status: 200, body: { data: { status: 'message unpinned' } } }
    await unpinMessage('c1', 'pin-1')
    expect(calls).toEqual([{ url: '/api/chat/conversations/c1/pins/pin-1', method: 'DELETE', body: undefined }])
  })

  test('list: GET /conversations/:id/pins, newest first as sent, keeping each pin id', async () => {
    reply = { status: 200, body: { data: [PIN_ROW, { ...PIN_ROW, id: 'pin-0', message_id: 'm0' }] } }
    const pins = await listPinnedMessages('c1')
    expect(calls).toEqual([{ url: '/api/chat/conversations/c1/pins', method: 'GET', body: undefined }])
    expect(pins.map((p) => [p.id, p.message_id])).toEqual([['pin-1', 'm1'], ['pin-0', 'm0']])
  })

  test('list: no pins (data: null from a nil Go slice) is an empty list', async () => {
    reply = { status: 200, body: { data: null } }
    expect(await listPinnedMessages('c1')).toEqual([])
  })

  test('getPinnedMessage is the newest pin, and null when the read fails', async () => {
    reply = { status: 200, body: { data: [PIN_ROW] } }
    expect((await getPinnedMessage('c1'))?.id).toBe('pin-1')
    reply = { status: 400, body: { error: { message: 'not a conversation member' } } }
    expect(await getPinnedMessage('c1')).toBeNull()
  })

  test('a pin failure (the 3-pin cap) throws for the caller to report', async () => {
    reply = { status: 400, body: { error: { message: 'maximum 3 pinned messages per conversation' } } }
    await expect(pinMessage('c1', 'm4')).rejects.toThrow()
  })
})

describe('decodePin', () => {
  test('a row without a pin id or message id is dropped', () => {
    expect(decodePin({ ...PIN_ROW, id: '' }, 'c1')).toBeNull()
    expect(decodePin({ ...PIN_ROW, message_id: undefined }, 'c1')).toBeNull()
    expect(decodePin(null, 'c1')).toBeNull()
  })

  test('the conversation id falls back to the one asked for', () => {
    expect(decodePin({ ...PIN_ROW, conversation_id: undefined }, 'c9')?.conversation_id).toBe('c9')
  })
})

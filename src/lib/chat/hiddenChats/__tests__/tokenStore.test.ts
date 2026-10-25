import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createHiddenTokenStore, expiryMs, HIDDEN_IDLE_MS, type HiddenTokenSnapshot } from '../tokenStore'

/** A clock and timers the test moves by hand. */
function fakeTime(start = Date.parse('2026-10-24T10:00:00Z')) {
  let now = start
  let seq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  return {
    now: () => now,
    setTimer: (fn: () => void, ms: number) => {
      const id = ++seq
      timers.set(id, { at: now + ms, fn })
      return id
    },
    clearTimer: (h: unknown) => {
      timers.delete(h as number)
    },
    advance(ms: number) {
      const end = now + ms
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0])
        now = due[1].at
        due[1].fn()
      }
      now = end
    },
    pending: () => timers.size,
  }
}

const make = (t = fakeTime()) => ({ t, store: createHiddenTokenStore({ now: t.now, setTimer: t.setTimer, clearTimer: t.clearTimer }) })
const FAR = '2999-01-01T00:00:00Z'

describe('holding tokens', () => {
  test('reveal and open are held and returned', () => {
    const { store } = make()
    expect(store.reveal()).toBeNull()
    store.setReveal('rv-1', FAR)
    store.setOpen('op-1', FAR)
    expect(store.reveal()).toBe('rv-1')
    expect(store.open()).toBe('op-1')
    expect(store.snapshot()).toEqual({ revealed: true, opened: true, lastDrop: null })
  })

  test('a blank token is ignored', () => {
    const { store } = make()
    store.setReveal('   ', FAR)
    expect(store.reveal()).toBeNull()
  })

  test('past its expiry a token is gone', () => {
    const { t, store } = make()
    store.setReveal('rv', t.now() + 30_000)
    t.advance(20_000)
    store.touch()
    t.advance(20_000)
    expect(store.reveal()).toBeNull()
    expect(store.snapshot().lastDrop).toBe('expired')
  })

  test('slide: a used token lives a full window again', () => {
    const { t, store } = make()
    store.setOpen('op', t.now() + 50_000)
    t.advance(40_000)
    store.touch()
    store.slide('open')
    t.advance(40_000)
    store.touch()
    expect(store.open()).toBe('op')
  })
})

describe('idle re-lock (1 minute)', () => {
  test('drops both tokens after a minute without activity', () => {
    const { t, store } = make()
    store.setReveal('rv', FAR)
    store.setOpen('op', FAR)
    t.advance(HIDDEN_IDLE_MS - 1)
    expect(store.reveal()).toBe('rv')
    t.advance(1)
    expect(store.reveal()).toBeNull()
    expect(store.open()).toBeNull()
    expect(store.snapshot().lastDrop).toBe('idle')
  })

  test('activity keeps them, and the minute counts from the last activity', () => {
    const { t, store } = make()
    store.setReveal('rv', FAR)
    t.advance(50_000)
    store.touch()
    t.advance(50_000)
    expect(store.reveal()).toBe('rv')
    t.advance(10_000)
    expect(store.reveal()).toBeNull()
  })

  test('one timer at a time, none once locked', () => {
    const { t, store } = make()
    store.setReveal('rv', FAR)
    for (let i = 0; i < 20; i++) store.touch()
    expect(t.pending()).toBe(1)
    store.drop('lock')
    expect(t.pending()).toBe(0)
  })

  test('touch with nothing held arms nothing', () => {
    const { t, store } = make()
    store.touch()
    expect(t.pending()).toBe(0)
  })

  test('the default idle time is one minute', () => {
    expect(HIDDEN_IDLE_MS).toBe(60_000)
  })
})

describe('drops', () => {
  test('dropping the reveal token drops the open token with it', () => {
    const { store } = make()
    store.setReveal('rv', FAR)
    store.setOpen('op', FAR)
    store.drop('hidden')
    expect(store.reveal()).toBeNull()
    expect(store.open()).toBeNull()
    expect(store.snapshot().lastDrop).toBe('hidden')
  })

  test('dropping only the open token keeps the list revealed', () => {
    const { store } = make()
    store.setReveal('rv', FAR)
    store.setOpen('op', FAR)
    store.drop('server', 'open')
    expect(store.reveal()).toBe('rv')
    expect(store.open()).toBeNull()
  })

  test('listeners hear every change, and only real ones', () => {
    const { store } = make()
    const seen: HiddenTokenSnapshot[] = []
    const off = store.subscribe((s) => seen.push(s))
    store.drop('lock') // nothing held: silent
    store.setReveal('rv', FAR)
    store.setOpen('op', FAR)
    store.drop('idle')
    off()
    store.setReveal('rv2', FAR)
    expect(seen.map((s) => [s.revealed, s.opened])).toEqual([[true, false], [true, true], [false, false]])
  })

  test('a throwing listener does not break the store', () => {
    const { store } = make()
    store.subscribe(() => { throw new Error('boom') })
    store.setReveal('rv', FAR)
    expect(store.reveal()).toBe('rv')
  })
})

describe('locked conversation ids', () => {
  test('marked ids are known until unmarked; a re-lock keeps them', () => {
    const { store } = make()
    store.markLocked(['c1', 'c2', ''])
    store.unmarkLocked('c2')
    store.setReveal('rv', FAR)
    store.drop('idle')
    expect(store.isLocked('c1')).toBe(true)
    expect(store.isLocked('c2')).toBe(false)
    expect(store.isLocked('')).toBe(false)
    expect(store.isLocked(null)).toBe(false)
  })

  test('sign-out forgets tokens and ids', () => {
    const { store } = make()
    store.markLocked(['c1'])
    store.setReveal('rv', FAR)
    store.forgetAll()
    expect(store.isLocked('c1')).toBe(false)
    expect(store.reveal()).toBeNull()
    expect(store.snapshot().lastDrop).toBe('signout')
  })
})

describe('memory only', () => {
  test('setting and reading tokens touches no browser storage', () => {
    const touched: string[] = []
    const spy = (name: string) => new Proxy({}, { get: (_t, k) => { touched.push(`${name}.${String(k)}`); return () => null } })
    const g = globalThis as Record<string, unknown>
    const saved = { localStorage: g.localStorage, sessionStorage: g.sessionStorage, indexedDB: g.indexedDB }
    g.localStorage = spy('localStorage')
    g.sessionStorage = spy('sessionStorage')
    g.indexedDB = spy('indexedDB')
    try {
      const { store } = make()
      store.setReveal('rv', FAR)
      store.setOpen('op', FAR)
      store.reveal()
      store.open()
      store.touch()
      store.slide('open')
      store.drop('lock')
    } finally {
      Object.assign(g, saved)
    }
    expect(touched).toEqual([])
  })

  test('no hidden-chats module mentions a storage API', () => {
    const dir = join(import.meta.dir, '..')
    const files = ['tokenStore.ts', 'requests.ts', 'guards.ts', 'validation.ts', 'shortcut.ts']
      .map((f) => join(dir, f))
      .concat([join(import.meta.dir, '../../../../services/hiddenChatsApi.ts'), join(import.meta.dir, '../../../../components/messenger/hidden/useHiddenChats.ts')])
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      expect({ file: f, hit: /localStorage|sessionStorage|indexedDB|document\.cookie\s*=|setItem\(/.exec(src)?.[0] ?? null }).toEqual({ file: f, hit: null })
    }
  })
})

describe('expiryMs', () => {
  test('ISO, epoch seconds, epoch ms, and the 15-minute fallback', () => {
    expect(expiryMs('2026-10-24T10:00:00Z', 0)).toBe(Date.parse('2026-10-24T10:00:00Z'))
    expect(expiryMs(1_800_000_000, 0)).toBe(1_800_000_000_000)
    expect(expiryMs(1_800_000_000_000, 0)).toBe(1_800_000_000_000)
    expect(expiryMs(null, 5)).toBe(5 + 15 * 60_000)
    expect(expiryMs('not a date', 5)).toBe(5 + 15 * 60_000)
  })
})

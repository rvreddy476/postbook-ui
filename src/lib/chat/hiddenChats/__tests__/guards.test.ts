import { describe, expect, test } from 'bun:test'

import { ACTIVITY_EVENTS, installHiddenChatGuards, SESSION_EVENT } from '../guards'
import { createHiddenTokenStore } from '../tokenStore'

class FakeTarget {
  visibilityState = 'visible'
  listeners = new Map<string, Set<(e: unknown) => void>>()
  addEventListener(type: string, fn: (e: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }
  removeEventListener(type: string, fn: (e: unknown) => void) {
    this.listeners.get(type)?.delete(fn)
  }
  fire(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn({ type })
  }
  count() {
    let n = 0
    for (const s of this.listeners.values()) n += s.size
    return n
  }
}

function setup(user: string | null = 'me') {
  let now = 0
  const timers: { at: number; fn: () => void }[] = []
  const store = createHiddenTokenStore({
    now: () => now,
    setTimer: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t },
    clearTimer: (h) => { const i = timers.indexOf(h as never); if (i >= 0) timers.splice(i, 1) },
  })
  const advance = (ms: number) => {
    now += ms
    for (const t of [...timers].sort((a, b) => a.at - b.at)) {
      if (t.at <= now && timers.includes(t)) {
        timers.splice(timers.indexOf(t), 1)
        t.fn()
      }
    }
  }
  const doc = new FakeTarget()
  const win = new FakeTarget()
  let currentUser = user
  const off = installHiddenChatGuards({ doc, win, currentUserId: () => currentUser }, store, 'me')
  store.setReveal('rv', '2999-01-01T00:00:00Z')
  store.setOpen('op', '2999-01-01T00:00:00Z')
  return { store, doc, win, off, advance, setUser: (u: string | null) => { currentUser = u } }
}

describe('installHiddenChatGuards', () => {
  test('the tab going hidden drops both tokens', () => {
    const { store, doc } = setup()
    doc.visibilityState = 'hidden'
    doc.fire('visibilitychange')
    expect(store.reveal()).toBeNull()
    expect(store.open()).toBeNull()
    expect(store.snapshot().lastDrop).toBe('hidden')
  })

  test('the tab becoming visible drops nothing', () => {
    const { store, doc } = setup()
    doc.visibilityState = 'visible'
    doc.fire('visibilitychange')
    expect(store.reveal()).toBe('rv')
  })

  test('pagehide drops both tokens', () => {
    const { store, win } = setup()
    win.fire('pagehide')
    expect(store.reveal()).toBeNull()
  })

  test.each([...ACTIVITY_EVENTS])('%s counts as activity: the idle minute restarts', (ev) => {
    const { store, doc, advance } = setup()
    advance(50_000)
    doc.fire(ev)
    advance(50_000)
    expect(store.reveal()).toBe('rv')
    advance(10_000)
    expect(store.reveal()).toBeNull()
  })

  test('without activity the minute runs out', () => {
    const { store, advance } = setup()
    advance(60_000)
    expect(store.reveal()).toBeNull()
    expect(store.snapshot().lastDrop).toBe('idle')
  })

  test('signing out (or another account) elsewhere forgets everything', () => {
    for (const next of [null, 'someone-else']) {
      const { store, win, setUser } = setup()
      store.markLocked(['c1'])
      setUser(next)
      win.fire(SESSION_EVENT)
      expect(store.reveal()).toBeNull()
      expect(store.isLocked('c1')).toBe(false)
    }
  })

  test('the same account in another tab changes nothing', () => {
    const { store, win } = setup()
    win.fire('storage')
    win.fire(SESSION_EVENT)
    expect(store.reveal()).toBe('rv')
  })

  test('cleanup removes every listener', () => {
    const { doc, win, off } = setup()
    expect(doc.count()).toBeGreaterThan(0)
    off()
    expect(doc.count()).toBe(0)
    expect(win.count()).toBe(0)
  })
})

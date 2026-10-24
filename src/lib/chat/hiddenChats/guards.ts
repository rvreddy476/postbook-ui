/*
  Hidden chats: when the browser re-locks them (contract 24 Oct 2026 —
  "auto re-lock on tab hidden or 1 min idle", and on sign-out).

  installHiddenChatGuards wires a token store to the page:
    visibilitychange → hidden, pagehide   drop both tokens
    pointer, key, wheel, touch, scroll     activity: the idle clock restarts
    session change to someone else / none  forget everything
  The idle drop itself is the store's own timer (tokenStore.ts).
*/

import type { HiddenTokenStore } from './tokenStore'

interface Listenable {
  addEventListener(type: string, listener: (e: unknown) => void, options?: AddEventListenerOptions | boolean): void
  removeEventListener(type: string, listener: (e: unknown) => void, options?: EventListenerOptions | boolean): void
}

export interface GuardTargets {
  doc: Listenable & { visibilityState?: string }
  win: Listenable
  /** The signed-in user right now (localStorage session record), or null. */
  currentUserId: () => string | null
}

export const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
export const SESSION_EVENT = 'postbook:session-changed'

export function installHiddenChatGuards(t: GuardTargets, store: HiddenTokenStore, myId: string): () => void {
  const onVisibility = () => {
    if (t.doc.visibilityState === 'hidden') store.drop('hidden')
  }
  const onPageHide = () => store.drop('hidden')
  const onActivity = () => store.touch()
  const onSession = () => {
    const now = t.currentUserId()
    if (!now || now !== myId) store.forgetAll()
  }
  const passive: AddEventListenerOptions = { passive: true, capture: true }

  t.doc.addEventListener('visibilitychange', onVisibility)
  t.win.addEventListener('pagehide', onPageHide)
  t.win.addEventListener(SESSION_EVENT, onSession)
  t.win.addEventListener('storage', onSession)
  for (const ev of ACTIVITY_EVENTS) t.doc.addEventListener(ev, onActivity, passive)

  return () => {
    t.doc.removeEventListener('visibilitychange', onVisibility)
    t.win.removeEventListener('pagehide', onPageHide)
    t.win.removeEventListener(SESSION_EVENT, onSession)
    t.win.removeEventListener('storage', onSession)
    for (const ev of ACTIVITY_EVENTS) t.doc.removeEventListener(ev, onActivity, passive)
  }
}

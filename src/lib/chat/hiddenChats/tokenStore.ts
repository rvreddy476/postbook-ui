/*
  Hidden chats (contract 24 Oct 2026): the reveal and open tokens, in memory.

  A correct secret key returns a `reveal_token` (the hidden list); the chat
  password returns an `open_token` (reading and sending in a hidden chat).
  Both live ONLY in this module's closure: never localStorage,
  sessionStorage, IndexedDB or a cookie, never a URL. A reload, another tab
  or a closed tab starts locked.

  The client re-locks sooner than the server's 15-minute sliding expiry:
  - the tab is hidden (visibilitychange / pagehide),
  - 1 minute without user activity,
  - sign-out,
  - the server refuses a token (404 on the hidden list, 403 CHAT_LOCKED).
  Dropping the reveal token drops the open token with it.

  The store also remembers which conversation ids are locked for this user
  (learned from the hidden list, from Hide chat, or from a 403 CHAT_LOCKED),
  so the normal list, badges and the cross-tab broadcast can leave them out.
  That set survives a re-lock (it is what keeps a hidden chat out of the
  normal surfaces) and is cleared only on sign-out.

  No imports on purpose: authService calls `forgetHiddenChats()` on sign-out
  and must not pull the messenger in with it.
*/

export type HiddenTokenKind = 'reveal' | 'open'
export type HiddenDropReason = 'idle' | 'hidden' | 'signout' | 'expired' | 'server' | 'lock'

export interface HiddenTokenSnapshot {
  revealed: boolean
  opened: boolean
  /** Why the last drop happened, until the next token arrives. */
  lastDrop: HiddenDropReason | null
}

export interface HiddenTokenStoreOptions {
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  /** Client re-lock after this long without activity (1 minute). */
  idleMs?: number
}

export interface HiddenTokenStore {
  setReveal(token: string, expiresAt?: unknown): void
  setOpen(token: string, expiresAt?: unknown): void
  /** The reveal token, or null (absent or past its expiry). */
  reveal(): string | null
  open(): string | null
  /** User activity: the idle clock starts again. */
  touch(): void
  /** A request with this token succeeded: the server slid its expiry, so do the same. */
  slide(kind: HiddenTokenKind): void
  /** Drop the open token, or both. */
  drop(reason: HiddenDropReason, kind?: HiddenTokenKind): void
  snapshot(): HiddenTokenSnapshot
  subscribe(listener: (s: HiddenTokenSnapshot) => void): () => void
  markLocked(ids: Iterable<string>): void
  unmarkLocked(id: string): void
  isLocked(id: string | null | undefined): boolean
  /** Sign-out: tokens and the locked-id set both go. */
  forgetAll(): void
}

export const HIDDEN_IDLE_MS = 60_000
/** The server's sliding window, used when a response names no expiry. */
export const HIDDEN_TOKEN_TTL_MS = 15 * 60_000

interface Held {
  token: string
  expiresAt: number
  ttl: number
}

/** expires_at as epoch ms: ISO string, epoch seconds or ms. Unknown → now + ttl. */
export function expiryMs(expiresAt: unknown, now: number, fallbackTtl = HIDDEN_TOKEN_TTL_MS): number {
  if (typeof expiresAt === 'string' && expiresAt.trim()) {
    const t = Date.parse(expiresAt)
    if (Number.isFinite(t)) return t
  }
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt > 0) {
    return expiresAt < 1e12 ? expiresAt * 1000 : expiresAt
  }
  return now + fallbackTtl
}

export function createHiddenTokenStore(opts: HiddenTokenStoreOptions = {}): HiddenTokenStore {
  const now = opts.now ?? (() => Date.now())
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const idleMs = opts.idleMs ?? HIDDEN_IDLE_MS

  let reveal: Held | null = null
  let open: Held | null = null
  let lastActivity = now()
  let timer: unknown = null
  let lastDrop: HiddenDropReason | null = null
  const locked = new Set<string>()
  const listeners = new Set<(s: HiddenTokenSnapshot) => void>()

  const snapshot = (): HiddenTokenSnapshot => ({ revealed: reveal !== null, opened: open !== null, lastDrop })

  const announce = () => {
    const s = snapshot()
    for (const l of listeners) {
      try {
        l(s)
      } catch {
        // A listener must not break the store.
      }
    }
  }

  const disarm = () => {
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  /** One timer at a time, aimed at lastActivity + idleMs; it re-aims itself if activity moved on. */
  const arm = () => {
    disarm()
    if (!reveal && !open) return
    const wait = Math.max(0, lastActivity + idleMs - now())
    timer = setTimer(() => {
      timer = null
      if (now() - lastActivity >= idleMs) drop('idle')
      else arm()
    }, wait)
  }

  const held = (token: string, expiresAt: unknown): Held | null => {
    const t = typeof token === 'string' ? token.trim() : ''
    if (!t) return null
    const at = now()
    const exp = expiryMs(expiresAt, at)
    return { token: t, expiresAt: exp, ttl: Math.max(1, exp - at) }
  }

  function drop(reason: HiddenDropReason, kind?: HiddenTokenKind) {
    const hadAny = reveal !== null || open !== null
    if (kind === 'open') {
      if (!open) return
      open = null
    } else {
      reveal = null
      open = null
    }
    lastDrop = reason
    if (!reveal && !open) disarm()
    if (hadAny) announce()
  }

  const live = (h: Held | null, kind: HiddenTokenKind): string | null => {
    if (!h) return null
    if (now() >= h.expiresAt) {
      drop('expired', kind === 'open' ? 'open' : undefined)
      return null
    }
    return h.token
  }

  return {
    setReveal(token, expiresAt) {
      const h = held(token, expiresAt)
      if (!h) return
      reveal = h
      lastDrop = null
      lastActivity = now()
      arm()
      announce()
    },
    setOpen(token, expiresAt) {
      const h = held(token, expiresAt)
      if (!h) return
      open = h
      lastDrop = null
      lastActivity = now()
      arm()
      announce()
    },
    reveal: () => live(reveal, 'reveal'),
    open: () => live(open, 'open'),
    touch() {
      lastActivity = now()
      if ((reveal || open) && timer === null) arm()
    },
    slide(kind) {
      const h = kind === 'open' ? open : reveal
      if (h) h.expiresAt = Math.max(h.expiresAt, now() + h.ttl)
    },
    drop,
    snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    markLocked(ids) {
      for (const id of ids) if (typeof id === 'string' && id) locked.add(id)
    },
    unmarkLocked(id) {
      locked.delete(id)
    },
    isLocked: (id) => (typeof id === 'string' && id ? locked.has(id) : false),
    forgetAll() {
      locked.clear()
      drop('signout')
    },
  }
}

/** The tab's one store. */
export const hiddenChatTokens: HiddenTokenStore = createHiddenTokenStore()

/** Sign-out (authService): every hidden-chat token and id leaves memory. */
export function forgetHiddenChats(): void {
  hiddenChatTokens.forgetAll()
}

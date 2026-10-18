/*
  Plays a chat alert tone (rules in src/lib/chat/alertTone.ts).

  One sound per message across tabs (claimAlert), and a visible tab gets
  first claim: a hidden tab waits a moment before claiming. At most one
  sound a second, so a burst of messages is one alert, not a drum roll.
*/

import { claimAlert, type ClaimStore } from '@/lib/chat/alertTone'

const MIN_GAP_MS = 1000
const HIDDEN_TAB_DELAY_MS = 250
const VOLUME = 0.6

let lastPlayedAt = 0
const players = new Map<string, HTMLAudioElement>()

function store(): ClaimStore | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function play(src: string): void {
  const now = Date.now()
  if (now - lastPlayedAt < MIN_GAP_MS) return
  lastPlayedAt = now
  try {
    let a = players.get(src)
    if (!a) {
      a = new Audio(src)
      a.preload = 'auto'
      players.set(src, a)
    }
    a.volume = VOLUME
    a.currentTime = 0
    // Autoplay rules can refuse before the first interaction; nothing to do then.
    void a.play().catch(() => undefined)
  } catch {
    /* no audio in this environment */
  }
}

export function playChatAlert(messageId: string, src: string): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return
  const go = () => {
    if (claimAlert(messageId, store())) play(src)
  }
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') setTimeout(go, HIDDEN_TAB_DELAY_MS)
  else go()
}

/** Play a tone now, for the chat settings picker (a tap, so no tab claim or gap). */
export function previewChatAlert(src: string): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return
  lastPlayedAt = 0
  play(src)
}

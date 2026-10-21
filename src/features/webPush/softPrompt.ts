/*
  When the in-app "Get notified…" card may appear (founder, 15 Oct 2026).

  - Only after a meaningful action: a follow, a comment or a post. Never on
    page load — the card reacts to that event and to nothing else, and it
    also waits for the person to have interacted with the page at all.
  - Once per page: the first qualifying action offers it; later ones in the
    same page do not, whatever the answer was.
  - "Not now" (or closing it) snoozes it for 14 days on this browser.
  - Never when web push is not configured or not supported, when signed out,
    when the browser has already been answered (granted or denied), or when
    push is already on for this device.
*/

import type { PushPermission } from "./client"

export const SOFT_PROMPT_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000

export interface SoftPromptInput {
    /** Configured, supported and signed in (WebPushStatus.visible). */
    visible: boolean
    permission: PushPermission
    deviceOn: boolean
    snoozedUntil: number
    now: number
    /** The card was already offered on this page. */
    offeredThisPage: boolean
    /** navigator.userActivation.hasBeenActive (true where the browser does not say). */
    userActivated: boolean
}

export function shouldOfferSoftPrompt(i: SoftPromptInput): boolean {
    if (!i.visible) return false
    if (i.permission !== "default") return false
    if (i.deviceOn) return false
    if (i.offeredThisPage) return false
    if (!i.userActivated) return false
    if (i.now < i.snoozedUntil) return false
    return true
}

export function snoozeUntil(now: number): number {
    return now + SOFT_PROMPT_SNOOZE_MS
}

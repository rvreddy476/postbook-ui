/*
  Read tick colour (viewer preference, 22 Oct 2026): the colour of the double
  tick on a message the other side has read. Every tick draws from ONE token,
  `text-receipt-seen` (--receipt-seen in globals.css, --theme-receipt-seen in
  src/ui/theme.css). The preference only re-points that variable at another
  existing theme token, so light and dark values still come from theme.css.

  There is no server field for this, so it is stored on this device
  (localStorage, wrapped: a private window or blocked storage falls back to
  the default).
*/

export const READ_TICK_COLOURS = ['default', 'green', 'violet', 'amber', 'rose'] as const
export type ReadTickColour = (typeof READ_TICK_COLOURS)[number]

export const READ_TICK_COLOUR_LABELS: Record<ReadTickColour, string> = {
  default: 'Cerulean',
  green: 'Green',
  violet: 'Violet',
  amber: 'Amber',
  rose: 'Rose',
}

/** The theme token (theme.css, light + dark) each choice points at. */
export const READ_TICK_COLOUR_TOKENS: Record<ReadTickColour, string> = {
  default: '--theme-receipt-seen',
  green: '--theme-tile-photo',
  violet: '--theme-tile-poll',
  amber: '--theme-tile-tag',
  rose: '--theme-send',
}

export const READ_TICK_COLOUR_STORAGE_KEY = 'chat.readTickColour'
export const READ_TICK_COLOUR_EVENT = 'chat:read-tick-colour'

export function parseReadTickColour(v: unknown): ReadTickColour {
  return typeof v === 'string' && (READ_TICK_COLOURS as readonly string[]).includes(v) ? (v as ReadTickColour) : 'default'
}

/** The value --receipt-seen takes for a choice (an rgb triple via var()). */
export function readTickColourValue(choice: ReadTickColour): string {
  return `var(${READ_TICK_COLOUR_TOKENS[choice]})`
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function storage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function loadReadTickColour(store: StorageLike | null = storage()): ReadTickColour {
  try {
    return parseReadTickColour(store?.getItem(READ_TICK_COLOUR_STORAGE_KEY))
  } catch {
    return 'default'
  }
}

/** Re-point --receipt-seen on the root (default clears the override). */
export function applyReadTickColour(choice: ReadTickColour, root: { style: { setProperty(n: string, v: string): void; removeProperty(n: string): void } } | null =
  typeof document !== 'undefined' ? document.documentElement : null) {
  if (!root) return
  if (choice === 'default') root.style.removeProperty('--receipt-seen')
  else root.style.setProperty('--receipt-seen', readTickColourValue(choice))
}

export function saveReadTickColour(choice: ReadTickColour, store: StorageLike | null = storage()) {
  try {
    if (choice === 'default') store?.removeItem(READ_TICK_COLOUR_STORAGE_KEY)
    else store?.setItem(READ_TICK_COLOUR_STORAGE_KEY, choice)
  } catch {
    /* storage blocked: the choice still applies for this page */
  }
  applyReadTickColour(choice)
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(READ_TICK_COLOUR_EVENT, { detail: choice }))
  } catch {
    /* no window */
  }
}

/*
  Hidden chats: the keyboard shortcut that opens the secret-key prompt on
  the web (default Ctrl+Shift+H, configurable; stored server-side in the
  hidden-chats settings as a string like "Ctrl+Shift+H").

  A shortcut is two or more modifiers plus one letter or digit, never a
  combination the browser or the OS keeps for itself (those either cannot be
  caught by a page or would take away something people rely on).
*/

export interface Shortcut {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  /** One upper-case letter A–Z or a digit 0–9. */
  key: string
}

export const DEFAULT_SHORTCUT = 'Ctrl+Shift+H'

const MOD_ALIASES: Record<string, keyof Omit<Shortcut, 'key'>> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  win: 'meta',
  super: 'meta',
}

/** "Ctrl+Shift+H" → a Shortcut; null for anything that is not one. */
export function parseShortcut(raw: string | null | undefined): Shortcut | null {
  if (typeof raw !== 'string') return null
  const parts = raw.split('+').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const s: Shortcut = { ctrl: false, alt: false, shift: false, meta: false, key: '' }
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    const mod = MOD_ALIASES[p.toLowerCase()]
    if (i < parts.length - 1) {
      if (!mod || s[mod]) return null // unknown or repeated modifier
      s[mod] = true
      continue
    }
    if (mod || !/^[A-Za-z0-9]$/.test(p)) return null
    s.key = p.toUpperCase()
  }
  return s
}

/** The canonical spelling: Ctrl, Alt, Shift, Meta, then the key. */
export function formatShortcut(s: Shortcut): string {
  return [s.ctrl && 'Ctrl', s.alt && 'Alt', s.shift && 'Shift', s.meta && 'Meta', s.key].filter(Boolean).join('+')
}

/** How the key is labelled for this person (⌘/⌥ on a Mac). */
export function shortcutLabel(s: Shortcut, mac: boolean): string {
  if (!mac) return formatShortcut(s)
  return [s.ctrl && 'Ctrl', s.alt && 'Option', s.shift && 'Shift', s.meta && 'Cmd', s.key].filter(Boolean).join('+')
}

/** The letter or digit of a key event, from its physical key where it has one (Alt changes event.key on a Mac). */
export function keyOfEvent(e: { code?: string; key?: string }): string | null {
  const code = e.code ?? ''
  let m = /^Key([A-Z])$/.exec(code)
  if (m) return m[1]
  m = /^Digit([0-9])$/.exec(code)
  if (m) return m[1]
  const k = e.key ?? ''
  return /^[A-Za-z0-9]$/.test(k) ? k.toUpperCase() : null
}

export interface KeyEventLike {
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
  code?: string
  key?: string
  repeat?: boolean
}

export function matchesShortcut(e: KeyEventLike, s: Shortcut | null): boolean {
  if (!s || e.repeat) return false
  return (
    e.ctrlKey === s.ctrl &&
    e.altKey === s.alt &&
    e.shiftKey === s.shift &&
    e.metaKey === s.meta &&
    keyOfEvent(e) === s.key
  )
}

/** The shortcut a key press spells, for the chooser; null until a letter or digit is pressed. */
export function shortcutFromEvent(e: KeyEventLike): Shortcut | null {
  const key = keyOfEvent(e)
  if (!key) return null
  return { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, key }
}

/*
  Kept by browsers (Chrome, Edge, Firefox, Safari) or the OS. Written with
  "Mod" for Ctrl on Windows/Linux and Cmd on a Mac: both spellings are
  refused.
*/
const RESERVED_MOD = [
  // one modifier: tabs, windows, find, print, save, history, downloads, editing
  'A', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
].map((k) => `Mod+${k}`)

const RESERVED_MOD_SHIFT = [
  'A', // tab search
  'B', // bookmarks bar
  'C', // inspect element
  'D', // bookmark all tabs
  'E', // Firefox network panel
  'G', // find previous
  'I', // dev tools
  'J', // console
  'K', // Firefox web console
  'M', // profile menu / Firefox responsive design
  'N', // incognito / private window
  'O', // bookmarks manager
  'P', // private window (Firefox), command menu
  'Q', // quit (macOS)
  'R', // hard reload
  'S', // screenshot (Firefox)
  'T', // reopen closed tab
  'V', // paste as plain text
  'W', // close window
  'Y', // Firefox downloads
  'Z', // redo
  'Delete',
].map((k) => `Mod+Shift+${k}`)

const RESERVED_OTHER = [
  'Ctrl+Alt+Delete',
  'Ctrl+Alt+T', // terminal on Linux desktops
  'Ctrl+Alt+L', // lock screen on Linux desktops
  'Ctrl+Alt+D', // show desktop on Linux desktops
  'Meta+Alt+D', // dock (macOS)
  'Meta+Alt+I', // Safari web inspector
  'Meta+Alt+C', // Safari console
  'Meta+Alt+J', // Chrome console (macOS)
  'Meta+Alt+U', // view source (macOS)
  'Meta+Shift+3', 'Meta+Shift+4', 'Meta+Shift+5', // macOS screenshots
  'Meta+Shift+S', // Windows snipping tool
  'Meta+Ctrl+Q', // lock screen (macOS)
  'Meta+Ctrl+F', // full screen (macOS)
]

function expand(spec: string): string[] {
  return spec.startsWith('Mod+') ? [spec.replace('Mod+', 'Ctrl+'), spec.replace('Mod+', 'Meta+')] : [spec]
}

/** Canonical spellings, so "Meta+Shift+3" and "Shift+Meta+3" are one entry. */
const RESERVED = new Set(
  [...RESERVED_MOD, ...RESERVED_MOD_SHIFT, ...RESERVED_OTHER]
    .flatMap(expand)
    .map((spec) => {
      const s = parseShortcut(spec)
      return s ? formatShortcut(s) : null
    })
    .filter((x): x is string => x !== null),
)

/** Why a shortcut cannot be used, or null when it can. */
export function shortcutProblem(s: Shortcut | null): string | null {
  if (!s || !s.key) return 'Press two or more modifier keys with a letter or number.'
  const mods = [s.ctrl, s.alt, s.shift, s.meta].filter(Boolean).length
  if (!s.ctrl && !s.alt && !s.meta) return 'Include Ctrl, Alt or Cmd.'
  if (mods < 2) return 'Use at least two modifier keys, such as Ctrl+Shift.'
  if (RESERVED.has(formatShortcut(s))) return 'Your browser or computer already uses that shortcut. Try another.'
  return null
}

/** The shortcut to listen for: the saved one when it is usable, otherwise the default. */
export function effectiveShortcut(saved: string | null | undefined): Shortcut {
  const s = parseShortcut(saved)
  if (s && !shortcutProblem(s)) return s
  // The default is the contract's; it is checked against the list in tests.
  return parseShortcut(DEFAULT_SHORTCUT) as Shortcut
}

/*
  The default profile theme colour is the brand accent, read from the theme
  tokens (src/ui/theme.css, the one place colour lives) rather than a hex
  typed into the form. The profile stores a hex, so the token's "r g b"
  triple is converted once here; before the page has mounted there is no
  stylesheet to read, and the form holds "" until the profile loads.
*/
export function defaultProfileThemeColor(): string {
  if (typeof document === 'undefined') return ''
  const triple = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim()
  return rgbTripleToHex(triple)
}

/** "59 130 196" → "#3b82c4"; "" when the value is not a triple. */
export function rgbTripleToHex(triple: string): string {
  const parts = triple.split(/[\s,]+/).filter(Boolean).map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return ''
  return `#${parts.map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

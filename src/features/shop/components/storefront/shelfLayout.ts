/** Keep every shelf card at a readable width; wide monitors get more columns, not oversized images. */
export function shelfColumns(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 2
  return Math.max(2, Math.min(6, Math.floor((width + 16) / 216)))
}

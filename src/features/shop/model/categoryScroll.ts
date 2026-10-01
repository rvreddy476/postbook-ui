/** Edges tolerate subpixel scroll positions and browsers' overscroll. */
export function categoryScrollEdges(left: number, width: number, contentWidth: number) {
  const end = Math.max(0, contentWidth - width)
  const position = Math.max(0, Math.min(end, left))
  return { previous: position > 1, next: end - position > 1 }
}

export function categoryScrollStep(width: number) {
  return Math.max(100, Math.round(width * 0.8))
}

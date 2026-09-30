"use client"

import { useEffect, useRef } from "react"

/**
 * The element at the bottom of a paged grid. When it comes into view the
 * next page is asked for; there is also a button for anyone whose browser
 * has no IntersectionObserver, or who would rather press it.
 */
export function InfiniteSentinel({ hasMore, isLoading, onMore }: { hasMore: boolean; isLoading: boolean; onMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !hasMore || isLoading || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onMore()
    }, { rootMargin: "400px 0px" })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, isLoading, onMore])

  if (!hasMore && !isLoading) return null
  return (
    <div ref={ref} className="shop-sentinel" aria-live="polite">
      {isLoading ? (
        <span>Loading more…</span>
      ) : (
        <button type="button" className="shop-btn shop-btn--ghost shop-btn--sm" onClick={onMore}>Show more</button>
      )}
    </div>
  )
}

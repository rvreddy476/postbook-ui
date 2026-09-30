"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { usePrefersReducedMotion } from "../../hooks/storefront"
import { nextSlide, shouldAutoplay, type Banner } from "../../model/storefront"

const AUTOPLAY_MS = 6000

/**
 * The offers rail: the merchandiser's banners, one wide card at a time, on
 * a scroll-snap track. It advances on its own every six seconds — but never
 * under reduced motion, never while the pointer or focus is on it, never
 * when the tab is hidden, and never with one slide (model/storefront.ts
 * shouldAutoplay). Two buttons and the dots move it by hand.
 */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [engaged, setEngaged] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const count = banners.length

  const goTo = (next: number) => {
    const el = track.current
    if (!el) return
    const card = el.children[next] as HTMLElement | undefined
    if (!card) return
    el.scrollTo({ left: card.offsetLeft, behavior: reducedMotion ? "auto" : "smooth" })
    setIndex(next)
  }

  // Keep the dots honest when the person drags the track.
  useEffect(() => {
    const el = track.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const width = el.clientWidth || 1
        setIndex(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / width))))
      })
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      el.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [count])

  useEffect(() => {
    if (!shouldAutoplay({ reducedMotion, count, engaged })) return
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      const el = track.current
      if (!el) return
      const next = nextSlide(index, count)
      const card = el.children[next] as HTMLElement | undefined
      if (card) el.scrollTo({ left: card.offsetLeft, behavior: "smooth" })
      setIndex(next)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [reducedMotion, count, engaged, index])

  if (count === 0) return null

  return (
    <section
      className="shop-banners"
      aria-roledescription="carousel"
      aria-label="Offers"
      onMouseEnter={() => setEngaged(true)}
      onMouseLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      onBlur={() => setEngaged(false)}
    >
      <div className="shop-banners__track" ref={track}>
        {banners.map((banner, i) => {
          const copy = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={banner.image} alt="" loading={i === 0 ? "eager" : "lazy"} decoding="async" />
              <span className="shop-banner__copy">
                <span className="shop-banner__title">{banner.title}</span>
                {banner.subtitle ? <span className="shop-banner__subtitle">{banner.subtitle}</span> : null}
              </span>
            </>
          )
          const label = `${i + 1} of ${count}: ${banner.title}`
          return banner.external ? (
            <a key={banner.id} href={banner.href} className="shop-banner" aria-label={label} rel="noopener">{copy}</a>
          ) : (
            <Link key={banner.id} href={banner.href} className="shop-banner" aria-label={label}>{copy}</Link>
          )
        })}
      </div>
      {count > 1 ? (
        <>
          <button type="button" className="shop-banners__nav shop-banners__nav--prev" aria-label="Previous offer" onClick={() => goTo(nextSlide(index, count, -1))}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className="shop-banners__nav shop-banners__nav--next" aria-label="Next offer" onClick={() => goTo(nextSlide(index, count))}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <div className="shop-banners__dots" role="tablist" aria-label="Choose an offer">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Offer ${i + 1}`}
                className={`shop-banners__dot${i === index ? " shop-banners__dot--on" : ""}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}

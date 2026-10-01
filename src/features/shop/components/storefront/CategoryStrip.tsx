"use client"

import Link from "next/link"
import { useEffect, useId, useRef, useState } from "react"
import { Tag, Headphones, Sparkles, BookOpen, Shirt, House, Dumbbell, Coffee, Palette, HeartPulse, Baby, Watch, Car, ChevronLeft, ChevronRight } from "lucide-react"
import { usePrefersReducedMotion } from "../../hooks/storefront"
import { categoryScrollEdges, categoryScrollStep } from "../../model/categoryScroll"
import { browseHref, categoryCountLabel, type CategoryCard } from "../../model/storefront"

const categoryIcon = (name: string) => {
  const word = name.toLowerCase()
  if (word.includes("electronic")) return Headphones
  if (word.includes("beauty")) return Sparkles
  if (word.includes("book")) return BookOpen
  if (word.includes("fashion")) return Shirt
  if (word.includes("home")) return House
  if (word.includes("sport")) return Dumbbell
  if (word.includes("grocery")) return Coffee
  if (word.includes("handicraft")) return Palette
  if (word.includes("health")) return HeartPulse
  if (word.includes("baby") || word.includes("toy")) return Baby
  if (word.includes("jewellery") || word.includes("watch")) return Watch
  if (word.includes("automotive")) return Car
  return Tag
}

function Art({ src, size, name }: { src: string | null; size: number; name: string }) {
  // Seeded categories can point at artwork media-service never received;
  // falling back to the glyph on error keeps the row even.
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
  }
  const Icon = categoryIcon(name)
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />
}

/**
 * The round chips under the search: artwork, name, live count. A category
 * with nothing in it is DIMMED rather than hidden — the strip is the shop's
 * table of contents — and still opens onto a page that says so.
 */
export function CategoryStrip({ categories, active }: { categories: CategoryCard[]; active?: string }) {
  const track = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ previous: false, next: false })
  const reducedMotion = usePrefersReducedMotion()
  const id = useId()
  useEffect(() => {
    const el = track.current
    if (!el) return
    const update = () => setEdges(categoryScrollEdges(el.scrollLeft, el.clientWidth, el.scrollWidth))
    const observer = new ResizeObserver(update)
    observer.observe(el)
    update()
    el.addEventListener("scroll", update, { passive: true })
    return () => { observer.disconnect(); el.removeEventListener("scroll", update) }
  }, [categories.length])
  const move = (direction: number) => {
    const el = track.current
    if (el) el.scrollBy({ left: direction * categoryScrollStep(el.clientWidth), behavior: reducedMotion ? "auto" : "smooth" })
  }
  if (categories.length === 0) return null
  return (
    <nav className="shop-category-nav" aria-label="Shop by category">
      <div className="shop-category-nav__head">
        <h2 className="shop-section__title">Shop by category</h2>
        <div className="shop-category-nav__controls">
          <button type="button" aria-label="Previous categories" aria-controls={id} disabled={!edges.previous} onClick={() => move(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="Next categories" aria-controls={id} disabled={!edges.next} onClick={() => move(1)}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </div>
      <ul ref={track} id={id} className="shop-cats" tabIndex={0} aria-label="Categories; use arrow keys to scroll" onKeyDown={(event) => {
        if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1) }
      }}>
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              href={browseHref({ category: c.id })}
              className={["shop-cat-chip", c.count ? "" : "shop-cat-chip--empty", active === c.id ? "shop-cat-chip--on" : ""].filter(Boolean).join(" ")}
              aria-current={active === c.id ? "page" : undefined}
              aria-label={`${c.name}, ${categoryCountLabel(c.count).toLowerCase()}`}
            >
              <span className="shop-cat-chip__art"><Art src={c.image} size={26} name={c.name} /></span>
              <span className="shop-cat-chip__name">{c.name}</span>
              <span className="shop-cat-chip__count">{categoryCountLabel(c.count)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** "Shop by category": image, name, count; dimmed when the count is 0. */
export function CategoryTiles({ categories }: { categories: CategoryCard[] }) {
  if (categories.length === 0) return null
  return (
    <div className="shop-cat-tiles">
      {categories.map((c) => (
        <Link key={c.id} href={browseHref({ category: c.id })} className={`shop-cat-tile${c.count ? "" : " shop-cat-tile--empty"}`}>
          <span className="shop-cat-tile__art"><Art src={c.image} size={20} name={c.name} /></span>
          <span className="shop-cat-tile__copy">
            <span className="shop-cat-tile__name">{c.name}</span>
            <span className="shop-cat-tile__count">{categoryCountLabel(c.count)}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

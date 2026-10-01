"use client"

import Link from "next/link"
import { useId, useState } from "react"
import { Tag, Headphones, Sparkles, BookOpen, Shirt, House, Dumbbell, Coffee, Palette, HeartPulse, Baby, Watch, Car, ChevronDown } from "lucide-react"
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
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  if (categories.length === 0) return null
  return (
    <nav aria-label="Shop by category">
      <ul id={id} className={`shop-cats${expanded ? " is-expanded" : ""}`}>
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              href={browseHref({ category: c.id })}
              className={["shop-cat-chip", c.count ? "" : "shop-cat-chip--empty", active === c.id ? "shop-cat-chip--on" : ""].filter(Boolean).join(" ")}
              aria-current={active === c.id ? "page" : undefined}
              aria-label={`${c.name}, ${categoryCountLabel(c.count).toLowerCase()}`}
            >
              <span className="shop-cat-chip__art"><Art src={c.image} size={19} name={c.name} /></span>
              <span className="shop-cat-chip__name">{c.name}</span>
              <span className="shop-cat-chip__count">{categoryCountLabel(c.count)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {categories.length > 6 ? <button className="shop-cats__more" type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>{expanded ? "Fewer categories" : "More categories"}<ChevronDown size={15} aria-hidden="true" /></button> : null}
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

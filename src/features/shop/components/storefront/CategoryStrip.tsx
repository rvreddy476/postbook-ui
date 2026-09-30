"use client"

import Link from "next/link"
import { useState } from "react"
import { Tag } from "lucide-react"
import { browseHref, categoryCountLabel, type CategoryCard } from "../../model/storefront"

function Art({ src, size }: { src: string | null; size: number }) {
  // Seeded categories can point at artwork media-service never received;
  // falling back to the glyph on error keeps the row even.
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
  }
  return <Tag size={size} aria-hidden="true" />
}

/**
 * The round chips under the search: artwork, name, live count. A category
 * with nothing in it is DIMMED rather than hidden — the strip is the shop's
 * table of contents — and still opens onto a page that says so.
 */
export function CategoryStrip({ categories, active }: { categories: CategoryCard[]; active?: string }) {
  if (categories.length === 0) return null
  return (
    <nav aria-label="Shop by category">
      <ul className="shop-cats">
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              href={browseHref({ category: c.id })}
              className={["shop-cat-chip", c.count ? "" : "shop-cat-chip--empty", active === c.id ? "shop-cat-chip--on" : ""].filter(Boolean).join(" ")}
              aria-current={active === c.id ? "page" : undefined}
              aria-label={`${c.name}, ${categoryCountLabel(c.count).toLowerCase()}`}
            >
              <span className="shop-cat-chip__art"><Art src={c.image} size={22} /></span>
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
          <span className="shop-cat-tile__art"><Art src={c.image} size={20} /></span>
          <span className="shop-cat-tile__copy">
            <span className="shop-cat-tile__name">{c.name}</span>
            <span className="shop-cat-tile__count">{categoryCountLabel(c.count)}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

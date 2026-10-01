"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { ProductCard as ProductCardData } from "../../model/storefront"
import { ProductCard, ProductCardSkeleton } from "./ProductGrid"
import { shelfColumns } from "./shelfLayout"

/** A paged shelf instead of a clipped horizontal strip. All products remain reachable by touch or keyboard. */
export function ProductShelf({ products, loading }: { products: ProductCardData[]; loading?: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(2)
  const [page, setPage] = useState(0)
  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setColumns(shelfColumns(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const pages = Math.max(1, Math.ceil(products.length / columns))
  const current = Math.min(page, pages - 1)
  const start = current * columns
  return (
    <div ref={container} className="shop-shelf">
      <div className="shop-shelf__grid" style={{ "--shop-columns": columns } as CSSProperties} aria-busy={loading || undefined}>
        {loading ? Array.from({ length: columns }, (_, index) => <ProductCardSkeleton key={index} />) : products.slice(start, start + columns).map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
      {!loading && pages > 1 ? (
        <div className="shop-shelf__controls">
          <span aria-live="polite" aria-atomic="true">{start + 1}–{Math.min(start + columns, products.length)} of {products.length}</span>
          <button type="button" aria-label="Previous products" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="Next products" disabled={current === pages - 1} onClick={() => setPage(current + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      ) : null}
    </div>
  )
}

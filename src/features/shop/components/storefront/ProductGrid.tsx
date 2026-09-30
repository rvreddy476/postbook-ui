"use client"

import Link from "next/link"
import { Star } from "lucide-react"
import { SHOP_BASE, type ProductCard as ProductCardData } from "../../model/storefront"
import { FavouriteButton } from "../favourites/FavouriteButton"
import { ProductPhoto } from "./ProductPhoto"

/** One card: photo, seller, title, rating, price. The price is the only bold thing. */
export function ProductCard({ product }: { product: ProductCardData }) {
  const lowStock = product.inStock && product.stock !== null && product.stock > 0 && product.stock <= 5
  const badge = !product.inStock
    ? <span className="shop-photo__badge shop-photo__badge--out">Sold out</span>
    : product.discountPct
      ? <span className="shop-photo__badge">{product.discountPct}% off</span>
      : null
  return (
    <article className="shop-card">
      <Link href={`${SHOP_BASE}/products/${encodeURIComponent(product.id)}`} className="shop-card__link">
        <ProductPhoto src={product.image} alt={product.title} badge={badge} />
        <div className="shop-card__body">
          {product.seller ? <span className="shop-card__seller">{product.seller}</span> : null}
          <h3 className="shop-card__title">{product.title}</h3>
          {product.rating !== null ? (
            <span className="shop-card__meta">
              <Star size={12} aria-hidden="true" fill="currentColor" />
              <span>{product.rating.toFixed(1)}</span>
              <span>({product.reviewCount})</span>
            </span>
          ) : null}
          <div className="shop-card__price">
            <span className="shop-card__amount">{product.price}</span>
            {product.was ? <s className="shop-card__was">{product.was}</s> : null}
            {product.discountPct && product.was ? <span className="shop-card__off">{product.discountPct}% off</span> : null}
          </div>
          {!product.inStock ? (
            <span className="shop-card__stock shop-card__stock--out">Out of stock</span>
          ) : lowStock ? (
            <span className="shop-card__stock shop-card__stock--low">Only {product.stock} left</span>
          ) : null}
        </div>
      </Link>
      <FavouriteButton product={product} className="shop-card__fav" />
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="shop-card" aria-hidden="true">
      <div className="shop-skeleton" style={{ aspectRatio: "1 / 1", borderRadius: 0 }} />
      <div className="shop-card__body">
        <div className="shop-skeleton" style={{ height: 10, width: "40%" }} />
        <div className="shop-skeleton" style={{ height: 13, marginTop: 6 }} />
        <div className="shop-skeleton" style={{ height: 13, width: "70%", marginTop: 4 }} />
        <div className="shop-skeleton" style={{ height: 14, width: "45%", marginTop: 10 }} />
      </div>
    </div>
  )
}

export interface ProductGridProps {
  products: ProductCardData[]
  isLoading?: boolean
  /** `grid` wraps 2-up on phone and 4-up on desktop; `rail` is one snap-scrolling row. Same card either way. */
  layout?: "grid" | "rail"
  /** Rendered when there is nothing to show and nothing loading. */
  empty?: React.ReactNode
  /** Extra skeleton cards while the next page loads. */
  loadingMore?: boolean
}

export function ProductGrid({ products, isLoading, layout = "grid", empty, loadingMore }: ProductGridProps) {
  const wrapper = layout === "rail" ? "shop-rail" : "shop-grid"
  if (isLoading) {
    return (
      <div className={wrapper} aria-busy="true">
        {Array.from({ length: layout === "rail" ? 5 : 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
      </div>
    )
  }
  if (products.length === 0) return <>{empty ?? null}</>
  return (
    <div className={wrapper}>
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
      {loadingMore ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={`more-${i}`} />) : null}
    </div>
  )
}

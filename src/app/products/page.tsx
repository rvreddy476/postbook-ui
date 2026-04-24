'use client'

import { useState } from 'react'
import { useCategories, useSellerProducts, type Product } from '@/hooks/useCommerce'
import { ProductGrid, type ProductCardData } from '@/components/commerce/ProductGrid'

function toCardData(p: Product): ProductCardData {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    short_description: p.short_description,
  }
}

export default function ProductBrowsePage() {
  const { data: categories } = useCategories()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sellerFilter, setSellerFilter] = useState<string>('')

  // Without a /v1/commerce/products endpoint, browse is scoped to a seller
  // chosen via query string or typed in. Category chips act as a hint for filtering.
  const { data: sellerProducts, isLoading } = useSellerProducts(sellerFilter || undefined)

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Shop</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 rounded-full text-sm border ${
            selectedCategory === null
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'border-gray-300 text-gray-700 hover:border-indigo-300'
          }`}
        >
          All
        </button>
        {(categories ?? []).map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3 py-1 rounded-full text-sm border ${
              selectedCategory === c.id
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-300 text-gray-700 hover:border-indigo-300'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <input
          placeholder="Filter by seller ID (temporary — browse-by-category coming)"
          value={sellerFilter}
          onChange={(e) => setSellerFilter(e.target.value)}
          className="w-full max-w-md border rounded px-3 py-2 text-sm"
        />
      </div>

      <ProductGrid
        products={(sellerProducts ?? []).map(toCardData)}
        isLoading={isLoading}
        emptyLabel={sellerFilter ? 'No products from this seller' : 'Enter a seller ID to browse their products'}
      />
    </div>
  )
}

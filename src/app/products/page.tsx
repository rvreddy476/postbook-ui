'use client'

import { useState } from 'react'
import { useCategories, useProducts, type Product } from '@/hooks/useCommerce'
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
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [submittedQuery, setSubmittedQuery] = useState<string>('')

  const { data, isLoading } = useProducts({
    category: selectedCategory ?? undefined,
    q: submittedQuery || undefined,
  })
  const products = data?.items ?? []
  const total = data?.total ?? 0

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

      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmittedQuery(searchQuery.trim())
        }}
      >
        <input
          placeholder="Search products"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 max-w-md border rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          Search
        </button>
        {submittedQuery ? (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setSubmittedQuery('')
            }}
            className="px-3 py-2 rounded text-sm text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
        ) : null}
      </form>

      {!isLoading && total > 0 ? (
        <div className="mb-3 text-sm text-gray-500">
          {total} product{total === 1 ? '' : 's'}
          {selectedCategory ? ` in ${categories?.find((c) => c.id === selectedCategory)?.name ?? 'category'}` : ''}
          {submittedQuery ? ` matching "${submittedQuery}"` : ''}
        </div>
      ) : null}

      <ProductGrid
        products={products.map(toCardData)}
        isLoading={isLoading}
        emptyLabel={
          submittedQuery
            ? `No products match "${submittedQuery}"`
            : selectedCategory
              ? 'No products in this category yet'
              : 'No products available yet'
        }
      />
    </div>
  )
}

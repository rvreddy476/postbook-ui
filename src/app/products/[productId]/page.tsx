'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import {
  useProduct, useProductReviews, useAddToCart,
  type ProductVariant,
} from '@/hooks/useCommerce'
import { StarRating } from '@/components/ui/StarRating'

export default function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params)
  const { data, isLoading } = useProduct(productId)
  const { data: reviewsData } = useProductReviews(productId)
  const addToCart = useAddToCart()
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)

  if (isLoading) return <div className="p-8">Loading product…</div>
  if (!data?.product) return <div className="p-8 text-red-600">Product not found</div>

  const { product, variants } = data
  const activeVariants = variants.filter((v) => v.status === 'active')
  const selected: ProductVariant | undefined =
    activeVariants.find((v) => v.id === selectedVariantId) ?? activeVariants[0]

  const reviews = reviewsData?.reviews ?? []
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0

  const onAdd = async () => {
    if (!selected) return
    await addToCart.mutateAsync({ variant_id: selected.id, quantity: qty })
  }

  return (
    <div className="mx-auto max-w-6xl p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="aspect-square rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
        No image
      </div>

      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{product.title}</h1>
          {product.short_description ? (
            <p className="text-gray-600 mt-1">{product.short_description}</p>
          ) : null}
        </div>

        {reviews.length > 0 ? (
          <div className="flex items-center gap-2 text-sm">
            <StarRating value={Math.round(avgRating)} />
            <span className="text-gray-600">
              {avgRating.toFixed(1)} ({reviews.length} review{reviews.length === 1 ? '' : 's'})
            </span>
          </div>
        ) : null}

        {selected ? (
          <div>
            <div className="text-2xl font-semibold">
              {selected.currency_code} {selected.selling_price.toFixed(2)}
            </div>
            {selected.mrp > selected.selling_price ? (
              <div className="text-sm text-gray-500 line-through">
                {selected.currency_code} {selected.mrp.toFixed(2)}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeVariants.length > 1 ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">Variant</div>
            <div className="flex flex-wrap gap-2">
              {activeVariants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariantId(v.id)}
                  className={`px-3 py-1.5 rounded border text-sm ${
                    selected?.id === v.id
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-300 hover:border-indigo-300'
                  }`}
                >
                  {v.option_1_value ?? v.sku}
                  {v.option_2_value ? ` / ${v.option_2_value}` : ''}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <label className="text-sm">Qty</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 border rounded px-3 py-1.5 text-sm"
          />
        </div>

        <button
          onClick={onAdd}
          disabled={!selected || addToCart.isPending}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300"
        >
          {addToCart.isPending ? 'Adding…' : 'Add to cart'}
        </button>

        {product.description ? (
          <div className="pt-4 border-t">
            <h2 className="text-sm font-semibold mb-2">Description</h2>
            <p className="text-sm text-gray-700 whitespace-pre-line">{product.description}</p>
          </div>
        ) : null}
      </div>

      <section className="md:col-span-2 border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-gray-500">No reviews yet. Buy and receive this item to leave one.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <StarRating value={r.rating} size="sm" />
                  {r.is_verified_purchase ? (
                    <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      Verified purchase
                    </span>
                  ) : null}
                </div>
                {r.title ? <div className="font-medium text-sm">{r.title}</div> : null}
                {r.body ? <p className="text-sm text-gray-700 mt-1">{r.body}</p> : null}
                <div className="text-xs text-gray-400 mt-2">
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Link href="/orders" className="text-indigo-600 text-sm hover:underline">
            Reviewed an order here? → Go to orders
          </Link>
        </div>
      </section>
    </div>
  )
}

'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useOrderWithItems, useCreateReview, type OrderItem } from '@/hooks/useCommerce'
import { StarRating } from '@/components/ui/StarRating'

export default function WriteReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data, isLoading } = useOrderWithItems(id)
  const createReview = useCreateReview()

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  if (isLoading) return <div className="p-8">Loading order…</div>
  if (!data) return <div className="p-8 text-red-600">Order not found</div>

  const delivered = (data.items ?? []).filter((it: OrderItem) => it.status === 'delivered' || it.delivered_at)
  const selected = delivered.find((i) => i.id === selectedItemId) ?? delivered[0]

  const submit = async () => {
    if (!selected) return
    await createReview.mutateAsync({
      product_id: selected.product_id,
      seller_id: selected.seller_id,
      order_item_id: selected.id,
      rating,
      title: title || undefined,
      body: body || undefined,
    })
    router.push(`/products/${selected.product_id}`)
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href={`/orders/${id}`} className="text-sm text-gray-500 hover:text-indigo-600">
        ← Back to order
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">Write a review</h1>

      {delivered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-600">
          Only delivered items can be reviewed. Come back once your order arrives.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold mb-3">Which item?</h2>
            <div className="space-y-2">
              {delivered.map((it) => (
                <label
                  key={it.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                    selected?.id === it.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    checked={selected?.id === it.id}
                    onChange={() => setSelectedItemId(it.id)}
                  />
                  <div className="text-sm">
                    <div className="font-medium">{it.product_title}</div>
                    <div className="text-gray-500">SKU {it.sku} · Qty {it.quantity}</div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <div>
              <div className="text-sm font-semibold mb-2">Your rating</div>
              <StarRating value={rating} onChange={setRating} size="lg" />
            </div>
            <input
              placeholder="Summary (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <textarea
              placeholder="What did you like or not like?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </section>

          <button
            disabled={!selected || createReview.isPending}
            onClick={submit}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300"
          >
            {createReview.isPending ? 'Posting…' : 'Post review'}
          </button>

          {createReview.error ? (
            <div className="text-sm text-red-600">{(createReview.error as Error).message}</div>
          ) : null}
        </div>
      )}
    </div>
  )
}

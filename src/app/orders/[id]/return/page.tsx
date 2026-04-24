'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useOrderWithItems, useCreateReturn, type OrderItem } from '@/hooks/useCommerce'

const REASON_CODES = [
  { code: 'defective', label: 'Item arrived damaged or defective' },
  { code: 'wrong_item', label: 'Received wrong item' },
  { code: 'not_as_described', label: 'Not as described' },
  { code: 'quality', label: 'Quality below expectations' },
  { code: 'size', label: "Size / fit doesn't work" },
  { code: 'changed_mind', label: 'Changed my mind' },
]

export default function ReturnRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data, isLoading } = useOrderWithItems(id)
  const createReturn = useCreateReturn()

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [reasonCode, setReasonCode] = useState<string>(REASON_CODES[0].code)
  const [description, setDescription] = useState('')

  if (isLoading) return <div className="p-8">Loading order…</div>
  if (!data) return <div className="p-8 text-red-600">Order not found</div>

  const eligible = (data.items ?? []).filter((it: OrderItem) => {
    if (!it.return_eligible_until) return false
    return new Date(it.return_eligible_until).getTime() > Date.now()
  })

  const selected = eligible.find((i) => i.id === selectedItemId) ?? eligible[0]

  const submit = async () => {
    if (!selected) return
    await createReturn.mutateAsync({
      order_id: id,
      order_item_id: selected.id,
      seller_id: selected.seller_id,
      reason_code: reasonCode,
      reason_description: description || undefined,
    })
    router.push(`/orders/${id}`)
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href={`/orders/${id}`} className="text-sm text-gray-500 hover:text-indigo-600">
        ← Back to order
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-6">Request a return</h1>

      {eligible.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-600">
          No items in this order are currently eligible for return.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold mb-3">Which item?</h2>
            <div className="space-y-2">
              {eligible.map((it) => (
                <label
                  key={it.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                    selected?.id === it.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="item"
                    checked={selected?.id === it.id}
                    onChange={() => setSelectedItemId(it.id)}
                  />
                  <div className="text-sm">
                    <div className="font-medium">{it.product_title}</div>
                    <div className="text-gray-500">
                      SKU {it.sku} · Qty {it.quantity} · ₹{it.final_price.toFixed(2)}
                    </div>
                    {it.return_eligible_until ? (
                      <div className="text-xs text-gray-400">
                        Returnable until {new Date(it.return_eligible_until).toLocaleDateString()}
                      </div>
                    ) : null}
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold mb-3">Reason</h2>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {REASON_CODES.map((r) => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
            <textarea
              placeholder="Tell us more (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full mt-3 border rounded px-3 py-2 text-sm"
            />
          </section>

          <button
            disabled={!selected || createReturn.isPending}
            onClick={submit}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300"
          >
            {createReturn.isPending ? 'Submitting…' : 'Submit return request'}
          </button>

          {createReturn.error ? (
            <div className="text-sm text-red-600">{(createReturn.error as Error).message}</div>
          ) : null}
        </div>
      )}
    </div>
  )
}

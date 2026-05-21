'use client'

import { useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useSellerRFQs,
  useRFQ,
  useSendRFQQuote,
} from '@/hooks/useCommerce'

const STATUS_COLOR: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-800',
  quoted: 'bg-blue-100 text-blue-800',
  accepted: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
}

const TABS = [
  { value: 'requested', label: 'New' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'accepted', label: 'Accepted' },
  { value: '', label: 'All' },
]

function QuoteForm({ rfqId, onClose }: { rfqId: string; onClose: () => void }) {
  const { data } = useRFQ(rfqId)
  const send = useSendRFQQuote()
  const [validityDays, setValidityDays] = useState(7)
  const [unitPrices, setUnitPrices] = useState<Record<string, string>>({})

  if (!data) return null

  const handleSend = () => {
    const linePrices = data.items.map((it) => ({
      rfq_item_id: it.id,
      unit_price: parseFloat(unitPrices[it.id] || '0'),
    }))
    if (linePrices.some((lp) => !(lp.unit_price > 0))) return
    send.mutate(
      { rfqId, validityDays, linePrices },
      { onSuccess: () => onClose() }
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-3">
      <h3 className="text-xs font-black uppercase tracking-widest text-amber-800 mb-3">
        Send a quote
      </h3>
      <table className="w-full text-xs mb-3">
        <thead>
          <tr className="text-left text-[#6B5544]">
            <th>Variant</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Unit price (₹)</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it) => (
            <tr key={it.id}>
              <td className="font-mono">{it.variant_id.slice(0, 8)}…</td>
              <td className="text-right">{it.quantity}</td>
              <td className="text-right">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={unitPrices[it.id] ?? ''}
                  onChange={(e) =>
                    setUnitPrices((u) => ({ ...u, [it.id]: e.target.value }))
                  }
                  className="w-24 border border-amber-300 rounded px-2 py-1 text-right"
                  placeholder="0.00"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <label className="block text-xs font-medium text-[#6B5544] mb-1">
        Quote valid for (days)
      </label>
      <input
        type="number"
        min="1"
        max="90"
        value={validityDays}
        onChange={(e) => setValidityDays(parseInt(e.target.value, 10) || 7)}
        className="w-24 border border-amber-300 rounded px-2 py-1 text-sm"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSend}
          disabled={send.isPending}
          className="px-4 py-2 bg-amber-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-amber-800 disabled:opacity-50"
        >
          {send.isPending ? 'Sending…' : 'Send quote'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#6B5544] hover:text-[#1A1A1A]"
        >
          Cancel
        </button>
      </div>
      {send.error && (
        <p className="text-xs text-red-600 mt-2">{(send.error as Error).message}</p>
      )}
    </div>
  )
}

export default function SellerRFQInboxPage() {
  const [status, setStatus] = useState('requested')
  const { data } = useSellerRFQs(status)
  const rfqs = data?.rfqs ?? []
  const [activeRFQ, setActiveRFQ] = useState<string | null>(null)

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/seller/dashboard" className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] hover:text-[#1A1A1A]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-black text-[#1A1A1A]">RFQ Inbox</h1>
          <p className="text-sm text-[#6B5544] mt-1">
            Buyers requesting custom quotes. Send a per-line price to convert into an order.
          </p>

          <div className="flex items-center gap-2 my-4 overflow-x-auto pb-2">
            {TABS.map((t) => (
              <button
                key={t.value || 'all'}
                onClick={() => setStatus(t.value)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap ${
                  status === t.value
                    ? 'bg-[#1A1A1A] text-white'
                    : 'bg-white border border-[#E8DDD3] text-[#4A3728] hover:bg-[#F5F0EB]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {rfqs.length === 0 ? (
            <p className="p-6 bg-white rounded-2xl border border-[#E8DDD3] text-sm text-[#6B5544]">
              Nothing in this bucket.
            </p>
          ) : (
            <div className="space-y-3">
              {rfqs.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-[#E8DDD3] bg-white p-5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-[#6B5544]">
                        From buyer{' '}
                        <span className="font-mono">{r.buyer_user_id.slice(0, 8)}…</span>
                        {r.organization_id && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                            ORG
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6B5544] mt-0.5">
                        Requested {new Date(r.requested_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        STATUS_COLOR[r.status] ?? 'bg-gray-100'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  {r.message_text && (
                    <p className="mt-2 text-sm text-[#1A1A1A] whitespace-pre-line">
                      {r.message_text}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    {r.status === 'requested' || r.status === 'quoted' ? (
                      <button
                        onClick={() => setActiveRFQ(activeRFQ === r.id ? null : r.id)}
                        className="px-4 py-1.5 bg-amber-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-amber-700"
                      >
                        {activeRFQ === r.id ? 'Hide quote form' : 'Send quote'}
                      </button>
                    ) : null}
                    <Link
                      href={`/rfq/${r.id}`}
                      className="px-4 py-1.5 border border-[#E8DDD3] text-[#4A3728] text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-[#F5F0EB]"
                    >
                      Open
                    </Link>
                  </div>
                  {activeRFQ === r.id && (
                    <QuoteForm rfqId={r.id} onClose={() => setActiveRFQ(null)} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

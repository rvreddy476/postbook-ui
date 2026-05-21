'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useRFQ,
  useAcceptRFQQuote,
  useRejectRFQ,
  useAddresses,
} from '@/hooks/useCommerce'

export default function RFQDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data, isLoading } = useRFQ(id)
  const { data: addresses } = useAddresses()
  const accept = useAcceptRFQQuote()
  const reject = useRejectRFQ()

  const [selectedAddr, setSelectedAddr] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'prepaid' | 'cod' | 'credit'>('prepaid')

  if (isLoading) {
    return (
      <AppShell activeTab="Shop">
        <div className="p-8 text-sm text-[#6B5544]">Loading RFQ…</div>
      </AppShell>
    )
  }
  if (!data) {
    return (
      <AppShell activeTab="Shop">
        <div className="p-8 text-sm text-red-600">RFQ not found</div>
      </AppShell>
    )
  }

  const { rfq, items, quotes } = data
  const liveQuote = quotes.find((q) => !q.accepted_at) ?? quotes[0]
  const addrList = addresses ?? []
  const defaultAddr = addrList.find((a) => a.is_default) ?? addrList[0]
  const useAddr = selectedAddr || defaultAddr?.id || ''
  const canAccept =
    rfq.status === 'quoted' && liveQuote && !liveQuote.accepted_at && useAddr

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          <Link href="/rfq" className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] hover:text-[#1A1A1A]">
            ← My RFQs
          </Link>
          <h1 className="text-2xl font-black text-[#1A1A1A]">RFQ {rfq.id.slice(0, 8)}…</h1>
          <p className="text-sm text-[#6B5544]">
            Status: <span className="font-bold">{rfq.status}</span> · Expires{' '}
            {new Date(rfq.expires_at).toLocaleDateString()}
          </p>

          {rfq.message_text && (
            <section className="bg-white rounded-xl border border-[#E8DDD3] p-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#6B5544] mb-2">
                Your message
              </h2>
              <p className="text-sm whitespace-pre-line">{rfq.message_text}</p>
            </section>
          )}

          <section className="bg-white rounded-xl border border-[#E8DDD3] p-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#6B5544] mb-2">
              Items requested
            </h2>
            <ul className="text-sm space-y-1">
              {items.map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span className="font-mono text-xs">{it.variant_id.slice(0, 8)}…</span>
                  <span>qty {it.quantity}</span>
                </li>
              ))}
            </ul>
          </section>

          {liveQuote ? (
            <section className="bg-white rounded-xl border border-emerald-200 p-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-2">
                Seller's quote
              </h2>
              <p className="text-2xl font-black text-[#1A1A1A]">
                ₹{liveQuote.quoted_total.toFixed(2)}
              </p>
              <p className="text-xs text-[#6B5544]">
                Valid until {new Date(liveQuote.expires_at).toLocaleString()}
              </p>
              <table className="w-full text-xs mt-3">
                <thead>
                  <tr className="text-left text-[#6B5544]">
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {liveQuote.line_prices.map((lp) => (
                    <tr key={lp.rfq_item_id}>
                      <td className="font-mono">{lp.variant_id.slice(0, 8)}…</td>
                      <td className="text-right">{lp.quantity}</td>
                      <td className="text-right font-mono">₹{lp.unit_price.toFixed(2)}</td>
                      <td className="text-right font-mono">₹{lp.line_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {rfq.status === 'quoted' && (
                <div className="mt-4 pt-4 border-t border-emerald-100 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#6B5544] mb-1">
                      Ship to
                    </label>
                    <select
                      value={useAddr}
                      onChange={(e) => setSelectedAddr(e.target.value)}
                      className="w-full border border-[#E8DDD3] rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">— Pick an address —</option>
                      {addrList.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.contact_name} · {a.city}, {a.postal_code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B5544] mb-1">
                      Payment
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) =>
                        setPaymentMethod(e.target.value as 'prepaid' | 'cod' | 'credit')
                      }
                      className="w-full border border-[#E8DDD3] rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="prepaid">Pay online (Razorpay)</option>
                      <option value="cod">Cash on Delivery</option>
                      {rfq.organization_id && <option value="credit">Pay on invoice (Net N)</option>}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        accept.mutate({
                          rfqId: rfq.id,
                          quoteId: liveQuote.id,
                          addressId: useAddr,
                          paymentMethod,
                        })
                      }
                      disabled={!canAccept || accept.isPending}
                      className="flex-1 px-5 py-3 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {accept.isPending ? 'Accepting…' : 'Accept & Place Order'}
                    </button>
                    <button
                      onClick={() => {
                        const reason = window.prompt('Reason for rejection (optional):') ?? ''
                        reject.mutate({ rfqId: rfq.id, reason })
                      }}
                      className="px-5 py-3 border border-red-300 text-red-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </div>
                  {accept.isSuccess && (
                    <p className="text-xs text-emerald-700">
                      Order created. Redirect to /orders/[id] in your UI flow.
                    </p>
                  )}
                  {accept.error && (
                    <p className="text-xs text-red-600">{(accept.error as Error).message}</p>
                  )}
                </div>
              )}
            </section>
          ) : (
            <section className="bg-white rounded-xl border border-[#E8DDD3] p-4">
              <p className="text-sm text-[#6B5544]">
                Waiting for the seller to send a quote. RFQs expire automatically after the window
                closes.
              </p>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  )
}

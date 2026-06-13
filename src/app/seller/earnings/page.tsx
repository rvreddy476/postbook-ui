'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useSellerEarnings, useSellerCODRemittances } from '@/hooks/useCommerce'

type LedgerRow = {
  date: string | null | undefined
  source: 'prepaid' | 'cod'
  reference: string // order number or shipment id slice
  product?: string
  sku?: string
  gross: number
  commission: number
  fee: number
  tds: number
  net: number
  status: string
  paymentMethod: string
}

function statusPill(s: string) {
  if (s === 'settled' || s === 'delivered')
    return 'bg-emerald-100 text-emerald-700'
  if (s === 'pending') return 'bg-amber-100 text-amber-800'
  return 'bg-gray-100 text-gray-700'
}

export default function SellerEarningsPage() {
  const { data: earningsData, isLoading: loadingPrepaid } = useSellerEarnings(50, 0)
  const { data: codData, isLoading: loadingCod } = useSellerCODRemittances()

  const rows: LedgerRow[] = useMemo(() => {
    const prepaid: LedgerRow[] =
      earningsData?.earnings.map((e) => ({
        date: e.delivered_at,
        source: 'prepaid',
        reference: e.order_number,
        product: e.product_title,
        sku: e.sku,
        gross: e.gross_amount,
        commission: e.commission_amount,
        fee: e.platform_fee,
        tds: e.tds_amount,
        net: e.net_amount,
        status: e.status,
        paymentMethod: e.payment_method ?? 'prepaid',
      })) ?? []
    const cod: LedgerRow[] =
      codData?.items.map((r) => ({
        date: r.delivered_at,
        source: 'cod',
        reference: r.shipment_id.slice(0, 8) + '…',
        gross: r.gross_amount,
        commission: r.commission_amount,
        fee: r.platform_fee,
        tds: r.tds_amount,
        net: r.net_amount,
        status: r.status,
        paymentMethod: 'cod',
      })) ?? []
    return [...prepaid, ...cod].sort((a, b) => {
      const da = a.date ? Date.parse(a.date) : 0
      const db = b.date ? Date.parse(b.date) : 0
      return db - da
    })
  }, [earningsData, codData])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        gross: acc.gross + r.gross,
        commission: acc.commission + r.commission,
        fee: acc.fee + r.fee,
        tds: acc.tds + r.tds,
        net: acc.net + r.net,
      }),
      { gross: 0, commission: 0, fee: 0, tds: 0, net: 0 }
    )
  }, [rows])

  const [tab, setTab] = useState<'all' | 'prepaid' | 'cod'>('all')
  const filtered = tab === 'all' ? rows : rows.filter((r) => r.source === tab)
  const loading = loadingPrepaid || loadingCod

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Link
            href="/seller/dashboard"
            className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] hover:text-[#1A1A1A] transition mb-1 block"
          >
            ← Dashboard
          </Link>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-[#1A1A1A]">Earnings</h1>
              <p className="text-sm text-[#6B5544] mt-1">
                Per-order breakdown of gross, commission, platform fee, TDS, and net payout.
              </p>
            </div>
            <a
              href="/api/v1/commerce/seller/earnings.csv"
              className="px-4 py-2 border border-[#E8DDD3] rounded-lg text-xs font-bold uppercase tracking-wider text-[#4A3728] hover:bg-white transition"
            >
              Download CSV
            </a>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <TotalsCard label="Gross" value={totals.gross} />
            <TotalsCard label="Commission" value={-totals.commission} />
            <TotalsCard label="Platform fee" value={-totals.fee} />
            <TotalsCard label="TDS" value={-totals.tds} />
            <TotalsCard label="Net" value={totals.net} accent />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-4">
            {(['all', 'prepaid', 'cod'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition ${
                  tab === t
                    ? 'bg-[#1A1A1A] text-white'
                    : 'bg-white border border-[#E8DDD3] text-[#4A3728] hover:bg-[#F5F0EB]'
                }`}
              >
                {t === 'all' ? 'All' : t === 'prepaid' ? 'Prepaid (Razorpay)' : 'COD'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-sm text-[#6B5544]">Loading earnings…</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DDD3] p-12 text-center">
              <p className="text-sm text-[#6B5544]">No entries yet for this tab.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DDD3] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F5F0EB] border-b border-[#E8DDD3] text-left">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Date
                    </th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Source
                    </th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Reference
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Gross
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Commission
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Fee
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      TDS
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Net
                    </th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DDD3]">
                  {filtered.map((r, i) => (
                    <tr key={`${r.source}-${r.reference}-${i}`}>
                      <td className="px-4 py-2 text-xs text-[#6B5544]">
                        {r.date ? new Date(r.date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <span className="font-medium text-[#1A1A1A]">{r.source}</span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium text-[#1A1A1A]">{r.reference}</div>
                        {r.product && (
                          <div className="text-xs text-[#6B5544] truncate max-w-[20ch]">
                            {r.product}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">₹{r.gross.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono text-red-600">
                        -₹{r.commission.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-red-600">
                        -₹{r.fee.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-red-600">
                        -₹{r.tds.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold">
                        ₹{r.net.toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusPill(r.status)}`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function TotalsCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-4 ${accent ? 'bg-[#1A1A1A] text-white' : 'bg-white border border-[#E8DDD3]'}`}
    >
      <div
        className={`text-[10px] font-black uppercase tracking-widest ${accent ? 'text-white/60' : 'text-[#6B5544]'}`}
      >
        {label}
      </div>
      <div className={`text-lg font-bold ${accent ? 'text-white' : 'text-[#1A1A1A]'}`}>
        {value < 0 ? '-' : ''}₹{Math.abs(value).toFixed(2)}
      </div>
    </div>
  )
}

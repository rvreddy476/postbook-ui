'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

const ADMIN_HEADERS = { 'X-Scopes': 'admin superadmin' } as const

type PendingPayoutSummary = {
  seller_id: string
  store_name: string
  email: string
  remittance_count: number
  total_gross: number
  total_commission: number
  total_platform_fee: number
  total_tds: number
  total_net: number
  oldest_delivered: string
}

function daysSince(date: string): number {
  const ms = Date.now() - Date.parse(date)
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function ageBadge(days: number) {
  if (days <= 7) return 'bg-emerald-100 text-emerald-700'
  if (days <= 14) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-700'
}

export default function AdminPayoutReconciliationPage() {
  const { data, isLoading, error } = useQuery<{ sellers: PendingPayoutSummary[] }>({
    queryKey: ['admin', 'commerce', 'payouts', 'pending'],
    queryFn: async () =>
      (await api.get('/v1/commerce/internal/payouts/pending', { headers: ADMIN_HEADERS })).data.data,
  })

  const sellers = data?.sellers ?? []
  const totals = sellers.reduce(
    (acc, s) => ({
      gross: acc.gross + s.total_gross,
      net: acc.net + s.total_net,
      remittances: acc.remittances + s.remittance_count,
    }),
    { gross: 0, net: 0, remittances: 0 }
  )

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Payout Reconciliation</h1>
      <p className="mt-1 text-sm text-gray-600">
        Sellers with outstanding (unsettled) COD remittances. Oldest delivered first — anything over
        14 days is overdue and should be settled in the next payout batch.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <SummaryCard label="Sellers awaiting" value={sellers.length.toString()} />
        <SummaryCard label="Open remittances" value={totals.remittances.toString()} />
        <SummaryCard
          label="Net to disburse"
          value={`₹${totals.net.toFixed(2)}`}
          accent
        />
      </div>

      {isLoading ? (
        <div className="mt-8 text-sm text-gray-500">Loading reconciliation queue…</div>
      ) : error ? (
        <div className="mt-8 text-sm text-red-600">{(error as Error).message}</div>
      ) : sellers.length === 0 ? (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Nothing pending — all COD remittances are settled.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3 text-right">Count</th>
                <th className="px-4 py-3 text-right">Gross</th>
                <th className="px-4 py-3 text-right">Commission</th>
                <th className="px-4 py-3 text-right">Fee</th>
                <th className="px-4 py-3 text-right">TDS</th>
                <th className="px-4 py-3 text-right">Net Owed</th>
                <th className="px-4 py-3">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sellers.map((s) => {
                const days = daysSince(s.oldest_delivered)
                return (
                  <tr key={s.seller_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{s.store_name || '—'}</div>
                      <div className="text-xs text-gray-500">{s.email || s.seller_id.slice(0, 8) + '…'}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{s.remittance_count}</td>
                    <td className="px-4 py-3 text-right font-mono">₹{s.total_gross.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">
                      -₹{s.total_commission.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">
                      -₹{s.total_platform_fee.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">
                      -₹{s.total_tds.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      ₹{s.total_net.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ageBadge(days)}`}
                      >
                        {days}d
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500">
        Settlement happens via an Ops job that creates a payout batch and stamps each remittance as
        settled. Wire that job to read this same query for parity.
      </p>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-4 ${accent ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200'}`}
    >
      <div className={`text-xs uppercase tracking-wider ${accent ? 'text-white/60' : 'text-gray-500'}`}>
        {label}
      </div>
      <div className={`text-lg font-bold ${accent ? 'text-white' : 'text-gray-900'}`}>{value}</div>
    </div>
  )
}

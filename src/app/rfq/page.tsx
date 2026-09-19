'use client'

import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useMyRFQs } from '@/hooks/useCommerce'

const STATUS_COLOR: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-800',
  quoted: 'bg-blue-100 text-blue-800',
  accepted: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
}

export default function MyRFQsPage() {
  const { data, isLoading } = useMyRFQs()
  const rfqs = data?.rfqs ?? []

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-secondary">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-black text-foreground">My Requests for Quote</h1>
          <p className="text-sm text-muted-foreground mt-1">
            RFQs you've sent to sellers. Quotes show up here once the seller responds; accept one
            to convert it into an order.
          </p>

          {isLoading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          ) : rfqs.length === 0 ? (
            <div className="mt-6 bg-white rounded-2xl border border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No RFQs yet. Start one from any product page — the "Request a quote" button on a
                seller's product opens this flow.
              </p>
            </div>
          ) : (
            <div className="mt-6 bg-white rounded-2xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left">
                  <tr>
                    <th className="px-4 py-2 text-[10px] font-black tracking-widest text-muted-foreground">
                      Requested
                    </th>
                    <th className="px-4 py-2 text-[10px] font-black tracking-widest text-muted-foreground">
                      Seller
                    </th>
                    <th className="px-4 py-2 text-[10px] font-black tracking-widest text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-2 text-[10px] font-black tracking-widest text-muted-foreground">
                      Expires
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DDD3]">
                  {rfqs.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">
                        <Link
                          href={`/rfq/${r.id}`}
                          className="text-foreground hover:text-primary-ink font-medium"
                        >
                          {new Date(r.requested_at).toLocaleString()}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {r.seller_id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                            STATUS_COLOR[r.status] ?? 'bg-gray-100'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(r.expires_at).toLocaleDateString()}
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

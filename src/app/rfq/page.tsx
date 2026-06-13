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
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-black text-[#1A1A1A]">My Requests for Quote</h1>
          <p className="text-sm text-[#6B5544] mt-1">
            RFQs you've sent to sellers. Quotes show up here once the seller responds; accept one
            to convert it into an order.
          </p>

          {isLoading ? (
            <p className="mt-6 text-sm text-[#6B5544]">Loading…</p>
          ) : rfqs.length === 0 ? (
            <div className="mt-6 bg-white rounded-2xl border border-[#E8DDD3] p-12 text-center">
              <p className="text-sm text-[#6B5544]">
                No RFQs yet. Start one from any product page — the "Request a quote" button on a
                seller's product opens this flow.
              </p>
            </div>
          ) : (
            <div className="mt-6 bg-white rounded-2xl border border-[#E8DDD3] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F5F0EB] text-left">
                  <tr>
                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Requested
                    </th>
                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Seller
                    </th>
                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                      Status
                    </th>
                    <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
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
                          className="text-[#1A1A1A] hover:text-[#8B5E3C] font-medium"
                        >
                          {new Date(r.requested_at).toLocaleString()}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-[#6B5544]">
                        {r.seller_id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            STATUS_COLOR[r.status] ?? 'bg-gray-100'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-[#6B5544]">
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

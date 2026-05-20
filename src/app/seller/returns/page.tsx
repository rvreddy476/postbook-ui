'use client'

import { useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useSellerReturns,
  useApproveReturn,
  useRejectReturn,
  useReturnRefundPreview,
  type ReturnStatus,
  type SellerReturnCard,
} from '@/hooks/useCommerce'

const TABS: { value: ReturnStatus; label: string }[] = [
  { value: 'requested', label: 'New' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'refunded', label: 'Refunded' },
  { value: '', label: 'All' },
]

const statusPill = (status: string) => {
  switch (status) {
    case 'requested':
      return 'bg-amber-100 text-amber-800'
    case 'approved':
      return 'bg-blue-100 text-blue-800'
    case 'rejected':
      return 'bg-red-100 text-red-800'
    case 'refunded':
      return 'bg-emerald-100 text-emerald-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function ReturnCard({ card }: { card: SellerReturnCard }) {
  const { return: r, order_item: item, order } = card
  const [rejectMessage, setRejectMessage] = useState('')
  const [showReject, setShowReject] = useState(false)
  const approve = useApproveReturn()
  const reject = useRejectReturn()
  const refundPreview = useReturnRefundPreview(r.status === 'requested' ? r.id : undefined)

  const pending = r.status === 'requested'

  return (
    <div className="rounded-xl border border-[#E8DDD3] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {order ? (
            <Link
              href={`/seller/orders/${order.id}`}
              className="font-bold text-[#1A1A1A] hover:text-[#8B5E3C] transition"
            >
              Order {order.order_number}
            </Link>
          ) : (
            <span className="font-mono text-xs text-[#6B5544]">order {r.order_id.slice(0, 8)}…</span>
          )}
          <p className="text-xs text-[#6B5544] mt-0.5">
            Requested {new Date(r.requested_at).toLocaleString()}
          </p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusPill(r.status)}`}
        >
          {r.status}
        </span>
      </div>

      {item && (
        <div className="mt-3 border-t border-[#E8DDD3] pt-3 text-sm">
          <div className="font-medium text-[#1A1A1A]">{item.product_title}</div>
          <div className="text-xs text-[#6B5544] mt-0.5">
            SKU {item.sku} · qty {item.quantity} · ₹{item.final_price.toFixed(2)}
          </div>
        </div>
      )}

      <div className="mt-3 border-t border-[#E8DDD3] pt-3 text-sm">
        <div className="text-[10px] font-black uppercase tracking-widest text-[#6B5544] mb-1">
          Buyer's reason
        </div>
        <div className="font-medium text-[#1A1A1A]">{r.reason_code.replace(/_/g, ' ')}</div>
        {r.reason_description && (
          <p className="text-[#6B5544] text-sm mt-1 whitespace-pre-line">{r.reason_description}</p>
        )}
      </div>

      {(r.refund_amount || refundPreview.data?.refund_amount) && (
        <div className="mt-3 border-t border-[#E8DDD3] pt-3 text-sm">
          <span className="text-[#6B5544]">Refund preview:</span>{' '}
          <span className="font-bold text-[#1A1A1A]">
            ₹{(r.refund_amount ?? refundPreview.data?.refund_amount ?? 0).toFixed(2)}
          </span>
          {r.refund_amount == null && (
            <span className="text-xs text-[#6B5544] ml-2">(item final price)</span>
          )}
        </div>
      )}

      {r.rejection_reason && (
        <div className="mt-3 border-t border-[#E8DDD3] pt-3 text-sm">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#6B5544] mb-1">
            Your rejection reason
          </div>
          <p className="text-[#1A1A1A]">{r.rejection_reason}</p>
        </div>
      )}

      {pending && (
        <div className="mt-4 border-t border-[#E8DDD3] pt-3">
          {showReject ? (
            <div className="space-y-2">
              <textarea
                value={rejectMessage}
                onChange={(e) => setRejectMessage(e.target.value)}
                rows={2}
                placeholder="Reason shown to buyer (required)"
                className="w-full rounded-md border border-[#E8DDD3] px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowReject(false)}
                  className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#6B5544] hover:text-[#1A1A1A]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => reject.mutate({ returnId: r.id, reason: rejectMessage })}
                  disabled={!rejectMessage || reject.isPending}
                  className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-700 disabled:opacity-50"
                >
                  {reject.isPending ? 'Rejecting…' : 'Confirm Reject'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => approve.mutate(r.id)}
                disabled={approve.isPending}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50"
              >
                {approve.isPending ? 'Approving…' : 'Approve & Refund'}
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-50"
              >
                Reject
              </button>
            </div>
          )}
          {approve.error && (
            <div className="mt-2 text-xs text-red-600">{(approve.error as Error).message}</div>
          )}
          {reject.error && (
            <div className="mt-2 text-xs text-red-600">{(reject.error as Error).message}</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SellerReturnsPage() {
  const [status, setStatus] = useState<ReturnStatus>('requested')
  const { data, isLoading, error } = useSellerReturns(status)
  const returns = data?.returns ?? []

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Link
              href="/seller/dashboard"
              className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] hover:text-[#1A1A1A] transition mb-1 block"
            >
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-black text-[#1A1A1A]">Returns</h1>
            <p className="text-sm text-[#6B5544] mt-1">
              Approve to refund the buyer and trigger a reverse pickup. Reject only with a clear reason —
              the buyer sees it.
            </p>
          </div>

          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            {TABS.map((t) => (
              <button
                key={t.value || 'all'}
                onClick={() => setStatus(t.value)}
                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider whitespace-nowrap transition ${
                  status === t.value
                    ? 'bg-[#1A1A1A] text-white'
                    : 'bg-white border border-[#E8DDD3] text-[#4A3728] hover:bg-[#F5F0EB]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-sm text-[#6B5544]">Loading returns…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{(error as Error).message}</div>
          ) : returns.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DDD3] p-12 text-center">
              <p className="text-sm text-[#6B5544]">
                {status === 'requested'
                  ? 'No new return requests. New requests will appear here.'
                  : 'Nothing in this bucket.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {returns.map((card) => (
                <ReturnCard key={card.return.id} card={card} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

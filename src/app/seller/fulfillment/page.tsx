'use client'

import { useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useSellerFulfillment,
  useBookShipment,
  useIssueInvoice,
  type FulfillmentStage,
  type SellerOrderCard,
} from '@/hooks/useCommerce'

const TABS: { value: FulfillmentStage; label: string; description: string }[] = [
  { value: 'unshipped', label: 'To Ship', description: 'Paid, no shipment booked' },
  { value: 'in_transit', label: 'In Transit', description: 'Booked, en route' },
  { value: 'delivered', label: 'Delivered', description: 'Marked delivered by courier' },
  { value: 'cancelled', label: 'Cancelled', description: 'Cancelled by buyer or admin' },
  { value: 'all', label: 'All', description: 'Every order with your items' },
]

function shipmentStatusPill(status: string | undefined) {
  if (!status) return { label: 'Not booked', color: 'bg-amber-100 text-amber-800' }
  if (status === 'pending') return { label: 'Pending', color: 'bg-amber-100 text-amber-800' }
  if (status === 'delivered') return { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700' }
  if (status === 'cancelled') return { label: 'Cancelled', color: 'bg-red-100 text-red-700' }
  return { label: status.replace(/_/g, ' '), color: 'bg-blue-100 text-blue-800' }
}

function FulfillmentCard({ card }: { card: SellerOrderCard }) {
  const { order, items, shipment, seller_subtotal } = card
  const bookShipment = useBookShipment()
  const issueInvoice = useIssueInvoice()
  const pill = shipmentStatusPill(shipment?.status)
  const payable = order.payment_status === 'paid' || order.payment_status === 'cod_pending'
  const hasShipment = !!shipment

  return (
    <div className="rounded-xl border border-[#E8DDD3] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/seller/orders/${order.id}`}
            className="font-bold text-[#1A1A1A] hover:text-[#8B5E3C] transition"
          >
            Order {order.order_number}
          </Link>
          <p className="text-xs text-[#6B5544] mt-0.5">
            Placed {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#F5F0EB] text-[#4A3728]">
            {order.payment_status}
          </span>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${pill.color}`}
          >
            {pill.label}
          </span>
        </div>
      </div>

      <div className="mt-3 border-t border-[#E8DDD3] pt-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#6B5544] mb-2">
          Your items ({items.length})
        </p>
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between text-sm">
              <div className="truncate">
                <span className="font-medium text-[#1A1A1A]">{it.product_title}</span>
                <span className="text-[#6B5544]">
                  {' '}
                  · {it.sku} · qty {it.quantity}
                </span>
              </div>
              <span className="text-xs font-mono text-[#6B5544]">
                ₹{it.final_price.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[#6B5544]">
          Your subtotal: <span className="font-bold text-[#1A1A1A]">₹{seller_subtotal.toFixed(2)}</span>
        </p>
      </div>

      {shipment && (
        <div className="mt-3 border-t border-[#E8DDD3] pt-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[#6B5544]">Courier:</span>{' '}
              <span className="font-medium">{shipment.courier}</span>
              {shipment.tracking_number && (
                <>
                  {' '}
                  · AWB <span className="font-mono">{shipment.tracking_number}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {shipment.label_url && (
                <a
                  href={shipment.label_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-[#8B5E3C] hover:text-[#1A1A1A] transition"
                >
                  Label ↗
                </a>
              )}
              {shipment.tracking_url && (
                <a
                  href={shipment.tracking_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-[#8B5E3C] hover:text-[#1A1A1A] transition"
                >
                  Track ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 border-t border-[#E8DDD3] pt-3 flex flex-wrap items-center gap-2">
        {!hasShipment && payable && (
          <button
            onClick={() => bookShipment.mutate(order.id)}
            disabled={bookShipment.isPending}
            className="px-4 py-2 bg-[#1A1A1A] text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-[#3A2E26] disabled:opacity-50 transition"
          >
            {bookShipment.isPending ? 'Booking…' : 'Book Shipment'}
          </button>
        )}
        {payable && (
          <button
            onClick={() => issueInvoice.mutate(order.id)}
            disabled={issueInvoice.isPending}
            className="px-4 py-2 border border-[#E8DDD3] text-[#4A3728] rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-[#F5F0EB] disabled:opacity-50 transition"
          >
            {issueInvoice.isPending ? 'Issuing…' : 'Issue Invoice'}
          </button>
        )}
        <Link
          href={`/seller/orders/${order.id}`}
          className="ml-auto text-xs font-bold text-[#8B5E3C] hover:text-[#1A1A1A] transition uppercase tracking-wider"
        >
          Details →
        </Link>
      </div>

      {bookShipment.error && (
        <div className="mt-2 text-xs text-red-600">
          {(bookShipment.error as Error).message}
        </div>
      )}
    </div>
  )
}

export default function SellerFulfillmentPage() {
  const [stage, setStage] = useState<FulfillmentStage>('unshipped')
  const { data, isLoading, error } = useSellerFulfillment(stage)

  const orders = data?.orders ?? []

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Link
                href="/seller/dashboard"
                className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] hover:text-[#1A1A1A] transition mb-1 block"
              >
                ← Dashboard
              </Link>
              <h1 className="text-2xl font-black text-[#1A1A1A]">Fulfillment</h1>
              <p className="text-sm text-[#6B5544] mt-1">
                Ship items in the right order. Click an order to see buyer details and shipment tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setStage(t.value)}
                title={t.description}
                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider whitespace-nowrap transition ${
                  stage === t.value
                    ? 'bg-[#1A1A1A] text-white'
                    : 'bg-white border border-[#E8DDD3] text-[#4A3728] hover:bg-[#F5F0EB]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-sm text-[#6B5544]">Loading queue…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{(error as Error).message}</div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DDD3] p-12 text-center">
              <p className="text-sm text-[#6B5544]">
                Nothing here. Orders matching the &ldquo;{TABS.find(t => t.value === stage)?.label}&rdquo;
                tab will show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((card) => (
                <FulfillmentCard key={card.order.id} card={card} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

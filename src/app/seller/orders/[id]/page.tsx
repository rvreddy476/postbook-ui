'use client'

import { use } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useSellerOrderDetail,
  useInvoice,
  useBookShipment,
  useIssueInvoice,
} from '@/hooks/useCommerce'

type DeliveryAddress = {
  full_name?: string
  phone?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

function parseAddress(raw: unknown): DeliveryAddress | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as DeliveryAddress
    } catch {
      // Some serialisations send base64. Try one decode then JSON.
      try {
        return JSON.parse(atob(raw)) as DeliveryAddress
      } catch {
        return null
      }
    }
  }
  if (typeof raw === 'object') return raw as DeliveryAddress
  return null
}

export default function SellerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: card, isLoading } = useSellerOrderDetail(id)
  const { data: invoiceData } = useInvoice(id)
  const bookShipment = useBookShipment()
  const issueInvoice = useIssueInvoice()

  if (isLoading) {
    return (
      <AppShell activeTab="Shop">
        <div className="p-8 text-sm text-[#6B5544]">Loading order…</div>
      </AppShell>
    )
  }
  if (!card) {
    return (
      <AppShell activeTab="Shop">
        <div className="p-8 text-sm text-red-600">Order not found</div>
      </AppShell>
    )
  }

  const { order, items, shipment, seller_subtotal, delivery_address } = card
  const address = parseAddress(delivery_address)
  const hasShipment = !!shipment
  const hasInvoice = !!invoiceData?.invoice
  const payable = order.payment_status === 'paid' || order.payment_status === 'cod_pending'

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="mx-auto max-w-4xl p-6 space-y-6">
          <div>
            <Link
              href="/seller/fulfillment"
              className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] hover:text-[#1A1A1A] transition mb-1 block"
            >
              ← Fulfillment
            </Link>
            <h1 className="text-2xl font-black text-[#1A1A1A] mt-1">Order {order.order_number}</h1>
            <div className="text-sm text-[#6B5544]">
              Placed {new Date(order.created_at).toLocaleString()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[#E8DDD3] bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                Status
              </div>
              <div className="text-lg font-bold text-[#1A1A1A]">
                {order.status.replace(/_/g, ' ')}
              </div>
            </div>
            <div className="rounded-xl border border-[#E8DDD3] bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                Payment
              </div>
              <div className="text-lg font-bold text-[#1A1A1A]">{order.payment_status}</div>
              <div className="text-xs text-[#6B5544]">{order.payment_method ?? '-'}</div>
            </div>
            <div className="rounded-xl border border-[#E8DDD3] bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                Your subtotal
              </div>
              <div className="text-lg font-bold text-[#1A1A1A]">
                ₹{seller_subtotal.toFixed(2)}
              </div>
              <div className="text-xs text-[#6B5544]">
                Order total {order.currency_code} {order.final_amount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Buyer + shipping */}
          {address && (
            <section className="rounded-xl border border-[#E8DDD3] bg-white p-6">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#6B5544] mb-3">
                Ship to
              </h2>
              <div className="text-sm text-[#1A1A1A] space-y-0.5">
                {address.full_name && <div className="font-bold">{address.full_name}</div>}
                {address.phone && <div className="text-[#6B5544]">{address.phone}</div>}
                {address.line1 && <div>{address.line1}</div>}
                {address.line2 && <div>{address.line2}</div>}
                <div>
                  {[address.city, address.state, address.postal_code].filter(Boolean).join(', ')}
                </div>
                {address.country && <div>{address.country}</div>}
              </div>
            </section>
          )}

          {/* Items */}
          <section className="rounded-xl border border-[#E8DDD3] bg-white p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#6B5544] mb-3">
              Your items
            </h2>
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] font-black uppercase tracking-widest text-[#6B5544]">
                <tr>
                  <th className="pb-2">Product</th>
                  <th className="pb-2">SKU</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Status</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DDD3]">
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2 font-medium text-[#1A1A1A]">{it.product_title}</td>
                    <td className="py-2 text-[#6B5544] font-mono text-xs">{it.sku}</td>
                    <td className="py-2 text-right">{it.quantity}</td>
                    <td className="py-2 text-right text-xs">{it.status}</td>
                    <td className="py-2 text-right font-mono">₹{it.final_price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Shipment */}
          <section className="rounded-xl border border-[#E8DDD3] bg-white p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#6B5544]">
                Shipment
              </h2>
              {!hasShipment && payable && (
                <button
                  disabled={bookShipment.isPending}
                  onClick={() => bookShipment.mutate(order.id)}
                  className="rounded-lg bg-[#1A1A1A] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-[#3A2E26] disabled:opacity-50 transition"
                >
                  {bookShipment.isPending ? 'Booking…' : 'Book shipment'}
                </button>
              )}
            </div>

            {hasShipment ? (
              <>
                <div className="text-sm text-[#1A1A1A]">
                  Courier: <span className="font-bold">{shipment.courier}</span>
                  {shipment.tracking_number && (
                    <>
                      {' '}
                      · AWB <span className="font-mono">{shipment.tracking_number}</span>
                    </>
                  )}
                  {' '}· Status: <span className="font-medium">{shipment.status}</span>
                </div>
                <div className="mt-2 flex gap-3">
                  {shipment.label_url && (
                    <a
                      href={shipment.label_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#8B5E3C] hover:text-[#1A1A1A] text-sm font-bold transition"
                    >
                      Download label ↗
                    </a>
                  )}
                  {shipment.tracking_url && (
                    <a
                      href={shipment.tracking_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#8B5E3C] hover:text-[#1A1A1A] text-sm font-bold transition"
                    >
                      Track ↗
                    </a>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-[#6B5544]">
                No shipment booked yet.{' '}
                {!payable && (
                  <span className="text-amber-700">Waiting for payment.</span>
                )}
              </p>
            )}

            {bookShipment.error && (
              <div className="mt-2 text-sm text-red-600">
                {(bookShipment.error as Error).message}
              </div>
            )}
          </section>

          {/* Invoice */}
          <section className="rounded-xl border border-[#E8DDD3] bg-white p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#6B5544]">
                Invoice
              </h2>
              {!hasInvoice && payable && (
                <button
                  disabled={issueInvoice.isPending}
                  onClick={() => issueInvoice.mutate(order.id)}
                  className="rounded-lg bg-[#1A1A1A] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-[#3A2E26] disabled:opacity-50 transition"
                >
                  {issueInvoice.isPending ? 'Issuing…' : 'Issue invoice'}
                </button>
              )}
            </div>

            {hasInvoice ? (
              <>
                <div className="text-sm text-[#1A1A1A]">
                  Invoice <span className="font-mono">{invoiceData!.invoice.invoice_number}</span>
                </div>
                {invoiceData!.download_url && (
                  <a
                    href={invoiceData!.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-2 rounded-lg bg-[#8B5E3C] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-[#3A2E26] transition"
                  >
                    Download invoice
                  </a>
                )}
              </>
            ) : (
              <p className="text-sm text-[#6B5544]">No invoice issued yet.</p>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  )
}

'use client'

import { use } from 'react'
import Link from 'next/link'
import {
  useOrder,
  useShipment,
  useInvoice,
  useBookShipment,
  useIssueInvoice,
} from '@/hooks/useCommerce'

export default function SellerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: order, isLoading } = useOrder(id)
  const { data: shipmentData } = useShipment(id)
  const { data: invoiceData } = useInvoice(id)
  const bookShipment = useBookShipment()
  const issueInvoice = useIssueInvoice()

  if (isLoading) return <div className="p-8">Loading order…</div>
  if (!order) return <div className="p-8 text-red-600">Order not found</div>

  const hasShipment = !!shipmentData?.shipment
  const hasInvoice = !!invoiceData?.invoice
  const payable = order.payment_status === 'paid' || order.payment_status === 'cod_pending'

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <Link href="/seller/orders" className="text-sm text-gray-500 hover:text-indigo-600">
          ← All seller orders
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Order {order.order_number}</h1>
        <div className="text-sm text-gray-500">
          Placed {new Date(order.created_at).toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase text-gray-500">Status</div>
          <div className="text-lg font-semibold">{order.status.replace(/_/g, ' ')}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase text-gray-500">Payment</div>
          <div className="text-lg font-semibold">{order.payment_status}</div>
          <div className="text-sm text-gray-500">{order.payment_method ?? '-'}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase text-gray-500">Total</div>
          <div className="text-lg font-semibold">
            {order.currency_code} {order.final_amount.toFixed(2)}
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Shipment</h2>
          {!hasShipment && payable ? (
            <button
              disabled={bookShipment.isPending}
              onClick={() => bookShipment.mutate(order.id)}
              className="rounded bg-indigo-600 text-white px-4 py-2 text-sm hover:bg-indigo-700 disabled:bg-gray-300"
            >
              {bookShipment.isPending ? 'Booking…' : 'Book shipment'}
            </button>
          ) : null}
        </div>

        {hasShipment ? (
          <>
            <div className="text-sm text-gray-700">
              Courier: <span className="font-medium">{shipmentData!.shipment.courier}</span>
              {shipmentData!.shipment.tracking_number ? (
                <> · AWB: <span className="font-medium">{shipmentData!.shipment.tracking_number}</span></>
              ) : null}
            </div>
            <div className="mt-2 flex gap-3">
              {shipmentData!.shipment.label_url ? (
                <a href={shipmentData!.shipment.label_url} target="_blank" rel="noreferrer"
                  className="text-indigo-600 hover:underline text-sm">
                  Download label
                </a>
              ) : null}
              {shipmentData!.shipment.tracking_url ? (
                <a href={shipmentData!.shipment.tracking_url} target="_blank" rel="noreferrer"
                  className="text-indigo-600 hover:underline text-sm">
                  Track →
                </a>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            No shipment booked yet. {!payable ? 'Waiting for payment.' : ''}
          </p>
        )}

        {bookShipment.error ? (
          <div className="mt-2 text-sm text-red-600">
            {(bookShipment.error as Error).message}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Invoice</h2>
          {!hasInvoice && payable ? (
            <button
              disabled={issueInvoice.isPending}
              onClick={() => issueInvoice.mutate(order.id)}
              className="rounded bg-indigo-600 text-white px-4 py-2 text-sm hover:bg-indigo-700 disabled:bg-gray-300"
            >
              {issueInvoice.isPending ? 'Issuing…' : 'Issue invoice'}
            </button>
          ) : null}
        </div>

        {hasInvoice ? (
          <>
            <div className="text-sm text-gray-700">
              Invoice {invoiceData!.invoice.invoice_number}
            </div>
            {invoiceData!.download_url ? (
              <a href={invoiceData!.download_url} target="_blank" rel="noreferrer"
                className="inline-block mt-2 rounded bg-indigo-600 text-white px-4 py-2 text-sm hover:bg-indigo-700">
                Download invoice
              </a>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-gray-500">No invoice issued yet.</p>
        )}
      </section>
    </div>
  )
}

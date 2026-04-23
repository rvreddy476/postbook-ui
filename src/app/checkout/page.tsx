'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart, useAddresses, useAddAddress, useCheckout } from '@/hooks/useCommerce'

export default function CheckoutPage() {
  const router = useRouter()
  const { data: cart } = useCart()
  const { data: addresses } = useAddresses()
  const addAddress = useAddAddress()
  const checkout = useCheckout()

  const [selectedAddr, setSelectedAddr] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'prepaid' | 'cod'>('prepaid')
  const [couponCode, setCouponCode] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({
    full_name: '', phone: '', address_line_1: '',
    address_line_2: '', city: '', state: '', postal_code: '',
  })

  const addrList = addresses ?? []
  if (!selectedAddr && addrList.length > 0) {
    const def = addrList.find((a) => a.is_default) ?? addrList[0]
    if (def) setSelectedAddr(def.id)
  }

  const submitAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    const created = await addAddress.mutateAsync(form)
    if (created?.id) setSelectedAddr(created.id)
    setShowAddForm(false)
  }

  const place = async () => {
    if (!selectedAddr) return
    const order = await checkout.mutateAsync({
      address_id: selectedAddr,
      payment_method: paymentMethod,
      coupon_code: couponCode || undefined,
    })
    router.push(`/orders/${order.id}`)
  }

  if (!cart || cart.ItemCount === 0)
    return <div className="p-8 text-center">Your cart is empty.</div>

  return (
    <div className="mx-auto max-w-4xl p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-4">Shipping Address</h2>
          {addrList.length > 0 ? (
            <div className="space-y-2">
              {addrList.map((a) => (
                <label
                  key={a.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                    selectedAddr === a.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="addr"
                    checked={selectedAddr === a.id}
                    onChange={() => setSelectedAddr(a.id)}
                  />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">
                      {a.contact_name} · {a.phone}
                    </div>
                    <div className="text-gray-600">
                      {a.address_line_1}
                      {a.address_line_2 ? `, ${a.address_line_2}` : ''}, {a.city}, {a.state} {a.postal_code}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ) : null}

          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-3 text-indigo-600 text-sm hover:underline"
            >
              + Add new address
            </button>
          ) : (
            <form onSubmit={submitAddress} className="mt-4 grid grid-cols-2 gap-3">
              <input required placeholder="Full name" value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="border rounded px-3 py-2 col-span-2" />
              <input required placeholder="Phone" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="border rounded px-3 py-2 col-span-2" />
              <input required placeholder="Address line 1" value={form.address_line_1}
                onChange={(e) => setForm({ ...form, address_line_1: e.target.value })}
                className="border rounded px-3 py-2 col-span-2" />
              <input placeholder="Address line 2" value={form.address_line_2}
                onChange={(e) => setForm({ ...form, address_line_2: e.target.value })}
                className="border rounded px-3 py-2 col-span-2" />
              <input required placeholder="City" value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="border rounded px-3 py-2" />
              <input required placeholder="State" value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="border rounded px-3 py-2" />
              <input required placeholder="Postal code" value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                className="border rounded px-3 py-2" />
              <div className="col-span-2 flex gap-2">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded">
                  Save
                </button>
                <button type="button" onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded border">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-4">Payment Method</h2>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer">
            <input type="radio" checked={paymentMethod === 'prepaid'}
              onChange={() => setPaymentMethod('prepaid')} />
            <span>Pay online (UPI / Card / Net Banking)</span>
          </label>
          <label className="mt-2 flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer">
            <input type="radio" checked={paymentMethod === 'cod'}
              onChange={() => setPaymentMethod('cod')} />
            <span>Cash on Delivery</span>
          </label>
        </section>
      </div>

      <aside className="rounded-xl border border-gray-200 bg-white p-6 h-fit sticky top-6">
        <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
        <div className="space-y-1 text-sm">
          {cart.Items.map((ci) => (
            <div key={ci.Item.id} className="flex justify-between">
              <span>{ci.Product?.title ?? 'Product'} × {ci.Item.quantity}</span>
              <span>₹{(ci.Item.price_snapshot * ci.Item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <input placeholder="Coupon code" value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div className="mt-4 pt-3 border-t flex justify-between font-semibold">
          <span>Subtotal</span>
          <span>₹{cart.Subtotal.toFixed(2)}</span>
        </div>
        <button
          disabled={!selectedAddr || checkout.isPending}
          onClick={place}
          className="mt-4 w-full rounded-lg bg-indigo-600 text-white py-3 font-medium disabled:bg-gray-300 hover:bg-indigo-700"
        >
          {checkout.isPending ? 'Placing…' : paymentMethod === 'cod' ? 'Place COD Order' : 'Pay & Place Order'}
        </button>
        {checkout.error ? (
          <div className="mt-2 text-sm text-red-600">
            {(checkout.error as Error).message}
          </div>
        ) : null}
      </aside>
    </div>
  )
}

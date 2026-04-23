'use client'

import Link from 'next/link'
import { useCart, useRemoveFromCart } from '@/hooks/useCommerce'

export default function CartPage() {
  const { data: cart, isLoading, error } = useCart()
  const remove = useRemoveFromCart()

  if (isLoading) return <div className="p-8">Loading cart…</div>
  if (error) return <div className="p-8 text-red-600">Failed to load cart</div>
  if (!cart || cart.ItemCount === 0)
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">Your cart is empty</h1>
        <Link href="/commerce" className="text-indigo-600 hover:underline">
          Browse products
        </Link>
      </div>
    )

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold mb-6">Your Cart</h1>
      <div className="space-y-3">
        {cart.Items.map((ci) => (
          <div
            key={ci.Item.id}
            className="flex items-center gap-4 rounded-xl border border-gray-200 p-4 bg-white"
          >
            <div className="flex-1">
              <div className="font-medium">{ci.Product?.title ?? 'Product'}</div>
              <div className="text-sm text-gray-500">SKU: {ci.Variant?.sku}</div>
              <div className="text-sm text-gray-500">
                ₹{ci.Item.price_snapshot} × {ci.Item.quantity}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">
                ₹{(ci.Item.price_snapshot * ci.Item.quantity).toFixed(2)}
              </div>
              <button
                onClick={() => remove.mutate(ci.Item.variant_id)}
                className="text-sm text-red-600 hover:underline mt-1"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex justify-between text-lg">
          <span>Subtotal</span>
          <span className="font-semibold">₹{cart.Subtotal.toFixed(2)}</span>
        </div>
        <div className="text-sm text-gray-500 mt-2">
          Shipping and taxes calculated at checkout.
        </div>
        <Link
          href="/checkout"
          className="mt-4 block w-full rounded-lg bg-indigo-600 text-white text-center py-3 font-medium hover:bg-indigo-700"
        >
          Proceed to Checkout
        </Link>
      </div>
    </div>
  )
}

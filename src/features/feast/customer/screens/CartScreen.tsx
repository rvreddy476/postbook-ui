"use client"

/*
  /feast/cart — the cart as the server priced it.

  Lines show the server's line totals; the bill is `taxes_and_charges` and
  `final_amount_paise`, never re-added. A cart the server cannot price
  (`pricing_error`) shows the server's words and cannot be checked out.
*/

import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react"
import Link from "next/link"

import { toFeastError } from "../api/client"
import { Bill, Skel, StateBlock, VegMark } from "../components/parts"
import { useCart, useClearCart, useRemoveCartItem, useUpdateCartItem } from "../hooks/queries"
import { MAX_QUANTITY } from "../model/itemSheet"
import { addPaise, formatPaise } from "../model/money"

export function CartScreen() {
  const cart = useCart()
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const clear = useClearCart()
  const busy = update.isPending || remove.isPending || clear.isPending
  const writeError = update.error || remove.error || clear.error

  if (cart.isLoading) {
    return (
      <div className="fc-grid2">
        <div className="fc-stack">
          <Skel h={22} w="40%" />
          <Skel h={72} />
          <Skel h={72} />
        </div>
        <Skel h={220} />
      </div>
    )
  }

  if (cart.isError) {
    const e = toFeastError(cart.error)
    // An empty cart can answer 404 on some deployments; treat it as empty.
    if (e.status !== 404) {
      return (
        <StateBlock
          icon={<ShoppingBag size={22} />}
          title="Your cart couldn't be loaded"
          text={e.message}
          action={
            <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" onClick={() => cart.refetch()}>
              Try again
            </button>
          }
        />
      )
    }
  }

  const c = cart.data
  if (!c || !c.items.length) {
    return (
      <StateBlock
        icon={<ShoppingBag size={22} />}
        title="Your cart is empty"
        text="Add dishes from a restaurant that delivers to you."
        action={
          <Link href="/feast" className="fc-btn fc-btn--primary fc-btn--sm">
            Find food
          </Link>
        }
      />
    )
  }

  const canCheckout = Boolean(c.totalsPaise) && !c.pricingError

  return (
    <>
      <div className="fc-head">
        <div>
          <h1 className="fc-title">Your cart</h1>
          {c.restaurantName ? (
            <p className="fc-sub">
              From{" "}
              {c.restaurantId ? (
                <Link className="fc-link" href={`/feast/r/${encodeURIComponent(c.restaurantId)}`}>
                  {c.restaurantName}
                </Link>
              ) : (
                c.restaurantName
              )}
            </p>
          ) : null}
        </div>
        <button type="button" className="fc-btn fc-btn--ghost fc-btn--sm" disabled={busy} onClick={() => clear.mutate()}>
          <Trash2 size={14} aria-hidden="true" /> Clear cart
        </button>
      </div>

      <div className="fc-grid2">
        <section className="fc-card" aria-label="Dishes">
          {c.items.map((line) => (
            <div key={line.id} className="fc-line">
              <VegMark foodType={line.foodType} />
              <div className="fc-grow">
                <div style={{ fontWeight: 600 }}>{line.name}</div>
                {line.addons.length ? <div className="fc-meta">{line.addons.map((a) => a.name).join(", ")}</div> : null}
                {line.itemInstruction ? <div className="fc-meta">“{line.itemInstruction}”</div> : null}
                <div className="fc-meta">{formatPaise(line.unitPricePaise)} each</div>
              </div>
              <div className="fc-stack" style={{ alignItems: "flex-end", gap: 6 }}>
                <div className="fc-qty" role="group" aria-label={`Quantity of ${line.name}`}>
                  <button
                    type="button"
                    aria-label="One fewer"
                    disabled={busy}
                    onClick={() => (line.quantity <= 1 ? remove.mutate(line.id) : update.mutate({ id: line.id, quantity: line.quantity - 1 }))}
                  >
                    <Minus size={14} aria-hidden="true" />
                  </button>
                  <span>{line.quantity}</span>
                  <button type="button" aria-label="One more" disabled={busy || line.quantity >= MAX_QUANTITY} onClick={() => update.mutate({ id: line.id, quantity: line.quantity + 1 })}>
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </div>
                <span className="fc-price">{formatPaise(addPaise(line.lineTotalPaise, line.addonTotalPaise))}</span>
              </div>
            </div>
          ))}
          {writeError ? (
            <p className="fc-alert" role="alert">
              {toFeastError(writeError).message}
            </p>
          ) : null}
        </section>

        <aside className="fc-card fc-sticky" aria-label="Bill">
          <h2 className="fc-h2">Bill</h2>
          {c.pricingError ? (
            <p className="fc-alert" role="alert">
              {c.pricingError.message || "This order can't be priced right now."}
            </p>
          ) : c.totalsPaise ? (
            <Bill totals={c.totalsPaise} breakdown={c.taxesAndCharges} />
          ) : (
            <p className="fc-note">The price will be worked out at checkout.</p>
          )}
          {canCheckout ? (
            <Link href="/feast/checkout" className="fc-btn fc-btn--primary fc-btn--block">
              Checkout · {formatPaise(c.totalsPaise!.finalAmount)}
            </Link>
          ) : (
            <button type="button" className="fc-btn fc-btn--primary fc-btn--block" disabled>
              Checkout
            </button>
          )}
        </aside>
      </div>
    </>
  )
}

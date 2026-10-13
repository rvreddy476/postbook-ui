"use client"

/*
  /feast/checkout

    GET /cart, GET /addresses
    Pay → the attempt's Idempotency-Key is saved to localStorage FIRST
        → POST /orders {address_id, payment_method}
        → /feast/orders/:id?pay=<method>, where the payment opens and the
          server's GET /orders/:id/payment decides "paid".

  The screen never computes the total: it shows the cart's
  final_amount_paise. A lost response keeps the key, so pressing Pay again
  returns the same order instead of making a second one; an order that was
  made is paid for (or retried) on its own page, never placed again.
*/

import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ShoppingBag } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { placeOrder, toFeastError } from "../api/client"
import { Bill, ServiceCardView, Skel, StateBlock } from "../components/parts"
import { keys, useCart, useChosenAddress } from "../hooks/queries"
import { addressLine, addressTitle, checkoutAddressIssue } from "../model/address"
import { attemptSignature, placeWithSavedKey, readAttempt, type CheckoutAttempt } from "../model/checkoutAttempt"
import { formatPaise } from "../model/money"
import { PAYMENT_METHODS, type PaymentMethod } from "../model/payment"
import { fromRefusal, type ServiceCard } from "../model/serviceability"
import { AddAddress } from "./AddressesScreen"

function localStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

export function CheckoutScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const cart = useCart()
  const { addresses, chosen, choose } = useChosenAddress()
  const [addingAddress, setAddingAddress] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>("upi")
  const [note, setNote] = useState("")
  const [placing, setPlacing] = useState(false)
  const [refusal, setRefusal] = useState<{ card: ServiceCard | null; message: string } | null>(null)
  const [pending, setPending] = useState<CheckoutAttempt | null>(null)

  // An order already made by an earlier Pay is paid on its own page.
  useEffect(() => {
    const a = readAttempt(localStore())
    if (a?.orderId) setPending(a)
  }, [])

  const c = cart.data
  if (cart.isLoading) {
    return (
      <div className="fc-grid2">
        <div className="fc-stack">
          <Skel h={22} w="30%" />
          <Skel h={110} />
          <Skel h={80} />
        </div>
        <Skel h={240} />
      </div>
    )
  }

  if (cart.isError && toFeastError(cart.error).status !== 404) {
    return (
      <StateBlock
        icon={<ShoppingBag size={22} />}
        title="Your cart couldn't be loaded"
        text={toFeastError(cart.error).message}
        action={
          <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" onClick={() => cart.refetch()}>
            Try again
          </button>
        }
      />
    )
  }

  if (!c || !c.items.length) {
    return (
      <StateBlock
        icon={<ShoppingBag size={22} />}
        title="Nothing to check out"
        text={pending?.orderId ? "Your last order is waiting for payment." : "Your cart is empty."}
        action={
          pending?.orderId ? (
            <Link href={`/feast/orders/${encodeURIComponent(pending.orderId)}`} className="fc-btn fc-btn--primary fc-btn--sm">
              Open order {pending.orderNumber ?? ""}
            </Link>
          ) : (
            <Link href="/feast" className="fc-btn fc-btn--primary fc-btn--sm">
              Find food
            </Link>
          )
        }
      />
    )
  }

  const totals = c.totalsPaise
  const addressIssue = checkoutAddressIssue(chosen)
  const blocked = addingAddress ? "Save or cancel your address changes before paying." : addresses.isError ? "Reload your saved addresses before paying." : addressIssue ?? (!totals || c.pricingError ? c.pricingError?.message || "This order can't be priced right now." : null)

  const onPay = async () => {
    if (!chosen || !totals || placing || blocked) return
    setPlacing(true)
    setRefusal(null)
    const signature = attemptSignature({
      cartId: c.id,
      items: c.items.map((i) => ({ id: i.id, quantity: i.quantity })),
      finalAmountPaise: totals.finalAmount,
      addressId: chosen.id,
      method,
    })
    const body = { address_id: chosen.id, payment_method: method, ...(note.trim() ? { customer_instruction: note.trim() } : {}) }
    const outcome = await placeWithSavedKey(localStore(), signature, (key) => placeOrder(body, key), (e) => toFeastError(e).status)
    if (outcome.kind === "placed" || outcome.kind === "reused") {
      const orderId = outcome.kind === "placed" ? outcome.order.id : (outcome.attempt.orderId as string)
      void qc.invalidateQueries({ queryKey: keys.cart })
      void qc.invalidateQueries({ queryKey: keys.orders })
      router.push(`/feast/orders/${encodeURIComponent(orderId)}?pay=${method}`)
      return
    }
    setPlacing(false)
    const e = toFeastError(outcome.error)
    if (outcome.kind === "lost") {
      setRefusal({ card: null, message: "We couldn't hear back about your order. Check your connection and press Pay again — you won't be charged twice." })
      return
    }
    if (e.status === 404) {
      setRefusal({ card: null, message: "This delivery address is no longer available. Choose a saved address or add a new one." })
      void addresses.refetch()
      void qc.invalidateQueries({ queryKey: keys.addresses })
      return
    }
    setRefusal({ card: fromRefusal(e.code, e.fromServer ? e.message : ""), message: e.message })
    void qc.invalidateQueries({ queryKey: keys.cart })
  }

  return (
    <>
      <div className="fc-head">
        <div className="fc-row">
          <Link href="/feast/cart" className="fc-back" aria-label="Back to cart">
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <h1 className="fc-title">Checkout</h1>
        </div>
      </div>

      {pending?.orderId ? (
        <p className="fc-info" style={{ marginBottom: 16 }}>
          Order {pending.orderNumber} is waiting for payment.{" "}
          <Link className="fc-link" href={`/feast/orders/${encodeURIComponent(pending.orderId)}`}>
            Pay for it
          </Link>
        </p>
      ) : null}

      <div className="fc-grid2">
        <div className="fc-stack">
          <section className="fc-card" aria-labelledby="fc-deliver">
            <div className="fc-row">
              <h2 id="fc-deliver" className="fc-h2 fc-grow">Delivery address</h2>
              <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" disabled={placing} onClick={() => setAddingAddress((value) => !value)}>{addingAddress ? "Cancel changes" : "Add address"}</button>
            </div>
            {addresses.isLoading ? <p role="status">Loading saved addresses…</p> : addresses.isError ? <p role="alert">{toFeastError(addresses.error).message} <button type="button" className="fc-link" onClick={() => void addresses.refetch()}>Try again</button></p> : (
              <div className="fc-stack" role="radiogroup" aria-label="Delivery address">
                {(addresses.data ?? []).map((address) => <label key={address.id} className={chosen?.id === address.id ? "fc-choice is-on" : "fc-choice"}>
                  <input type="radio" name="delivery-address" checked={chosen?.id === address.id} onChange={() => choose(address.id)} disabled={placing || addingAddress} />
                  <span><strong>{addressTitle(address)}</strong><span className="fc-meta" style={{ display: "block" }}>{addressLine(address)}</span><span className="fc-meta" style={{ display: "block" }}>{[address.receiverName, address.phone].filter(Boolean).join(" · ") || "No receiver contact saved"}</span></span>
                </label>)}
              </div>
            )}
            {addressIssue && !addresses.isLoading ? <p className="fc-note">{addressIssue}</p> : null}
            <p className="fc-note">Review your flat, entrance and receiver contact before paying. You can search for an address manually; device location is optional.</p>
          </section>
          {addingAddress ? <AddAddress first={!addresses.data?.length} onDone={(id) => { choose(id); void addresses.refetch().then((result) => { if (!result.isError) setAddingAddress(false) }) }} /> : null}

          <section className="fc-card" aria-labelledby="fc-method">
            <h2 id="fc-method" className="fc-h2">Pay with</h2>
            <div className="fc-row" role="radiogroup" aria-label="Payment method" style={{ flexWrap: "wrap" }}>
              {PAYMENT_METHODS.map((m) => (
                <label key={m.value} className={method === m.value ? "fc-choice is-on" : "fc-choice"}>
                  <input type="radio" name="method" checked={method === m.value} onChange={() => setMethod(m.value)} disabled={placing} />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
            <p className="fc-note">Online payment only. You&apos;ll pay on a secure Razorpay window.</p>
          </section>

          <section className="fc-card" aria-labelledby="fc-note">
            <label id="fc-note" className="fc-field">
              Delivery and restaurant instructions (optional)
              <input className="fc-input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Flat, entrance, landmark or food preferences…" />
            </label>
          </section>

          <section className="fc-card" aria-label="Your order">
            <h2 className="fc-h2">{c.restaurantName ?? "Your order"}</h2>
            {c.items.map((i) => (
              <div key={i.id} className="fc-row">
                <span className="fc-grow fc-truncate">
                  {i.quantity} × {i.name}
                  {i.addons.length ? <span className="fc-meta"> · {i.addons.map((a) => a.name).join(", ")}</span> : null}
                </span>
              </div>
            ))}
          </section>
        </div>

        <aside className="fc-card fc-sticky" aria-label="Bill">
          <h2 className="fc-h2">Bill</h2>
          {totals && !c.pricingError ? <Bill totals={totals} breakdown={c.taxesAndCharges} /> : null}
          {refusal?.card ? <ServiceCardView card={refusal.card} /> : refusal ? <p className="fc-alert" role="alert">{refusal.message}</p> : null}
          <button type="button" className="fc-btn fc-btn--primary fc-btn--block" onClick={onPay} disabled={Boolean(blocked) || placing}>
            {placing ? "Placing your order…" : totals ? `Pay ${formatPaise(totals.finalAmount)}` : "Pay"}
          </button>
          {blocked && !placing ? <p className="fc-note">{blocked}</p> : null}
          <p className="fc-note">Your order is confirmed once the payment is.</p>
        </aside>
      </div>
    </>
  )
}

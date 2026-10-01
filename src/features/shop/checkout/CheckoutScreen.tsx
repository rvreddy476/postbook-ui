"use client"

/*
  /shop/checkout — the P0 flow (commerce-contract.md §4):

    GET /cart, GET /addresses
    POST /checkout/quote            on every address or method change
    POST /v2/orders/checkout        Pay, with the attempt's Idempotency-Key
    POST /orders/:id/payment/intent then Razorpay (or the stub, on dev)
    → /shop/orders/:id?confirming=1 where the poll decides.

  The screen never computes a total: it shows the quote's figures and
  sends the quote's total back as `expected_total_minor`.
*/

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useReducer, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useGlobalToast } from "@/contexts/ToastContext"
import { inrMinor } from "@/features/shop/money"

import "../shop.css"
import "../shop-offers.css"

import { AddressForm } from "../components/addresses/AddressForm"
import { AddressPicker, BagLines, PaymentMethodPicker, QuoteBreakdown } from "../components/checkout/CheckoutParts"
import { CouponBox } from "../components/coupons/CouponBox"
import { BankOffers } from "../components/offers/BankOffers"
import { useCheckoutAddresses, useCheckoutBag, useCreateAddress, usePlaceOrder, useQuote } from "../hooks/checkout"
import { useCartCoupons } from "../hooks/coupons"
import { usePaymentOffers } from "../hooks/offers"
import { useOpenPaymentIntent } from "../hooks/payments"
import {
  BAG_HREF,
  buildCheckoutBody,
  checkoutAttemptKey,
  checkoutRefusal,
  errorCode,
  forgetCheckoutAttempt,
  payBlockReason,
  preselectedAddressId,
  quoteRefusal,
  quoteSecondsLeft,
  type AddressFormValues,
  type CheckoutRefusal,
  type PaymentMethod,
  type Quote,
} from "../model/checkout"
import {
  checkoutCouponLine,
  couponReducer,
  isCouponError,
  looksLikeCouponCode,
  minOrderFromError,
  NO_COUPON,
  normaliseCouponCode,
  recallAppliedCoupon,
  rememberAppliedCoupon,
  withCouponCode,
  type CouponBoxState,
  type CouponEvent,
} from "../model/coupons"
import { offersSheetNote } from "../model/offers"
import { rememberIntent } from "../model/payments"
import { startPayment } from "./startPayment"

const QUOTE_DEBOUNCE_MS = 350

const couponStep = (state: CouponBoxState, event: CouponEvent) => couponReducer(state, event, inrMinor)

function sessionStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null
  } catch {
    return null
  }
}

function RefusalLine({ refusal }: { refusal: CheckoutRefusal }) {
  const withLink = refusal.kind === "bag_changed" || refusal.kind === "empty_bag"
  return (
    <p className="shop-checkout__refusal" role="alert">
      {refusal.message}
      {withLink ? (
        <>
          {" "}
          <Link href={refusal.bagHref} className="shop-link">
            Open your bag
          </Link>
        </>
      ) : null}
    </p>
  )
}

export function CheckoutScreen() {
  const router = useRouter()
  const toast = useGlobalToast()
  const bagQuery = useCheckoutBag()
  const addressesQuery = useCheckoutAddresses()
  const createAddress = useCreateAddress()
  const quoteMutation = useQuote()
  const placeOrder = usePlaceOrder()
  const openIntent = useOpenPaymentIntent()

  const [addressId, setAddressId] = useState("")
  const [method, setMethod] = useState<PaymentMethod>("upi")
  const [adding, setAdding] = useState(false)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteRefused, setQuoteRefused] = useState<CheckoutRefusal | null>(null)
  const [payRefused, setPayRefused] = useState<CheckoutRefusal | null>(null)
  const [paying, setPaying] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const quoteSeq = useRef(0)
  // The coupon: `code` is what the next quote asks with, `quotedCode` what
  // the current quote was taken with (and what Pay sends).
  const [coupon, dispatchCoupon] = useReducer(couponStep, NO_COUPON)

  const bag = bagQuery.data
  const addresses = addressesQuery.data || []
  const cartCoupons = useCartCoupons(bag && bag.lines.length ? `${bag.subtotalMinor}:${bag.itemCount}` : "")
  const offers = usePaymentOffers(quote?.totalMinor ?? null)

  // The code applied in the bag, once.
  useEffect(() => {
    const carried = recallAppliedCoupon(sessionStore())
    if (looksLikeCouponCode(carried)) dispatchCoupon({ type: "apply", code: carried })
  }, [])

  // An empty bag has nothing to pay for.
  useEffect(() => {
    if (bagQuery.isSuccess && bag && bag.lines.length === 0) router.replace(BAG_HREF)
  }, [bagQuery.isSuccess, bag, router])

  // The default address, once.
  useEffect(() => {
    if (!addressId && addresses.length) setAddressId(preselectedAddressId(addresses))
  }, [addresses, addressId])

  // The countdown.
  useEffect(() => {
    if (!quote) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [quote])

  const runQuote = useCallback(() => {
    if (!addressId) return
    const seq = ++quoteSeq.current
    setQuoteRefused(null)
    setPayRefused(null)
    const code = coupon.code
    quoteMutation.mutate(
      withCouponCode({ address_id: addressId, payment_method: method }, code),
      {
        onSuccess: (q) => {
          if (seq !== quoteSeq.current) return
          setQuote(q)
          dispatchCoupon({ type: "quoted", code })
          setNow(Date.now())
        },
        onError: (error) => {
          if (seq !== quoteSeq.current) return
          setQuote(null)
          const refused = errorCode(error)
          if (code && isCouponError(refused)) {
            // The code is dropped and said once; the next quote goes
            // without it, so the buyer still has a price.
            dispatchCoupon({ type: "refused", errorCode: refused, minOrderMinor: minOrderFromError(error) })
            rememberAppliedCoupon(sessionStore(), "")
            return
          }
          setQuoteRefused(quoteRefusal(refused))
        },
      },
    )
    // quoteMutation is stable per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressId, method, coupon.code])

  // A quote on every address, method or coupon change, debounced.
  useEffect(() => {
    if (!addressId) return
    setQuote(null)
    const id = setTimeout(runQuote, QUOTE_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [addressId, method, coupon.code, runQuote])

  const onApplyCoupon = (code: string) => {
    dispatchCoupon({ type: "apply", code })
    if (looksLikeCouponCode(normaliseCouponCode(code))) rememberAppliedCoupon(sessionStore(), code)
  }

  const onRemoveCoupon = () => {
    dispatchCoupon({ type: "remove" })
    rememberAppliedCoupon(sessionStore(), "")
  }

  const onAddAddress = (values: AddressFormValues) => {
    createAddress.mutate(values, {
      onSuccess: (saved) => {
        setAdding(false)
        if (saved.id) setAddressId(saved.id)
        toast({ type: "success", title: "Address saved" })
      },
      onError: () => toast({ type: "error", title: "The address couldn't be saved", description: "Check the pincode and mobile number." }),
    })
  }

  const onPay = async () => {
    if (!quote || !bag) return
    const store = sessionStore()
    setPaying(true)
    setPayRefused(null)
    const key = checkoutAttemptKey(store, quote.quoteId)
    // The code the quote was taken with: the server binds a quote to it.
    const body = buildCheckoutBody({ quote, addressId, paymentMethod: method, couponCode: coupon.quotedCode })
    try {
      const result = await placeOrder.mutateAsync({ body, idempotencyKey: key })
      forgetCheckoutAttempt(store, quote.quoteId)
      // The payment leg. A failure here is not a failure of the order:
      // the order page offers "Complete payment", which opens the same
      // intent again.
      try {
        const { wire, intent } = await openIntent.mutateAsync(result.order_id)
        rememberIntent(store, result.order_id, wire)
        if (intent.provider === "razorpay") {
          // The dialog is body-level DOM and outlives this screen; its
          // result only ends the dialog. The order page polls.
          startPayment(intent, result.order_number)
        }
      } catch {
        /* handled on the order page */
      }
      router.push(`/shop/orders/${result.order_id}?confirming=1`)
    } catch (error) {
      const refusedCode = errorCode(error)
      if (coupon.quotedCode && isCouponError(refusedCode)) {
        // The coupon ran out (or stopped applying) between the quote and
        // Pay. No order was made: drop the code, say why, re-quote.
        forgetCheckoutAttempt(store, quote.quoteId)
        dispatchCoupon({ type: "refused", errorCode: refusedCode, minOrderMinor: minOrderFromError(error) })
        rememberAppliedCoupon(sessionStore(), "")
        setPayRefused({ kind: "requote", message: "Your coupon couldn't be used. Check the new total and pay again." })
        setQuote(null)
        setPaying(false)
        return
      }
      const refusal = checkoutRefusal(refusedCode)
      setPayRefused(refusal)
      if (refusal.kind === "requote") {
        // No order was made. The new quote brings a new key.
        forgetCheckoutAttempt(store, quote.quoteId)
        setQuote(null)
        runQuote()
      }
      setPaying(false)
    }
  }

  const secondsLeft = quote ? quoteSecondsLeft(quote, now) : 0
  const blocked = bag
    ? payBlockReason({ addressId, bag, quote, quoting: quoteMutation.isPending, paying, nowMs: now })
    : "Loading your bag…"

  if (bagQuery.isLoading || (bagQuery.isSuccess && bag && bag.lines.length === 0)) {
    return (
      <div className="shop-checkout">
        <Skeleton className="h-6 w-40" />
        <div className="shop-checkout__grid">
          <div className="shop-checkout__main">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    )
  }

  if (bagQuery.isError || !bag) {
    return (
      <div className="shop-state">
        <p>Your bag couldn't be loaded.</p>
        <Button variant="outline" size="sm" onClick={() => bagQuery.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="shop-checkout">
      <div className="shop-checkout__head">
        <Link href={BAG_HREF} className="shop-w2-back" aria-label="Back to bag">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <h1 className="shop-w2-title">Checkout</h1>
      </div>

      <div className="shop-checkout__grid">
        <div className="shop-checkout__main">
          <section className="shop-w2-sec">
            <h2 className="shop-w2-sec__title">Deliver to</h2>
            {addressesQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <AddressPicker addresses={addresses} selectedId={addressId} onSelect={setAddressId} onAdd={() => setAdding(true)} adding={adding} />
            )}
            {adding ? <AddressForm submitLabel="Save and use" onSubmit={onAddAddress} onCancel={() => setAdding(false)} busy={createAddress.isPending} /> : null}
          </section>

          <section className="shop-w2-sec">
            <h2 className="shop-w2-sec__title">Pay with</h2>
            <PaymentMethodPicker value={method} onChange={setMethod} disabled={paying} />
            {quote ? (
              <BankOffers offers={offers.data ?? []} title="Bank offers available" note={offersSheetNote(quote.totalMinor, inrMinor)} flush />
            ) : null}
          </section>

          <section className="shop-w2-sec">
            <CouponBox
              coupons={cartCoupons.data ?? []}
              loadingCoupons={cartCoupons.isLoading}
              applied={coupon.code}
              appliedLine={checkoutCouponLine({ applied: coupon.code, quotedCode: coupon.quotedCode, quote, quoting: quoteMutation.isPending, formatMinor: inrMinor })}
              error={coupon.error}
              busy={paying || quoteMutation.isPending}
              onApply={onApplyCoupon}
              onRemove={onRemoveCoupon}
            />
          </section>

          <section className="shop-w2-sec">
            <h2 className="shop-w2-sec__title">
              Your bag
              {bag.sellerName ? <span className="shop-w2-sec__sub"> · Sold by {bag.sellerName}</span> : null}
            </h2>
            <BagLines bag={bag} />
          </section>
        </div>

        <aside className="shop-checkout__aside">
          <section className="shop-w2-sec is-sticky">
            <h2 className="shop-w2-sec__title">Price</h2>
            <QuoteBreakdown quote={quote} secondsLeft={secondsLeft} quoting={quoteMutation.isPending} couponCode={coupon.quotedCode} />
            {quoteRefused ? <RefusalLine refusal={quoteRefused} /> : null}
            {payRefused ? <RefusalLine refusal={payRefused} /> : null}
            {quote && secondsLeft === 0 ? (
              <Button variant="outline" size="sm" className="w-full" onClick={runQuote} disabled={quoteMutation.isPending}>
                Refresh price
              </Button>
            ) : null}
            <Button size="lg" className="w-full shop-pay" onClick={onPay} disabled={!!blocked} aria-disabled={!!blocked}>
              {paying ? "Placing your order…" : quote ? `Pay ${inrMinor(quote.totalMinor)}` : "Pay"}
            </Button>
            {blocked && !paying ? <p className="shop-checkout__hint">{blocked}</p> : null}
            <p className="shop-checkout__fine">You'll be taken to a secure payment page. Your order is confirmed once the payment is.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}

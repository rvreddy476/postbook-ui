"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertTriangle, ArrowRight, ShoppingBag, Store } from "lucide-react"
import { useGlobalToast } from "@/contexts/ToastContext"
import { inrMinor } from "../money"
import { useBag, useRemoveBagLine, useUpdateBagLine } from "../hooks/bag"
import { useCartCoupons } from "../hooks/coupons"
import { useShopSession } from "../hooks/storefront"
import { canCheckout, cartBlockReason, isMixedSellerCart, itemCountLabel } from "../model/bag"
import { bagCouponLine, listedSaving, looksLikeCouponCode, normaliseCouponCode, recallAppliedCoupon, rememberAppliedCoupon } from "../model/coupons"
import { isSignedOut, SHOP_BASE, signInHref } from "../model/storefront"
import { BagLine } from "../components/bag/BagLine"
import { CouponBox } from "../components/coupons/CouponBox"
import { StateBlock } from "../components/storefront/StateBlock"

function sessionStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null
  } catch {
    return null
  }
}

function BagSkeleton() {
  return (
    <div className="shop-bag" aria-busy="true" aria-label="Loading your bag">
      <div className="shop-bag__lines">
        <div className="shop-skeleton" style={{ height: 120 }} />
        <div className="shop-skeleton" style={{ height: 120 }} />
      </div>
      <div className="shop-skeleton" style={{ height: 180 }} />
    </div>
  )
}

/**
 * `/shop/bag`: the lines, the badges the service's signals earn, the
 * subtotal, and "Proceed to checkout", which is disabled while anything
 * blocks the bag (model/bag.ts cartBlockReason). "Apply coupon" lists the
 * codes that apply (GET /cart/coupons) and carries the chosen one to
 * checkout, where the quote prices it and any refusal is said; the bag
 * never takes a discount off a total itself.
 */
export function BagScreen() {
  const { signedIn, known } = useShopSession()
  const bag = useBag()
  const update = useUpdateBagLine()
  const remove = useRemoveBagLine()
  const toast = useGlobalToast()
  const [pendingVariant, setPendingVariant] = useState<string | null>(null)
  const busy = update.isPending || remove.isPending
  const [coupon, setCoupon] = useState("")
  const [couponError, setCouponError] = useState("")
  useEffect(() => setCoupon(recallAppliedCoupon(sessionStore())), [])
  const bagSignature = bag.data && bag.data.items.length ? `${bag.data.subtotal_minor}:${bag.data.item_count}` : ""
  const coupons = useCartCoupons(bagSignature)
  const applyCoupon = (raw: string) => {
    const code = normaliseCouponCode(raw)
    if (!looksLikeCouponCode(code)) {
      setCouponError("Enter a code of 4 to 20 letters and numbers.")
      return
    }
    setCouponError("")
    setCoupon(code)
    rememberAppliedCoupon(sessionStore(), code)
  }
  const removeCoupon = () => {
    setCouponError("")
    setCoupon("")
    rememberAppliedCoupon(sessionStore(), "")
  }

  if (known && !signedIn) {
    return (
      <StateBlock
        icon={<ShoppingBag size={20} aria-hidden="true" />}
        title="Sign in to see your bag"
        text="Your bag is kept with your account."
        action={{ label: "Sign in", href: signInHref(`${SHOP_BASE}/bag`) }}
      />
    )
  }
  if (!known || bag.isLoading) return <BagSkeleton />
  if (bag.isError) {
    if (isSignedOut(bag.error)) {
      return <StateBlock title="Sign in to see your bag" text="Your bag is kept with your account." action={{ label: "Sign in", href: signInHref(`${SHOP_BASE}/bag`) }} />
    }
    return <StateBlock text="Your bag could not be loaded." action={{ label: "Try again", onClick: () => void bag.refetch() }} />
  }
  const cart = bag.data
  if (!cart || cart.items.length === 0) {
    return (
      <StateBlock
        icon={<ShoppingBag size={20} aria-hidden="true" />}
        title="Your bag is empty"
        text="Everything you add is held here until you are ready to check out."
        action={{ label: "Explore the shop", href: SHOP_BASE }}
      />
    )
  }

  const reason = cartBlockReason(cart)
  const ready = canCheckout(cart)
  const run = async (variantId: string, action: () => Promise<unknown>) => {
    setPendingVariant(variantId)
    try {
      await action()
    } catch {
      toast({ type: "error", title: "Your bag could not be updated. Please try again." })
    } finally {
      setPendingVariant(null)
    }
  }

  return (
    <div>
      <div className="shop-page__head">
        <div>
          <h1 className="shop-page__title">Your bag</h1>
          <p className="shop-page__lede">{itemCountLabel(cart.item_count)}</p>
        </div>
        {cart.seller_name ? (
          <span className="shop-pdp__seller"><Store size={12} aria-hidden="true" /> Sold by {cart.seller_name}</span>
        ) : null}
      </div>

      {isMixedSellerCart(cart) ? (
        <p className="shop-notice shop-notice--danger" role="alert" style={{ marginBottom: 12 }}>
          <AlertTriangle size={14} aria-hidden="true" /> Your bag has items from more than one seller. Remove the items from one of them to check out.
        </p>
      ) : null}

      <div className="shop-bag">
        <section className="shop-bag__lines" aria-label="Items in your bag">
          {cart.items.map((line) => (
            <BagLine
              key={line.variant_id}
              line={line}
              busy={busy && pendingVariant === line.variant_id}
              onQuantity={(quantity) => void run(line.variant_id, () =>
                quantity <= 0 ? remove.mutateAsync(line.variant_id) : update.mutateAsync({ variant_id: line.variant_id, quantity }))}
              onRemove={() => void run(line.variant_id, () => remove.mutateAsync(line.variant_id))}
            />
          ))}
          <Link href={SHOP_BASE} className="shop-link">Continue shopping</Link>
        </section>

        <aside className="shop-bag__summary" aria-label="Order summary">
          <h2>Summary</h2>
          <div className="shop-bag__row"><span>Items</span><span>{cart.item_count}</span></div>
          <div className="shop-bag__row"><span>Subtotal</span><span>{inrMinor(cart.subtotal_minor)}</span></div>
          <div className="shop-bag__row shop-bag__row--total">
            <span>Estimated total</span>
            <strong>{inrMinor(cart.subtotal_minor)}</strong>
          </div>
          <p className="shop-bag__note">Taxes and delivery are calculated at checkout.</p>
          <CouponBox
            coupons={coupons.data ?? []}
            loadingCoupons={coupons.isLoading}
            applied={coupon}
            appliedLine={bagCouponLine(listedSaving(coupons.data ?? [], coupon), inrMinor)}
            error={couponError}
            busy={false}
            onApply={applyCoupon}
            onRemove={removeCoupon}
          />
          {reason ? <p className="shop-notice shop-notice--danger" role="alert">{reason}</p> : null}
          <Link
            href={`${SHOP_BASE}/checkout`}
            className="shop-btn shop-btn--primary shop-btn--block"
            aria-disabled={ready ? undefined : true}
            tabIndex={ready ? undefined : -1}
            onClick={(event) => { if (!ready) event.preventDefault() }}
          >
            Proceed to checkout <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  )
}

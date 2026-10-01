"use client"

// "Apply coupon": a code box, the applied code with Remove, and the list of
// codes that apply to the bag (GET /cart/coupons), each with the server's
// saving. Props in, callbacks out; the rules are model/coupons.ts.

import { Check, TicketPercent } from "lucide-react"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import { inrMinor } from "../../money"
import { normaliseCouponCode, unavailableLine, type CartCoupon } from "../../model/coupons"

import "../../shop-offers.css"

export function CouponBox({
  coupons,
  loadingCoupons,
  applied,
  appliedLine,
  error,
  busy,
  onApply,
  onRemove,
}: {
  coupons: readonly CartCoupon[]
  loadingCoupons: boolean
  /** The applied code, "" for none. */
  applied: string
  /** The line under the applied code ("You save ₹120", "Checked at checkout"). */
  appliedLine: string
  error: string
  busy: boolean
  onApply: (code: string) => void
  onRemove: () => void
}) {
  const [typed, setTyped] = useState("")

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!typed.trim() || busy) return
    onApply(typed)
  }

  return (
    <div className="shop-coupons">
      <h3 className="shop-coupons__title">Apply coupon</h3>
      {applied ? (
        <div className="shop-coupons__applied">
          <Check size={16} aria-hidden="true" />
          <span className="shop-coupons__applied-body">
            <span className="shop-coupons__code">{applied}</span>
            {appliedLine ? <span className="shop-coupons__applied-line">{appliedLine}</span> : null}
          </span>
          <button type="button" className="shop-coupons__link" onClick={onRemove} disabled={busy}>
            Remove
          </button>
        </div>
      ) : (
        <form className="shop-coupons__form" onSubmit={submit}>
          <input
            className="shop-coupons__input"
            value={typed}
            onChange={(e) => setTyped(normaliseCouponCode(e.target.value))}
            placeholder="Enter coupon code"
            aria-label="Coupon code"
            aria-invalid={!!error}
            aria-describedby={error ? "shop-coupon-error" : undefined}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <Button type="submit" variant="outline" size="sm" className="h-9" disabled={busy || !typed.trim()}>
            Apply
          </Button>
        </form>
      )}
      {error ? (
        <p id="shop-coupon-error" className="shop-coupons__error" role="alert">
          {error}
        </p>
      ) : null}

      {loadingCoupons ? (
        <Skeleton className="h-12 w-full" />
      ) : coupons.length ? (
        <>
          <p className="shop-coupons__list-title">Available coupons</p>
          <ul className="shop-coupons__list">
            {coupons.map((c) => {
              const isApplied = c.code === applied
              const why = unavailableLine(c, inrMinor)
              return (
                <li key={c.code} className={c.applicable ? "shop-coupons__item" : "shop-coupons__item is-unavailable"}>
                  <TicketPercent size={16} aria-hidden="true" className="shop-offers__icon" />
                  <span className="shop-coupons__item-body">
                    <span className="shop-coupons__code">{c.code}</span>
                    {c.discountMinor > 0 ? <span className="shop-coupons__save">Save {inrMinor(c.discountMinor)}</span> : null}
                    {c.text ? <span className="shop-coupons__text">{c.text}</span> : null}
                    {why ? <span className="shop-coupons__why">{why}</span> : null}
                  </span>
                  {!c.applicable ? null : isApplied ? (
                    <span className="shop-coupons__tag">Applied</span>
                  ) : (
                    <button
                      type="button"
                      className="shop-coupons__link"
                      disabled={busy}
                      onClick={() => {
                        setTyped("")
                        onApply(c.code)
                      }}
                      aria-label={`Apply coupon ${c.code}`}
                    >
                      Apply
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
    </div>
  )
}

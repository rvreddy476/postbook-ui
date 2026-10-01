"use client"

// Create or edit one MSeller coupon. The rules (validation, rupees → paise,
// percent → basis points, the PATCH that carries only what changed) are
// model/sellerCoupons.ts; this file draws the fields and sends the body.

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useGlobalToast } from "@/contexts/ToastContext"

import { useCreateSellerCoupon, usePatchSellerCoupon } from "../../hooks/sellerCoupons"
import { inrMinor } from "../../money"
import { apiEnvelope } from "../../model/sell"
import {
  EMPTY_COUPON_DRAFT,
  bpsToPercent,
  couponSaveError,
  createCouponBody,
  draftFromCoupon,
  hasErrors,
  patchCouponBody,
  validateCouponDraft,
  type CouponAppliesTo,
  type CouponDiscountType,
  type CouponDraft,
  type SellerCoupon,
} from "../../model/sellerCoupons"
import { Field, Notice, Panel, Select, TextField } from "./primitives"

import "../../shop-offers.css"

/** The type picker, alphabetical by label. */
const DISCOUNT_TYPES: ReadonlyArray<{ value: CouponDiscountType; label: string }> = [
  { value: "flat", label: "Amount off (₹)" },
  { value: "percentage", label: "Percentage off (%)" },
]

/** Applies-to, alphabetical by label. */
const APPLIES_TO: ReadonlyArray<{ value: CouponAppliesTo; label: string }> = [
  { value: "all", label: "All my products" },
  { value: "product", label: "Chosen products" },
]

export function CouponForm({
  coupon,
  products,
  onClose,
}: {
  /** null to create. */
  coupon: SellerCoupon | null
  products: ReadonlyArray<{ id: string; title: string }>
  onClose: () => void
}) {
  const toast = useGlobalToast()
  const create = useCreateSellerCoupon()
  const patch = usePatchSellerCoupon()
  const mode = coupon ? "edit" : "create"
  const [draft, setDraft] = useState<CouponDraft>(() => (coupon ? draftFromCoupon(coupon) : EMPTY_COUPON_DRAFT))
  const [attempted, setAttempted] = useState(false)
  const [failure, setFailure] = useState("")
  const errors = validateCouponDraft(draft, mode)
  const shown = attempted ? errors : {}
  const busy = create.isPending || patch.isPending
  const set = <K extends keyof CouponDraft>(key: K, value: CouponDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const isPercent = draft.discountType === "percentage"

  async function submit() {
    setAttempted(true)
    setFailure("")
    if (hasErrors(errors)) return
    try {
      if (!coupon) {
        await create.mutateAsync(createCouponBody(draft))
        toast({ type: "success", title: "Coupon created" })
      } else {
        const body = patchCouponBody(coupon, draft)
        if (Object.keys(body).length === 0) {
          onClose()
          return
        }
        await patch.mutateAsync({ id: coupon.id, body })
        toast({ type: "success", title: "Coupon saved" })
      }
      onClose()
    } catch (error) {
      const { code, status } = apiEnvelope(error)
      setFailure(couponSaveError(code, status))
    }
  }

  const toggleProduct = (id: string, on: boolean) =>
    set("applicableIds", on ? [...draft.applicableIds, id] : draft.applicableIds.filter((x) => x !== id))

  return (
    <Panel title={coupon ? `Edit ${coupon.code}` : "New coupon"}>
      <form
        className="shop-sell-coupons"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        noValidate
      >
        {coupon ? (
          <p className="shop-sell-coupons__fixed">
            {coupon.discountType === "percentage" ? `${bpsToPercent(coupon.discountValue)}% off` : `${inrMinor(coupon.discountValue)} off`}
            {" · "}
            {coupon.appliesTo === "product" ? `${coupon.applicableIds.length} chosen product${coupon.applicableIds.length === 1 ? "" : "s"}` : "All your products"}
            {". "}The code, the discount and what it applies to can't change after a coupon is created.
          </p>
        ) : null}

        <div className="shop-sell-coupons__grid">
          {!coupon ? (
            <TextField
              id="coupon-code"
              label="Code"
              value={draft.code}
              onChange={(v) => set("code", v.replace(/\s+/g, "").toUpperCase())}
              error={shown.code}
              help="4 to 20 letters and numbers, like DIWALI20."
              required
              maxLength={20}
              autoComplete="off"
            />
          ) : null}
          <TextField
            id="coupon-description"
            label="Description"
            value={draft.description}
            onChange={(v) => set("description", v)}
            error={shown.description}
            help="Optional. Buyers see this under the code."
            maxLength={200}
          />

          {!coupon ? (
            <>
              <Field id="coupon-type" label="Discount" required>
                <Select id="coupon-type" value={draft.discountType} onChange={(e) => set("discountType", e.target.value as CouponDiscountType)}>
                  {DISCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <TextField
                id="coupon-value"
                label={isPercent ? "Percentage off" : "Amount off (₹)"}
                value={draft.discountValue}
                onChange={(v) => set("discountValue", v)}
                error={shown.discountValue}
                help={isPercent ? "Up to two decimals, like 10 or 12.5." : "In rupees, like 150 or 99.50."}
                inputMode="decimal"
                required
              />
            </>
          ) : null}

          {isPercent ? (
            <TextField
              id="coupon-max-discount"
              label="Most it can take off (₹)"
              value={draft.maxDiscount}
              onChange={(v) => set("maxDiscount", v)}
              error={shown.maxDiscount}
              help="Optional. Leave empty for no cap."
              inputMode="decimal"
            />
          ) : null}
          <TextField
            id="coupon-min-order"
            label="Minimum order (₹)"
            value={draft.minOrder}
            onChange={(v) => set("minOrder", v)}
            error={shown.minOrder}
            help="Optional. Leave empty for no minimum."
            inputMode="decimal"
          />
          <TextField
            id="coupon-max-uses"
            label="Total uses"
            value={draft.maxUses}
            onChange={(v) => set("maxUses", v)}
            error={shown.maxUses}
            help="Optional. Leave empty for unlimited."
            inputMode="numeric"
          />
          <TextField
            id="coupon-max-per-user"
            label="Uses per buyer"
            value={draft.maxUsesPerUser}
            onChange={(v) => set("maxUsesPerUser", v)}
            error={shown.maxUsesPerUser}
            inputMode="numeric"
            required
          />
          <TextField
            id="coupon-starts"
            label="Starts"
            type="datetime-local"
            value={draft.startsAt}
            onChange={(v) => set("startsAt", v)}
            error={shown.startsAt}
            help={coupon ? null : "Optional. Leave empty to start now."}
          />
          <TextField
            id="coupon-ends"
            label="Ends"
            type="datetime-local"
            value={draft.expiresAt}
            onChange={(v) => set("expiresAt", v)}
            error={shown.expiresAt}
            help="Optional. Leave empty for no end date."
          />

          {!coupon ? (
            <div className="shop-sell-coupons__wide">
              <Field id="coupon-applies" label="Applies to" error={shown.applicableIds}>
                <Select id="coupon-applies" value={draft.appliesTo} onChange={(e) => set("appliesTo", e.target.value as CouponAppliesTo)}>
                  {APPLIES_TO.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {draft.appliesTo === "product" ? (
                products.length ? (
                  <div className="shop-sell-coupons__products" role="group" aria-label="Your products">
                    {products.map((p) => (
                      <label key={p.id}>
                        <input type="checkbox" checked={draft.applicableIds.includes(p.id)} onChange={(e) => toggleProduct(p.id, e.target.checked)} />
                        {p.title}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="shop-sell-muted">You have no products yet.</p>
                )
              ) : null}
            </div>
          ) : null}

          <div className="shop-sell-coupons__wide shop-sell-coupons__checks">
            <label>
              <input type="checkbox" checked={draft.isPublic} onChange={(e) => set("isPublic", e.target.checked)} />
              Show on my product pages
            </label>
            <span className="shop-sell-muted">Off makes it a secret code that only buyers you give it to can use.</span>
          </div>
        </div>

        {failure ? <Notice tone="danger">{failure}</Notice> : null}

        <div className="shop-sell-coupons__actions">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving…" : coupon ? "Save" : "Create coupon"}
          </Button>
        </div>
      </form>
    </Panel>
  )
}

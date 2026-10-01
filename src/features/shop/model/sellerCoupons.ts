/*
  MSeller coupons (coupons-offers contract §B, and the additions pinned by
  the admin lane, 97856085):

    GET   /v1/commerce/seller/coupons
    POST  /v1/commerce/seller/coupons      create
    PATCH /v1/commerce/seller/coupons/:id  edit / deactivate (is_active=false)

  There is no delete. Code, discount type, discount value and applies-to
  are fixed after create. A PATCH carries ONLY the fields that changed; an
  explicit JSON null CLEARS an optional field and an absent key means "no
  change".

  Money the seller types is rupees and goes through money.ts parseMinor
  into integer paise; a percentage goes into basis points by integer
  arithmetic on the typed digits — "12.5" is 1250, never 12.5 * 100.
*/

import { parseMinor } from "../money"

/* ── the row on the wire ─────────────────────────────────────────── */

export type CouponDiscountType = "percentage" | "flat"
export type CouponAppliesTo = "all" | "product"

export interface WireSellerCoupon {
  id?: string
  code?: string
  description?: string | null
  discount_type?: string
  /** Basis points for a percentage, paise for a flat coupon. */
  discount_value?: number
  discount_basis_points?: number
  discount_value_minor?: number
  max_discount_minor?: number | null
  max_discount_amount_minor?: number | null
  min_order_minor?: number | null
  min_order_amount_minor?: number | null
  max_uses?: number | null
  max_uses_per_user?: number | null
  uses_count?: number
  applicable_to?: string
  applicable_ids?: string[] | null
  starts_at?: string | null
  expires_at?: string | null
  is_public?: boolean
  is_active?: boolean
  funded_by?: string
  seller_id?: string | null
}

export interface SellerCoupon {
  id: string
  code: string
  description: string
  discountType: CouponDiscountType
  /** bps for percentage, paise for flat. */
  discountValue: number
  /** Paise; null for "no cap". */
  maxDiscountMinor: number | null
  /** Paise; 0 for "no minimum". */
  minOrderMinor: number
  /** null for "unlimited". */
  maxUses: number | null
  maxUsesPerUser: number
  usesCount: number
  appliesTo: CouponAppliesTo
  applicableIds: string[]
  startsAt: string
  expiresAt: string
  isPublic: boolean
  isActive: boolean
}

function nonNegInt(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function positiveOrNull(value: unknown): number | null {
  const n = nonNegInt(value)
  return n && n > 0 ? n : null
}

export function toSellerCoupon(wire: WireSellerCoupon): SellerCoupon | null {
  if (!wire || !wire.id || !wire.code) return null
  const discountType: CouponDiscountType = wire.discount_type === "flat" ? "flat" : "percentage"
  const value =
    nonNegInt(wire.discount_value) ||
    (discountType === "percentage" ? nonNegInt(wire.discount_basis_points) : nonNegInt(wire.discount_value_minor)) ||
    0
  return {
    id: wire.id,
    code: wire.code,
    description: wire.description || "",
    discountType,
    discountValue: value,
    maxDiscountMinor: positiveOrNull(wire.max_discount_minor) ?? positiveOrNull(wire.max_discount_amount_minor),
    minOrderMinor: nonNegInt(wire.min_order_minor) || nonNegInt(wire.min_order_amount_minor) || 0,
    maxUses: positiveOrNull(wire.max_uses),
    maxUsesPerUser: positiveOrNull(wire.max_uses_per_user) ?? 1,
    usesCount: nonNegInt(wire.uses_count) ?? 0,
    appliesTo: wire.applicable_to === "product" ? "product" : "all",
    applicableIds: Array.isArray(wire.applicable_ids) ? wire.applicable_ids.filter((id) => typeof id === "string" && id) : [],
    startsAt: wire.starts_at || "",
    expiresAt: wire.expires_at || "",
    isPublic: wire.is_public !== false,
    isActive: wire.is_active !== false,
  }
}

/** The list, `[]`, `{items}` or `{coupons}`; unreadable rows are dropped. Newest first is the server's; kept. */
export function toSellerCoupons(data: unknown): SellerCoupon[] {
  const r = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null
  const rows: unknown[] = Array.isArray(data) ? data : Array.isArray(r?.items) ? (r!.items as unknown[]) : Array.isArray(r?.coupons) ? (r!.coupons as unknown[]) : []
  return rows.map((row) => toSellerCoupon(row as WireSellerCoupon)).filter((c): c is SellerCoupon => c !== null)
}

/* ── percent ⇄ basis points, integers only ───────────────────────── */

const PERCENT = /^(\d{1,3})(?:\.(\d{1,2}))?$/

/**
  "12.5" → 1250, "10" → 1000, "0.25" → 25. Up to two decimals, nothing
  else; null for anything that is not a plain percentage. The digits are
  added as integers, so no float ever sees the value.
*/
export function percentToBps(raw: string): number | null {
  const s = raw.trim().replace(/%$/, "").trim()
  const m = PERCENT.exec(s)
  if (!m) return null
  const whole = Number(m[1])
  const frac = Number((m[2] || "").padEnd(2, "0"))
  return whole * 100 + frac
}

/** 1250 → "12.5", 1000 → "10", 25 → "0.25". */
export function bpsToPercent(bps: number): string {
  if (!Number.isSafeInteger(bps) || bps < 0) return ""
  const whole = Math.floor(bps / 100)
  const frac = bps % 100
  if (frac === 0) return String(whole)
  return `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`
}

/** Paise → the "1234.50" / "1234" an input shows ("" for none). */
export function minorToRupeeInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined || !Number.isSafeInteger(minor) || minor <= 0) return ""
  const rupees = Math.floor(minor / 100)
  const paise = minor % 100
  return paise === 0 ? String(rupees) : `${rupees}.${String(paise).padStart(2, "0")}`
}

/* ── dates: ISO on the wire, datetime-local in the form ──────────── */

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** ISO → "YYYY-MM-DDTHH:MM" in the browser's zone, for <input type="datetime-local">; "" for none. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "YYYY-MM-DDTHH:MM" (browser zone) → ISO; null when it is not a readable date. */
export function localInputToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/* ── the form ────────────────────────────────────────────────────── */

export interface CouponDraft {
  code: string
  description: string
  discountType: CouponDiscountType
  /** Percent for percentage ("12.5"), rupees for flat ("150"). */
  discountValue: string
  /** Rupees; "" for no cap. Percentage only. */
  maxDiscount: string
  /** Rupees; "" for no minimum. */
  minOrder: string
  /** Whole number; "" for unlimited. */
  maxUses: string
  maxUsesPerUser: string
  appliesTo: CouponAppliesTo
  applicableIds: string[]
  /** datetime-local; "" for "from now" (create) . */
  startsAt: string
  /** datetime-local; "" for "never". */
  expiresAt: string
  isPublic: boolean
}

export const EMPTY_COUPON_DRAFT: CouponDraft = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  maxDiscount: "",
  minOrder: "",
  maxUses: "",
  maxUsesPerUser: "1",
  appliesTo: "all",
  applicableIds: [],
  startsAt: "",
  expiresAt: "",
  isPublic: true,
}

/** The form, filled from a saved coupon. */
export function draftFromCoupon(c: SellerCoupon): CouponDraft {
  return {
    code: c.code,
    description: c.description,
    discountType: c.discountType,
    discountValue: c.discountType === "percentage" ? bpsToPercent(c.discountValue) : minorToRupeeInput(c.discountValue),
    maxDiscount: minorToRupeeInput(c.maxDiscountMinor),
    minOrder: minorToRupeeInput(c.minOrderMinor),
    maxUses: c.maxUses === null ? "" : String(c.maxUses),
    maxUsesPerUser: String(c.maxUsesPerUser),
    appliesTo: c.appliesTo,
    applicableIds: [...c.applicableIds],
    startsAt: isoToLocalInput(c.startsAt),
    expiresAt: isoToLocalInput(c.expiresAt),
    isPublic: c.isPublic,
  }
}

export const COUPON_CODE_RULE = /^[A-Z0-9]{4,20}$/
export const DESCRIPTION_MAX = 200

/** The code as the server stores it: spaces gone, upper-cased. */
export function normaliseSellerCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase()
}

/** A whole number ≥ 1, or null. */
function wholeCount(raw: string): number | null {
  const s = raw.trim()
  if (!/^\d{1,9}$/.test(s)) return null
  const n = Number(s)
  return n >= 1 ? n : null
}

/** Rupees → positive paise, or null. */
function positivePaise(raw: string): number | null {
  const minor = parseMinor(raw)
  return minor !== null && minor > 0 ? minor : null
}

export type CouponDraftErrors = Partial<Record<keyof CouponDraft, string>>

/**
  Every field's problem, keyed by field. `mode` "edit" skips the fields that
  are fixed after create (code, type, value, applies-to).
*/
export function validateCouponDraft(d: CouponDraft, mode: "create" | "edit"): CouponDraftErrors {
  const e: CouponDraftErrors = {}
  if (mode === "create") {
    const code = normaliseSellerCode(d.code)
    if (!code) e.code = "Enter a code."
    else if (!COUPON_CODE_RULE.test(code)) e.code = "4 to 20 letters and numbers, no spaces or symbols."

    if (!d.discountValue.trim()) e.discountValue = d.discountType === "percentage" ? "Enter the percentage off." : "Enter the amount off."
    else if (d.discountType === "percentage") {
      const bps = percentToBps(d.discountValue)
      if (bps === null || bps <= 0 || bps > 10000) e.discountValue = "A percentage between 0.01 and 100, up to two decimals."
    } else if (positivePaise(d.discountValue) === null) e.discountValue = "An amount in rupees, like 150 or 99.50."

    if (d.appliesTo === "product" && d.applicableIds.length === 0) e.applicableIds = "Choose at least one of your products."
  }
  if (d.description.trim().length > DESCRIPTION_MAX) e.description = `Keep it under ${DESCRIPTION_MAX} characters.`
  if (d.discountType === "percentage" && d.maxDiscount.trim() && positivePaise(d.maxDiscount) === null) {
    e.maxDiscount = "An amount in rupees, or leave it empty for no cap."
  }
  if (d.minOrder.trim()) {
    const min = parseMinor(d.minOrder)
    if (min === null || min < 0) e.minOrder = "An amount in rupees, or leave it empty for no minimum."
  }
  if (d.maxUses.trim() && wholeCount(d.maxUses) === null) e.maxUses = "A whole number, or leave it empty for unlimited."
  if (wholeCount(d.maxUsesPerUser) === null) e.maxUsesPerUser = "A whole number, 1 or more."
  if (d.startsAt && localInputToIso(d.startsAt) === null) e.startsAt = "Choose a date and time."
  if (mode === "edit" && !d.startsAt) e.startsAt = "A coupon keeps its start date."
  if (d.expiresAt) {
    const ends = localInputToIso(d.expiresAt)
    const starts = d.startsAt ? localInputToIso(d.startsAt) : null
    if (ends === null) e.expiresAt = "Choose a date and time."
    else if (starts && Date.parse(ends) <= Date.parse(starts)) e.expiresAt = "The end must be after the start."
  }
  return e
}

export function hasErrors(e: CouponDraftErrors): boolean {
  return Object.keys(e).length > 0
}

/** POST /seller/coupons body. Call only on a draft with no errors. */
export interface CouponCreateBody {
  code: string
  description: string
  discount_type: CouponDiscountType
  discount_value: number
  max_discount_minor?: number
  min_order_minor?: number
  max_uses?: number
  max_uses_per_user: number
  applicable_to: CouponAppliesTo
  applicable_ids: string[]
  starts_at?: string
  expires_at?: string
  is_public: boolean
}

export function createCouponBody(d: CouponDraft): CouponCreateBody {
  const body: CouponCreateBody = {
    code: normaliseSellerCode(d.code),
    description: d.description.trim(),
    discount_type: d.discountType,
    discount_value: d.discountType === "percentage" ? (percentToBps(d.discountValue) as number) : (positivePaise(d.discountValue) as number),
    max_uses_per_user: wholeCount(d.maxUsesPerUser) as number,
    applicable_to: d.appliesTo,
    applicable_ids: d.appliesTo === "product" ? [...d.applicableIds] : [],
    is_public: d.isPublic,
  }
  const cap = d.discountType === "percentage" && d.maxDiscount.trim() ? positivePaise(d.maxDiscount) : null
  if (cap !== null) body.max_discount_minor = cap
  const min = d.minOrder.trim() ? parseMinor(d.minOrder) : null
  if (min !== null && min > 0) body.min_order_minor = min
  const uses = d.maxUses.trim() ? wholeCount(d.maxUses) : null
  if (uses !== null) body.max_uses = uses
  const starts = d.startsAt ? localInputToIso(d.startsAt) : null
  if (starts) body.starts_at = starts
  const ends = d.expiresAt ? localInputToIso(d.expiresAt) : null
  if (ends) body.expires_at = ends
  return body
}

/** PATCH body: only the editable fields; `null` clears. */
export interface CouponPatchBody {
  description?: string | null
  max_discount_minor?: number | null
  min_order_minor?: number
  max_uses?: number | null
  max_uses_per_user?: number
  starts_at?: string
  expires_at?: string | null
  is_public?: boolean
  is_active?: boolean
}

/**
  The PATCH for an edit: every editable field whose value differs from the
  saved coupon, and nothing else. Clearing max discount, max uses, the end
  date or the description sends an explicit `null` (the server's "clear");
  clearing the minimum order sends 0 ("no minimum" — the field is not one
  of the nullable four). Dates are compared as the form shows them, so an
  untouched date is never re-sent at a different precision.
*/
export function patchCouponBody(saved: SellerCoupon, d: CouponDraft): CouponPatchBody {
  const before = draftFromCoupon(saved)
  const body: CouponPatchBody = {}

  if (d.description.trim() !== before.description.trim()) body.description = d.description.trim() ? d.description.trim() : null

  if (saved.discountType === "percentage" && d.maxDiscount.trim() !== before.maxDiscount) {
    body.max_discount_minor = d.maxDiscount.trim() ? positivePaise(d.maxDiscount) : null
  }

  const minNow = d.minOrder.trim() ? parseMinor(d.minOrder) ?? 0 : 0
  if (minNow !== saved.minOrderMinor) body.min_order_minor = minNow

  const usesNow = d.maxUses.trim() ? wholeCount(d.maxUses) : null
  if (usesNow !== saved.maxUses) body.max_uses = usesNow

  const perUserNow = wholeCount(d.maxUsesPerUser)
  if (perUserNow !== null && perUserNow !== saved.maxUsesPerUser) body.max_uses_per_user = perUserNow

  if (d.startsAt && d.startsAt !== before.startsAt) {
    const iso = localInputToIso(d.startsAt)
    if (iso) body.starts_at = iso
  }
  if (d.expiresAt !== before.expiresAt) body.expires_at = d.expiresAt ? localInputToIso(d.expiresAt) : null

  if (d.isPublic !== saved.isPublic) body.is_public = d.isPublic
  return body
}

/** Deactivate (and its undo) is a PATCH of is_active alone; there is no delete. */
export function activeBody(isActive: boolean): CouponPatchBody {
  return { is_active: isActive }
}

/* ── the list ────────────────────────────────────────────────────── */

/** "10% off, up to ₹200" / "₹150 off". */
export function discountSummary(c: Pick<SellerCoupon, "discountType" | "discountValue" | "maxDiscountMinor">, formatMinor: (minor: number) => string): string {
  if (c.discountType === "flat") return `${formatMinor(c.discountValue)} off`
  const pct = `${bpsToPercent(c.discountValue)}% off`
  return c.maxDiscountMinor ? `${pct}, up to ${formatMinor(c.maxDiscountMinor)}` : pct
}

/** "12 of 100 used" / "12 used". */
export function usesSummary(c: Pick<SellerCoupon, "usesCount" | "maxUses">): string {
  return c.maxUses ? `${c.usesCount} of ${c.maxUses} used` : `${c.usesCount} used`
}

export type CouponState = "active" | "inactive" | "expired" | "scheduled" | "used_up"

/** What the status pill says, decided once. Inactive wins; then the dates; then the cap. */
export function couponState(c: Pick<SellerCoupon, "isActive" | "startsAt" | "expiresAt" | "usesCount" | "maxUses">, nowMs: number): CouponState {
  if (!c.isActive) return "inactive"
  const ends = c.expiresAt ? Date.parse(c.expiresAt) : NaN
  if (Number.isFinite(ends) && ends <= nowMs) return "expired"
  const starts = c.startsAt ? Date.parse(c.startsAt) : NaN
  if (Number.isFinite(starts) && starts > nowMs) return "scheduled"
  if (c.maxUses && c.usesCount >= c.maxUses) return "used_up"
  return "active"
}

export const COUPON_STATE_LABEL: Record<CouponState, string> = {
  active: "Active",
  expired: "Expired",
  inactive: "Off",
  scheduled: "Scheduled",
  used_up: "Used up",
}

/** A refused create or edit, by code. */
export function couponSaveError(code: string, status: number): string {
  switch (code) {
    case "COUPON_CODE_TAKEN":
    case "CODE_TAKEN":
    case "DUPLICATE_CODE":
      return "That code is already taken. Try another."
    case "COUPON_PRODUCT_NOT_OWNED":
    case "PRODUCT_NOT_OWNED":
      return "A coupon can only apply to your own products."
    case "COUPON_IMMUTABLE":
      return "The code, the discount and what it applies to can't change after a coupon is created."
    case "SELLER_NOT_APPROVED":
      return "Coupons open once your shop is approved."
    case "COUPON_NOT_FOUND":
      return "This coupon no longer exists. Refresh the list."
    default:
      if (status === 409) return "That code is already taken. Try another."
      if (status === 400 || status === 422) return "Some details aren't right. Check the form and try again."
      return "The coupon couldn't be saved. Try again."
  }
}

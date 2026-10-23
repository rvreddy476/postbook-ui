/*
  Paid memberships, the pure half (contract pinned 23 Oct 2026,
  memberships-payments-contract.md). No React, no requests: the decoders,
  the request builders, the level form's rules, the lock decision and the
  words. The hooks and screens read everything from here, and the tests pin
  it against fixtures taken from the Go handler structs.

  Routes (monetization-service, under /v1/monetization):
    GET   /tiers                                    my levels (all, inactive too)
    POST  /tiers                                    {name, price_paise, currency, perks}
    PATCH /tiers/:id                                only the fields that changed
    GET   /creators/:creatorId/tiers                a creator's ACTIVE levels (public)
    GET   /creators/:creatorId/membership-eligibility   the creator's own
    POST  /subscribe/:creatorId                     {tier_id} + Idempotency-Key → checkout
    POST  /subscriptions/:id/renew                  → checkout (kind renewal)
    POST  /subscriptions/:id/upgrade                {tier_id} → checkout | {status:"scheduled"|"upgraded"}
    POST  /subscriptions/:id/cancel                 {} → keeps access until the period ends
    GET   /memberships                              my memberships
    GET   /memberships/payments/:paymentId          confirming | paid | failed
    POST  /memberships/payments/:paymentId/verify   advisory: never grants access
    GET   /entitlements?creator_id=&tier_id=        does the caller have access
  and post-service:
    PUT   /v1/posts/:postId/membership              {tier_required_id: uuid | null}

  Go sends zero values ("" / 0 / null) where a field is empty, so every
  decoder treats absent, null and "" alike (`??` alone lets "" through).
*/

/* ── wire helpers ────────────────────────────────────────────────── */

type Wire = Record<string, unknown>

function obj(v: unknown): Wire {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Wire) : {}
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function int(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0
}

/** A timestamp that parses, else "" (Go's zero time 0001-01-01 counts as none). */
function time(v: unknown): string {
  const s = str(v)
  if (!s || s.startsWith("0001-01-01")) return ""
  return Number.isNaN(Date.parse(s)) ? "" : s
}

/** The `data` of a `{data, error, meta}` envelope, or the value itself. */
export function unwrap(body: unknown): unknown {
  const o = obj(body)
  return "data" in o ? o.data : body
}

/** A JSON array that may arrive as a JSON string (perks is json.RawMessage). */
function stringList(v: unknown): string[] {
  if (typeof v === "string") {
    try {
      return stringList(JSON.parse(v))
    } catch {
      return []
    }
  }
  return arr(v).map(str).filter(Boolean)
}

/* ── levels (creator tiers) ──────────────────────────────────────── */

export interface Tier {
  id: string
  creatorId: string
  name: string
  pricePaise: number
  currency: string
  perks: string[]
  subscriberCount: number
  isActive: boolean
}

/** postgres.CreatorTier (monetization-service store.go:144). */
export function toTier(raw: unknown): Tier | null {
  const w = obj(raw)
  const id = str(w.id)
  if (!id) return null
  return {
    id,
    creatorId: str(w.creator_id),
    name: str(w.name),
    pricePaise: int(w.price_paise),
    currency: str(w.currency) || "INR",
    perks: stringList(w.perks),
    subscriberCount: Math.max(0, int(w.subscriber_count)),
    isActive: w.is_active === true,
  }
}

export function toTiers(body: unknown): Tier[] {
  return arr(unwrap(body))
    .map(toTier)
    .filter((t): t is Tier => !!t)
}

/** Active levels, cheapest first: the order every picker shows. */
export function activeLevels(tiers: readonly Tier[]): Tier[] {
  return tiers.filter((t) => t.isActive).sort((a, b) => a.pricePaise - b.pricePaise || a.name.localeCompare(b.name))
}

/**
  The levels a viewer may join to unlock something gated on `requiredTierId`:
  that level and every dearer one (a member at a higher level sees what a
  lower level sees). Nothing required, or a required level that is not on
  sale any more: every active level.
*/
export function levelsThatUnlock(tiers: readonly Tier[], requiredTierId?: string | null): Tier[] {
  const active = activeLevels(tiers)
  if (!requiredTierId) return active
  const required = tiers.find((t) => t.id === requiredTierId)
  if (!required) return active
  return active.filter((t) => t.pricePaise >= required.pricePaise)
}

/* ── the level form ──────────────────────────────────────────────── */

// The server's limits (monetization-service service/membership.go:100-107).
export const MIN_PRICE_PAISE = 2_900
export const MAX_PRICE_PAISE = 299_900
export const MAX_ACTIVE_LEVELS = 3
export const MAX_NAME_LENGTH = 60
export const MAX_PERKS = 10
export const MAX_PERK_LENGTH = 100

export interface TierForm {
  name: string
  /** Rupees as typed: "99" or "99.50". */
  price: string
  /** One perk per line, as typed. */
  perks: string
}

export function emptyTierForm(): TierForm {
  return { name: "", price: "", perks: "" }
}

export function tierFormFrom(t: Tier): TierForm {
  return { name: t.name, price: paiseToInput(t.pricePaise), perks: t.perks.join("\n") }
}

/** 9900 → "99", 9950 → "99.50". */
export function paiseToInput(paise: number): string {
  const rupees = Math.floor(paise / 100)
  const rest = paise % 100
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, "0")}`
}

/** "99" / "99.5" / "99.50" / "1,299" → paise, exactly (no float); null when it is not a price. */
export function parsePricePaise(input: string): number | null {
  const s = input.replace(/[₹,\s]/g, "")
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(s)
  if (!m) return null
  const fraction = (m[2] ?? "").padEnd(2, "0")
  return Number(m[1]) * 100 + Number(fraction || "0")
}

const chars = (s: string) => [...s].length

/** Perks as the server stores them: trimmed, blanks dropped. */
export function parsePerks(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export interface TierFormErrors {
  name?: string
  price?: string
  perks?: string
  /** Not a field: the 3-active-levels rule. */
  form?: string
}

/**
  The server's rules, said before the request. `activeCount` is how many
  active levels the creator has now; `creating` adds one more (an edit of an
  existing level does not change the count).
*/
export function validateTierForm(form: TierForm, opts: { activeCount: number; creating: boolean }): TierFormErrors {
  const errors: TierFormErrors = {}
  const name = form.name.trim()
  if (chars(name) < 1 || chars(name) > MAX_NAME_LENGTH) errors.name = `Give the level a name of 1 to ${MAX_NAME_LENGTH} characters.`
  const paise = parsePricePaise(form.price)
  if (paise === null) errors.price = "Enter a price in rupees, like 99."
  else if (paise < MIN_PRICE_PAISE || paise > MAX_PRICE_PAISE) errors.price = "The price must be between ₹29 and ₹2,999 a month."
  const perks = parsePerks(form.perks)
  if (perks.length > MAX_PERKS) errors.perks = `Up to ${MAX_PERKS} perks.`
  else if (perks.some((p) => chars(p) > MAX_PERK_LENGTH)) errors.perks = `Each perk can be at most ${MAX_PERK_LENGTH} characters.`
  if (opts.creating && opts.activeCount >= MAX_ACTIVE_LEVELS) errors.form = "You can have up to 3 active levels. Turn one off before adding another."
  return errors
}

export const hasErrors = (e: TierFormErrors) => Object.keys(e).length > 0

/** POST /tiers (handler.go:865 CreateTierRequest). Currency is always INR. */
export function createTierBody(form: TierForm): { name: string; price_paise: number; currency: "INR"; perks: string[] } {
  return { name: form.name.trim(), price_paise: parsePricePaise(form.price) ?? 0, currency: "INR", perks: parsePerks(form.perks) }
}

export interface TierPatch {
  name?: string
  price_paise?: number
  perks?: string[]
  is_active?: boolean
}

const samePerks = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((p, i) => p === b[i])

/**
  PATCH /tiers/:id sends only what changed (handler.go:974 UpdateTierRequest:
  every field optional, an absent one left as it is). Until 23 Oct 2026 the
  server wrote absent fields as zero values, so a price-only edit blanked the
  name — never send a field the creator did not change.
*/
export function tierPatch(original: Tier, form: TierForm): TierPatch {
  const patch: TierPatch = {}
  const name = form.name.trim()
  if (name !== original.name) patch.name = name
  const paise = parsePricePaise(form.price)
  if (paise !== null && paise !== original.pricePaise) patch.price_paise = paise
  const perks = parsePerks(form.perks)
  if (!samePerks(perks, original.perks)) patch.perks = perks
  return patch
}

/** Turning a level off (or back on) is its own one-field PATCH. */
export function activePatch(on: boolean): TierPatch {
  return { is_active: on }
}

/* ── eligibility ─────────────────────────────────────────────────── */

export type MissingItem = "age" | "pan" | "followers" | "strikes"

export interface Eligibility {
  eligible: boolean
  missing: MissingItem[]
}

const MISSING_ORDER: readonly MissingItem[] = ["age", "pan", "followers", "strikes"]

function missingList(v: unknown): MissingItem[] {
  const seen = new Set(arr(v).map(str))
  return MISSING_ORDER.filter((m) => seen.has(m))
}

/** service.Eligibility (membership_payments.go:572). */
export function toEligibility(body: unknown): Eligibility {
  const w = obj(unwrap(body))
  const missing = missingList(w.missing)
  return { eligible: w.eligible === true && missing.length === 0, missing }
}

/** What each missing item asks of the creator, in plain words. */
export const MISSING_COPY: Record<MissingItem, { title: string; hint: string; href?: string }> = {
  age: { title: "Be 18 or older", hint: "Your date of birth on your account says how old you are.", href: "/settings/profile" },
  pan: { title: "Add your PAN", hint: "A PAN in your tax profile, so earnings can be paid out.", href: "/settings/tax-profile" },
  followers: { title: "Reach 500 followers", hint: "Memberships open once 500 people follow you." },
  strikes: { title: "No active strikes", hint: "Your account must be in good standing, with no community-guideline strikes." },
}

/* ── checkout ────────────────────────────────────────────────────── */

export interface ClientSession {
  provider: string
  orderId: string
  keyId: string
  merchantName: string
}

export type PaymentKind = "join" | "renewal" | "upgrade"

export interface Checkout {
  subscriptionId: string
  paymentId: string
  kind: PaymentKind
  /** "pending_payment" while open; a replayed, already-paid join answers the subscription's status. */
  status: string
  amountPaise: number
  currency: string
  session: ClientSession | null
}

function kindOf(v: unknown): PaymentKind {
  const k = str(v)
  return k === "renewal" || k === "upgrade" ? k : "join"
}

/** service.Checkout (membership_payments.go:88) + payments.ClientSession (payments/client.go:69). */
export function toCheckout(body: unknown): Checkout {
  const w = obj(unwrap(body))
  const s = w.client_session == null ? null : obj(w.client_session)
  return {
    subscriptionId: str(w.subscription_id),
    paymentId: str(w.payment_id),
    kind: kindOf(w.kind),
    status: str(w.status),
    amountPaise: Math.max(0, int(w.amount_paise)),
    currency: str(w.currency) || "INR",
    session: s ? { provider: str(s.provider), orderId: str(s.order_id), keyId: str(s.key_id), merchantName: str(s.merchant_display_name) } : null,
  }
}

export const MERCHANT_FALLBACK_NAME = "Momentum"

export interface RazorpayOpen {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description?: string
}

/**
  The dialog's options from the checkout alone (the key and order id come
  from client_session, never from the build). null when there is no usable
  Razorpay session: the caller must not open a dialog with a blank key.
*/
export function razorpayOpen(c: Checkout, description?: string): RazorpayOpen | null {
  const s = c.session
  if (!s || s.provider !== "razorpay" || !s.keyId || !s.orderId || c.amountPaise <= 0) return null
  const options: RazorpayOpen = { key: s.keyId, order_id: s.orderId, amount: c.amountPaise, currency: c.currency, name: s.merchantName || MERCHANT_FALLBACK_NAME }
  if (description) options.description = description
  return options
}

/** A replayed join that is already paid answers the live status and no session: nothing to collect. */
export function checkoutAlreadyPaid(c: Checkout): boolean {
  return !c.session && (c.status === "active" || c.status === "cancelled_at_period_end" || c.status === "grace" || c.status === "past_due")
}

export type TierChangeResult = { kind: "checkout"; checkout: Checkout } | { kind: "scheduled"; effectiveAt: string } | { kind: "upgraded" } | { kind: "unchanged" }

/**
  POST /subscriptions/:id/upgrade: 201 a checkout (an upgrade that costs
  something), else 200 service.TierChange (subscription.go:169)
  {status:"scheduled"|"upgraded"|"unchanged", effective_at}.
*/
export function toTierChange(body: unknown): TierChangeResult {
  const w = obj(unwrap(body))
  if (str(w.payment_id)) return { kind: "checkout", checkout: toCheckout(body) }
  const status = str(w.status)
  if (status === "scheduled") return { kind: "scheduled", effectiveAt: time(w.effective_at) }
  if (status === "upgraded") return { kind: "upgraded" }
  return { kind: "unchanged" }
}

/* ── the payment read ────────────────────────────────────────────── */

export interface PaymentReading {
  state: "confirming" | "paid" | "failed"
  refundStatus: "" | "pending" | "refunded"
}

/** service.PaymentView (membership_payments.go:156): only "paid" and "failed" are verdicts. */
export function toPaymentReading(body: unknown): PaymentReading {
  const w = obj(unwrap(body))
  const status = str(w.status)
  const refund = str(w.refund_status)
  return {
    state: status === "paid" ? "paid" : status === "failed" ? "failed" : "confirming",
    refundStatus: refund === "pending" || refund === "refunded" ? refund : "",
  }
}

/* ── my memberships ──────────────────────────────────────────────── */

export type MembershipStatus = "pending_payment" | "active" | "cancelled_at_period_end" | "paused" | "past_due" | "grace" | "cancelled" | "expired"

const STATUSES: ReadonlySet<string> = new Set(["pending_payment", "active", "cancelled_at_period_end", "paused", "past_due", "grace", "cancelled", "expired"])

export interface MyMembership {
  subscriptionId: string
  creatorId: string
  tier: { id: string; name: string; pricePaise: number }
  status: MembershipStatus
  currentPeriodEnd: string
  /** When access ends; "" for a status that grants none. */
  accessUntil: string
  renewAvailable: boolean
}

/** service.MembershipView (membership_payments.go:462). */
export function toMyMembership(raw: unknown): MyMembership | null {
  const w = obj(raw)
  const subscriptionId = str(w.subscription_id)
  if (!subscriptionId) return null
  const tier = obj(w.tier)
  const status = str(w.status)
  return {
    subscriptionId,
    creatorId: str(obj(w.creator).id),
    tier: { id: str(tier.id), name: str(tier.name), pricePaise: Math.max(0, int(tier.price_paise)) },
    status: (STATUSES.has(status) ? status : "expired") as MembershipStatus,
    currentPeriodEnd: time(w.current_period_end),
    accessUntil: time(w.access_until),
    renewAvailable: w.renew_available === true,
  }
}

export function toMyMemberships(body: unknown): MyMembership[] {
  return arr(unwrap(body))
    .map(toMyMembership)
    .filter((m): m is MyMembership => !!m)
}

/** Live access right now (the statuses that grant it; pending_payment does not). */
export function hasAccess(m: Pick<MyMembership, "status">): boolean {
  return m.status === "active" || m.status === "cancelled_at_period_end" || m.status === "paused" || m.status === "past_due" || m.status === "grace"
}

/** Cancel is offered while the membership still renews (cancel keeps access until the end). */
export function canCancel(m: Pick<MyMembership, "status">): boolean {
  return m.status === "active" || m.status === "past_due" || m.status === "grace"
}

/** Change level while the membership is live and not winding down. */
export function canChangeLevel(m: Pick<MyMembership, "status">): boolean {
  return m.status === "active"
}

export function formatDate(iso: string, locale = "en-IN"): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
}

export function formatPrice(paise: number, locale = "en-IN"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: "INR", maximumFractionDigits: paise % 100 === 0 ? 0 : 2 }).format(paise / 100)
  } catch {
    return `₹${paiseToInput(paise)}`
  }
}

export const perMonth = (paise: number) => `${formatPrice(paise)} a month`

/**
  One line about where a membership stands. Renewal is by reminder: nothing
  is charged automatically, so "renews" always means "pay to renew by".
*/
export function statusLine(m: MyMembership, now: Date = new Date()): string {
  const end = formatDate(m.accessUntil || m.currentPeriodEnd)
  switch (m.status) {
    case "active":
      return end ? `Active. Renew by ${end} to keep access.` : "Active."
    case "cancelled_at_period_end":
      return end ? `Cancelled. You keep access until ${end}.` : "Cancelled. You keep access until the period ends."
    case "past_due":
    case "grace":
      return end ? `Payment due. Access ends ${end} unless you renew.` : "Payment due. Renew to keep access."
    case "paused":
      return "Paused."
    case "pending_payment":
      return "Waiting for payment."
    default: {
      const ended = m.currentPeriodEnd && Date.parse(m.currentPeriodEnd) <= now.getTime() ? formatDate(m.currentPeriodEnd) : ""
      return ended ? `Ended ${ended}.` : "Ended."
    }
  }
}

export const STATUS_LABEL: Record<MembershipStatus, string> = {
  pending_payment: "Pending",
  active: "Active",
  cancelled_at_period_end: "Cancelled",
  paused: "Paused",
  past_due: "Payment due",
  grace: "Payment due",
  cancelled: "Ended",
  expired: "Ended",
}

/* ── entitlement and the lock ────────────────────────────────────── */

export type Access = "allowed" | "denied" | "unknown"

/** service.Entitlement (entitlement.go:34) → allowed/denied. */
export function toAccess(body: unknown): Access {
  const w = obj(unwrap(body))
  if (w.allowed === true) return "allowed"
  if (w.allowed === false) return "denied"
  return "unknown"
}

export interface LockInput {
  tierRequiredId?: string | null
  bodyRedacted?: boolean | null
  isOwner: boolean
  /** The viewer's entitlement for this creator and level: "unknown" while loading, on error, or when not asked. */
  access: Access
  /**
    Whether a served (unredacted) body counts as the server's yes. post-service
    redacts every post row for a non-member and fails closed
    (members_read.go), so a card can trust it. The watch page cannot: its
    player plays from media ids, and it shows the lock until access is known.
  */
  trustServedBody: boolean
}

/** Locked: draw the lock card, never the body. */
export function membersLocked(i: LockInput): boolean {
  if (!i.tierRequiredId && !i.bodyRedacted) return false
  if (i.isOwner) return false
  if (i.bodyRedacted) return true
  if (i.access === "allowed") return false
  if (i.access === "denied") return true
  return !i.trustServedBody
}

/** A gated row of any kind, as the Members tab and the lock cards read it. */
export interface GatedRow {
  id: string
  authorId: string
  tierRequiredId: string
  bodyRedacted: boolean
  contentType: string
  title: string
  coverMediaId: string
  durationMs: number
  createdAt: string
}

/** A post row (post-service by-author / feed) → its gated view; null when the row is not members-only. */
export function toGatedRow(raw: unknown): GatedRow | null {
  const w = obj(raw)
  const id = str(w.id)
  const tier = str(w.tier_required_id)
  if (!id || !tier) return null
  const title = str(w.title) || (w.body_redacted === true ? "" : str(w.text).split(/\r?\n/)[0] ?? "")
  const video = arr(w.media).map(obj).find((m) => m.kind === "video")
  return {
    id,
    authorId: str(w.author_id),
    tierRequiredId: tier,
    bodyRedacted: w.body_redacted === true,
    contentType: str(w.content_type) || "post",
    title: title.slice(0, 140),
    coverMediaId: str(w.cover_media_id) || str(arr(w.media).map(obj).find((m) => m.kind === "image")?.media_id),
    durationMs: Math.max(0, int(w.duration_ms) || int(video?.duration_ms)),
    createdAt: time(w.created_at),
  }
}

export function gatedRows(rows: readonly unknown[]): GatedRow[] {
  return rows.map(toGatedRow).filter((r): r is GatedRow => !!r)
}

const SHORT_TYPES = new Set(["flick", "reel", "short"])

/** Where a members-only item opens. */
export function gatedHref(r: Pick<GatedRow, "id" | "contentType">): string {
  if (SHORT_TYPES.has(r.contentType)) return `/reels/${r.id}`
  if (r.contentType === "long_video" || r.contentType === "podcast") return `/posttube/watch/${r.id}`
  return `/post/${r.id}`
}

export function kindLabel(contentType: string): string {
  if (SHORT_TYPES.has(contentType)) return "Short"
  if (contentType === "long_video") return "Video"
  if (contentType === "podcast") return "Podcast"
  return "Post"
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return ""
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`
}

/* ── the members-only gate on a post ─────────────────────────────── */

/** PUT /v1/posts/:id/membership (post-service handler.go:1105): a level id sets, null clears. */
export function gateRequest(postId: string, tierId: string | null): { url: string; body: { tier_required_id: string | null } } {
  return { url: `/v1/posts/${encodeURIComponent(postId)}/membership`, body: { tier_required_id: tierId || null } }
}

/** The choice the "Members only" control shows: "Everyone", or a level and every dearer one. */
export function gateOptionLabel(tier: Pick<Tier, "name" | "pricePaise">, levels: readonly Pick<Tier, "pricePaise">[]): string {
  const dearer = levels.some((l) => l.pricePaise > tier.pricePaise)
  return dearer ? `${tier.name} and above` : tier.name
}

/* ── request builders (the monetization routes) ──────────────────── */

const M = "/v1/monetization"

export interface Request {
  url: string
  body?: unknown
  headers?: Record<string, string>
}

/** POST /subscribe/:creatorId (membership_payments_handler.go:178): the key in the contract's header. */
export function subscribeRequest(creatorId: string, tierId: string, idempotencyKey: string): Request {
  return { url: `${M}/subscribe/${encodeURIComponent(creatorId)}`, body: { tier_id: tierId }, headers: { "Idempotency-Key": idempotencyKey } }
}

export function renewRequest(subscriptionId: string, idempotencyKey: string): Request {
  return { url: `${M}/subscriptions/${encodeURIComponent(subscriptionId)}/renew`, body: {}, headers: { "Idempotency-Key": idempotencyKey } }
}

export function upgradeRequest(subscriptionId: string, tierId: string, idempotencyKey: string): Request {
  return { url: `${M}/subscriptions/${encodeURIComponent(subscriptionId)}/upgrade`, body: { tier_id: tierId }, headers: { "Idempotency-Key": idempotencyKey } }
}

/** Cancel at period end (subscription_handler.go:99): an empty body is never "immediate". */
export function cancelRequest(subscriptionId: string): Request {
  return { url: `${M}/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, body: {} }
}

export function paymentUrl(paymentId: string): string {
  return `${M}/memberships/payments/${encodeURIComponent(paymentId)}`
}

export function verifyRequest(paymentId: string, resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }): Request {
  return { url: `${paymentUrl(paymentId)}/verify`, body: { razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature } }
}

export function entitlementParams(creatorId: string, tierId?: string | null): Record<string, string> {
  return tierId ? { creator_id: creatorId, tier_id: tierId } : { creator_id: creatorId }
}

/* ── one Idempotency-Key per decision to pay ─────────────────────── */

export interface JoinKeys {
  /** The key for this intent (a level, a renewal…): the same until reset, a new one when the intent changes. */
  keyFor(intent: string): string
  reset(): void
}

/**
  A failed POST may have committed before its answer was lost: the retry
  must send the SAME key so the server returns that checkout instead of
  opening a second one. A verdict (paid, failed, a refusal) resets it; a
  different level is a different intent and gets its own key (the server
  answers IDEMPOTENCY_KEY_REUSED otherwise).
*/
export function createJoinKeys(generate: () => string = () => crypto.randomUUID()): JoinKeys {
  let held: { intent: string; key: string } | null = null
  return {
    keyFor(intent: string) {
      if (!held || held.intent !== intent) held = { intent, key: generate() }
      return held.key
    },
    reset() {
      held = null
    },
  }
}

/* ── errors ──────────────────────────────────────────────────────── */

export interface MembershipError {
  /** HTTP status; 0 when there was no response. */
  status: number
  code: string
  missing: MissingItem[]
}

export function toMembershipError(err: unknown): MembershipError {
  const response = obj(obj(err).response)
  const e = obj(obj(response.data).error)
  return { status: int(response.status), code: str(e.code), missing: missingList(obj(e.details).missing) }
}

const ERROR_COPY: Record<string, string> = {
  TIER_NAME_INVALID: "Give the level a name of 1 to 60 characters.",
  TIER_PRICE_OUT_OF_RANGE: "The price must be between ₹29 and ₹2,999 a month.",
  TIER_PERKS_INVALID: "Up to 10 perks, each at most 100 characters.",
  TIER_CURRENCY_INVALID: "Levels are priced in rupees.",
  TIER_LIMIT: "You can have up to 3 active levels. Turn one off before adding another.",
  MEMBERSHIPS_NOT_ELIGIBLE: "You can't offer memberships yet.",
  MEMBERSHIPS_NOT_ENABLED: "Memberships aren't available yet.",
  MONETIZATION_NOT_LAUNCHED: "Memberships aren't available yet.",
  MAINTENANCE: "Memberships are paused for maintenance. Try again later.",
  MEMBERSHIP_PAYMENTS_UNAVAILABLE: "Payments are unavailable right now. Try again in a few minutes.",
  PAYMENT_SESSION_UNAVAILABLE: "Checkout couldn't be opened. Try again.",
  CHECKOUT_EXPIRED: "That checkout expired. Start again.",
  ALREADY_SUBSCRIBED: "You're already a member of this creator.",
  IDEMPOTENCY_KEY_REUSED: "Checkout couldn't start. Try again.",
  CANNOT_SUBSCRIBE_TO_SELF: "You can't join your own membership.",
  TIER_NOT_FOUND: "That level isn't offered any more.",
  TIER_INACTIVE: "That level isn't offered any more.",
  TIER_CREATOR_MISMATCH: "That level isn't offered any more.",
  NOT_FOUND: "That membership wasn't found.",
  FORBIDDEN: "That isn't your membership.",
  SUBSCRIPTION_NOT_RENEWABLE: "This membership can't be renewed any more. Join again instead.",
  RENEWAL_ALREADY_PAID: "This period is already paid.",
  SUBSCRIPTION_STATE_CHANGED: "Your membership changed while this was running. Nothing was charged. Try again.",
  REFUND_NOT_ALLOWED: "This payment can't be refunded.",
}

export const NETWORK_COPY = "The connection dropped. Check your network and try again."

/** A refusal as a sentence. Never the server's own message (it is written for developers). */
export function membershipErrorMessage(err: unknown, fallback = "Something went wrong. Try again."): string {
  const e = toMembershipError(err)
  if (e.status === 0 && !e.code) return NETWORK_COPY
  if (e.code && ERROR_COPY[e.code]) return ERROR_COPY[e.code]
  if (e.status === 503) return ERROR_COPY.MEMBERSHIPS_NOT_ENABLED
  return fallback
}

export function isMembershipsOff(err: unknown): boolean {
  const e = toMembershipError(err)
  return e.code === "MEMBERSHIPS_NOT_ENABLED" || e.code === "MONETIZATION_NOT_LAUNCHED"
}

/**
  Whether a failed checkout start keeps its key for a retry. No answer or a
  5xx: the server may have opened the checkout, so the retry must name it.
  The switch being off, or any 4xx, is a verdict: the next try is new.
*/
export function keepKeyAfter(err: unknown): boolean {
  const e = toMembershipError(err)
  if (e.code === "MEMBERSHIPS_NOT_ENABLED" || e.code === "CHECKOUT_EXPIRED") return false
  return e.status === 0 || e.status >= 500
}

/** post-service's comment refusal on a members-only post (post_edit.go:509). */
export function isMembersOnlyError(err: unknown): boolean {
  const e = toMembershipError(err)
  return e.status === 403 && e.code === "MEMBERS_ONLY"
}

/* ── notifications ───────────────────────────────────────────────── */

export const MEMBERSHIP_NOTIFICATION_TYPES = [
  "membership_new_member",
  "membership_joined",
  "membership_renewed",
  "membership_renewal_due",
  "membership_payment_failed",
  "membership_ended",
] as const

export type MembershipNotificationType = (typeof MEMBERSHIP_NOTIFICATION_TYPES)[number]

export const isMembershipNotification = (type: string): type is MembershipNotificationType =>
  (MEMBERSHIP_NOTIFICATION_TYPES as readonly string[]).includes(type)

export const MY_MEMBERSHIPS_PATH = "/memberships"
export const CREATOR_LEVELS_PATH = "/monetization/tiers"

const membershipPath = /^\/memberships\/[0-9a-f-]{36}$/i

/**
  The six membership notices (notification-service membership_notify.go).
  The server's sentence names the other party and wins when sent; the
  second line is ours. The creator's notice opens their levels page; every
  notice to the member opens that membership (the row's
  /memberships/{subscription_id}), or the list when the row has no link.
*/
export function membershipNotificationCopy(
  type: string,
  actorName: string | undefined,
  serverTitle: string | undefined,
  rowLink?: string,
): { title: string; body: string; link: string } | null {
  if (!isMembershipNotification(type)) return null
  const who = actorName?.trim()
  const memberLink = rowLink && membershipPath.test(rowLink) ? rowLink : MY_MEMBERSHIPS_PATH
  // With no name, the server's own unnamed wording ("Your a creator membership" is not a sentence).
  const named = (withName: (n: string) => string, unnamed: string) => serverTitle ?? (who ? withName(who) : unnamed)
  switch (type) {
    case "membership_new_member":
      return { title: named((n) => `${n} joined your membership`, "Someone joined your membership"), body: "See your levels and members.", link: CREATOR_LEVELS_PATH }
    case "membership_joined":
      return { title: named((n) => `You're a member of ${n}`, "You're a member of a creator"), body: "Members-only posts and videos are open to you now.", link: memberLink }
    case "membership_renewed":
      return { title: named((n) => `Your ${n} membership was renewed`, "Your membership with a creator was renewed"), body: "Thanks for renewing. Your access carries on.", link: memberLink }
    case "membership_renewal_due":
      return { title: named((n) => `Your ${n} membership ends soon — renew to keep access`, "Your membership with a creator ends soon — renew to keep access"), body: "Renewal isn't automatic. Pay to keep your access.", link: memberLink }
    case "membership_payment_failed":
      return { title: named((n) => `Your ${n} membership payment didn't go through`, "Your membership payment to a creator didn't go through"), body: "No access was added. Try paying again.", link: memberLink }
    case "membership_ended":
      return { title: named((n) => `Your ${n} membership has ended`, "Your membership with a creator has ended"), body: "Join again any time to get access back.", link: memberLink }
  }
}

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
    GET   /memberships                              my memberships, each naming its creator
    GET   /memberships/:subscriptionId              one of mine (+ perks, pending downgrade); 404 otherwise
    GET   /members?cursor=&limit=                   my members, as their creator (limit ≤ 50)
    GET   /memberships/payments/:paymentId          confirming | paid | failed
    POST  /memberships/payments/:paymentId/verify   advisory: never grants access
    GET   /entitlements?creator_id=&tier_id=        does the caller have access
  and post-service (23 Oct 2026: the gate is written WITH the post):
    POST  /v1/posts                                 tier_required_id: uuid (absent = open), every type
    PATCH /v1/posts/:id                             tier_required_id: uuid sets, null clears
    PATCH /v1/reels/drafts/:id, POST …/publish      tier_required_id: uuid sets, null clears
    /v1/posts/drafts                                payload.tier_required_id (absent = open)
    GET   /v1/posts/by-author/:id?members_only=true the Members tab
    PUT   /v1/posts/:postId/membership              {tier_required_id: uuid | null} (only where nothing else fits)

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
  What a gated item costs to open, in paise a month: the row's own
  tier_required_price_paise when the server sent it (post-service
  members_tiers.go attachTierPrices), else the price of its level when that
  level is in the list; null when neither is known.
*/
export function requiredPriceOf(tiers: readonly Tier[], requiredTierId?: string | null, requiredPricePaise?: number | null): number | null {
  if (typeof requiredPricePaise === "number" && Number.isFinite(requiredPricePaise) && requiredPricePaise > 0) return Math.trunc(requiredPricePaise)
  if (!requiredTierId) return null
  const required = tiers.find((t) => t.id === requiredTierId)
  return required ? required.pricePaise : null
}

/** The unlock rule: a level opens an item when it costs at least what the item's level costs (a dearer member sees what a cheaper one sees). */
export function unlocksAt(tier: Pick<Tier, "pricePaise">, requiredPrice: number | null): boolean {
  return requiredPrice !== null && tier.pricePaise >= requiredPrice
}

/**
  The levels a viewer may join to unlock something gated on `requiredTierId`
  (at `requiredPricePaise` when the row says): that level and every dearer
  one. Nothing required, or a price that cannot be known: every active level.
*/
export function levelsThatUnlock(tiers: readonly Tier[], requiredTierId?: string | null, requiredPricePaise?: number | null): Tier[] {
  const active = activeLevels(tiers)
  const price = requiredPriceOf(tiers, requiredTierId, requiredPricePaise)
  if (price === null) return active
  return active.filter((t) => unlocksAt(t, price))
}

export interface JoinChoices {
  /** Every active level, cheapest first: joining any of them is a membership. */
  levels: Tier[]
  /** The ids of the levels that open the item; empty when nothing is required or it cannot be known. */
  unlocking: string[]
  /** The cheapest level that opens it: the sheet starts on it. */
  lowest: Tier | null
  /** "Unlocks with Gold or higher"; null when there is nothing to say. */
  line: string | null
}

/**
  The Join sheet's levels for a locked item. Every active level is shown;
  the ones that open the item are highlighted and the sheet starts on the
  cheapest of them. Nothing required (a profile's Join), or no price known
  and its level not listed: nothing highlighted, the cheapest first.
*/
export function joinChoices(tiers: readonly Tier[], requiredTierId?: string | null, requiredPricePaise?: number | null): JoinChoices {
  const levels = activeLevels(tiers)
  const price = requiredTierId || requiredPricePaise ? requiredPriceOf(tiers, requiredTierId, requiredPricePaise) : null
  const unlocking = price === null ? [] : levels.filter((t) => unlocksAt(t, price))
  const lowest = unlocking[0] ?? null
  // A price above every level on sale (its level was turned off): say so rather than sell a level that opens nothing.
  const line = lowest ? unlockLine(lowest, levels) : price !== null && levels.length > 0 ? NO_LEVEL_UNLOCKS : null
  return { levels, unlocking: unlocking.map((t) => t.id), lowest, line }
}

export const NO_LEVEL_UNLOCKS = "None of the levels on offer unlocks this right now."

/** "Unlocks with Gold or higher" ("Unlocks with Gold" when no dearer level is offered). */
export function unlockLine(lowest: Pick<Tier, "name" | "pricePaise">, levels: readonly Pick<Tier, "pricePaise">[]): string {
  const dearer = levels.some((l) => l.pricePaise > lowest.pricePaise)
  return dearer ? `Unlocks with ${lowest.name} or higher` : `Unlocks with ${lowest.name}`
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

/* ── people (creators and members) ───────────────────────────────── */

/**
  A creator or a member as the membership reads name them
  (membership_reads.go MembershipPerson): the id always; username,
  display_name and avatar_url only when identity-profile answered.
*/
export interface Person {
  id: string
  username: string
  displayName: string
  avatarUrl: string
}

/** An avatar URL the page may load: a site path or http(s); anything else is none. */
function safeImageUrl(v: unknown): string {
  const s = str(v)
  if (!s) return ""
  if (s.startsWith("/") && !s.startsWith("//")) return s
  return /^https?:\/\//i.test(s) ? s : ""
}

export function toPerson(raw: unknown): Person {
  const w = obj(raw)
  return { id: str(w.id), username: str(w.username), displayName: str(w.display_name), avatarUrl: safeImageUrl(w.avatar_url) }
}

/** Whether the server named the person (else the screen falls back to its own profile lookup). */
export const isNamed = (p: Pick<Person, "username" | "displayName">) => !!(p.username || p.displayName)

/**
  An id-only person (the server's lookup failed) filled from the web's own
  profile batch; a person the server named is left as it is.
*/
export function fillPerson(p: Person, profile?: { username?: string | null; display_name?: string | null; avatar_media_id?: string | null } | null): Person {
  if (isNamed(p) || !profile) return p
  const avatar = str(profile.avatar_media_id)
  return {
    id: p.id,
    username: str(profile.username),
    displayName: str(profile.display_name),
    avatarUrl: p.avatarUrl || (avatar ? `/v1/media/${encodeURIComponent(avatar)}/serve` : ""),
  }
}

export function personName(p: Pick<Person, "username" | "displayName"> | null | undefined, fallback = "Creator"): string {
  return p?.displayName || p?.username || fallback
}

/* ── my memberships ──────────────────────────────────────────────── */

export type MembershipStatus = "pending_payment" | "active" | "cancelled_at_period_end" | "paused" | "past_due" | "grace" | "cancelled" | "expired"

const STATUSES: ReadonlySet<string> = new Set(["pending_payment", "active", "cancelled_at_period_end", "paused", "past_due", "grace", "cancelled", "expired"])

export interface MyMembership {
  subscriptionId: string
  creatorId: string
  /** The creator as the server named them; only `id` when its profile lookup failed. */
  creator: Person
  tier: { id: string; name: string; pricePaise: number }
  status: MembershipStatus
  currentPeriodEnd: string
  /** When access ends; "" for a status that grants none. */
  accessUntil: string
  renewAvailable: boolean
}

function statusOf(v: unknown): MembershipStatus {
  const status = str(v)
  return (STATUSES.has(status) ? status : "expired") as MembershipStatus
}

/** service.MembershipView (membership_reads.go:107), creator per MembershipPerson (:88). */
export function toMyMembership(raw: unknown): MyMembership | null {
  const w = obj(raw)
  const subscriptionId = str(w.subscription_id)
  if (!subscriptionId) return null
  const tier = obj(w.tier)
  const creator = toPerson(w.creator)
  return {
    subscriptionId,
    creatorId: creator.id,
    creator,
    tier: { id: str(tier.id), name: str(tier.name), pricePaise: Math.max(0, int(tier.price_paise)) },
    status: statusOf(w.status),
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

/** The creators a list did not name: only these go to the fallback profile lookup. */
export function unnamedCreatorIds(list: readonly Pick<MyMembership, "creator">[]): string[] {
  return [...new Set(list.filter((m) => m.creator.id && !isNamed(m.creator)).map((m) => m.creator.id))]
}

export interface PendingDowngrade {
  tierId: string
  tierName: string
  pricePaise: number
  effectiveAt: string
}

/** GET /memberships/:subscriptionId: a list row plus the level's perks and a booked downgrade. */
export interface MembershipDetail extends MyMembership {
  tier: { id: string; name: string; pricePaise: number; perks: string[] }
  pendingDowngrade: PendingDowngrade | null
}

/** service.MembershipDetailView (membership_reads.go:182); PendingDowngrade (:173), null when none. */
export function toMembershipDetail(body: unknown): MembershipDetail | null {
  const w = obj(unwrap(body))
  const row = toMyMembership(w)
  if (!row) return null
  const pending = w.pending_downgrade == null ? null : obj(w.pending_downgrade)
  const pendingId = pending ? str(pending.tier_id) : ""
  return {
    ...row,
    tier: { ...row.tier, perks: stringList(obj(w.tier).perks) },
    pendingDowngrade: pending && pendingId ? { tierId: pendingId, tierName: str(pending.tier_name), pricePaise: Math.max(0, int(pending.price_paise)), effectiveAt: time(pending.effective_at) } : null,
  }
}

export function membershipUrl(subscriptionId: string): string {
  return `/v1/monetization/memberships/${encodeURIComponent(subscriptionId)}`
}

/** "Moves to Fan (₹49 a month) on 23 Nov 2026" — the booked downgrade in words. */
export function downgradeLine(d: PendingDowngrade): string {
  const level = d.tierName || "a lower level"
  const price = d.pricePaise > 0 ? ` (${perMonth(d.pricePaise)})` : ""
  const when = formatDate(d.effectiveAt)
  return when ? `Moves to ${level}${price} on ${when}. Nothing is charged now.` : `Moves to ${level}${price} at your next renewal. Nothing is charged now.`
}

/* ── a creator's members ─────────────────────────────────────────── */

export interface CreatorMember {
  subscriptionId: string
  subscriber: Person
  tier: { id: string; name: string; pricePaise: number }
  status: MembershipStatus
  since: string
  accessUntil: string
}

/** service.MemberView (membership_reads.go:254). */
export function toCreatorMember(raw: unknown): CreatorMember | null {
  const w = obj(raw)
  const subscriptionId = str(w.subscription_id)
  const subscriber = toPerson(w.subscriber)
  if (!subscriptionId || !subscriber.id) return null
  const tier = obj(w.tier)
  return {
    subscriptionId,
    subscriber,
    tier: { id: str(tier.id), name: str(tier.name), pricePaise: Math.max(0, int(tier.price_paise)) },
    status: statusOf(w.status),
    since: time(w.since),
    accessUntil: time(w.access_until),
  }
}

/** One page of GET /members: rows and meta.next_cursor ("" / absent on the last page). */
export function toCreatorMembersPage(body: unknown): { rows: CreatorMember[]; nextCursor?: string } {
  const rows = arr(unwrap(body))
    .map(toCreatorMember)
    .filter((m): m is CreatorMember => !!m)
  const next = str(obj(obj(body).meta).next_cursor)
  return next ? { rows, nextCursor: next } : { rows }
}

export const MAX_MEMBERS_PAGE = 50
export const MEMBERS_PAGE = 30

/** GET /members params: limit 1..50 (the server refuses 0 or less and caps at 50), the cursor only when there is one. */
export function membersListParams(cursor?: string | null, limit: number = MEMBERS_PAGE): Record<string, string> {
  const n = Math.min(MAX_MEMBERS_PAGE, Math.max(1, Math.floor(Number.isFinite(limit) ? limit : MEMBERS_PAGE)))
  return cursor ? { limit: String(n), cursor } : { limit: String(n) }
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
  /** tier_required_price_paise: what its level costs a month; null when the server could not read it. */
  requiredPricePaise: number | null
  bodyRedacted: boolean
  contentType: string
  title: string
  coverMediaId: string
  durationMs: number
  createdAt: string
}

/** A row's tier_required_price_paise (post-service store/postgres/posts.go:144, omitempty): a positive whole number, else null. */
export function requiredPriceOfRow(raw: unknown): number | null {
  const v = obj(raw).tier_required_price_paise
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.trunc(v) : null
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
    requiredPricePaise: requiredPriceOfRow(w),
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

/**
  The gate on a create (POST /v1/posts handler.go:556, a reel draft's
  publish, a composer draft's payload): the level when there is one, else
  nothing at all — absent is open, and an empty create body stays as it was
  (the create's Idempotency-Key is bound to the body).
*/
export function gateCreateField(tierId: string | null | undefined): { tier_required_id?: string } {
  const id = typeof tierId === "string" ? tierId.trim() : ""
  return id ? { tier_required_id: id } : {}
}

/**
  The gate on an edit (PATCH /v1/posts/:id post_edit.go:97, PATCH
  /v1/reels/drafts/:id service/drafts.go:79): always sent — a level sets it, null
  clears it. Send it only when the gate changed.
*/
export function gatePatchField(tierId: string | null | undefined): { tier_required_id: string | null } {
  const id = typeof tierId === "string" ? tierId.trim() : ""
  return { tier_required_id: id || null }
}

/** An edit's gate field: nothing when the level did not change (omitted = unchanged), else the PATCH field. */
export function gateEditField(before: string | null | undefined, after: string | null | undefined): { tier_required_id?: string | null } {
  const was = typeof before === "string" ? before.trim() : ""
  const now = typeof after === "string" ? after.trim() : ""
  return was === now ? {} : gatePatchField(now)
}

/** By-author params for the Members tab: ?members_only=true with the same cursor paging (handler.go:1353). */
export function membersOnlyParams(cursor?: string | null, limit = 50): Record<string, string> {
  return { limit: String(limit), members_only: "true", ...(cursor ? { cursor } : {}) }
}

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
  INVALID_TIER: "That level isn't available any more — pick another.",
  MEMBERSHIP_TIERS_UNAVAILABLE: "Couldn't check your membership levels. Nothing was saved — try again.",
  // PUT /v1/posts/:id/membership on a video in copyright review (post-service standing_errors.go:76).
  // The same words as features/copyright COPYRIGHT_REVIEW_EDIT_COPY (a test keeps them equal; this file imports nothing).
  COPYRIGHT_REVIEW: "This video is in copyright review — you can't change who can see it until it's cleared.",
  INVALID_CURSOR: "The list moved on. Reload to see it from the top.",
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

/** post-service's comment refusal on a members-only post (post_edit.go:556). */
export function isMembersOnlyError(err: unknown): boolean {
  const e = toMembershipError(err)
  return e.status === 403 && e.code === "MEMBERS_ONLY"
}

/**
  The gate a MEMBERS_ONLY refusal names (error.details {creator_id,
  tier_required_id}, post_edit.go:556), so the Join prompt opens on the
  right creator and level. null when it is not that refusal or names no
  creator; tierRequiredId is null when only the creator came.
*/
export function membersOnlyGate(err: unknown): { creatorId: string; tierRequiredId: string | null } | null {
  if (!isMembersOnlyError(err)) return null
  const details = obj(obj(obj(obj(obj(err).response).data).error).details)
  const creatorId = str(details.creator_id)
  if (!creatorId) return null
  return { creatorId, tierRequiredId: str(details.tier_required_id) || null }
}

/* ── the gate refusals on a write ────────────────────────────────── */

export const TIER_GATE_CODES = ["INVALID_TIER", "MEMBERSHIP_TIERS_UNAVAILABLE"] as const

/**
  post-service's members-only refusals on every write (handler.go:1184
  writeTierGateError): 400 INVALID_TIER — the level is not one of the
  author's active levels; 503 MEMBERSHIP_TIERS_UNAVAILABLE — they could not
  be checked, and nothing was written. `verb` names what did not happen:
  "posted" on a create or publish, "saved" on an edit or a draft.
*/
export function tierGateMessage(code: string | null | undefined, verb: "posted" | "saved" = "posted"): string | null {
  if (code === "INVALID_TIER") return "That level isn't available any more — pick another."
  if (code === "MEMBERSHIP_TIERS_UNAVAILABLE") return `Couldn't check your membership levels. Nothing was ${verb} — try again.`
  return null
}

/** The same, read off an axios error. */
export function tierGateError(err: unknown, verb: "posted" | "saved" = "posted"): string | null {
  return tierGateMessage(toMembershipError(err).code, verb)
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
/** The creator's members list. The server still links the new-member notice to the levels page; we open this. */
export const CREATOR_MEMBERS_PATH = "/monetization/members"

const membershipPath = /^\/memberships\/[0-9a-f-]{36}$/i

/**
  The six membership notices (notification-service membership_notify.go).
  The server's sentence names the other party and wins when sent; the
  second line is ours. The creator's notice opens their members list
  (whatever link the server sent — it still says /monetization/tiers); every
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
      return { title: named((n) => `${n} joined your membership`, "Someone joined your membership"), body: "See who your members are.", link: CREATOR_MEMBERS_PATH }
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

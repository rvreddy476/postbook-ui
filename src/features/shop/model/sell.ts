// MSeller's pure half: the wire shapes commerce-service sends a seller and
// every rule the seller screens decide without a round trip. No React, no
// axios; each rule is testable on its own.
//
// Sources, by section: handler_onboarding.go + service/onboarding.go +
// store/postgres/sellerreadiness.go (onboarding), handler_inventory.go +
// service/inventory.go (stock, seller products), handler_submissions.go +
// service/submitgate.go (readiness, action needed), handler_seller_fulfilment.go
// + service/service.go fulfillmentMatchesStage + migration 010 (orders).

// ═══════════════════════════════════════════════════════════════
//  The gateway's error envelope
// ═══════════════════════════════════════════════════════════════

export interface ApiEnvelope {
  status: number
  code: string
  message: string
  details: Record<string, unknown>
}

/** Read `{error:{code,message,details}}` without trusting any field to exist. */
export function apiEnvelope(error: unknown): ApiEnvelope {
  const e = error as
    | { response?: { status?: number; data?: { error?: { code?: string; message?: string; details?: unknown } } } }
    | undefined
  const err = e?.response?.data?.error
  return {
    status: e?.response?.status ?? 0,
    code: typeof err?.code === "string" ? err.code : "",
    message: typeof err?.message === "string" ? err.message : "",
    details: err?.details && typeof err.details === "object" ? (err.details as Record<string, unknown>) : {},
  }
}

export function apiMessage(error: unknown, fallback: string): string {
  return apiEnvelope(error).message || fallback
}

/** 403 NO_SELLER / 404 on the status route: the caller has no seller profile yet. */
export function isNoSeller(error: unknown): boolean {
  const { status, code } = apiEnvelope(error)
  return code === "NO_SELLER" || (status === 404 && code === "NOT_FOUND")
}

// ═══════════════════════════════════════════════════════════════
//  The rail
// ═══════════════════════════════════════════════════════════════

export interface RailEntry {
  label: string
  href: string
}

/** Alphabetical by label (the founder's rule for anything read as a list). */
export const SELLER_RAIL: readonly RailEntry[] = [
  { label: "Dashboard", href: "/shop/sell" },
  { label: "Orders", href: "/shop/sell/orders" },
  { label: "Products", href: "/shop/sell/products" },
  { label: "Stock", href: "/shop/sell/stock" },
]

export function railIsAlphabetical(entries: readonly RailEntry[] = SELLER_RAIL): boolean {
  for (let i = 1; i < entries.length; i += 1) {
    if (entries[i - 1].label.localeCompare(entries[i].label, "en") > 0) return false
  }
  return true
}

/** The rail entry a path belongs to: the longest href that prefixes it. */
export function activeRailHref(pathname: string, entries: readonly RailEntry[] = SELLER_RAIL): string | null {
  let best: RailEntry | null = null
  for (const entry of entries) {
    const hit = pathname === entry.href || pathname.startsWith(`${entry.href}/`)
    if (hit && (!best || entry.href.length > best.href.length)) best = entry
  }
  return best?.href ?? null
}

// ═══════════════════════════════════════════════════════════════
//  Onboarding: the seller row, its status, the wizard
// ═══════════════════════════════════════════════════════════════

/** postgres.Seller as GET /onboarding/status and GET /sellers/me send it. PAN and bank are never here in full. */
export interface SellerWire {
  id: string
  user_id?: string
  business_page_id?: string
  seller_type?: string
  business_type?: string
  store_name: string
  brand_name?: string
  owner_name?: string
  slug?: string
  description?: string
  tagline?: string
  logo_media_id?: string
  banner_media_id?: string
  email: string
  phone?: string
  gst_number?: string
  pan_masked?: string
  support_phone?: string
  support_email?: string
  state?: string
  city?: string
  postal_code?: string
  status: string
  onboarding_step?: number
  submitted_at?: string
  approved_at?: string
  rejected_at?: string
  rejection_reason?: string
  changes_requested?: string
  suspension_reason?: string
  verification_status?: string
  store_status?: string
}

/** sellers.status CHECK (migration 001). */
export const SELLER_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "changes_required",
  "approved",
  "rejected",
  "suspended",
  "disabled",
] as const
export type SellerStatus = (typeof SELLER_STATUSES)[number]

export type BannerTone = "muted" | "info" | "warning" | "success" | "danger"

export interface StatusBanner {
  label: string
  tone: BannerTone
  /** The sentence under the label. */
  body: string
  /** Whether SELLER routes (products, stock, orders) will answer. */
  canTrade: boolean
  /** Where the banner's one action goes, if it has one. */
  action?: { label: string; href: string }
}

/**
 * One banner per seller status. Approval is manual (a person in the admin
 * console reads hand-uploaded documents), and the copy says so rather than
 * promising a timer.
 */
export function sellerStatusBanner(seller: Pick<SellerWire, "status" | "rejection_reason" | "changes_requested" | "suspension_reason">): StatusBanner {
  const why = (s: string | undefined) => (s && s.trim() ? ` ${s.trim()}` : "")
  switch (seller.status) {
    case "draft":
      return {
        label: "Draft",
        tone: "muted",
        body: "Your shop is not set up yet. Finish the application and submit it for review.",
        canTrade: false,
        action: { label: "Continue application", href: "/shop/sell/onboarding" },
      }
    case "submitted":
      return {
        label: "Submitted",
        tone: "info",
        body: "Your application is in the review queue. A person checks the documents you uploaded; you will see the status change here.",
        canTrade: false,
      }
    case "under_review":
      return {
        label: "Under review",
        tone: "info",
        body: "A reviewer is checking your documents now. Nothing more is needed from you until this changes.",
        canTrade: false,
      }
    case "changes_required":
      return {
        label: "Changes required",
        tone: "warning",
        body: `The reviewer needs something changed before your shop can open.${why(seller.changes_requested)}`,
        canTrade: false,
        action: { label: "Update application", href: "/shop/sell/onboarding" },
      }
    case "approved":
      return {
        label: "Approved",
        tone: "success",
        body: "Your shop is open. Listings you submit go live once reviewed.",
        canTrade: true,
      }
    case "rejected":
      return {
        label: "Rejected",
        tone: "danger",
        body: `Your application was not approved.${why(seller.rejection_reason)}`,
        canTrade: false,
      }
    case "suspended":
      return {
        label: "Suspended",
        tone: "danger",
        body: `Your shop is closed while support looks into it.${why(seller.suspension_reason)}`,
        canTrade: false,
      }
    case "disabled":
      return {
        label: "Disabled",
        tone: "danger",
        body: "This seller account has been switched off.",
        canTrade: false,
      }
    default:
      return {
        label: humanise(seller.status),
        tone: "muted",
        body: "Your seller account is in a state this page does not recognise yet.",
        canTrade: false,
      }
  }
}

/** The statuses that send the seller into the wizard rather than the dashboard. */
export function sellerNeedsWizard(status: string): boolean {
  return status === "draft" || status === "changes_required"
}

// ── The wizard ──────────────────────────────────────────────────

export const WIZARD_STEPS = ["basic", "storefront", "documents", "fulfillment", "payout", "readiness"] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

export const WIZARD_STEP_LABEL: Record<WizardStep, string> = {
  basic: "Basic details",
  storefront: "Storefront",
  documents: "Documents",
  fulfillment: "Fulfilment",
  payout: "Payout",
  readiness: "Review and submit",
}

/** GET /onboarding/readiness → {ready, missing[], detail{…}}. */
export interface ReadinessWire {
  ready: boolean
  missing: string[]
  detail?: {
    has_store_name?: boolean
    has_email?: boolean
    has_pickup_address?: boolean
    has_payout_account?: boolean
    has_kyc_document?: boolean
  }
}

/** The five `missing[]` codes SellerReadiness.Missing() can name, each with the step that fixes it. */
export const MISSING_CODES: Record<string, { label: string; step: WizardStep }> = {
  store_name: { label: "Store name", step: "basic" },
  email: { label: "Contact email", step: "basic" },
  pickup_address: { label: "Pickup address", step: "fulfillment" },
  payout_account: { label: "Payout account", step: "payout" },
  kyc_document: { label: "A KYC document", step: "documents" },
}

export interface MissingItem {
  code: string
  label: string
  step: WizardStep
}

/** `missing[]` → what to show and where to send the seller. Unknown codes are kept, not dropped. */
export function mapMissing(missing: readonly string[] | null | undefined): MissingItem[] {
  const out: MissingItem[] = []
  for (const raw of missing ?? []) {
    const code = String(raw).trim()
    if (!code) continue
    const known = MISSING_CODES[code]
    out.push(known ? { code, ...known } : { code, label: humanise(code), step: "readiness" })
  }
  return out
}

/**
 * The submit refusal, as the handler writes it. Contract §6 says "422 with
 * missing[]"; handler_p0.go writeCommerceError maps ErrApplicationIncomplete
 * to 409 APPLICATION_INCOMPLETE with the codes in the MESSAGE
 * ("…incomplete: store_name, kyc_document"). Both are read: `details.missing`
 * when present, otherwise the codes after the colon. Null for any other error.
 */
export function missingFromSubmitError(error: unknown): string[] | null {
  const { status, code, message, details } = apiEnvelope(error)
  const isIncomplete = code === "APPLICATION_INCOMPLETE" || (status === 422 && Array.isArray(details.missing))
  if (!isIncomplete) return null
  if (Array.isArray(details.missing)) return details.missing.filter((m): m is string => typeof m === "string")
  const idx = message.lastIndexOf(":")
  if (idx === -1) return []
  return message
    .slice(idx + 1)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z_]+$/.test(s))
}

/** Which steps the readiness answer says are done. Storefront is optional and never blocks. */
export function completedSteps(readiness: ReadinessWire | null | undefined): Set<WizardStep> {
  const done = new Set<WizardStep>()
  const d = readiness?.detail
  if (!d) return done
  if (d.has_store_name && d.has_email) done.add("basic")
  if (d.has_kyc_document) done.add("documents")
  if (d.has_pickup_address) done.add("fulfillment")
  if (d.has_payout_account) done.add("payout")
  return done
}

/**
 * Step gating. Basic details must exist before any other step (every other
 * write needs the seller row those two fields anchor). Storefront is optional.
 * Documents, fulfilment and payout unlock together after basic; the review
 * step is reachable once every REQUIRED step is complete, so the seller sees
 * the checklist before the server does.
 */
export function stepUnlocked(step: WizardStep, done: ReadonlySet<WizardStep>): boolean {
  if (step === "basic") return true
  if (!done.has("basic")) return false
  if (step === "readiness") return done.has("documents") && done.has("fulfillment") && done.has("payout")
  return true
}

/** Where a returning seller lands: the first step still locked or incomplete. */
export function firstOpenStep(done: ReadonlySet<WizardStep>): WizardStep {
  for (const step of WIZARD_STEPS) {
    if (step === "storefront") continue
    if (step === "readiness") return "readiness"
    if (!done.has(step)) return step
  }
  return "readiness"
}

// ── Step bodies ─────────────────────────────────────────────────

/** POST /onboarding/start. */
export interface StartBody {
  store_name: string
  email: string
  seller_type: SellerType
}

/** sellers.seller_type CHECK (setup.sql): individual, business, brand_owner, local_retailer. The start form offers the two a person picks between. */
export const SELLER_TYPES = ["individual", "business"] as const
export type SellerType = (typeof SELLER_TYPES)[number]

/** PUT /onboarding/step/basic (saveBasicReq). */
export interface BasicBody {
  store_name: string
  owner_name: string
  business_type: string
  seller_type?: string
  email: string
  phone?: string
  state?: string
  city?: string
  postal_code?: string
  description?: string
}

/** sellers.business_type CHECK (migration 001). */
export const BUSINESS_TYPES = ["individual", "retailer", "wholesaler", "manufacturer", "brand", "home_business"] as const

export const BUSINESS_TYPE_LABEL: Record<(typeof BUSINESS_TYPES)[number], string> = {
  individual: "Individual",
  retailer: "Retailer",
  wholesaler: "Wholesaler",
  manufacturer: "Manufacturer",
  brand: "Brand",
  home_business: "Home business",
}

/** PUT /onboarding/step/storefront (saveStorefrontReq). */
export interface StorefrontBody {
  brand_name?: string
  logo_media_id?: string
  banner_media_id?: string
  tagline?: string
  support_phone?: string
  support_email?: string
}

/** postgres.SellerDocumentTypes, minus nothing: the CHECK constraint's vocabulary. */
export const DOCUMENT_TYPES = [
  "address_proof",
  "business_registration",
  "cancelled_cheque",
  "gst_certificate",
  "other",
  "pan_card",
  "passport",
  "aadhaar",
] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  aadhaar: "Aadhaar (document image only)",
  address_proof: "Address proof",
  business_registration: "Business registration",
  cancelled_cheque: "Cancelled cheque",
  gst_certificate: "GST certificate",
  other: "Other",
  pan_card: "PAN card",
  passport: "Passport",
}

/** Alphabetical by label, for the picker. */
export function documentTypeOptions(): { value: DocumentType; label: string }[] {
  return DOCUMENT_TYPES.map((value) => ({ value, label: DOCUMENT_TYPE_LABEL[value] })).sort((a, b) =>
    a.label.localeCompare(b.label, "en"),
  )
}

/** PUT /onboarding/step/documents body row (docInput). */
export interface DocumentBody {
  document_type: DocumentType
  media_id: string
  /** Never for `aadhaar`; the server refuses it and this build never asks for it. */
  document_number?: string
}

export interface DocumentDraft {
  document_type: DocumentType
  media_id: string
  document_number: string
}

/**
 * The document rows as they leave the browser.
 *
 * An Aadhaar row travels WITHOUT a number, whatever the draft holds (the
 * control is never shown for it, and this is the belt to that brace). Any
 * other type's number travels only when non-blank. A row without a media id
 * is not a document and is left out.
 */
export function documentsPayload(drafts: readonly DocumentDraft[]): DocumentBody[] {
  const out: DocumentBody[] = []
  for (const d of drafts) {
    const media = d.media_id.trim()
    if (!media) continue
    const body: DocumentBody = { document_type: d.document_type, media_id: media }
    if (d.document_type !== "aadhaar") {
      const number = d.document_number.trim()
      if (number) body.document_number = number
    }
    out.push(body)
  }
  return out
}

/** Mirrors internal/kyc LooksLikeAadhaar closely enough to refuse before the server does: 12 digits, spaces or dashes allowed. */
export function looksLikeAadhaar(raw: string): boolean {
  const digits = raw.replace(/[\s-]/g, "")
  return /^\d{12}$/.test(digits)
}

/** What is wrong with the documents step before it is sent, or null. */
export function validateDocuments(drafts: readonly DocumentDraft[]): string | null {
  const sent = documentsPayload(drafts)
  if (sent.length === 0) return "Upload at least one document."
  const seen = new Set<string>()
  for (const d of sent) {
    if (seen.has(d.document_type)) return `Only one ${DOCUMENT_TYPE_LABEL[d.document_type]} can be uploaded.`
    seen.add(d.document_type)
    if (d.document_number && d.document_type !== "cancelled_cheque" && looksLikeAadhaar(d.document_number)) {
      return "That looks like an Aadhaar number. Leave the number blank; the uploaded document is enough."
    }
  }
  return null
}

/** PUT /onboarding/step/fulfillment (saveFulfillmentReq). COD is fenced: always false. */
export interface FulfillmentBody {
  delivery_modes: string[]
  cod_enabled: false
  dispatch_sla_hours: number
  return_supported: boolean
  return_window_days: number
}

export const DISPATCH_SLA_OPTIONS = [24, 48, 72] as const

export function fulfillmentPayload(input: { dispatch_sla_hours: number; return_supported: boolean; return_window_days: number }): FulfillmentBody {
  return {
    delivery_modes: ["platform"],
    cod_enabled: false,
    dispatch_sla_hours: input.dispatch_sla_hours > 0 ? input.dispatch_sla_hours : 48,
    return_supported: input.return_supported,
    return_window_days: input.return_supported && input.return_window_days > 0 ? input.return_window_days : 7,
  }
}

/** PUT /seller/address (sellerAddressReq). */
export interface SellerAddressBody {
  address_type: "pickup"
  contact_name: string
  phone: string
  address_line_1: string
  address_line_2?: string
  city: string
  state: string
  postal_code: string
  country: "IN"
  is_default: true
}

export interface PickupAddressDraft {
  contact_name: string
  phone: string
  address_line_1: string
  address_line_2: string
  city: string
  state: string
  postal_code: string
}

const PIN_RE = /^[1-9]\d{5}$/
const PHONE_RE = /^(?:\+91)?[6-9]\d{9}$/

export type PickupAddressErrors = Partial<Record<keyof PickupAddressDraft, string>>

/** state and postal_code decide money (GST place of supply, courier origin), so both are required. */
export function validatePickupAddress(d: PickupAddressDraft): PickupAddressErrors {
  const e: PickupAddressErrors = {}
  if (d.contact_name.trim().length < 2) e.contact_name = "Who should the courier ask for?"
  if (!PHONE_RE.test(d.phone.replace(/\s/g, ""))) e.phone = "Enter a 10-digit Indian mobile number."
  if (d.address_line_1.trim().length < 3) e.address_line_1 = "Enter the street address."
  if (d.city.trim().length < 2) e.city = "Enter the city."
  if (d.state.trim().length < 2) e.state = "Enter the state."
  if (!PIN_RE.test(d.postal_code.trim())) e.postal_code = "Enter a 6-digit PIN code."
  return e
}

export function pickupAddressPayload(d: PickupAddressDraft): SellerAddressBody {
  const line2 = d.address_line_2.trim()
  return {
    address_type: "pickup",
    contact_name: d.contact_name.trim(),
    phone: d.phone.replace(/\s/g, ""),
    address_line_1: d.address_line_1.trim(),
    ...(line2 ? { address_line_2: line2 } : {}),
    city: d.city.trim(),
    state: d.state.trim(),
    postal_code: d.postal_code.trim(),
    country: "IN",
    is_default: true,
  }
}

/** PUT /onboarding/step/payout (savePayoutReq). */
export interface PayoutBody {
  account_holder_name: string
  account_number: string
  ifsc_code?: string
  bank_name?: string
  upi_id?: string
}

export interface PayoutDraft {
  account_holder_name: string
  account_number: string
  ifsc_code: string
  bank_name: string
  upi_id: string
}

export type PayoutErrors = Partial<Record<keyof PayoutDraft, string>>

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
const ACCOUNT_RE = /^\d{9,18}$/
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/

/**
 * The handler requires account_holder_name and account_number. Readiness
 * (sellerreadiness.go) counts the account only when it has an IFSC beside it,
 * or when a UPI id exists — so the IFSC is required here whenever a bank
 * account is given, and a UPI id alone is not enough for the handler's
 * `binding:"required"` on account_number. Both are asked for; UPI is extra.
 */
export function validatePayout(d: PayoutDraft): PayoutErrors {
  const e: PayoutErrors = {}
  if (d.account_holder_name.trim().length < 2) e.account_holder_name = "Enter the name on the account."
  const number = d.account_number.replace(/\s/g, "")
  if (!ACCOUNT_RE.test(number)) e.account_number = "Enter the account number (9 to 18 digits)."
  const ifsc = d.ifsc_code.trim().toUpperCase()
  if (!IFSC_RE.test(ifsc)) e.ifsc_code = "Enter the 11-character IFSC (like HDFC0001234)."
  const upi = d.upi_id.trim()
  if (upi && !UPI_RE.test(upi)) e.upi_id = "That does not look like a UPI id (name@bank)."
  return e
}

export function payoutPayload(d: PayoutDraft): PayoutBody {
  const bank = d.bank_name.trim()
  const upi = d.upi_id.trim()
  return {
    account_holder_name: d.account_holder_name.trim(),
    account_number: d.account_number.replace(/\s/g, ""),
    ifsc_code: d.ifsc_code.trim().toUpperCase(),
    ...(bank ? { bank_name: bank } : {}),
    ...(upi ? { upi_id: upi } : {}),
  }
}

/**
 * What the seller sees after the save: the last four digits and nothing else.
 * No read route returns the account (it is sealed under migration 035), so
 * this is derived once from what was typed and the full number is dropped.
 */
export function maskAccountNumber(number: string): string {
  const digits = number.replace(/\s/g, "")
  if (digits.length < 4) return "••••"
  return `•••• ${digits.slice(-4)}`
}

// ═══════════════════════════════════════════════════════════════
//  Dashboard
// ═══════════════════════════════════════════════════════════════

/** postgres.DashboardStats. `revenue_total` is a rupee float the store still writes; shown as-is, never summed. */
export interface DashboardWire {
  total_products: number
  live_products: number
  draft_products: number
  pending_products: number
  low_stock_items: number
  orders_today: number
  revenue_total: number
  seller_status: string
}

/** service.ProductActionNeeded. */
export interface ActionNeededWire {
  product_id: string
  product_title: string
  still_selling: boolean
  fields: { code: string; label?: string; reason: string }[]
}

// ═══════════════════════════════════════════════════════════════
//  Products
// ═══════════════════════════════════════════════════════════════

/** postgres.Product as GET /seller/products sends it (the shared summary projection). */
export interface SellerProductWire {
  id: string
  title?: string
  slug?: string
  status?: string
  approval_status?: string
  rejection_reason?: string
  category_id?: string
  category_name?: string
  tax_class_id?: string
  image_url?: string
  thumbnail_url?: string
  min_price_minor?: number
  mrp_minor?: number
  discount_pct?: number
  in_stock?: boolean
  total_stock?: number
  created_at?: string
  updated_at?: string
}

export interface ProductRow {
  id: string
  title: string
  imageUrl: string | null
  approvalStatus: string
  statusLabel: string
  statusTone: BannerTone
  /** Integer paise, or null when the row carries no price (no variant yet). */
  priceMinor: number | null
  mrpMinor: number | null
  stock: number | null
  inStock: boolean
  /** Whether POST /products/:id/submit may move it (submittableApprovalStatuses). */
  submittable: boolean
  rejectionReason: string | null
}

/** postgres.submittableApprovalStatuses. */
export const SUBMITTABLE_STATUSES = ["draft", "pending", "rejected", "changes_requested", "flagged"] as const

const PRODUCT_STATUS_UI: Record<string, { label: string; tone: BannerTone }> = {
  draft: { label: "Draft", tone: "muted" },
  pending: { label: "Draft", tone: "muted" },
  submitted: { label: "Submitted", tone: "info" },
  under_review: { label: "Submitted", tone: "info" },
  approved: { label: "Active", tone: "success" },
  live: { label: "Active", tone: "success" },
  changes_requested: { label: "Changes required", tone: "warning" },
  flagged: { label: "Changes required", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
  hidden: { label: "Hidden", tone: "muted" },
  archived: { label: "Archived", tone: "muted" },
}

export function productStatusUI(approvalStatus: string | null | undefined): { label: string; tone: BannerTone } {
  return PRODUCT_STATUS_UI[approvalStatus || ""] ?? { label: humanise(approvalStatus || "") || "Unknown", tone: "muted" }
}

export function isSubmittableStatus(approvalStatus: string | null | undefined): boolean {
  return (SUBMITTABLE_STATUSES as readonly string[]).includes(approvalStatus || "")
}

/** A summary row → what the table draws. Go zero values ("" / 0) fall through to null. */
export function productRow(p: SellerProductWire): ProductRow {
  const status = p.approval_status || ""
  const ui = productStatusUI(status)
  const price = typeof p.min_price_minor === "number" && p.min_price_minor > 0 ? p.min_price_minor : null
  const mrp = typeof p.mrp_minor === "number" && p.mrp_minor > 0 ? p.mrp_minor : null
  return {
    id: p.id,
    title: p.title || "Untitled listing",
    imageUrl: p.thumbnail_url || p.image_url || null,
    approvalStatus: status,
    statusLabel: ui.label,
    statusTone: ui.tone,
    priceMinor: price,
    mrpMinor: mrp,
    stock: typeof p.total_stock === "number" ? p.total_stock : null,
    inStock: p.in_stock === true,
    submittable: isSubmittableStatus(status),
    rejectionReason: p.rejection_reason || null,
  }
}

/** GET /products/:id/readiness → {ready, missing[{code,label?,reason}]}. */
export interface ProductReadinessWire {
  ready: boolean
  missing: { code: string; label?: string; reason: string }[]
}

/**
 * Submit is offered only for a listing in a submittable status whose
 * readiness answer says nothing is missing. A row whose readiness has not
 * arrived yet is not offered either: "maybe" is not an offer.
 */
export function submitOffered(row: Pick<ProductRow, "submittable">, readiness: ProductReadinessWire | null | undefined): boolean {
  if (!row.submittable) return false
  if (!readiness) return false
  return readiness.ready === true && (readiness.missing ?? []).length === 0
}

/** What the seller is told when the submit route refuses (handler_products.go writeProductWriteError). */
export function submitProductError(error: unknown): string {
  const { code, message, details } = apiEnvelope(error)
  switch (code) {
    case "PRODUCT_INCOMPLETE": {
      const fields = Array.isArray(details.fields) ? (details.fields as { label?: string; code?: string; reason?: string }[]) : []
      const names = fields.map((f) => f.label || f.code).filter(Boolean)
      return names.length > 0 ? `Still needed: ${names.join(", ")}.` : "This listing is not complete enough to review yet."
    }
    case "SELLER_NOT_APPROVED":
      return "Your shop is not approved yet, so listings cannot be sent for review."
    case "PRODUCT_NOT_SUBMITTABLE":
      return "This listing cannot be sent for review from where it is now."
    default:
      return message || "The listing could not be sent for review."
  }
}

// ═══════════════════════════════════════════════════════════════
//  Stock
// ═══════════════════════════════════════════════════════════════

/** postgres.ProductVariant as GET /products/:id/variants sends it, narrowed to what stock needs. */
export interface VariantWire {
  id: string
  product_id?: string
  sku?: string
  option_1_name?: string | null
  option_1_value?: string | null
  option_2_name?: string | null
  option_2_value?: string | null
  option_3_name?: string | null
  option_3_value?: string | null
  status?: string
  mrp_minor?: number | null
  selling_price_minor?: number | null
  available_qty?: number | null
  mrp?: number
  selling_price?: number
}

export interface StockRow {
  variantId: string
  productId: string
  productTitle: string
  sku: string
  options: string
  priceMinor: number | null
  /** null when the variant has no inventory row at all (distinct from 0). */
  available: number | null
}

export function variantOptionsText(v: VariantWire): string {
  const parts: string[] = []
  for (const [name, value] of [
    [v.option_1_name, v.option_1_value],
    [v.option_2_name, v.option_2_value],
    [v.option_3_name, v.option_3_value],
  ]) {
    if (name && value) parts.push(`${name}: ${value}`)
    else if (value) parts.push(value)
  }
  return parts.join(" · ")
}

/** Paise from a variant row: the minor column when real, else the rupee float rounded once. */
export function variantPriceMinor(v: Pick<VariantWire, "selling_price_minor" | "selling_price">): number | null {
  if (typeof v.selling_price_minor === "number" && v.selling_price_minor > 0) return v.selling_price_minor
  if (typeof v.selling_price === "number" && v.selling_price > 0) return Math.round(v.selling_price * 100)
  return null
}

export function stockRows(product: { id: string; title: string }, variants: readonly VariantWire[]): StockRow[] {
  return variants
    .filter((v) => (v.status || "active") !== "archived")
    .map((v) => ({
      variantId: v.id,
      productId: product.id,
      productTitle: product.title,
      sku: v.sku || "",
      options: variantOptionsText(v),
      priceMinor: variantPriceMinor(v),
      available: typeof v.available_qty === "number" ? v.available_qty : null,
    }))
}

/** service.StockAdjustReasons, alphabetical for the picker. */
export const STOCK_REASONS = ["correction", "damage", "purchase", "recount", "theft"] as const
export type StockReason = (typeof STOCK_REASONS)[number]

export const STOCK_REASON_LABEL: Record<StockReason, string> = {
  correction: "Correction",
  damage: "Damaged",
  purchase: "New purchase",
  recount: "Recount",
  theft: "Theft or loss",
}

/** PATCH /seller/variants/:id/stock body (adjustStockReq): a signed delta, never a new total. */
export interface StockAdjustBody {
  delta: number
  reason: StockReason
  notes?: string
}

export interface StockAdjustDraft {
  delta: string
  reason: string
  notes: string
}

export type StockAdjustErrors = Partial<Record<keyof StockAdjustDraft, string>>

/**
 * The delta must be a non-zero integer with an explicit sign in meaning
 * (positive restocks, negative writes down), and a reason must be chosen.
 * The server would default an empty reason to "correction"; the form does
 * not, because a seller who did not say why did not decide.
 */
export function validateStockAdjust(d: StockAdjustDraft, available: number | null): StockAdjustErrors {
  const e: StockAdjustErrors = {}
  const text = d.delta.trim()
  if (!/^[+-]?\d+$/.test(text)) e.delta = "Enter a whole number: positive to add stock, negative to remove it."
  else {
    const n = Number(text)
    if (n === 0) e.delta = "Zero changes nothing."
    else if (available !== null && n < 0 && available + n < 0) e.delta = `Only ${available} available; you cannot remove ${Math.abs(n)}.`
  }
  if (!(STOCK_REASONS as readonly string[]).includes(d.reason)) e.reason = "Choose a reason."
  if (d.notes.length > 500) e.notes = "Keep the note under 500 characters."
  return e
}

export function stockAdjustPayload(d: StockAdjustDraft): StockAdjustBody {
  const notes = d.notes.trim()
  return {
    delta: Number(d.delta.trim()),
    reason: d.reason as StockReason,
    ...(notes ? { notes } : {}),
  }
}

/** postgres.StockLevel, the adjust and read answer. */
export interface StockLevelWire {
  variant_id: string
  total_qty: number
  reserved_qty: number
  available: number
}

// ═══════════════════════════════════════════════════════════════
//  Orders
// ═══════════════════════════════════════════════════════════════

/**
 * migration 010 order_status_transitions, actor_type = 'seller', verbatim.
 * The trigger refuses any pair absent here, so a button for one would only
 * ever produce a 409.
 */
export const SELLER_TRANSITIONS: ReadonlyArray<readonly [from: string, to: string]> = [
  ["confirmed", "packed"],
  ["confirmed", "cancelled"],
  ["packed", "shipped"],
  ["packed", "cancelled"],
]

export type SellerActionKind = "pack" | "ship" | "cancel"

export interface SellerAction {
  kind: SellerActionKind
  to: string
  route: string
}

const ACTION_FOR_TARGET: Record<string, { kind: SellerActionKind; route: string }> = {
  packed: { kind: "pack", route: "/v1/commerce/seller/orders/{id}/pack" },
  shipped: { kind: "ship", route: "/v1/commerce/seller/orders/{id}/ship" },
  cancelled: { kind: "cancel", route: "/v1/commerce/seller/orders/{id}/cancel" },
}

export function sellerActionsFor(status: string): SellerAction[] {
  const out: SellerAction[] = []
  for (const [from, to] of SELLER_TRANSITIONS) {
    if (from !== status) continue
    const meta = ACTION_FOR_TARGET[to]
    if (meta) out.push({ kind: meta.kind, to, route: meta.route })
  }
  return out
}

const ROUTE_FOR_KIND: Record<SellerActionKind, string> = {
  pack: ACTION_FOR_TARGET.packed.route,
  ship: ACTION_FOR_TARGET.shipped.route,
  cancel: ACTION_FOR_TARGET.cancelled.route,
}

export function sellerActionPath(kind: SellerActionKind, orderId: string): string {
  return ROUTE_FOR_KIND[kind].replace("{id}", encodeURIComponent(orderId))
}

export function sellerActionError(kind: SellerActionKind, error: unknown, fallback: string): string {
  const { code, message } = apiEnvelope(error)
  switch (code) {
    case "TRANSITION_NOT_PERMITTED":
      return kind === "pack"
        ? "This order cannot be marked as packed from where it is now. Reload to see its current state."
        : "This order cannot be shipped from where it is now. Reload to see its current state."
    case "CANCEL_NOT_PERMITTED":
      return "This order can no longer be cancelled from your side; it has already moved on."
    case "TRACKING_NUMBER_IN_USE":
      return "That tracking number is already on another shipment with this courier. Check the label."
    case "ORDER_SHARED":
      return "This order has lines from other sellers, so no single seller can move it."
    case "REASON_REQUIRED":
      return "Give the buyer a reason for the cancellation."
    default:
      return message || fallback
  }
}

/**
 * Whether Ship is live: the shipment route's own gate (shipments.go
 * CreateShipmentsForOrder), not the status table. Confirmed or packed, paid,
 * and no shipment yet. COD is fenced, so "paid" is the only door.
 */
export function canBookShipment(order: { status: string; payment_status?: string }, shipment: { status?: string } | null | undefined): boolean {
  if (order.status !== "confirmed" && order.status !== "packed") return false
  if (order.payment_status !== "paid") return false
  if (shipment && shipment.status && shipment.status !== "pending") return false
  return !shipment
}

// ── Status vocabulary ───────────────────────────────────────────

const ORDER_STATUS_UI: Record<string, { label: string; tone: BannerTone }> = {
  created: { label: "Created", tone: "muted" },
  payment_pending: { label: "Payment pending", tone: "warning" },
  payment_failed: { label: "Payment failed", tone: "danger" },
  expired: { label: "Expired", tone: "muted" },
  paid: { label: "Paid", tone: "success" },
  confirmed: { label: "Confirmed", tone: "info" },
  packed: { label: "Packed", tone: "info" },
  shipped: { label: "Shipped", tone: "info" },
  out_for_delivery: { label: "Out for delivery", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  refund_pending: { label: "Refund pending", tone: "warning" },
  refunded: { label: "Refunded", tone: "muted" },
}

export function humanise(status: string): string {
  const s = (status || "").replace(/_/g, " ").trim()
  return s ? s[0].toUpperCase() + s.slice(1) : ""
}

export function orderStatusUI(status: string | undefined | null): { label: string; tone: BannerTone } {
  return ORDER_STATUS_UI[status ?? ""] ?? { label: humanise(status ?? "") || "Unknown", tone: "muted" }
}

// ── Stage pills ─────────────────────────────────────────────────

/** service.fulfillmentMatchesStage's vocabulary. Labels alphabetical (the list rule). */
export const FULFILLMENT_STAGES = [
  { id: "all", label: "All" },
  { id: "cancelled", label: "Cancelled" },
  { id: "delivered", label: "Delivered" },
  { id: "in_transit", label: "In transit" },
  { id: "unshipped", label: "To ship" },
] as const
export type FulfillmentStage = (typeof FULFILLMENT_STAGES)[number]["id"]

export function isFulfillmentStage(value: string | null | undefined): value is FulfillmentStage {
  return FULFILLMENT_STAGES.some((s) => s.id === value)
}

/** Offset paging over a route that filters AFTER it pages: only an empty page means the end. */
export function nextOffset(page: { count: number; offset: number; limit: number }): number | undefined {
  if (page.count === 0) return undefined
  return page.offset + page.limit
}

// ── Ship and cancel forms ───────────────────────────────────────

export interface ShipFormValues {
  courier: string
  tracking_number: string
}

export type ShipFormErrors = Partial<Record<keyof ShipFormValues, string>>

export function normaliseTracking(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase()
}

const TRACKING_RE = /^[A-Z0-9-]{6,40}$/

export function validateShipForm(values: ShipFormValues): ShipFormErrors {
  const errors: ShipFormErrors = {}
  const courier = values.courier.trim()
  if (courier.length < 2) errors.courier = "Name the courier."
  else if (courier.length > 60) errors.courier = "Keep the courier name under 60 characters."
  const tracking = normaliseTracking(values.tracking_number)
  if (!tracking) errors.tracking_number = "Enter the tracking number from the label."
  else if (!TRACKING_RE.test(tracking)) errors.tracking_number = "Tracking numbers are 6 to 40 letters, digits or dashes."
  return errors
}

/** POST /seller/orders/:id/ship body. */
export function shipRequestBody(values: ShipFormValues): { courier: string; tracking_number: string } {
  return { courier: values.courier.trim(), tracking_number: normaliseTracking(values.tracking_number) }
}

export const CANCEL_REASON_MAX = 500

export function validateCancelReason(raw: string): string | null {
  const reason = raw.trim()
  if (reason.length < 3) return "Tell the buyer why, in a few words."
  if (reason.length > CANCEL_REASON_MAX) return `Keep the reason under ${CANCEL_REASON_MAX} characters.`
  return null
}

/** POST /seller/orders/:id/cancel body. */
export function cancelRequestBody(reason: string): { reason: string } {
  return { reason: reason.trim() }
}

// ── Wire: the seller's order card ───────────────────────────────

/** postgres.Order, the fields the seller pages read. */
export interface OrderWire {
  id: string
  order_number?: string
  status: string
  payment_status?: string
  payment_method?: string | null
  total_minor?: number
  final_amount?: number
  currency_code?: string
  cancellation_reason?: string | null
  cancelled_by?: string | null
  gift_message?: string | null
  created_at?: string
  updated_at?: string
}

/** postgres.OrderItem, the fields the seller pages read. */
export interface OrderItemWire {
  id: string
  product_id?: string
  variant_id?: string
  product_title?: string
  variant_details?: string | null
  sku?: string
  quantity?: number
  unit_price_minor?: number
  final_price_minor?: number
  final_price?: number
  status?: string
  image_url?: string
  thumbnail_url?: string
}

/** service.SellerOrderCard. `shipment` is left unknown: normaliseShipment is the only reader. */
export interface SellerOrderCardWire {
  order: OrderWire
  items: OrderItemWire[]
  shipment?: unknown
  seller_subtotal_minor?: number
  seller_subtotal?: number
  delivery_address?: string | null
}

export function orderTotalMinor(order: { total_minor?: number | null; final_amount?: number | null }): number {
  if (typeof order.total_minor === "number" && order.total_minor > 0) return order.total_minor
  return Math.round((order.final_amount ?? 0) * 100)
}

export function sellerSubtotalMinor(card: { seller_subtotal_minor?: number | null; seller_subtotal?: number | null }): number {
  if (typeof card.seller_subtotal_minor === "number" && card.seller_subtotal_minor > 0) return card.seller_subtotal_minor
  return Math.round((card.seller_subtotal ?? 0) * 100)
}

export function lineTotalMinor(item: { final_price_minor?: number | null; final_price?: number | null }): number {
  if (typeof item.final_price_minor === "number" && item.final_price_minor > 0) return item.final_price_minor
  return Math.round((item.final_price ?? 0) * 100)
}

// ── Address snapshot ────────────────────────────────────────────

export interface DeliveryAddress {
  contact_name?: string
  phone?: string
  address_line_1?: string
  address_line_2?: string
  landmark?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

function fromBase64(s: string): string | null {
  try {
    if (typeof atob === "function") return atob(s)
    return Buffer.from(s, "base64").toString("utf8")
  } catch {
    return null
  }
}

function tryParse(s: string): Record<string, unknown> | null {
  if (!s || s[0] !== "{") return null
  try {
    const v = JSON.parse(s)
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function pickAddress(o: Record<string, unknown>): DeliveryAddress | null {
  const str = (k: string) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string) : undefined)
  const addr: DeliveryAddress = {
    contact_name: str("contact_name"),
    phone: str("phone"),
    address_line_1: str("address_line_1"),
    address_line_2: str("address_line_2"),
    landmark: str("landmark"),
    city: str("city"),
    state: str("state"),
    postal_code: str("postal_code"),
    country: str("country"),
  }
  return Object.values(addr).some(Boolean) ? addr : null
}

/**
 * `delivery_address` is a Go []byte (base64 over the JSON snapshot). After
 * the PII cutover the seller's copy carries only the routing fields, so a
 * decoded address may legitimately have no street or name.
 */
export function decodeAddressSnapshot(raw: unknown): DeliveryAddress | null {
  if (raw == null || raw === "") return null
  if (typeof raw === "object") return pickAddress(raw as Record<string, unknown>)
  if (typeof raw !== "string") return null
  const parsed = tryParse(raw) ?? tryParse(fromBase64(raw) ?? "")
  return parsed ? pickAddress(parsed) : null
}

export function addressIsRoutingOnly(addr: DeliveryAddress): boolean {
  return !addr.contact_name && !addr.address_line_1 && !addr.phone
}

/** `variant_details` is another []byte: base64 over `{option: value}`. */
export function variantSummary(raw: unknown): string {
  const obj =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : typeof raw === "string"
        ? (tryParse(raw) ?? tryParse(fromBase64(raw) ?? ""))
        : null
  if (!obj) return ""
  const parts: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim()) parts.push(`${humanise(k)}: ${v}`)
    else if (typeof v === "number") parts.push(`${humanise(k)}: ${v}`)
  }
  return parts.join(" · ")
}

// ── Shipment and history ────────────────────────────────────────

export interface SellerShipment {
  id: string
  order_id: string
  seller_id: string
  courier: string
  tracking_number: string | null
  courier_order_id: string | null
  tracking_url: string | null
  label_url: string | null
  status: string
  eta: string | null
  shipped_at: string | null
  delivered_at: string | null
  last_event_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface SellerShipmentEvent {
  id: string
  shipment_id: string | null
  status: string
  location: string | null
  remark: string | null
  occurred_at: string
}

type Raw = Record<string, unknown>

/** snake_case (the tagged wire) first, PascalCase (an untagged older answer) second. */
function pick(o: Raw, snake: string, pascal: string): unknown {
  return o[snake] !== undefined ? o[snake] : o[pascal]
}
const asStr = (v: unknown): string | null => (typeof v === "string" && v ? v : null)

export function normaliseShipment(raw: unknown): SellerShipment | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Raw
  const id = asStr(pick(o, "id", "ID"))
  if (!id) return null
  return {
    id,
    order_id: asStr(pick(o, "order_id", "OrderID")) ?? "",
    seller_id: asStr(pick(o, "seller_id", "SellerID")) ?? "",
    courier: asStr(pick(o, "courier", "Courier")) ?? "",
    tracking_number: asStr(pick(o, "tracking_number", "TrackingNumber")),
    courier_order_id: asStr(pick(o, "courier_order_id", "CourierOrderID")),
    tracking_url: asStr(pick(o, "tracking_url", "TrackingURL")),
    label_url: asStr(pick(o, "label_url", "LabelURL")),
    status: asStr(pick(o, "status", "Status")) ?? "pending",
    eta: asStr(pick(o, "eta", "ETA")),
    shipped_at: asStr(pick(o, "shipped_at", "ShippedAt")),
    delivered_at: asStr(pick(o, "delivered_at", "DeliveredAt")),
    last_event_at: asStr(pick(o, "last_event_at", "LastEventAt")),
    created_at: asStr(pick(o, "created_at", "CreatedAt")),
    updated_at: asStr(pick(o, "updated_at", "UpdatedAt")),
  }
}

export function normaliseShipmentEvent(raw: unknown): SellerShipmentEvent | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Raw
  const occurred = asStr(pick(o, "occurred_at", "OccurredAt"))
  if (!occurred) return null
  return {
    id: asStr(pick(o, "id", "ID")) ?? occurred,
    shipment_id: asStr(pick(o, "shipment_id", "ShipmentID")),
    status: asStr(pick(o, "status", "Status")) ?? "",
    location: asStr(pick(o, "location", "Location")),
    remark: asStr(pick(o, "remark", "Remark")),
    occurred_at: occurred,
  }
}

/** One row of GET /seller/orders/:id/history (postgres.OrderStatusHistory). */
export interface OrderHistoryRow {
  id: string
  order_id: string | null
  from_status: string | null
  to_status: string
  changed_by: string | null
  actor_type: string | null
  notes: string | null
  created_at: string
}

export function normaliseHistoryRow(raw: unknown): OrderHistoryRow | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Raw
  const to = asStr(o.to_status)
  const at = asStr(o.created_at)
  if (!to || !at) return null
  return {
    id: asStr(o.id) ?? `${to}@${at}`,
    order_id: asStr(o.order_id),
    from_status: asStr(o.from_status),
    to_status: to,
    changed_by: asStr(o.changed_by),
    actor_type: asStr(o.actor_type),
    notes: asStr(o.notes),
    created_at: at,
  }
}

export interface TimelineEntry {
  key: string
  label: string
  at: string | null
  detail?: string
}

const HISTORY_LABEL: Record<string, string> = {
  created: "Order placed",
  paid: "Payment received",
  confirmed: "Order confirmed",
  packed: "Packed",
  shipped: "Handed to courier",
  cancelled: "Cancelled",
}

const ACTOR_LABEL: Record<string, string> = {
  seller: "by you",
  customer: "by the buyer",
  system: "by the platform",
  admin: "by support",
}

/** The audit trail as the spine, courier events merged in for the steps the order status never records. */
export function timelineFromHistory(history: ReadonlyArray<OrderHistoryRow>, events: ReadonlyArray<SellerShipmentEvent> = []): TimelineEntry[] {
  const out: TimelineEntry[] = []
  const seen = new Set<string>()
  for (const row of history) {
    seen.add(row.to_status)
    const who = row.actor_type ? (ACTOR_LABEL[row.actor_type] ?? `by ${row.actor_type}`) : ""
    out.push({
      key: `history-${row.id}`,
      label: HISTORY_LABEL[row.to_status] ?? orderStatusUI(row.to_status).label,
      at: row.created_at,
      detail: [who, row.notes].filter(Boolean).join(": ") || undefined,
    })
  }
  for (const e of events) {
    if (seen.has(e.status)) continue
    out.push({
      key: `event-${e.id}`,
      label: orderStatusUI(e.status).label,
      at: e.occurred_at,
      detail: [e.location, e.remark].filter(Boolean).join(" · ") || undefined,
    })
  }
  return out.sort((a, b) => Date.parse(a.at ?? "") - Date.parse(b.at ?? ""))
}

/** The fallback when the history route is absent: rebuilt from the stamps the card carries. */
export function buildTimeline(
  order: {
    created_at?: string | null
    updated_at?: string | null
    status: string
    payment_status?: string
    cancellation_reason?: string | null
    cancelled_by?: string | null
  },
  shipment: SellerShipment | null,
  events: SellerShipmentEvent[] = [],
): TimelineEntry[] {
  const out: TimelineEntry[] = []
  if (order.created_at) out.push({ key: "placed", label: "Order placed", at: order.created_at })
  if (order.payment_status === "paid") out.push({ key: "paid", label: "Payment received", at: null })
  if (shipment) {
    out.push({
      key: "booked",
      label: "Shipment booked",
      at: shipment.created_at,
      detail: [shipment.courier, shipment.tracking_number].filter(Boolean).join(" · ") || undefined,
    })
    if (shipment.shipped_at) out.push({ key: "shipped", label: "Handed to courier", at: shipment.shipped_at })
  }
  const sorted = [...events].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at))
  let sawDelivered = false
  for (const e of sorted) {
    if (e.status === "delivered") sawDelivered = true
    out.push({
      key: `event-${e.id}`,
      label: orderStatusUI(e.status).label,
      at: e.occurred_at,
      detail: [e.location, e.remark].filter(Boolean).join(" · ") || undefined,
    })
  }
  if (shipment?.delivered_at && !sawDelivered) out.push({ key: "delivered", label: "Delivered", at: shipment.delivered_at })
  if (order.status === "cancelled") {
    const by = order.cancelled_by ? `by ${order.cancelled_by}` : ""
    out.push({
      key: "cancelled",
      label: "Cancelled",
      at: order.updated_at ?? null,
      detail: [by, order.cancellation_reason].filter(Boolean).join(": ") || undefined,
    })
  }
  return out
}

export function isNotFound(error: unknown): boolean {
  return apiEnvelope(error).status === 404
}

/** A short, stable handle for a buyer the seller cannot name: the first block of the user id. */
export function shortId(id: string | undefined | null): string {
  if (!id) return "unknown"
  return id.split("-")[0].toUpperCase()
}

// "What will you sell?" — the sell scope a shop chooses at onboarding
// (commerce-service migration 045, internal/service/sellscope.go).
//
//   all_categories   needs a GSTIN.
//   books_only       needs a PAN, the business name, a business address and
//                    one proof of address — and no GSTIN. A books-only shop
//                    lists only in book categories, on GST 0% (printed books
//                    are GST-exempt; a shop with no GSTIN cannot charge GST).
//
// Pure: no React, no axios. The server is the authority on every rule here;
// these mirror it so the seller is told before the round trip.

import { apiEnvelope } from "./sell"

export const SELL_SCOPES = ["all_categories", "books_only"] as const
export type SellScope = (typeof SELL_SCOPES)[number]

export function isSellScope(v: unknown): v is SellScope {
  return v === "all_categories" || v === "books_only"
}

export const SELL_SCOPE_LABEL: Record<SellScope, string> = {
  all_categories: "All categories",
  books_only: "Only books",
}

export const SELL_SCOPE_HELP: Record<SellScope, string> = {
  all_categories: "Sell in any category. A GSTIN is required.",
  books_only: "Sell printed books only. PAN is required; no GSTIN needed.",
}

// ── PAN ─────────────────────────────────────────────────────────

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/

/** shared/kyc PANHolderType, the fourth character. */
export const PAN_HOLDER_LABEL: Record<string, string> = {
  P: "Individual",
  C: "Company",
  H: "Hindu undivided family",
  F: "Firm",
  A: "Association of persons",
  T: "Trust",
  B: "Body of individuals",
  L: "Local authority",
  J: "Artificial juridical person",
  G: "Government",
}

/** Server's pan_holder_type (INDIVIDUAL, COMPANY, …) → the words a seller reads. */
export const PAN_HOLDER_WIRE_LABEL: Record<string, string> = {
  INDIVIDUAL: "Individual",
  COMPANY: "Company",
  HUF: "Hindu undivided family",
  FIRM: "Firm",
  AOP: "Association of persons",
  TRUST: "Trust",
  BOI: "Body of individuals",
  LOCAL_AUTHORITY: "Local authority",
  ARTIFICIAL_JURIDICAL_PERSON: "Artificial juridical person",
  GOVERNMENT: "Government",
}

export function normalisePAN(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase()
}

/** The holder type a PAN declares, or null when the PAN is not well formed. */
export function panHolderType(raw: string): string | null {
  const p = normalisePAN(raw)
  if (!PAN_RE.test(p)) return null
  return PAN_HOLDER_LABEL[p[3]] ?? null
}

/** What is wrong with a PAN, or null. Format and holder type, as shared/kyc ValidatePAN. */
export function validatePAN(raw: string): string | null {
  const p = normalisePAN(raw)
  if (!p) return "Enter your PAN."
  if (!PAN_RE.test(p)) return "A PAN is five letters, four digits and a letter (like ABCPE1234F)."
  if (!PAN_HOLDER_LABEL[p[3]]) return "The fourth letter of a PAN says who holds it; this one is not a holder type."
  return null
}

/** XXXXXX234F — what the server stores and sends back. */
export function maskPAN(raw: string): string {
  const p = normalisePAN(raw)
  if (p.length <= 4) return "X".repeat(p.length)
  return "X".repeat(p.length - 4) + p.slice(-4)
}

// ── GSTIN ───────────────────────────────────────────────────────

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

/** shared/kyc GSTINCheckDigit: mod-36, weights 1 and 2 alternating. */
export function gstinCheckCharacter(first14: string): string | null {
  if (first14.length !== 14) return null
  let sum = 0
  for (let i = 0; i < 14; i += 1) {
    const v = GSTIN_ALPHABET.indexOf(first14[i])
    if (v < 0) return null
    const p = v * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(p / 36) + (p % 36)
  }
  return GSTIN_ALPHABET[(36 - (sum % 36)) % 36]
}

export function normaliseGSTIN(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase()
}

/** What is wrong with a GSTIN, or null. Layout and check character; the server also checks the state code. */
export function validateGSTIN(raw: string): string | null {
  const g = normaliseGSTIN(raw)
  if (!g) return "Enter your GSTIN."
  if (!GSTIN_RE.test(g)) return "A GSTIN is 15 characters: state code, PAN, entity number, Z and a check character."
  if (!PAN_HOLDER_LABEL[g[5]]) return "The PAN inside this GSTIN has no recognised holder type."
  if (gstinCheckCharacter(g.slice(0, 14)) !== g[14]) return "The last character does not match; check the GSTIN for a typo."
  return null
}

/** The PAN a GSTIN is registered to (characters 3–12). */
export function gstinPAN(raw: string): string {
  return normaliseGSTIN(raw).slice(2, 12)
}

// ── The step ────────────────────────────────────────────────────

/** PUT /onboarding/step/sell-scope (saveSellScopeReq). */
export interface SellScopeBody {
  sell_scope: SellScope
  gstin?: string
  pan?: string
  business_name?: string
}

/** service.SellScopeSaved. */
export interface SellScopeSavedWire {
  sell_scope: SellScope
  gstin?: string
  business_name?: string
  pan_masked?: string
  pan_holder_type?: string
}

/** GET /seller/sell-scope and POST /seller/sell-scope/upgrade (service.SellScopeView). */
export interface SellScopeViewWire {
  sell_scope: string
  has_gstin: boolean
  book_category_ids: string[]
  can_upgrade: boolean
}

export interface SellScopeDraft {
  scope: SellScope
  gstin: string
  pan: string
  businessName: string
}

export type SellScopeErrors = Partial<Record<"gstin" | "pan" | "businessName", string>>

/** The step's own checks: the GSTIN on the all-categories path; PAN and business name on the books path. */
export function validateSellScopeDraft(d: SellScopeDraft): SellScopeErrors {
  const e: SellScopeErrors = {}
  const name = d.businessName.trim()
  if (d.scope === "all_categories") {
    const g = validateGSTIN(d.gstin)
    if (g) e.gstin = g
    if (name && (name.length < 2 || name.length > 200)) e.businessName = "Keep the business name between 2 and 200 characters."
  } else {
    const p = validatePAN(d.pan)
    if (p) e.pan = p
    if (name.length < 2 || name.length > 200) e.businessName = "Enter the business name (2 to 200 characters)."
  }
  return e
}

/** The body as it leaves the browser: only the fields the chosen path takes (the server refuses the others). */
export function sellScopePayload(d: SellScopeDraft): SellScopeBody {
  const name = d.businessName.trim()
  if (d.scope === "all_categories") {
    return { sell_scope: "all_categories", gstin: normaliseGSTIN(d.gstin), ...(name ? { business_name: name } : {}) }
  }
  return { sell_scope: "books_only", pan: normalisePAN(d.pan), business_name: name }
}

// ── Listing as a books-only shop ────────────────────────────────

interface TreeNode {
  id: string
  is_listable: boolean
  children: TreeNode[]
}

/**
 * The category tree a books-only shop may pick from: every allowed node, and
 * the headings above them so the path still reads "Books › Textbooks". A
 * heading kept only as a path to an allowed node is made non-listable.
 */
export function bookOnlyTree<T extends TreeNode>(roots: readonly T[], allowedIds: readonly string[]): T[] {
  const allowed = new Set(allowedIds)
  const walk = (nodes: readonly T[]): T[] => {
    const out: T[] = []
    for (const n of nodes) {
      const kids = walk((n.children ?? []) as T[])
      if (allowed.has(n.id)) out.push({ ...n, children: kids })
      else if (kids.length > 0) out.push({ ...n, is_listable: false, children: kids })
    }
    return out
  }
  return walk(roots)
}

/** The tax classes a books-only shop may choose: the zero-rated one(s). */
export function zeroRatedTaxClasses<T extends { rate_percent: number }>(classes: readonly T[]): T[] {
  return classes.filter((c) => c.rate_percent === 0)
}

// ── The refusals ────────────────────────────────────────────────

/** 403 SELLER_SCOPE_BOOKS_ONLY: the field it names (category_id | tax_class_id) and the server's sentence. */
export function sellerScopeBooksOnlyFrom(error: unknown): { field: string; message: string } | null {
  const { status, code, message, details } = apiEnvelope(error)
  if (code !== "SELLER_SCOPE_BOOKS_ONLY" && !(status === 403 && details.sell_scope === "books_only")) return null
  return { field: typeof details.field === "string" ? details.field : "", message }
}

/** The sell-scope step and upgrade refusals, as a field and a sentence for under it. */
export function sellScopeFieldError(error: unknown): { field: string; message: string } | null {
  const { code, message, details } = apiEnvelope(error)
  switch (code) {
    case "SELL_SCOPE_INVALID":
    case "SELL_SCOPE_FIELD_NOT_TAKEN":
    case "GSTIN_REQUIRED":
    case "GSTIN_INVALID":
    case "PAN_REQUIRED":
    case "PAN_INVALID":
    case "BUSINESS_NAME_REQUIRED":
      return { field: typeof details.field === "string" ? details.field : "", message }
    case "GSTIN_PAN_MISMATCH":
      return { field: "gstin", message: "This GSTIN is registered to a different PAN. Use the GSTIN issued on the PAN your shop was approved with." }
    case "SELL_SCOPE_LOCKED":
      return { field: "", message: "The application is with the reviewers, so what you sell cannot be changed now." }
    case "SELL_SCOPE_NOT_BOOKS_ONLY":
      return { field: "", message: "Your shop already sells in every category." }
    default:
      return null
  }
}

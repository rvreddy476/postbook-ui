// The listing editor's pure half: the server's refusals decoded, the attribute
// answers on the wire, the variation matrix (axes → cross product → request),
// and the gallery's rules. Ported from atpost-web-ui lib/{listing,variation,
// gallery}.ts, re-read against commerce-service handler.go createProductReq,
// handler_products.go (PATCH allowlist), handler_storefront.go (gallery) and
// service/variationaxes.go. Money goes through `parseMinor` from ../money and
// nowhere else.

import { formatMinor, parseMinor } from "../money"
import { apiEnvelope, type BannerTone } from "./sell"
import type { AttributeDefinition, AttributeGroup, AttributeSchema, AttributeValue, AttributeValueMap } from "./attributes"
import { optionCode } from "./attributes"

// ═══════════════════════════════════════════════════════════════
//  The write routes' refusals
// ═══════════════════════════════════════════════════════════════

/** 422 ATTRIBUTE_VALUES_INVALID → per-code messages for mergeServerErrors; null for anything else. */
export function attributeErrorsFrom(err: unknown): Record<string, { message: string; code?: string }> | null {
  const { status, code, details } = apiEnvelope(err)
  if (status !== 422 || code !== "ATTRIBUTE_VALUES_INVALID") return null
  const fields = details.fields
  if (!Array.isArray(fields)) return {}
  const map: Record<string, { message: string; code?: string }> = {}
  for (const entry of fields) {
    const row = entry as { code?: unknown; reason?: unknown }
    if (typeof row.code !== "string" || row.code === "") continue
    map[row.code] = {
      message: typeof row.reason === "string" && row.reason ? row.reason : "The catalogue refused this value.",
      code: "ATTRIBUTE_VALUES_INVALID",
    }
  }
  return map
}

export interface VariationProblem {
  /** The SKU, "variant 3" on a create, or a variant id on a patch. */
  variant?: string
  code?: string
  reason: string
}

/** 422 VARIATION_INVALID → every complaint about the matrix; null for anything else. */
export function variationProblemsFrom(err: unknown): VariationProblem[] | null {
  const { status, code, details } = apiEnvelope(err)
  if (status !== 422 || code !== "VARIATION_INVALID") return null
  const raw = details.problems
  if (!Array.isArray(raw)) return []
  const out: VariationProblem[] = []
  for (const entry of raw) {
    const row = entry as { variant?: unknown; code?: unknown; reason?: unknown }
    const reason = typeof row.reason === "string" ? row.reason : ""
    if (reason === "") continue
    out.push({
      variant: typeof row.variant === "string" ? row.variant : undefined,
      code: typeof row.code === "string" && row.code !== "" ? row.code : undefined,
      reason,
    })
  }
  return out
}

/** 409 REVALIDATION_REQUIRED → the fields that send the listing back for review. Empty still means yes. */
export function revalidationFrom(err: unknown): { fields: string[] } | null {
  const { status, code, details } = apiEnvelope(err)
  if (status !== 409 || code !== "REVALIDATION_REQUIRED") return null
  const raw = details.fields
  return { fields: Array.isArray(raw) ? raw.filter((f): f is string => typeof f === "string") : [] }
}

/** 400 FIELD_NOT_PATCHABLE → the refusal and the allowlist. */
export function notPatchableFrom(err: unknown): { message: string; patchable: string[] } | null {
  const { status, code, message, details } = apiEnvelope(err)
  if (status !== 400 || code !== "FIELD_NOT_PATCHABLE") return null
  const raw = details.patchable
  return {
    message: message || "That field cannot be changed after the listing is created.",
    patchable: Array.isArray(raw) ? raw.filter((f): f is string => typeof f === "string") : [],
  }
}

/** 422 PRODUCT_INCOMPLETE → the gaps, keyed by code with the label the gate set. */
export function incompleteFrom(err: unknown): { code: string; label: string; reason: string }[] | null {
  const { status, code, details } = apiEnvelope(err)
  if (status !== 422 || code !== "PRODUCT_INCOMPLETE") return null
  const fields = details.fields
  if (!Array.isArray(fields)) return []
  return fields
    .map((f) => f as { code?: unknown; label?: unknown; reason?: unknown })
    .filter((f) => typeof f.code === "string")
    .map((f) => ({
      code: f.code as string,
      label: typeof f.label === "string" && f.label ? f.label : (f.code as string),
      reason: typeof f.reason === "string" ? f.reason : "",
    }))
}

// ═══════════════════════════════════════════════════════════════
//  Attribute answers on the wire
// ═══════════════════════════════════════════════════════════════

/** One answer as POST /products and PATCH /products/:id take it (service.AttributeValueInput). */
export interface AttributeWireValue {
  code: string
  value: unknown
  unit_code?: string
}

/** Raw values under `attributes`; the server knows the type from the definition. A measure sends its unit. */
export function toAttributePayload(values: AttributeValueMap): AttributeWireValue[] {
  const out: AttributeWireValue[] = []
  for (const [code, value] of Object.entries(values)) {
    if (!code || value === null || value === undefined) continue
    const entry: AttributeWireValue = { code, value: (value as { value: unknown }).value }
    if (entry.value === null || entry.value === undefined) continue
    if (typeof entry.value === "string" && entry.value.trim() === "") continue
    if (Array.isArray(entry.value) && entry.value.length === 0) continue
    if (value.type === "measure" && value.unit) entry.unit_code = value.unit
    out.push(entry)
  }
  return out
}

/** The detail route's `attributes[]` (service.ProductAttributeDoc) back into the tagged working state. */
export function attributeValuesFromProduct(
  rows: ReadonlyArray<{ code?: string; data_type?: string; value?: unknown; unit_code?: string | null }>,
): AttributeValueMap {
  const out: AttributeValueMap = {}
  for (const row of rows) {
    const code = typeof row.code === "string" ? row.code : ""
    if (!code || row.value === null || row.value === undefined) continue
    const type = typeof row.data_type === "string" ? row.data_type : ""
    switch (type) {
      case "measure":
        out[code] = { type: "measure", value: String(row.value), unit: row.unit_code ?? "" }
        break
      case "decimal":
        out[code] = { type: "decimal", value: String(row.value) }
        break
      case "text":
      case "long_text":
      case "integer":
      case "money_minor":
      case "boolean":
      case "enum":
      case "multi_enum":
      case "date":
      case "media":
      case "gtin":
        out[code] = { type, value: row.value } as AttributeValue
        break
      default:
        out[code] = { type: "unknown", data_type: type, value: row.value }
    }
  }
  return out
}

// ═══════════════════════════════════════════════════════════════
//  The product's own columns
// ═══════════════════════════════════════════════════════════════

/** The built-in fields the editor owns. */
export interface ListingBasics {
  title: string
  description: string
  taxClassId: string
  hsnCode: string
  /** Text as typed; converted once on the way out. */
  weightGrams: string
  lengthCm: string
  widthCm: string
  heightCm: string
  returnPolicy: string
}

export const emptyBasics: ListingBasics = {
  title: "",
  description: "",
  taxClassId: "",
  hsnCode: "",
  weightGrams: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  returnPolicy: "7_days",
}

export const RETURN_POLICIES = [
  { value: "no_return", label: "No returns" },
  { value: "7_days", label: "7 days" },
  { value: "14_days", label: "14 days" },
  { value: "30_days", label: "30 days" },
] as const

/** The single-variant offer (a listing that does not vary). */
export interface ListingOffer {
  sku: string
  mrp: string
  price: string
  stock: string
}

export const emptyOffer: ListingOffer = { sku: "", mrp: "", price: "", stock: "" }

/** Only the columns the editor shows; seeding a hidden field would PATCH it back unchanged. */
export function basicsFromProduct(product: Record<string, unknown>): ListingBasics {
  const s = (v: unknown) => (typeof v === "string" ? v : "")
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? String(v) : "")
  return {
    title: s(product.title),
    description: s(product.description),
    taxClassId: s(product.tax_class_id),
    hsnCode: s(product.hsn_code),
    weightGrams: n(product.weight_grams),
    lengthCm: n(product.length_cm),
    widthCm: n(product.width_cm),
    heightCm: n(product.height_cm),
    returnPolicy: s(product.return_policy_type) || "7_days",
  }
}

export type BasicsErrors = Partial<Record<keyof ListingBasics, string>>

const HSN_RE = /^\d{4}(?:\d{2})?(?:\d{2})?$/

export function validateBasics(b: ListingBasics): BasicsErrors {
  const e: BasicsErrors = {}
  if (b.title.trim().length < 3) e.title = "Give the listing a title (at least 3 characters)."
  else if (b.title.trim().length > 200) e.title = "Keep the title under 200 characters."
  if (!b.taxClassId.trim()) e.taxClassId = "Choose the GST rate. Checkout refuses a listing without one."
  if (b.hsnCode.trim() && !HSN_RE.test(b.hsnCode.trim())) e.hsnCode = "An HSN code is 4, 6 or 8 digits."
  for (const key of ["weightGrams", "lengthCm", "widthCm", "heightCm"] as const) {
    const t = b[key].trim()
    if (t && !(Number.isFinite(Number(t)) && Number(t) > 0)) e[key] = "Enter a positive number."
  }
  if (b.weightGrams.trim() && !Number.isInteger(Number(b.weightGrams.trim()))) e.weightGrams = "Weight is whole grams."
  return e
}

export type OfferErrors = Partial<Record<keyof ListingOffer, string>>

/**
 * The single-variant offer. Prices go through parseMinor: a typed "12.345" is
 * refused, never rounded; a price must be positive; MRP must not be below the
 * selling price.
 */
export function validateOffer(o: ListingOffer): OfferErrors {
  const e: OfferErrors = {}
  if (!o.sku.trim()) e.sku = "Give this a SKU."
  const mrp = parseMinor(o.mrp)
  const price = parseMinor(o.price)
  if (mrp === null) e.mrp = "Enter the MRP in rupees, at most two decimals."
  else if (mrp <= 0) e.mrp = "MRP must be more than zero."
  if (price === null) e.price = "Enter the selling price in rupees, at most two decimals."
  else if (price <= 0) e.price = "The selling price must be more than zero."
  if (mrp !== null && price !== null && mrp < price) e.mrp = "MRP cannot be below the selling price."
  const stock = o.stock.trim()
  if (stock && !/^\d+$/.test(stock)) e.stock = "Stock is a whole number."
  return e
}

/** The product-level keys of POST /products (createProductReq) and PATCH /products/:id (patchableProductFields). */
export interface ListingColumns {
  title: string
  description?: string
  category_id: string
  tax_class_id: string
  product_type: "physical"
  condition: "new"
  return_policy_type: string
  return_policy_days: number
  hsn_code?: string
  weight_grams?: number
  length_cm?: number
  width_cm?: number
  height_cm?: number
}

export function returnPolicyDays(policy: string): number {
  if (policy === "no_return") return 0
  const n = Number(policy.split("_")[0])
  return Number.isFinite(n) ? n : 0
}

export function listingColumns(categoryId: string, b: ListingBasics): ListingColumns {
  const num = (t: string) => (t.trim() ? Number(t.trim()) : undefined)
  const hsn = b.hsnCode.trim()
  const weight = num(b.weightGrams)
  const length = num(b.lengthCm)
  const width = num(b.widthCm)
  const height = num(b.heightCm)
  return {
    title: b.title.trim(),
    description: b.description.trim(),
    category_id: categoryId,
    tax_class_id: b.taxClassId,
    product_type: "physical",
    condition: "new",
    return_policy_type: b.returnPolicy,
    return_policy_days: returnPolicyDays(b.returnPolicy),
    ...(hsn ? { hsn_code: hsn } : {}),
    ...(weight !== undefined ? { weight_grams: Math.round(weight) } : {}),
    ...(length !== undefined ? { length_cm: length } : {}),
    ...(width !== undefined ? { width_cm: width } : {}),
    ...(height !== undefined ? { height_cm: height } : {}),
  }
}

/** One row of `variants` on a create for a listing that does not vary: paise, never floats. */
export function singleVariantPayload(o: ListingOffer): VariantCreateWire {
  return {
    sku: o.sku.trim(),
    mrp_minor: parseMinor(o.mrp) ?? 0,
    selling_price_minor: parseMinor(o.price) ?? 0,
    stock_qty: o.stock.trim() === "" ? 0 : Number(o.stock.trim()),
    options: [],
  }
}

// ═══════════════════════════════════════════════════════════════
//  The variation matrix
// ═══════════════════════════════════════════════════════════════

/** Two: the database's limit (option_1 / option_2 derived columns). */
export const MAX_AXES = 2
/** Twenty combinations, the server's cap. */
export const MAX_COMBINATIONS = 20

export interface AxisOption {
  code: string
  label: string
  swatchHex: string | null
}

export interface AxisCandidate {
  code: string
  label: string
  options: AxisOption[]
  unavailable: string | null
}

function optionsOf(def: AttributeDefinition): AxisOption[] {
  return (def.values ?? [])
    .filter((v) => v.is_active !== false && optionCode(v) !== "")
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((v) => ({ code: optionCode(v), label: v.label || optionCode(v), swatchHex: v.swatch_hex ?? null }))
}

/** Every attribute the category says a product may vary on; one with no options is offered as unavailable, not hidden. */
export function axisCandidates(schema: AttributeSchema | null): AxisCandidate[] {
  if (!schema) return []
  const declared = new Set(schema.variation_axes ?? [])
  const out: AxisCandidate[] = []
  for (const group of schema.groups ?? []) {
    for (const def of group.attributes ?? []) {
      if (!def.is_variant_axis && !declared.has(def.code)) continue
      const options = optionsOf(def)
      out.push({
        code: def.code,
        label: def.label || def.code,
        options,
        unavailable:
          options.length > 0
            ? null
            : `${def.label || def.code} has no published options yet, so it cannot be an axis here.`,
      })
    }
  }
  return out
}

export function candidateFor(candidates: AxisCandidate[], code: string): AxisCandidate | null {
  return candidates.find((c) => c.code === code) ?? null
}

export type Combination = Record<string, string>

export interface MatrixRow {
  key: string
  combo: Combination
  sku: string
  /** Rupees as typed; paise once, on the way out. */
  mrp: string
  price: string
  stock: string
  included: boolean
  variantId?: string
  dirty?: boolean
  stranded?: boolean
}

export interface MatrixState {
  axes: string[]
  values: Record<string, string[]>
  rows: Record<string, MatrixRow>
}

export const emptyMatrix: MatrixState = { axes: [], values: {}, rows: {} }

export function combinationKey(axes: string[], combo: Combination): string {
  return axes.map((axis) => `${axis}=${combo[axis] ?? ""}`).join("|")
}

/** The cross product, last axis varying fastest. */
export function combinationsFor(axes: string[], values: Record<string, string[]>): Combination[] {
  if (axes.length === 0) return []
  let out: Combination[] = [{}]
  for (const axis of axes) {
    const picked = values[axis] ?? []
    if (picked.length === 0) return []
    const next: Combination[] = []
    for (const partial of out) for (const value of picked) next.push({ ...partial, [axis]: value })
    out = next
  }
  return out
}

export function combinationCount(axes: string[], values: Record<string, string[]>): number {
  if (axes.length === 0) return 0
  return axes.reduce((total, axis) => total * (values[axis] ?? []).length, 1)
}

/** What one more value on `axis` would cost, in rows, asked BEFORE the pick. */
export function countIfAdded(state: MatrixState, axis: string, value: string): number {
  const picked = state.values[axis] ?? []
  if (picked.includes(value)) return combinationCount(state.axes, state.values)
  return combinationCount(state.axes, { ...state.values, [axis]: [...picked, value] })
}

function skuPart(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

export function suggestSku(stem: string, axes: string[], combo: Combination): string {
  const parts = [skuPart(stem), ...axes.map((axis) => skuPart(combo[axis] ?? ""))]
  return parts.filter((p) => p !== "").join("-")
}

/** The rows the axes and values imply, anything typed kept, stranded server rows appended. */
export function matrixRows(state: MatrixState, stem = ""): MatrixRow[] {
  const rows: MatrixRow[] = []
  const seen = new Set<string>()
  for (const combo of combinationsFor(state.axes, state.values)) {
    const key = combinationKey(state.axes, combo)
    seen.add(key)
    const held = state.rows[key]
    rows.push(
      held
        ? { ...held, key, combo, stranded: false }
        : { key, combo, sku: suggestSku(stem, state.axes, combo), mrp: "", price: "", stock: "", included: true },
    )
  }
  for (const [key, row] of Object.entries(state.rows)) {
    if (seen.has(key) || !row.variantId) continue
    rows.push({ ...row, stranded: true, included: true })
  }
  return rows
}

export function withRow(state: MatrixState, row: MatrixRow): MatrixState {
  return { ...state, rows: { ...state.rows, [row.key]: row } }
}

export function applyToAll(state: MatrixState, stem: string, field: "mrp" | "price" | "stock", value: string): MatrixState {
  const rows = { ...state.rows }
  for (const row of matrixRows(state, stem)) {
    if (row.stranded) continue
    rows[row.key] = { ...row, [field]: value, dirty: row.dirty || field !== "stock" }
  }
  return { ...state, rows }
}

export type RowProblems = Record<string, string[]>

function addProblem(into: RowProblems, key: string, message: string): void {
  const list = into[key] ?? []
  if (!list.includes(message)) list.push(message)
  into[key] = list
}

/** Everything the grid can say before a round trip: SKUs, money through parseMinor, stranded rows. */
export function localProblems(rows: MatrixRow[]): RowProblems {
  const problems: RowProblems = {}
  const bySku = new Map<string, number>()
  for (const row of rows) {
    if (!row.included) continue
    const sku = row.sku.trim()
    if (sku !== "") bySku.set(sku, (bySku.get(sku) ?? 0) + 1)
  }
  for (const row of rows) {
    if (row.stranded) {
      addProblem(problems, row.key, "This variant already exists but its combination is no longer in the grid. Put its values back, or give it a combination the grid contains.")
      continue
    }
    if (!row.included) continue
    const sku = row.sku.trim()
    if (sku === "") addProblem(problems, row.key, "Needs a SKU.")
    else if ((bySku.get(sku) ?? 0) > 1) addProblem(problems, row.key, `Two rows use the SKU ${sku}. Each one has to be its own.`)
    const mrp = parseMinor(row.mrp)
    const price = parseMinor(row.price)
    if (mrp === null) addProblem(problems, row.key, "Needs an MRP.")
    else if (mrp <= 0) addProblem(problems, row.key, "MRP must be more than zero.")
    if (price === null) addProblem(problems, row.key, "Needs a selling price.")
    else if (price <= 0) addProblem(problems, row.key, "The selling price must be more than zero.")
    if (mrp !== null && price !== null && mrp > 0 && price > 0 && mrp < price) addProblem(problems, row.key, "MRP cannot be below the selling price.")
    if (row.stock.trim() !== "" && !/^\d+$/.test(row.stock.trim())) addProblem(problems, row.key, "Stock is a whole number.")
  }
  return problems
}

/** Integer paise → the rupee text a field holds. */
export function minorToRupees(minor: number): string {
  return formatMinor(minor).replace(/\.00$/, "")
}

export interface VariationAxisWire {
  code: string
}
export interface VariantOptionWire {
  code: string
  value: string
}
/** One row of a create (createVariantReq): paise, options by CODE. */
export interface VariantCreateWire {
  sku: string
  mrp_minor: number
  selling_price_minor: number
  stock_qty: number
  options: VariantOptionWire[]
}
/** One row of a matrix PATCH: which variant, and where it sits on the axes. */
export interface VariantOptionsWire {
  variant_id: string
  options: VariantOptionWire[]
}

/** Array order only; `position` is never sent. */
export function axesPayload(axes: string[]): VariationAxisWire[] {
  return axes.map((code) => ({ code }))
}

function optionsPayload(axes: string[], combo: Combination): VariantOptionWire[] {
  return axes.map((axis) => ({ code: axis, value: combo[axis] ?? "" }))
}

export function createVariantsPayload(axes: string[], rows: MatrixRow[]): VariantCreateWire[] {
  return rows
    .filter((row) => row.included && !row.stranded)
    .map((row) => ({
      sku: row.sku.trim(),
      mrp_minor: parseMinor(row.mrp) ?? 0,
      selling_price_minor: parseMinor(row.price) ?? 0,
      stock_qty: row.stock.trim() === "" ? 0 : Number(row.stock.trim()),
      options: optionsPayload(axes, row.combo),
    }))
}

/** Every variant the product has, by id: a matrix PATCH replaces the whole picture. */
export function patchVariantsPayload(axes: string[], rows: MatrixRow[]): VariantOptionsWire[] {
  return rows
    .filter((row) => !!row.variantId)
    .map((row) => ({ variant_id: row.variantId as string, options: optionsPayload(axes, row.combo) }))
}

/** 422 VARIATION_INVALID → one message per row, matched by SKU, id, or "variant N" position. */
export function problemsOntoRows(problems: VariationProblem[], sent: MatrixRow[]): { rows: RowProblems; unattached: string[] } {
  const rows: RowProblems = {}
  const unattached: string[] = []
  const bySku = new Map<string, MatrixRow>()
  const byId = new Map<string, MatrixRow>()
  sent.forEach((row) => {
    const sku = row.sku.trim()
    if (sku !== "" && !bySku.has(sku)) bySku.set(sku, row)
    if (row.variantId) byId.set(row.variantId, row)
  })
  for (const problem of problems) {
    const named = (problem.variant ?? "").trim()
    const message = problem.code ? `${problem.code}: ${problem.reason}` : problem.reason
    let row = named === "" ? undefined : (bySku.get(named) ?? byId.get(named))
    if (!row && named !== "") {
      const position = /^variant (\d+)$/.exec(named)
      if (position) row = sent[Number(position[1]) - 1]
    }
    if (row) addProblem(rows, row.key, message)
    else unattached.push(named === "" ? message : `${named}: ${message}`)
  }
  return { rows, unattached }
}

/** GET /products/:id/variants rows, narrowed to what the grid needs. */
export interface ExistingVariant {
  id: string
  sku: string
  status?: string
  option_1_name?: string | null
  option_1_value?: string | null
  option_2_name?: string | null
  option_2_value?: string | null
  mrp?: number
  selling_price?: number
  mrp_minor?: number | null
  selling_price_minor?: number | null
  available_qty?: number | null
}

function looseMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * An existing product's variants → the grid that produced them. No read
 * returns option CODES; the derived label pair is matched back to the schema.
 * A variant whose labels do not resolve is kept, stranded, so it can be fixed
 * rather than silently omitted from a PATCH that must name every variant.
 */
export function matrixFromVariants(candidates: AxisCandidate[], variants: ExistingVariant[]): MatrixState | null {
  const withOptions = variants.filter((v) => (v.option_1_name ?? "").trim() !== "")
  if (withOptions.length === 0) return null

  const axes: string[] = []
  for (const slot of ["option_1_name", "option_2_name"] as const) {
    const label = withOptions.map((v) => (v[slot] ?? "").trim()).find((l) => l !== "")
    if (!label) continue
    const hit = candidates.find((c) => looseMatch(c.code, label) || looseMatch(c.label, label))
    axes.push(hit ? hit.code : label)
  }
  if (axes.length === 0) return null

  const values: Record<string, string[]> = {}
  const rows: Record<string, MatrixRow> = {}
  for (const variant of withOptions) {
    const combo: Combination = {}
    let resolved = true
    axes.forEach((axis, index) => {
      const raw = ((index === 0 ? variant.option_1_value : variant.option_2_value) ?? "").trim()
      if (raw === "") {
        resolved = false
        return
      }
      const option = candidateFor(candidates, axis)?.options.find((o) => looseMatch(o.code, raw) || looseMatch(o.label, raw))
      if (!option) {
        resolved = false
        return
      }
      combo[axis] = option.code
    })
    const mrpMinor = variant.mrp_minor && variant.mrp_minor > 0 ? variant.mrp_minor : Math.round((variant.mrp ?? 0) * 100)
    const priceMinor =
      variant.selling_price_minor && variant.selling_price_minor > 0 ? variant.selling_price_minor : Math.round((variant.selling_price ?? 0) * 100)
    const row: MatrixRow = {
      key: resolved ? combinationKey(axes, combo) : `unresolved:${variant.id}`,
      combo,
      sku: variant.sku,
      mrp: minorToRupees(mrpMinor),
      price: minorToRupees(priceMinor),
      stock: variant.available_qty === null || variant.available_qty === undefined ? "" : String(variant.available_qty),
      included: true,
      variantId: variant.id,
      stranded: !resolved,
    }
    rows[row.key] = row
    if (!resolved) continue
    for (const axis of axes) {
      const picked = values[axis] ?? []
      if (!picked.includes(combo[axis])) picked.push(combo[axis])
      values[axis] = picked
    }
  }
  return { axes, values, rows }
}

export function rowsNeedingCreation(rows: MatrixRow[]): MatrixRow[] {
  return rows.filter((row) => row.included && !row.stranded && !row.variantId)
}

// ═══════════════════════════════════════════════════════════════
//  The gallery
// ═══════════════════════════════════════════════════════════════

/** postgres.MaxProductMedia. */
export const MAX_GALLERY_IMAGES = 8
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const IMAGE_ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"

export type GalleryStatus = "queued" | "uploading" | "processing" | "ready" | "failed"

export interface GalleryItem {
  key: string
  mediaId: string | null
  previewUrl: string | null
  fileName: string
  status: GalleryStatus
  progress: number
  error: string | null
  file?: File
}

export interface AddResult {
  items: GalleryItem[]
  rejected: Array<{ fileName: string; reason: string }>
}

let keySeq = 0
export function nextGalleryKey(): string {
  keySeq += 1
  return `g${keySeq}`
}

/** Picked files onto the end, up to the cap; the overflow and wrong types are refused by name. */
export function addToGallery(
  items: readonly GalleryItem[],
  files: readonly File[],
  makeKey: () => string = nextGalleryKey,
  makePreview: (file: File) => string | null = () => null,
): AddResult {
  const out = items.slice()
  const rejected: AddResult["rejected"] = []
  for (const file of files) {
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      rejected.push({ fileName: file.name, reason: "Only JPEG, PNG and WebP images can be uploaded." })
      continue
    }
    if (out.length >= MAX_GALLERY_IMAGES) {
      rejected.push({ fileName: file.name, reason: `A product carries at most ${MAX_GALLERY_IMAGES} images.` })
      continue
    }
    out.push({ key: makeKey(), mediaId: null, previewUrl: makePreview(file), fileName: file.name, status: "queued", progress: 0, error: null, file })
  }
  return { items: out, rejected }
}

export function moveGalleryItem(items: readonly GalleryItem[], from: number, to: number): GalleryItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items.slice()
  const out = items.slice()
  const [moved] = out.splice(from, 1)
  out.splice(to, 0, moved)
  return out
}

export function removeGalleryItem(items: readonly GalleryItem[], key: string): GalleryItem[] {
  return items.filter((item) => item.key !== key)
}

export function patchGalleryItem(items: readonly GalleryItem[], key: string, patch: Partial<GalleryItem>): GalleryItem[] {
  return items.map((item) => (item.key === key ? { ...item, ...patch } : item))
}

/** The cover is the first row. */
export function coverOf(items: readonly GalleryItem[]): GalleryItem | null {
  return items[0] ?? null
}

/** What `media_ids` carries: every READY row's id, in order, once. */
export function galleryMediaIds(items: readonly GalleryItem[]): string[] {
  const out: string[] = []
  for (const item of items) if (item.status === "ready" && item.mediaId && !out.includes(item.mediaId)) out.push(item.mediaId)
  return out
}

export function galleryBusy(items: readonly GalleryItem[]): boolean {
  return items.some((item) => item.status === "queued" || item.status === "uploading" || item.status === "processing")
}

export function galleryProblem(items: readonly GalleryItem[]): string | null {
  if (galleryBusy(items)) return "Images are still uploading."
  if (items.length > 0 && galleryMediaIds(items).length === 0) return "None of these images is ready to attach."
  return null
}

/** An already-attached image (service.ProductMediaItem) as a gallery row. */
export function attachedGalleryItem(entry: { media_id: string; image_url?: string; thumbnail_url?: string }, makeKey: () => string = nextGalleryKey): GalleryItem {
  return { key: makeKey(), mediaId: entry.media_id, previewUrl: entry.thumbnail_url || entry.image_url || null, fileName: "", status: "ready", progress: 1, error: null }
}

// ═══════════════════════════════════════════════════════════════
//  Editor steps and readiness
// ═══════════════════════════════════════════════════════════════

/**
 * Category → details → price and variants → images → review. Variants come
 * before images because POST /products requires at least one variant (so the
 * draft cannot exist until it is priced) and the gallery routes need the
 * draft's id.
 */
export const EDITOR_STEPS = ["category", "details", "variants", "images", "review"] as const
export type EditorStep = (typeof EDITOR_STEPS)[number]

export const EDITOR_STEP_LABEL: Record<EditorStep, string> = {
  category: "Category",
  details: "Details",
  variants: "Price and variants",
  images: "Images",
  review: "Review",
}

/** A step past the category needs a category; images and review need the draft to exist on the server. */
export function editorStepUnlocked(step: EditorStep, state: { categoryId: string | null; productId: string | null }): boolean {
  if (step === "category") return true
  if (!state.categoryId) return false
  if (step === "details" || step === "variants") return true
  return !!state.productId
}

export const READINESS_TONE: Record<string, BannerTone> = { ready: "success", missing: "warning" }

/** The built-in gap codes of submitgate.go (`listing.*`) → the step that fixes them; anything else is a category attribute on the details step. */
export function stepForGap(code: string): EditorStep {
  switch (code) {
    case "listing.image":
      return "images"
    case "listing.price":
    case "listing.stock":
    case "listing.variant":
      return "variants"
    default:
      return "details"
  }
}

/** Groups in authored order; every offer-scope attribute lifted into the offer panel, so "these are yours" stays true. */
export function arrangeGroups(schema: AttributeSchema | null): { itemGroups: AttributeGroup[]; offerAttributes: AttributeDefinition[] } {
  if (!schema) return { itemGroups: [], offerAttributes: [] }
  const sorted = [...(schema.groups ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const itemGroups: AttributeGroup[] = []
  const offerAttributes: AttributeDefinition[] = []
  for (const group of sorted) {
    const attributes = group.attributes ?? []
    if (group.name.trim().toLowerCase() === "offer") {
      offerAttributes.push(...attributes)
      continue
    }
    const mine = attributes.filter((def) => def.scope !== "offer")
    offerAttributes.push(...attributes.filter((def) => def.scope === "offer"))
    if (mine.length > 0) itemGroups.push({ ...group, attributes: mine })
  }
  return { itemGroups, offerAttributes }
}

// One product, as the detail page reads it: `GET /products/:id` sends
// `{product, variants, media, attributes}`; the gallery, the variant picker,
// the price line and the spec table are all pure functions of that body.
//
// Pure, so the three things a product page gets wrong on its own — which
// combinations of options exist, what the selected variant costs and whether
// it can be bought — are pinned by tests without a query client.

import { discountPercent, inrMinor } from "../money"
import { apiErrorCode, productImageUrl, readMinor, type WireProductSummary } from "./storefront"

// ── Wire ───────────────────────────────────────────────────────────────

/** `postgres.ProductVariant` on the wire. Money in the `_minor` pair; `available_qty` is absent for 0. */
export interface WireVariant {
  id?: string
  product_id?: string
  sku?: string
  option_1_name?: string | null
  option_1_value?: string | null
  option_2_name?: string | null
  option_2_value?: string | null
  option_3_name?: string | null
  option_3_value?: string | null
  /** Integer paise. */
  mrp_minor?: number | null
  /** Integer paise. */
  selling_price_minor?: number | null
  currency_code?: string
  status?: string
  image_media_id?: string | null
  /** `total_qty - reserved_qty`, clamped at zero; absent for 0 (omitempty) and for "no stock record". */
  available_qty?: number | null
}

/** One gallery entry, as `service.ProductMediaItem` is sent. */
export interface WireMediaItem {
  media_id?: string
  media_type?: string
  sort_order?: number
  image_url?: string
  thumbnail_url?: string
  is_cover?: boolean
}

/** One typed attribute, as `service.ProductAttributeDoc` is sent in the detail body. */
export interface WireAttributeDoc {
  code?: string
  label?: string
  data_type?: string
  value?: unknown
  unit_code?: string | null
  display_group?: string
}

/** One legacy spec row from `GET /products/:id/attributes` (`postgres.ProductAttribute`). */
export interface WireLegacyAttribute {
  name: string
  value: string
  unit?: string | null
}

/** The detail product is the summary plus the long fields. */
export interface WireProductDetail extends WireProductSummary {
  status?: string
  warranty_info?: string | null
  return_policy_type?: string
  return_policy_days?: number
  country_of_origin?: string | null
  /** The signed-in viewer's own reaction (shop-engagement contract §2); absent or null for none. */
  viewer_reaction?: "like" | "dislike" | null
  share_count?: number
}

export interface WireProductDetailBody {
  product?: WireProductDetail | null
  variants?: WireVariant[] | null
  media?: WireMediaItem[] | null
  attributes?: WireAttributeDoc[] | null
}

// ── Gallery ────────────────────────────────────────────────────────────

export interface GalleryImage {
  id: string
  /** The large rendition. */
  src: string
  /** The thumbnail, falling back to the large one. */
  thumb: string
}

/**
 * The images the gallery shows, in the seller's order with the cover first.
 * An entry without a resolved URL is skipped (a broken tile is worse than
 * one fewer). When the gallery is empty, the product's own image stands in,
 * so a product with only `primary_image_media_id` still has a picture.
 */
export function galleryImages(
  media: readonly WireMediaItem[] | null | undefined,
  product?: Pick<WireProductSummary, "image_url" | "thumbnail_url" | "source_image_url"> | null,
): GalleryImage[] {
  const out: GalleryImage[] = []
  const rows = Array.isArray(media) ? media.filter((m) => !!m && (m.media_type || "image") === "image") : []
  const ordered = rows
    .map((m, index) => ({ m, index }))
    .sort((a, b) => Number(b.m.is_cover === true) - Number(a.m.is_cover === true) || (a.m.sort_order ?? 0) - (b.m.sort_order ?? 0) || a.index - b.index)
  for (const { m } of ordered) {
    const src = m.image_url || m.thumbnail_url || ""
    if (!src) continue
    const id = m.media_id || src
    if (out.some((g) => g.id === id)) continue
    out.push({ id, src, thumb: m.thumbnail_url || src })
  }
  if (out.length === 0) {
    const fallback = productImageUrl(product)
    if (fallback) out.push({ id: "product", src: fallback, thumb: fallback })
  }
  return out
}

/** The index a keyboard arrow lands on, wrapping. Home/End go to the ends. */
export function galleryStep(index: number, count: number, key: string): number {
  if (count <= 0) return 0
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count
    case "Home":
      return 0
    case "End":
      return count - 1
    default:
      return Math.min(Math.max(index, 0), count - 1)
  }
}

// ── Variants ───────────────────────────────────────────────────────────

export interface Variant {
  id: string
  sku: string
  /** The option value on each axis, by axis name. Only the axes this variant names. */
  options: Record<string, string>
  priceMinor: number | null
  mrpMinor: number | null
  /** Units a buyer may take. 0 when the server omitted it (no stock, or no stock record). */
  availableQty: number
  active: boolean
  imageMediaId: string | null
}

export function toVariant(v: WireVariant): Variant | null {
  if (!v || !v.id) return null
  const options: Record<string, string> = {}
  const pairs: Array<[string | null | undefined, string | null | undefined]> = [
    [v.option_1_name, v.option_1_value],
    [v.option_2_name, v.option_2_value],
    [v.option_3_name, v.option_3_value],
  ]
  for (const [name, value] of pairs) {
    const axis = (name || "").trim()
    const option = (value || "").trim()
    if (axis && option) options[axis] = option
  }
  return {
    id: v.id,
    sku: v.sku || "",
    options,
    priceMinor: readMinor(v.selling_price_minor),
    mrpMinor: readMinor(v.mrp_minor),
    availableQty: typeof v.available_qty === "number" && v.available_qty > 0 ? Math.floor(v.available_qty) : 0,
    active: !v.status || v.status === "active",
    imageMediaId: v.image_media_id || null,
  }
}

/** The variants a buyer may pick from: active ones, with an id. */
export function sellableVariants(rows: readonly WireVariant[] | null | undefined): Variant[] {
  if (!Array.isArray(rows)) return []
  const out: Variant[] = []
  for (const row of rows) {
    const v = toVariant(row)
    if (v && v.active) out.push(v)
  }
  return out
}

export interface VariantAxis {
  name: string
  /** In first-seen order across the variants. */
  values: string[]
}

/**
 * The axes of the picker: every distinct option name, in the order the
 * variants name them, with the values in first-seen order. A product whose
 * variants name no options — the single-variant case — has no axes and no
 * picker.
 */
export function variantAxes(variants: readonly Variant[]): VariantAxis[] {
  const axes: VariantAxis[] = []
  for (const v of variants) {
    for (const [name, value] of Object.entries(v.options)) {
      let axis = axes.find((a) => a.name === name)
      if (!axis) {
        axis = { name, values: [] }
        axes.push(axis)
      }
      if (!axis.values.includes(value)) axis.values.push(value)
    }
  }
  return axes
}

/** Whether a picker is drawn: more than one variant AND at least one axis. */
export function hasVariantPicker(variants: readonly Variant[]): boolean {
  return variants.length > 1 && variantAxes(variants).length > 0
}

export type Selection = Record<string, string>

/** The variant that matches every chosen axis exactly, or null. */
export function findVariant(variants: readonly Variant[], selection: Selection, axes: readonly VariantAxis[]): Variant | null {
  if (axes.length === 0) return variants[0] ?? null
  for (const axis of axes) if (!selection[axis.name]) return null
  return variants.find((v) => axes.every((axis) => v.options[axis.name] === selection[axis.name])) ?? null
}

export type OptionState = "available" | "sold_out" | "missing"

/**
 * What choosing `value` on `axis` would mean, given the rest of the
 * selection: a variant with stock exists ("available"), variants exist but
 * none has stock ("sold_out"), or no variant has this combination at all
 * ("missing"). Other axes that are not yet chosen are free.
 */
export function optionState(
  variants: readonly Variant[],
  selection: Selection,
  axis: string,
  value: string,
): OptionState {
  const matches = variants.filter((v) => {
    if (v.options[axis] !== value) return false
    for (const [name, chosen] of Object.entries(selection)) {
      if (name === axis || !chosen) continue
      if (v.options[name] !== chosen) return false
    }
    return true
  })
  if (matches.length === 0) return "missing"
  return matches.some((v) => v.availableQty > 0) ? "available" : "sold_out"
}

/**
 * The selection to start from: the first variant that has stock, else the
 * first variant, so the page opens on something buyable when anything is.
 */
export function initialSelection(variants: readonly Variant[]): Selection {
  const first = variants.find((v) => v.availableQty > 0) ?? variants[0]
  return first ? { ...first.options } : {}
}

/**
 * The selection after choosing `value` on `axis`. Other axes keep their
 * choice when a variant with that combination exists; otherwise they are
 * cleared, so the buyer is asked again rather than shown a combination that
 * does not exist.
 */
export function selectOption(variants: readonly Variant[], selection: Selection, axis: string, value: string): Selection {
  const next: Selection = { ...selection, [axis]: value }
  const exact = variants.some((v) => Object.entries(next).every(([name, chosen]) => !chosen || v.options[name] === chosen))
  if (exact) return next
  const cleared: Selection = { [axis]: value }
  return cleared
}

// ── Price and stock lines ──────────────────────────────────────────────

export interface PriceLine {
  price: string
  was: string | null
  /** Whole percent saved, from `money.ts`'s one sum. */
  off: number | null
}

/** The price line for a variant, or for the summary when there is no variant yet. */
export function priceLine(source: { priceMinor: number | null; mrpMinor: number | null } | null | undefined): PriceLine | null {
  if (!source || source.priceMinor === null) return null
  const was = source.mrpMinor !== null && source.mrpMinor > source.priceMinor ? inrMinor(source.mrpMinor) : null
  return { price: inrMinor(source.priceMinor), was, off: discountPercent(source.mrpMinor, source.priceMinor) }
}

export const MAX_QUANTITY = 10

/** "Out of stock", "Only 3 left", or "In stock". Low is five or fewer. */
export function stockLine(availableQty: number): { text: string; tone: "danger" | "warning" | "success" } {
  if (availableQty <= 0) return { text: "Out of stock", tone: "danger" }
  if (availableQty <= 5) return { text: `Only ${availableQty} left`, tone: "warning" }
  return { text: "In stock", tone: "success" }
}

/** The stepper's ceiling: the cap, or what is left when that is smaller. */
export function maxQuantity(availableQty: number): number {
  return Math.max(0, Math.min(MAX_QUANTITY, availableQty))
}

/** The quantity after a step, clamped to 1..max (or 0 when nothing is buyable). */
export function stepQuantity(current: number, delta: number, availableQty: number): number {
  const ceiling = maxQuantity(availableQty)
  if (ceiling <= 0) return 0
  return Math.min(ceiling, Math.max(1, current + delta))
}

// ── Specifications ─────────────────────────────────────────────────────

export interface SpecRow {
  code: string
  label: string
  value: string
}

export interface SpecGroup {
  name: string
  rows: SpecRow[]
}

/** One attribute value as words: arrays become a list, booleans a word, a unit follows a number. */
export function attributeText(value: unknown, unit?: string | null): string {
  if (value === null || value === undefined || value === "") return "—"
  if (Array.isArray(value)) return value.map((entry) => String(entry)).filter(Boolean).join(", ") || "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  const text = String(value)
  return unit ? `${text} ${unit}` : text
}

/**
 * The spec table, grouped by the server's own `display_group`, in the order
 * the rows arrive (the service already sorted them). Anything ungrouped
 * falls under "Specifications" rather than being dropped.
 */
export function specGroups(attributes: readonly WireAttributeDoc[] | null | undefined): SpecGroup[] {
  if (!Array.isArray(attributes)) return []
  const groups: SpecGroup[] = []
  for (const attribute of attributes) {
    if (!attribute) continue
    const code = attribute.code || attribute.label || ""
    if (!code) continue
    const name = (attribute.display_group || "").trim() || "Specifications"
    let group = groups.find((g) => g.name === name)
    if (!group) {
      group = { name, rows: [] }
      groups.push(group)
    }
    group.rows.push({ code, label: attribute.label || code, value: attributeText(attribute.value, attribute.unit_code) })
  }
  return groups
}

/** The legacy free-form rows (`GET /products/:id/attributes`), as one group. */
export function legacySpecGroups(rows: readonly WireLegacyAttribute[] | null | undefined): SpecGroup[] {
  if (!Array.isArray(rows)) return []
  const out: SpecRow[] = []
  for (const row of rows) {
    if (!row || !row.name) continue
    out.push({ code: row.name, label: row.name, value: attributeText(row.value, row.unit) })
  }
  return out.length ? [{ name: "Specifications", rows: out }] : []
}

// ── Add to bag ─────────────────────────────────────────────────────────

export const MULTIPLE_SELLERS_MESSAGE = "Your bag has items from another seller. Empty it to add this."

/**
 * The one line to show when adding to the bag fails.
 *
 * `MULTIPLE_SELLERS` (409) is the code the contract names. Today's
 * `POST /cart/items` handler still answers 400 `ADD_TO_CART_FAILED` with
 * `ErrMultipleSellers`'s text for the same condition (handler.go AddToCart),
 * so that pair is read as well until lane C1 maps the code on this route.
 * TODO(lead): drop the ADD_TO_CART_FAILED branch once C1 lands 409
 * MULTIPLE_SELLERS on POST /cart/items.
 */
export function addToBagFailure(error: unknown): string {
  const code = apiErrorCode(error)
  if (code === "MULTIPLE_SELLERS") return MULTIPLE_SELLERS_MESSAGE
  if (code === "ADD_TO_CART_FAILED") {
    const message = (error as { response?: { data?: { error?: { message?: unknown } } } } | null | undefined)
      ?.response?.data?.error?.message
    if (typeof message === "string" && /more than one seller/i.test(message)) return MULTIPLE_SELLERS_MESSAGE
  }
  if (code === "PRODUCT_UNAVAILABLE") return "This product is no longer available."
  if (code === "OUT_OF_STOCK") return "Not enough stock for that quantity."
  return "Could not add this to your bag. Please try again."
}

/** Unknown id ⇒ a 404 state, including the code the handler names for drafts of others. */
export function isProductMissing(error: unknown): boolean {
  const code = apiErrorCode(error)
  if (code === "PRODUCT_NOT_FOUND" || code === "NOT_FOUND" || code === "INVALID_PARAM") return true
  const status = (error as { response?: { status?: unknown } } | null | undefined)?.response?.status
  return status === 404 || status === 400
}

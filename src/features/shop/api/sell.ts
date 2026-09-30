// Every MSeller call, one place. axios only; the shapes are in ../model/sell
// and ../model/sellListing. Every response is `{data, meta}` and is unwrapped
// here. Error codes are read by the callers through apiEnvelope.

import api from "@/lib/api"
import type { AttributeSchema } from "../model/attributes"
import type {
  ActionNeededWire,
  BasicBody,
  DashboardWire,
  DocumentBody,
  FulfillmentBody,
  FulfillmentStage,
  OrderHistoryRow,
  PayoutBody,
  ProductReadinessWire,
  ReadinessWire,
  SellerAddressBody,
  SellerOrderCardWire,
  SellerProductWire,
  SellerShipment,
  SellerShipmentEvent,
  SellerWire,
  ShipFormValues,
  StartBody,
  StockAdjustBody,
  StockLevelWire,
  StorefrontBody,
  VariantWire,
} from "../model/sell"
import {
  cancelRequestBody,
  normaliseHistoryRow,
  normaliseShipment,
  normaliseShipmentEvent,
  sellerActionPath,
  shipRequestBody,
} from "../model/sell"
import type { AttributeWireValue, ListingColumns, VariantCreateWire, VariantOptionsWire, VariationAxisWire } from "../model/sellListing"

const BASE = "/v1/commerce"

interface Envelope<T> {
  data?: T
  meta?: Record<string, unknown>
}

function unwrap<T>(body: unknown): T {
  return ((body as Envelope<T> | null)?.data ?? null) as T
}

// ── Onboarding ──────────────────────────────────────────────────

export async function fetchOnboardingStatus(): Promise<SellerWire> {
  return unwrap<SellerWire>((await api.get(`${BASE}/onboarding/status`)).data)
}

/** POST /onboarding/start {store_name, email, seller_type}. Idempotent: an existing row comes back. */
export async function startOnboarding(body: StartBody): Promise<SellerWire> {
  return unwrap<SellerWire>((await api.post(`${BASE}/onboarding/start`, body)).data)
}

export async function saveBasic(body: BasicBody): Promise<void> {
  await api.put(`${BASE}/onboarding/step/basic`, body)
}

export async function saveStorefront(body: StorefrontBody): Promise<void> {
  await api.put(`${BASE}/onboarding/step/storefront`, body)
}

/** PUT /onboarding/step/documents {documents:[{document_type, media_id, document_number?}]}. */
export async function saveDocuments(documents: DocumentBody[]): Promise<void> {
  await api.put(`${BASE}/onboarding/step/documents`, { documents })
}

export async function saveFulfillment(body: FulfillmentBody): Promise<void> {
  await api.put(`${BASE}/onboarding/step/fulfillment`, body)
}

/** PUT /seller/address: the pickup point. state and postal_code decide money. */
export async function saveSellerAddress(body: SellerAddressBody): Promise<void> {
  await api.put(`${BASE}/seller/address`, body)
}

export async function savePayout(body: PayoutBody): Promise<void> {
  await api.put(`${BASE}/onboarding/step/payout`, body)
}

export async function fetchReadiness(): Promise<ReadinessWire> {
  return unwrap<ReadinessWire>((await api.get(`${BASE}/onboarding/readiness`)).data)
}

/** POST /onboarding/submit, no body. 409 APPLICATION_INCOMPLETE names what is missing. */
export async function submitApplication(): Promise<{ message: string }> {
  return unwrap<{ message: string }>((await api.post(`${BASE}/onboarding/submit`)).data)
}

// ── Dashboard ───────────────────────────────────────────────────

export async function fetchDashboard(): Promise<DashboardWire> {
  return unwrap<DashboardWire>((await api.get(`${BASE}/dashboard`)).data)
}

export async function fetchActionNeeded(): Promise<{ products: ActionNeededWire[]; notice: string }> {
  const d = unwrap<{ products?: ActionNeededWire[]; notice?: string }>((await api.get(`${BASE}/seller/action-needed`)).data)
  return { products: Array.isArray(d?.products) ? d.products : [], notice: d?.notice || "" }
}

// ── Catalogue reads (public) ────────────────────────────────────

/** postgres.CategoryTreeNode. */
export interface CategoryNode {
  id: string
  parent_id?: string | null
  name: string
  slug: string
  description?: string | null
  display_order: number
  is_active: boolean
  is_featured: boolean
  is_listable: boolean
  product_count: number
  depth: number
  children: CategoryNode[]
}

export async function fetchCategoryTree(): Promise<CategoryNode[]> {
  const d = unwrap<CategoryNode[]>((await api.get(`${BASE}/categories`, { params: { tree: "true" } })).data)
  return Array.isArray(d) ? d : []
}

/** GET /categories/:id/attribute-schema?scope=; null when nothing is authored (404) or the body has no groups. */
export async function fetchAttributeSchema(categoryId: string, scope = "all"): Promise<AttributeSchema | null> {
  const res = await api.get(`${BASE}/categories/${encodeURIComponent(categoryId)}/attribute-schema`, {
    params: { scope },
    validateStatus: (status) => status === 404 || (status >= 200 && status < 300),
  })
  if (res.status === 404) return null
  const schema = unwrap<AttributeSchema>(res.data)
  return schema && Array.isArray(schema.groups) ? schema : null
}

/** postgres.TaxClassOption. */
export interface TaxClassWire {
  id: string
  name: string
  rate_percent: number
}

export async function fetchTaxClasses(): Promise<TaxClassWire[]> {
  const d = unwrap<{ items?: TaxClassWire[] }>((await api.get(`${BASE}/tax-classes`)).data)
  return Array.isArray(d?.items) ? d.items : []
}

// ── Products ────────────────────────────────────────────────────

export async function fetchMyProducts(params: { limit: number; offset: number; status?: string }): Promise<{ items: SellerProductWire[]; total: number }> {
  const d = unwrap<{ items?: SellerProductWire[]; total?: number }>((await api.get(`${BASE}/seller/products`, { params })).data)
  return { items: Array.isArray(d?.items) ? d.items : [], total: typeof d?.total === "number" ? d.total : 0 }
}

/** GET /products/:id → {product, variants, media, attributes}. The owner sees a draft here. */
export interface ProductDetailWire {
  product: Record<string, unknown>
  variants: VariantWire[]
  media: { media_id: string; media_type?: string; sort_order?: number; image_url?: string; thumbnail_url?: string; is_cover?: boolean }[]
  attributes: { code?: string; label?: string; data_type?: string; value?: unknown; unit_code?: string | null; display_group?: string }[]
}

export async function fetchProductDetail(productId: string): Promise<ProductDetailWire> {
  const d = unwrap<Partial<ProductDetailWire>>((await api.get(`${BASE}/products/${encodeURIComponent(productId)}`)).data)
  return {
    product: d?.product && typeof d.product === "object" ? d.product : {},
    variants: Array.isArray(d?.variants) ? d.variants : [],
    media: Array.isArray(d?.media) ? d.media : [],
    attributes: Array.isArray(d?.attributes) ? d.attributes : [],
  }
}

export async function fetchProductVariants(productId: string): Promise<VariantWire[]> {
  const d = unwrap<{ items?: VariantWire[] }>((await api.get(`${BASE}/products/${encodeURIComponent(productId)}/variants`)).data)
  return Array.isArray(d?.items) ? d.items : []
}

export async function fetchProductReadiness(productId: string): Promise<ProductReadinessWire> {
  const d = unwrap<Partial<ProductReadinessWire>>((await api.get(`${BASE}/products/${encodeURIComponent(productId)}/readiness`)).data)
  return { ready: d?.ready === true, missing: Array.isArray(d?.missing) ? d.missing : [] }
}

/** POST /products/:id/submit, 204. 422 PRODUCT_INCOMPLETE, 409 SELLER_NOT_APPROVED / PRODUCT_NOT_SUBMITTABLE. */
export async function submitProduct(productId: string): Promise<void> {
  await api.post(`${BASE}/products/${encodeURIComponent(productId)}/submit`)
}

/** POST /products (createProductReq). `variants` is required, min 1; `variation_axes` only when the listing varies. */
export interface CreateListingBody extends ListingColumns {
  variants: VariantCreateWire[]
  variation_axes?: VariationAxisWire[]
  attributes?: AttributeWireValue[]
}

export interface CreatedProductWire {
  id: string
  approval_status?: string
  status?: string
}

export async function createListing(body: CreateListingBody): Promise<CreatedProductWire> {
  return unwrap<CreatedProductWire>((await api.post(`${BASE}/products`, body)).data)
}

/** PATCH /products/:id: allowlisted columns, plus `attributes`, and `variation_axes`+`variants` as a pair. */
export interface PatchListingBody extends Partial<ListingColumns> {
  attributes?: AttributeWireValue[]
  variation_axes?: VariationAxisWire[]
  variants?: VariantOptionsWire[]
  revalidate?: boolean
}

export async function patchListing(productId: string, body: PatchListingBody): Promise<{ product: Record<string, unknown>; revalidated?: boolean; notice?: string }> {
  return unwrap((await api.patch(`${BASE}/products/${encodeURIComponent(productId)}`, body)).data)
}

/** POST /products/:id/variants (addVariantReq) — SKU and paise; options are set by the matrix PATCH. */
export async function addVariant(productId: string, body: { sku: string; mrp_minor: number; selling_price_minor: number }): Promise<{ id: string }> {
  return unwrap<{ id: string }>((await api.post(`${BASE}/products/${encodeURIComponent(productId)}/variants`, body)).data)
}

/** PATCH /variants/:id — price by variant id, never product id. */
export async function patchVariant(variantId: string, body: { mrp_minor?: number; selling_price_minor?: number; sku?: string }): Promise<void> {
  await api.patch(`${BASE}/variants/${encodeURIComponent(variantId)}`, body)
}

export async function archiveVariant(variantId: string): Promise<void> {
  await api.delete(`${BASE}/variants/${encodeURIComponent(variantId)}`)
}

// ── Gallery ─────────────────────────────────────────────────────

export interface GalleryWire {
  media_id: string
  media_type?: string
  sort_order?: number
  image_url?: string
  thumbnail_url?: string
  is_cover?: boolean
}

function galleryItems(body: unknown): GalleryWire[] {
  const d = unwrap<{ items?: GalleryWire[] }>(body)
  return Array.isArray(d?.items) ? d.items : []
}

export async function fetchGallery(productId: string): Promise<GalleryWire[]> {
  return galleryItems((await api.get(`${BASE}/products/${encodeURIComponent(productId)}/media`)).data)
}

/** POST /products/:id/media {media_ids}: REPLACES the gallery in the order given; the first is the cover. */
export async function setGallery(productId: string, mediaIds: string[]): Promise<GalleryWire[]> {
  return galleryItems((await api.post(`${BASE}/products/${encodeURIComponent(productId)}/media`, { media_ids: mediaIds })).data)
}

/** PUT /products/:id/media/order {media_ids}: a permutation of the existing gallery. */
export async function reorderGallery(productId: string, mediaIds: string[]): Promise<GalleryWire[]> {
  return galleryItems((await api.put(`${BASE}/products/${encodeURIComponent(productId)}/media/order`, { media_ids: mediaIds })).data)
}

export async function deleteGalleryImage(productId: string, mediaId: string): Promise<GalleryWire[]> {
  return galleryItems((await api.delete(`${BASE}/products/${encodeURIComponent(productId)}/media/${encodeURIComponent(mediaId)}`)).data)
}

// ── Stock ───────────────────────────────────────────────────────

/** PATCH /seller/variants/:id/stock {delta, reason, notes?}: a ledger delta, never a total. */
export async function adjustStock(variantId: string, body: StockAdjustBody): Promise<StockLevelWire> {
  return unwrap<StockLevelWire>((await api.patch(`${BASE}/seller/variants/${encodeURIComponent(variantId)}/stock`, body)).data)
}

export async function fetchStock(variantId: string): Promise<StockLevelWire> {
  return unwrap<StockLevelWire>((await api.get(`${BASE}/seller/variants/${encodeURIComponent(variantId)}/stock`)).data)
}

// ── Orders ──────────────────────────────────────────────────────

export async function fetchFulfillment(params: { stage: FulfillmentStage; limit: number; offset: number }): Promise<SellerOrderCardWire[]> {
  const d = unwrap<{ orders?: SellerOrderCardWire[] }>((await api.get(`${BASE}/seller/fulfillment`, { params })).data)
  return Array.isArray(d?.orders) ? d.orders : []
}

export async function fetchSellerOrder(orderId: string): Promise<SellerOrderCardWire> {
  return unwrap<SellerOrderCardWire>((await api.get(`${BASE}/seller/orders/${encodeURIComponent(orderId)}`)).data)
}

export async function fetchSellerOrderHistory(orderId: string): Promise<OrderHistoryRow[]> {
  const d = unwrap<{ history?: unknown[] }>((await api.get(`${BASE}/seller/orders/${encodeURIComponent(orderId)}/history`)).data)
  const list = Array.isArray(d?.history) ? d.history : []
  return list.map(normaliseHistoryRow).filter((r): r is OrderHistoryRow => !!r)
}

export interface ShipmentWithEvents {
  shipment: SellerShipment
  events: SellerShipmentEvent[]
}

/** GET /orders/:id/shipments: every shipment on the order with its courier events, normalised. */
export async function fetchOrderShipments(orderId: string): Promise<ShipmentWithEvents[]> {
  const d = unwrap<{ shipments?: unknown[] }>((await api.get(`${BASE}/orders/${encodeURIComponent(orderId)}/shipments`)).data)
  const list = Array.isArray(d?.shipments) ? d.shipments : []
  const out: ShipmentWithEvents[] = []
  for (const entry of list as Array<{ shipment?: unknown; events?: unknown[] }>) {
    const shipment = normaliseShipment(entry?.shipment)
    if (!shipment) continue
    const events = (entry.events ?? []).map(normaliseShipmentEvent).filter((e): e is SellerShipmentEvent => !!e)
    out.push({ shipment, events })
  }
  return out
}

/** service.SellerFulfilmentResult: `applied` false on an idempotent repeat. */
export interface FulfilmentResultWire {
  order_id: string
  status: string
  applied: boolean
}

export async function packOrder(orderId: string): Promise<FulfilmentResultWire> {
  return unwrap<FulfilmentResultWire>((await api.post(sellerActionPath("pack", orderId))).data)
}

export async function shipOrder(orderId: string, values: ShipFormValues): Promise<unknown> {
  return unwrap((await api.post(sellerActionPath("ship", orderId), shipRequestBody(values))).data)
}

export async function cancelSellerOrder(orderId: string, reason: string): Promise<FulfilmentResultWire> {
  return unwrap<FulfilmentResultWire>((await api.post(sellerActionPath("cancel", orderId), cancelRequestBody(reason))).data)
}

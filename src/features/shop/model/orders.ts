/*
  Orders on the wire (commerce-contract.md §5) and the buyer's words for
  them. Shapes are what the handlers write: store/postgres/store.go
  OrderCard for the list, service/service.go OrderDetail for one order,
  service/shipments.go ShipmentWithEvents for the tracking, and the
  `{invoice, download_url}` pair for the invoice.

  Go sends zero values: "" and 0 are "nothing", so every read falls through
  on empty (`x || fallback`), never on absent alone.
*/

import { orderPaymentOffer, type OrderPaymentOffer, type WireOrderPaymentOffer } from "./offers"

/* ── status vocabulary ───────────────────────────────────────────── */

export const ORDER_STATUSES = [
  "payment_pending",
  "payment_failed",
  "confirmed",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "expired",
  "refund_pending",
  "refunded",
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export type StatusTone = "info" | "success" | "warning" | "danger" | "muted"

export interface StatusLabel {
  label: string
  tone: StatusTone
}

const STATUS_LABELS: Record<OrderStatus, StatusLabel> = {
  payment_pending: { label: "Confirming", tone: "warning" },
  payment_failed: { label: "Payment failed", tone: "danger" },
  confirmed: { label: "Confirmed", tone: "info" },
  packed: { label: "Packed", tone: "info" },
  shipped: { label: "Shipped", tone: "info" },
  out_for_delivery: { label: "Out for delivery", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "muted" },
  expired: { label: "Expired", tone: "muted" },
  refund_pending: { label: "Refund pending", tone: "warning" },
  refunded: { label: "Refunded", tone: "muted" },
}

export function isOrderStatus(value: string): value is OrderStatus {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, value)
}

/**
  The pill. A status this build does not know still renders — as itself,
  spaced and capitalised — rather than blank: a server ahead of the client
  must not make the order look stateless.
*/
export function statusLabel(status: string): StatusLabel {
  if (isOrderStatus(status)) return STATUS_LABELS[status]
  const words = (status || "").replace(/_/g, " ").trim()
  return { label: words ? words[0].toUpperCase() + words.slice(1) : "Unknown", tone: "muted" }
}

/** The `?history=1` chip: orders that are over, one way or another. */
export const HISTORY_STATUSES: ReadonlySet<string> = new Set(["delivered", "cancelled", "expired", "refunded"])

export function isHistory(status: string): boolean {
  return HISTORY_STATUSES.has(status)
}

/* ── list ────────────────────────────────────────────────────────── */

export interface WireOrderCard {
  id: string
  order_number: string
  subtotal_minor: number
  discount_minor: number
  shipping_minor: number
  tax_minor: number
  total_minor: number
  currency: string
  payment_method?: string | null
  payment_status: string
  status: string
  item_count: number
  seller_count: number
  first_product_id?: string | null
  first_product_title?: string
  /** Not sent today; read if a later server adds it. */
  first_product_thumbnail_url?: string
  first_product_image_url?: string
  created_at: string
  created_at_epoch: number
}

export interface WireOrdersPage {
  items: WireOrderCard[] | null
  next_cursor?: string
}

export interface OrderRow {
  id: string
  orderNumber: string
  totalMinor: number
  currency: string
  status: string
  paymentStatus: string
  itemCount: number
  firstProductId: string
  firstProductTitle: string
  thumbnailUrl: string
  createdAtMs: number
}

export function toOrderRow(wire: WireOrderCard): OrderRow {
  return {
    id: wire.id || "",
    orderNumber: wire.order_number || "",
    totalMinor: Number(wire.total_minor) || 0,
    currency: wire.currency || "INR",
    status: wire.status || "",
    paymentStatus: wire.payment_status || "",
    itemCount: Number(wire.item_count) || 0,
    firstProductId: wire.first_product_id || "",
    firstProductTitle: wire.first_product_title || "",
    thumbnailUrl: wire.first_product_thumbnail_url || wire.first_product_image_url || "",
    createdAtMs: epochMs(wire.created_at_epoch, wire.created_at),
  }
}

export interface OrdersPage {
  rows: OrderRow[]
  nextCursor: string
}

/** `data.items` + `data.next_cursor`, with `meta.next_cursor` as the older spelling. */
export function toOrdersPage(data: WireOrdersPage | null | undefined, meta?: { next_cursor?: string } | null): OrdersPage {
  return {
    rows: (data?.items || []).map(toOrderRow),
    nextCursor: data?.next_cursor || meta?.next_cursor || "",
  }
}

/** "1 item" / "3 items". */
export function itemCountLabel(n: number): string {
  return n === 1 ? "1 item" : `${n} items`
}

/* ── detail ──────────────────────────────────────────────────────── */

export interface WireOrderItem {
  id: string
  product_id: string
  variant_id: string
  seller_id: string
  product_title: string
  sku: string
  quantity: number
  unit_mrp_minor: number
  unit_price_minor: number
  tax_minor: number
  line_total_minor: number
  status: string
  tracking_number?: string | null
  image_url?: string
  thumbnail_url?: string
  /** Not sent today; read if a later server adds them. */
  option_1?: string
  option_2?: string
  option_3?: string
  delivered_at?: string | null
}

export interface WireDeliveryAddress {
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

export interface WireOrderDetail {
  id: string
  order_number: string
  subtotal_minor: number
  discount_minor: number
  shipping_minor: number
  tax_minor: number
  total_minor: number
  currency: string
  payment_method?: string | null
  payment_status: string
  status: string
  items: WireOrderItem[] | null
  delivery_address?: WireDeliveryAddress | null
  can_cancel: boolean
  /** C1: true only in payment_failed for the payer. Absent before C1. */
  can_retry_payment?: boolean
  tracking_url?: string | null
  created_at: string
  created_at_epoch: number
  /** Coupons-offers contract §A: the bank offer applied inside the Razorpay sheet, or null. */
  payment_offer?: WireOrderPaymentOffer | null
  /** What the buyer was actually charged (captured), in paise. */
  amount_paid_minor?: number | null
}

export interface OrderItem {
  id: string
  productId: string
  variantId: string
  sellerId: string
  title: string
  sku: string
  /** "Red · M", or the SKU when the server sends no options. */
  optionsLabel: string
  quantity: number
  unitMrpMinor: number
  unitPriceMinor: number
  lineTotalMinor: number
  status: string
  trackingNumber: string
  imageUrl: string
  delivered: boolean
}

export interface DeliveryAddress {
  contactName: string
  phone: string
  lines: string[]
}

export interface OrderDetail {
  id: string
  orderNumber: string
  subtotalMinor: number
  discountMinor: number
  shippingMinor: number
  taxMinor: number
  totalMinor: number
  currency: string
  paymentMethod: string
  paymentStatus: string
  status: string
  items: OrderItem[]
  address: DeliveryAddress | null
  canCancel: boolean
  canRetryPayment: boolean
  trackingUrl: string
  createdAtMs: number
  /** The bank offer and what was actually paid, or null when no offer applied. */
  paymentOffer: OrderPaymentOffer | null
}

export function toOrderItem(wire: WireOrderItem): OrderItem {
  const options = [wire.option_1, wire.option_2, wire.option_3].map((o) => (o || "").trim()).filter(Boolean)
  return {
    id: wire.id || "",
    productId: wire.product_id || "",
    variantId: wire.variant_id || "",
    sellerId: wire.seller_id || "",
    title: wire.product_title || "",
    sku: wire.sku || "",
    optionsLabel: options.length ? options.join(" · ") : wire.sku || "",
    quantity: Number(wire.quantity) || 0,
    unitMrpMinor: Number(wire.unit_mrp_minor) || 0,
    unitPriceMinor: Number(wire.unit_price_minor) || 0,
    lineTotalMinor: Number(wire.line_total_minor) || 0,
    status: wire.status || "",
    trackingNumber: wire.tracking_number || "",
    imageUrl: wire.thumbnail_url || wire.image_url || "",
    delivered: wire.status === "delivered" || !!wire.delivered_at,
  }
}

export function toDeliveryAddress(wire: WireDeliveryAddress | null | undefined): DeliveryAddress | null {
  if (!wire) return null
  const cityLine = [wire.city, wire.state, wire.postal_code].map((s) => (s || "").trim()).filter(Boolean).join(", ")
  const lines = [wire.address_line_1, wire.address_line_2, wire.landmark, cityLine, wire.country]
    .map((s) => (s || "").trim())
    .filter(Boolean)
  if (!lines.length && !wire.contact_name) return null
  return { contactName: wire.contact_name || "", phone: wire.phone || "", lines }
}

/**
  Whether "Complete payment" / "Try again" is offered. Before C1 the
  server sends no `can_retry_payment`, so a pending order (the dialog was
  dismissed) still gets "Complete payment": the intent route answers a
  pending order today. A failed order needs the server's word, because
  retrying it re-reserves stock and only C1's route can.
*/
export function canRetryPayment(wire: Pick<WireOrderDetail, "status" | "payment_status" | "can_retry_payment">): boolean {
  if (wire.can_retry_payment === true) return true
  return wire.status === "payment_pending" && wire.payment_status !== "paid"
}

export function toOrderDetail(wire: WireOrderDetail): OrderDetail {
  return {
    id: wire.id || "",
    orderNumber: wire.order_number || "",
    subtotalMinor: Number(wire.subtotal_minor) || 0,
    discountMinor: Number(wire.discount_minor) || 0,
    shippingMinor: Number(wire.shipping_minor) || 0,
    taxMinor: Number(wire.tax_minor) || 0,
    totalMinor: Number(wire.total_minor) || 0,
    currency: wire.currency || "INR",
    paymentMethod: wire.payment_method || "",
    paymentStatus: wire.payment_status || "",
    status: wire.status || "",
    items: (wire.items || []).map(toOrderItem),
    address: toDeliveryAddress(wire.delivery_address),
    canCancel: wire.can_cancel === true,
    canRetryPayment: canRetryPayment(wire),
    trackingUrl: wire.tracking_url || "",
    createdAtMs: epochMs(wire.created_at_epoch, wire.created_at),
    paymentOffer: orderPaymentOffer(wire),
  }
}

/** The Invoice button: only once the order is paid (the route 404s before). */
export function canShowInvoice(order: Pick<OrderDetail, "paymentStatus">): boolean {
  return order.paymentStatus === "paid"
}

/** The words on the payment action, by why it is offered. */
export function retryPaymentLabel(order: Pick<OrderDetail, "status">): string {
  return order.status === "payment_failed" ? "Try again" : "Complete payment"
}

/* ── shipments ───────────────────────────────────────────────────── */

export interface WireShipmentEvent {
  id: string
  shipment_id: string
  status: string
  location?: string | null
  remark?: string | null
  occurred_at: string
  created_at: string
}

export interface WireShipment {
  id: string
  order_id: string
  seller_id: string
  courier: string
  tracking_number?: string | null
  tracking_url?: string | null
  status: string
  eta?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  last_event_at?: string | null
  created_at: string
}

export interface WireShipmentWithEvents {
  shipment: WireShipment | null
  events: WireShipmentEvent[] | null
}

export interface WireShipmentsResponse {
  shipments: WireShipmentWithEvents[] | null
}

/* ── invoice ─────────────────────────────────────────────────────── */

/** `invoice` is a Go struct with no json tags, so its keys are the field names. */
export interface WireInvoiceResponse {
  invoice?: { InvoiceNumber?: string; invoice_number?: string } | null
  download_url?: string
}

export interface InvoiceLink {
  number: string
  url: string
}

export function toInvoiceLink(wire: WireInvoiceResponse | null | undefined): InvoiceLink | null {
  const url = wire?.download_url || ""
  if (!url) return null
  return { number: wire?.invoice?.invoice_number || wire?.invoice?.InvoiceNumber || "", url }
}

/* ── time ────────────────────────────────────────────────────────── */

/** created_at_epoch is what the clients parse; the RFC3339 form is the fallback. */
export function epochMs(epoch: number | undefined, iso: string | undefined): number {
  if (epoch && Number.isFinite(epoch)) return epoch > 1e12 ? epoch : epoch * 1000
  const parsed = Date.parse(iso || "")
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatOrderDate(ms: number): string {
  if (!ms) return ""
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export function formatOrderDateTime(ms: number): string {
  if (!ms) return ""
  return new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
}

/* ── review ──────────────────────────────────────────────────────── */

export interface ReviewBody {
  seller_id: string
  order_item_id: string
  rating: number
  title?: string
  body?: string
}

/** The codes CreateReview refuses with (handler.go). */
export const REVIEW_NOT_DELIVERED_CODES: ReadonlySet<string> = new Set(["REVIEW_ITEM_NOT_DELIVERED", "REVIEW_NOT_ELIGIBLE"])

export function reviewRefusalMessage(code: string): string {
  if (REVIEW_NOT_DELIVERED_CODES.has(code)) return "You can review this once it is delivered."
  return "Your review couldn't be saved. Try again."
}

/** The body for POST /products/:productId/reviews, from the item being reviewed. */
export function buildReviewBody(item: Pick<OrderItem, "sellerId" | "id">, input: { rating: number; title: string; body: string }): ReviewBody {
  const rating = Math.min(5, Math.max(1, Math.round(input.rating)))
  const out: ReviewBody = { seller_id: item.sellerId, order_item_id: item.id, rating }
  const title = input.title.trim()
  const body = input.body.trim()
  if (title) out.title = title
  if (body) out.body = body
  return out
}

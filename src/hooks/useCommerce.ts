import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────

export type CartItem = {
  Item: {
    id: string
    cart_id: string
    variant_id: string
    product_id: string
    quantity: number
    price_snapshot: number
  }
  Product: { id: string; title: string; slug: string } | null
  Variant: { id: string; sku: string; mrp: number; selling_price: number } | null
}

export type CartSummary = {
  CartID: string
  Items: CartItem[]
  Subtotal: number
  ItemCount: number
}

export type Address = {
  id: string
  user_id: string
  contact_name: string
  phone: string
  address_line_1: string
  address_line_2?: string
  city: string
  state: string
  postal_code: string
  country: string
  is_default: boolean
  address_type: string
}

export type Order = {
  id: string
  order_number: string
  customer_user_id: string
  subtotal: number
  discount_amount: number
  shipping_charges: number
  tax_amount: number
  coupon_code?: string
  coupon_discount: number
  final_amount: number
  currency_code: string
  payment_method?: string
  payment_status: string
  delivery_address_id?: string
  status: string
  created_at: string
  updated_at: string
}

export type Shipment = {
  id: string
  order_id: string
  courier: string
  tracking_number?: string
  tracking_url?: string
  label_url?: string
  status: string
  eta?: string
  shipped_at?: string
  delivered_at?: string
}

export type ShipmentEvent = {
  id: string
  shipment_id: string
  status: string
  location?: string
  remark?: string
  occurred_at: string
}

export type Invoice = {
  id: string
  order_id: string
  invoice_number: string
  grand_total: number
  currency_code: string
  issued_at: string
}

export type ProductVariant = {
  id: string
  product_id: string
  sku: string
  option_1_name?: string | null
  option_1_value?: string | null
  option_2_name?: string | null
  option_2_value?: string | null
  option_3_name?: string | null
  option_3_value?: string | null
  mrp: number
  selling_price: number
  currency_code: string
  status: string
}

export type Product = {
  id: string
  seller_id: string
  category_id?: string | null
  tax_class_id?: string | null
  title: string
  short_title?: string | null
  description?: string | null
  short_description?: string | null
  slug: string
  product_type: string
  status: string
  hsn_code?: string | null
  weight_grams?: number | null
}

export type Review = {
  id: string
  product_id: string
  seller_id: string
  reviewer_id: string
  rating: number
  title?: string | null
  body?: string | null
  is_verified_purchase: boolean
  is_published: boolean
  created_at: string
}

export type Category = {
  id: string
  name: string
  slug: string
  description?: string | null
  parent_id?: string | null
}

export type ReturnRequest = {
  id: string
  order_id: string
  order_item_id: string
  customer_user_id: string
  seller_id: string
  reason_code: string
  reason_description?: string | null
  status: string
  requested_at: string
  approved_at?: string | null
  rejected_at?: string | null
  rejection_reason?: string | null
  refund_amount?: number | null
}

// ── Catalog ───────────────────────────────────────────────────────────

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['commerce', 'categories'],
    queryFn: async () => (await api.get('/v1/commerce/categories')).data.data ?? [],
  })
}

export function useSellerProducts(sellerId: string | undefined, limit = 24, offset = 0) {
  return useQuery<Product[]>({
    queryKey: ['commerce', 'seller-products', sellerId, limit, offset],
    queryFn: async () =>
      (await api.get(`/v1/commerce/sellers/${sellerId}/products`, { params: { limit, offset } })).data.data ?? [],
    enabled: !!sellerId,
  })
}

// useProducts hits the global product catalog — published + approved only.
// Backed by GET /v1/commerce/products. Pagination is offset-based.
export interface ProductListPage {
  items: Product[]
  total: number
  limit: number
  offset: number
}

export function useProducts(opts: { category?: string; q?: string; limit?: number; offset?: number } = {}) {
  const { category, q, limit = 24, offset = 0 } = opts
  return useQuery<ProductListPage>({
    queryKey: ['commerce', 'products', category ?? null, q ?? null, limit, offset],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit, offset }
      if (category) params.category = category
      if (q) params.q = q
      const res = (await api.get('/v1/commerce/products', { params })).data.data
      // Tolerate both wrapped {items,total} and a bare array if a future
      // backend variant returns one — keeps the hook resilient.
      if (Array.isArray(res)) {
        return { items: res, total: res.length, limit, offset }
      }
      return {
        items: res?.items ?? [],
        total: res?.total ?? 0,
        limit: res?.limit ?? limit,
        offset: res?.offset ?? offset,
      }
    },
  })
}

export function useProduct(productId: string | undefined) {
  return useQuery<{ product: Product; variants: ProductVariant[] }>({
    queryKey: ['commerce', 'product', productId],
    queryFn: async () => (await api.get(`/v1/commerce/products/${productId}`)).data.data,
    enabled: !!productId,
  })
}

export function useProductReviews(productId: string | undefined) {
  return useQuery<{ reviews: Review[]; total: number }>({
    queryKey: ['commerce', 'product-reviews', productId],
    queryFn: async () => (await api.get(`/v1/commerce/products/${productId}/reviews`)).data.data,
    enabled: !!productId,
  })
}

export function useCreateReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      product_id: string
      seller_id: string
      order_item_id: string
      rating: number
      title?: string
      body?: string
    }) =>
      (await api.post(`/v1/commerce/products/${input.product_id}/reviews`, {
        seller_id: input.seller_id,
        order_item_id: input.order_item_id,
        rating: input.rating,
        title: input.title,
        body: input.body,
      })).data.data as Review,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['commerce', 'product-reviews', vars.product_id] })
    },
  })
}

// ── Returns ───────────────────────────────────────────────────────────

export interface CreateReturnItem {
  order_item_id: string
  seller_id: string
  reason_code: string
  reason_description?: string
}

// useCreateReturn supports both the legacy single-item shape and the
// Phase-2.3 multi-item shape ({items:[...]}). The backend accepts both —
// pass `items` for multi-item bulk creation, or the top-level fields for
// a single-item create.
export function useCreateReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      input:
        | {
            order_id: string
            order_item_id: string
            seller_id: string
            reason_code: string
            reason_description?: string
          }
        | {
            order_id: string
            items: CreateReturnItem[]
            pickup_address_id?: string
          },
    ) => {
      const { order_id, ...body } = input as { order_id: string } & Record<string, unknown>
      const res = await api.post(`/v1/commerce/orders/${order_id}/returns`, body)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commerce', 'returns'] })
      qc.invalidateQueries({ queryKey: ['commerce', 'orders'] })
    },
  })
}

export function useMyReturns() {
  return useQuery<ReturnRequest[]>({
    queryKey: ['commerce', 'returns'],
    queryFn: async () => (await api.get('/v1/commerce/me/returns')).data.data ?? [],
  })
}

// useReturn fetches a single return by id — Phase 2.2. Replaces the
// mobile "list /me/returns and find the one I want" workaround.
export function useReturn(returnId: string | undefined) {
  return useQuery<ReturnRequest>({
    queryKey: ['commerce', 'return', returnId],
    enabled: !!returnId,
    queryFn: async () =>
      (await api.get(`/v1/commerce/returns/${returnId}`)).data.data as ReturnRequest,
  })
}

// ── Cart ──────────────────────────────────────────────────────────────

export function useCart() {
  return useQuery<CartSummary>({
    queryKey: ['commerce', 'cart'],
    queryFn: async () => (await api.get('/v1/commerce/cart')).data.data,
  })
}

export function useAddToCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { variant_id: string; quantity: number }) =>
      (await api.post('/v1/commerce/cart/items', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commerce', 'cart'] }),
  })
}

export function useRemoveFromCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (variantId: string) =>
      (await api.delete(`/v1/commerce/cart/items/${variantId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commerce', 'cart'] }),
  })
}

// useUpdateCartItem (Phase 1.2) — atomic set-to-N for a variant. Quantity
// 0 deletes the line. Server upserts under a single row-level write, so
// concurrent calls converge instead of racing (the old mobile delete+add
// roundtrip could briefly empty the cart).
export function useUpdateCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { variant_id: string; quantity: number }) =>
      (
        await api.patch(`/v1/commerce/cart/items/by-variant/${input.variant_id}`, {
          quantity: input.quantity,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commerce', 'cart'] }),
  })
}

// ── Checkout quote (Phase 1.1) ────────────────────────────────────────

export interface QuoteItem {
  variant_id: string
  product_id: string
  seller_id: string
  product_title: string
  sku?: string
  quantity: number
  unit_price: number
  line_subtotal: number
}

export interface UnavailableQuoteItem {
  variant_id: string
  product_id: string
  product_title: string
  available: number
  requested: number
}

export interface CheckoutQuote {
  subtotal: number
  coupon_discount: number
  coupon_code?: string
  shipping: number
  tax: number
  grand_total: number
  currency: string
  items: QuoteItem[]
  unavailable_items: UnavailableQuoteItem[]
  cod_eligible: boolean
  serviceable: boolean
  seller_ids: string[]
}

// useCheckoutQuote returns the server-authoritative pricing for the
// current cart. Mobile + web must render this BEFORE "Place order" so the
// client never recomputes prices locally — the audit found the mobile
// commerce_repository was doing exactly that.
export function useCheckoutQuote(input: {
  address_id: string
  payment_method: 'prepaid' | 'cod'
  coupon_code?: string
} | null) {
  return useQuery<CheckoutQuote | null>({
    queryKey: ['commerce', 'checkout-quote', input],
    enabled: !!input,
    queryFn: async () => {
      if (!input) return null
      const res = await api.post('/v1/commerce/checkout/quote', input)
      return res.data.data as CheckoutQuote
    },
  })
}

// ── Serviceability (Phase 1.3) ────────────────────────────────────────

export interface ServiceabilityResult {
  serviceable: boolean
  cod_supported: boolean
  estimated_days: number
  estimated_eta: string
  courier: string
  reason?: string
}

// useServiceability fetches the courier-backed serviceability for a
// pincode + product. Replaces the mobile pincode heuristic — production
// uses the seller's pickup pincode and the product weight.
export function useServiceability(args: {
  pincode: string
  product_id: string
  variant_id?: string
  seller_id?: string
  payment_method?: 'prepaid' | 'cod'
} | null) {
  return useQuery<ServiceabilityResult | null>({
    queryKey: ['commerce', 'serviceability', args],
    enabled: !!args && args.pincode.length === 6,
    queryFn: async () => {
      if (!args) return null
      const params = new URLSearchParams({
        pincode: args.pincode,
        product_id: args.product_id,
      })
      if (args.variant_id) params.set('variant_id', args.variant_id)
      if (args.seller_id) params.set('seller_id', args.seller_id)
      if (args.payment_method) params.set('payment_method', args.payment_method)
      const res = await api.get(`/v1/commerce/serviceability?${params.toString()}`)
      return res.data.data as ServiceabilityResult
    },
  })
}

// ── Addresses ─────────────────────────────────────────────────────────

export function useAddresses() {
  return useQuery<Address[]>({
    queryKey: ['commerce', 'addresses'],
    queryFn: async () => (await api.get('/v1/commerce/addresses')).data.data ?? [],
  })
}

export function useAddAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Address> & { full_name: string; phone: string; address_line_1: string; city: string; state: string; postal_code: string }) =>
      (await api.post('/v1/commerce/addresses', input)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commerce', 'addresses'] }),
  })
}

export function useUpdateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<Address> & { full_name: string; phone: string; address_line_1: string; city: string; state: string; postal_code: string } }) =>
      (await api.patch(`/v1/commerce/addresses/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commerce', 'addresses'] }),
  })
}

export function useDeleteAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/v1/commerce/addresses/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commerce', 'addresses'] }),
  })
}

export function useSetDefaultAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/v1/commerce/addresses/${id}/default`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commerce', 'addresses'] }),
  })
}

// ── Checkout + Orders ─────────────────────────────────────────────────

export type CheckoutInput = {
  address_id: string
  payment_method: 'prepaid' | 'cod'
  coupon_code?: string
  gift_message?: string
  idempotency_key?: string
}

export function useCheckout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CheckoutInput) =>
      (await api.post('/v1/commerce/orders/checkout', input)).data.data as Order,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commerce', 'cart'] })
      qc.invalidateQueries({ queryKey: ['commerce', 'orders'] })
    },
  })
}

// ── Payments ──────────────────────────────────────────────────────────

export type PaymentIntent = {
  id: string
  payer_id: string
  payee_id: string
  reference_type: string
  reference_id: string
  amount: number
  currency: string
  method: string
  status: string
  // provider_ref is the gateway-side order id (e.g. Razorpay's order_xxx).
  // The frontend hands this to the Razorpay checkout dialog.
  provider_ref?: string
}

export type CreatePaymentIntentInput = {
  payee_id: string
  reference_type: 'order'
  reference_id: string
  amount: number
  currency?: string
  method: 'razorpay' | 'upi' | 'card' | 'netbanking'
  idempotency_key?: string
}

// Creates a payment intent at payments-service. Returns the intent including
// `provider_ref`, which is the Razorpay order_id used by checkout.js to open
// the payment dialog.
export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: async (input: CreatePaymentIntentInput) =>
      (await api.post('/v1/payments/intents', input)).data.data as PaymentIntent,
  })
}

// Confirms a successful payment with commerce-service. This is the
// synchronous happy-path: a Razorpay webhook → commerce-service Kafka
// consumer is the resilient backup if the user closes the browser before
// this fires.
// useConfirmPayment posts the signed Razorpay handler response to
// commerce-service. The backend (Phase 0.1) requires the signature triple
// so it can ask payments-service to HMAC-verify before marking the order
// paid — the old `{payment_id, gateway}`-only shape is rejected as 400.
//
// `gateway: 'stub'` is only accepted when the backend was started with
// PAYMENTS_ALLOW_STUB=true; production builds gate the stub path off
// before calling this hook (see app/checkout/page.tsx).
export function useConfirmPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      order_id: string
      payment_intent_id: string
      razorpay_order_id: string
      razorpay_payment_id: string
      razorpay_signature: string
      amount_minor: number
      gateway?: string
    }) =>
      (await api.post(`/v1/commerce/orders/${input.order_id}/payment/confirm`, {
        payment_intent_id: input.payment_intent_id,
        razorpay_order_id: input.razorpay_order_id,
        razorpay_payment_id: input.razorpay_payment_id,
        razorpay_signature: input.razorpay_signature,
        amount_minor: input.amount_minor,
        gateway: input.gateway ?? 'razorpay',
      })).data,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['commerce', 'orders'] })
      qc.invalidateQueries({ queryKey: ['commerce', 'order', vars.order_id] })
    },
  })
}

// OrderCard is the rich order-list shape returned by GET /v1/commerce/orders
// (Phase 2.1). Adds item / seller counts and the first item so the customer
// can tell orders apart without opening every one. Older Order callers stay
// compatible because the extra fields are additive.
export interface OrderCard {
  id: string
  order_number: string
  final_amount: number
  currency: string
  payment_method?: string | null
  payment_status: string
  status: string
  item_count: number
  seller_count: number
  first_product_id?: string | null
  first_product_title?: string
  created_at: string
}

// useOrders returns the first page of order cards. For paginated screens
// use useInfiniteOrders below — keyset cursors avoid the offset COUNT(*)
// table-scan the old offset/limit path forced on every page.
export function useOrders() {
  return useQuery<OrderCard[]>({
    queryKey: ['commerce', 'orders'],
    queryFn: async () =>
      ((await api.get('/v1/commerce/orders?limit=20')).data.data as OrderCard[]) ?? [],
  })
}

// useInfiniteOrders threads next_cursor through getNextPageParam so the
// customer order-list screen can scroll without re-counting the whole
// orders table per page.
export function useInfiniteOrders(pageSize = 20) {
  return useInfiniteQuery<{ items: OrderCard[]; nextCursor: string | null }>({
    queryKey: ['commerce', 'orders', 'infinite', pageSize],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(pageSize) })
      if (pageParam) params.set('cursor', String(pageParam))
      const res = await api.get(`/v1/commerce/orders?${params.toString()}`)
      return {
        items: (res.data.data as OrderCard[]) ?? [],
        nextCursor: (res.data.meta?.next_cursor as string | undefined) || null,
      }
    },
    getNextPageParam: (last) => last.nextCursor,
  })
}

export function useOrder(orderId: string | undefined) {
  return useQuery<Order>({
    queryKey: ['commerce', 'order', orderId],
    queryFn: async () => (await api.get(`/v1/commerce/orders/${orderId}`)).data.data,
    enabled: !!orderId,
  })
}

export type OrderItem = {
  id: string
  order_id: string
  product_id: string
  variant_id: string
  seller_id: string
  product_title: string
  sku: string
  quantity: number
  unit_price: number
  final_price: number
  status: string
  shipment_id?: string | null
  tracking_number?: string | null
  return_eligible_until?: string | null
  delivered_at?: string | null
}

export function useOrderWithItems(orderId: string | undefined) {
  return useQuery<{ order: Order; items: OrderItem[] }>({
    queryKey: ['commerce', 'order-items', orderId],
    queryFn: async () => (await api.get(`/v1/commerce/orders/${orderId}/items`)).data.data,
    enabled: !!orderId,
  })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason?: string }) =>
      (await api.post(`/v1/commerce/orders/${orderId}/cancel`, { reason })).data,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['commerce', 'orders'] })
      qc.invalidateQueries({ queryKey: ['commerce', 'order', vars.orderId] })
    },
  })
}

// ── Shipments + Invoices ──────────────────────────────────────────────

export function useShipment(orderId: string | undefined) {
  return useQuery<{ shipment: Shipment; events: ShipmentEvent[] }>({
    queryKey: ['commerce', 'shipment', orderId],
    queryFn: async () => (await api.get(`/v1/commerce/orders/${orderId}/shipment`)).data.data,
    enabled: !!orderId,
    retry: false,
  })
}

// ── Seller fulfillment ────────────────────────────────────────────────

export function useSellerOrders() {
  return useQuery<Order[]>({
    queryKey: ['commerce', 'seller', 'orders'],
    queryFn: async () => (await api.get('/v1/commerce/seller/orders')).data.data ?? [],
  })
}

// SellerOrderCard mirrors the Phase 4.2 commerce-service DTO — seller-scoped
// items + their shipment in one payload so the fulfillment dashboard avoids
// fanning out a separate request per order.
export type FulfillmentStage = 'all' | 'unshipped' | 'in_transit' | 'delivered' | 'cancelled'

export type SellerOrderCard = {
  order: Order
  items: OrderItem[]
  shipment?: Shipment | null
  seller_subtotal: number
  delivery_address?: string | null // raw JSON snapshot, base64 or string
}

export function useSellerFulfillment(stage: FulfillmentStage = 'all') {
  return useQuery<{ orders: SellerOrderCard[]; stage: FulfillmentStage }>({
    queryKey: ['commerce', 'seller', 'fulfillment', stage],
    queryFn: async () =>
      (await api.get('/v1/commerce/seller/fulfillment', { params: { stage } })).data.data,
  })
}

export function useSellerOrderDetail(orderId: string | undefined) {
  return useQuery<SellerOrderCard>({
    queryKey: ['commerce', 'seller', 'order', orderId],
    queryFn: async () => (await api.get(`/v1/commerce/seller/orders/${orderId}`)).data.data,
    enabled: !!orderId,
  })
}

// ── Seller returns inbox (Phase 4.3) ──────────────────────────────────

export type ReturnStatus = '' | 'requested' | 'approved' | 'rejected' | 'refunded'

export type SellerReturnCard = {
  return: {
    id: string
    order_id: string
    order_item_id: string
    customer_user_id: string
    seller_id: string
    reason_code: string
    reason_description?: string | null
    status: string
    approved_at?: string | null
    rejected_at?: string | null
    rejection_reason?: string | null
    requested_at: string
    refund_amount?: number | null
  }
  order_item?: OrderItem
  order?: Order
}

export function useSellerReturns(status: ReturnStatus = '') {
  return useQuery<{ returns: SellerReturnCard[]; status: string }>({
    queryKey: ['commerce', 'seller', 'returns', status],
    queryFn: async () =>
      (await api.get('/v1/commerce/seller/returns', { params: status ? { status } : {} })).data.data,
  })
}

export function useReturnRefundPreview(returnId: string | undefined) {
  return useQuery<{ refund_amount: number }>({
    queryKey: ['commerce', 'return', returnId, 'refund-preview'],
    queryFn: async () =>
      (await api.get(`/v1/commerce/returns/${returnId}/refund-preview`)).data.data,
    enabled: !!returnId,
    retry: false,
  })
}

export function useApproveReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (returnId: string) =>
      (await api.post(`/v1/commerce/returns/${returnId}/approve`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commerce', 'seller', 'returns'] }),
  })
}

export function useRejectReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ returnId, reason }: { returnId: string; reason: string }) =>
      (await api.post(`/v1/commerce/returns/${returnId}/reject`, { reason })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commerce', 'seller', 'returns'] }),
  })
}

// ── Seller earnings (Phase 4.4) ───────────────────────────────────────

export type SellerEarning = {
  order_item_id: string
  order_id: string
  order_number: string
  product_title: string
  sku: string
  quantity: number
  gross_amount: number
  commission_amount: number
  platform_fee: number
  tds_amount: number
  net_amount: number
  payment_method?: string | null
  status: string
  delivered_at?: string | null
}

export function useSellerEarnings(limit = 50, offset = 0) {
  return useQuery<{ earnings: SellerEarning[] }>({
    queryKey: ['commerce', 'seller', 'earnings', limit, offset],
    queryFn: async () =>
      (await api.get('/v1/commerce/seller/earnings', { params: { limit, offset } })).data.data,
  })
}

export type SellerCODRemittance = {
  id: string
  shipment_id: string
  order_id: string
  seller_id: string
  gross_amount: number
  commission_amount: number
  platform_fee: number
  tds_amount: number
  net_amount: number
  currency_code: string
  status: string
  delivered_at: string
  settled_at?: string | null
}

export function useSellerCODRemittances(status: string = '') {
  return useQuery<{ items: SellerCODRemittance[]; total: number }>({
    queryKey: ['commerce', 'seller', 'cod-remittances', status],
    queryFn: async () =>
      (await api.get('/v1/commerce/seller/cod-remittances', { params: status ? { status } : {} })).data
        .data,
  })
}

export function useBookShipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) =>
      (await api.post(`/v1/commerce/orders/${orderId}/shipment`)).data.data as Shipment,
    onSuccess: (_, orderId) => {
      qc.invalidateQueries({ queryKey: ['commerce', 'shipment', orderId] })
      qc.invalidateQueries({ queryKey: ['commerce', 'seller', 'orders'] })
      qc.invalidateQueries({ queryKey: ['commerce', 'order', orderId] })
    },
  })
}

export function useIssueInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) =>
      (await api.post(`/v1/commerce/orders/${orderId}/invoice`)).data.data as Invoice,
    onSuccess: (_, orderId) => {
      qc.invalidateQueries({ queryKey: ['commerce', 'invoice', orderId] })
    },
  })
}

export function useInvoice(orderId: string | undefined) {
  return useQuery<{ invoice: Invoice; download_url: string }>({
    queryKey: ['commerce', 'invoice', orderId],
    queryFn: async () => (await api.get(`/v1/commerce/orders/${orderId}/invoice`)).data.data,
    enabled: !!orderId,
    retry: false,
  })
}

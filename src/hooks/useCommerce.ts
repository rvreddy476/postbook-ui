import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

export function useCreateReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      order_id: string
      order_item_id: string
      seller_id: string
      reason_code: string
      reason_description?: string
    }) =>
      (await api.post(`/v1/commerce/orders/${input.order_id}/returns`, {
        order_item_id: input.order_item_id,
        seller_id: input.seller_id,
        reason_code: input.reason_code,
        reason_description: input.reason_description,
      })).data.data as ReturnRequest,
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

export function useOrders() {
  return useQuery<Order[]>({
    queryKey: ['commerce', 'orders'],
    queryFn: async () => (await api.get('/v1/commerce/orders')).data.data ?? [],
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

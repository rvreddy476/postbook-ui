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

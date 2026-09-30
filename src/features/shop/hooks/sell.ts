"use client"

// TanStack Query over ../api/sell. Keys are namespaced ["shop","sell",…] so
// one invalidation reaches every seller screen that shows the same fact.

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as sell from "../api/sell"
import type { FulfillmentStage, ShipFormValues, StockAdjustBody } from "../model/sell"
import { isNoSeller, nextOffset } from "../model/sell"

export const sellKeys = {
  all: ["shop", "sell"] as const,
  status: ["shop", "sell", "status"] as const,
  readiness: ["shop", "sell", "readiness"] as const,
  dashboard: ["shop", "sell", "dashboard"] as const,
  actionNeeded: ["shop", "sell", "action-needed"] as const,
  categoryTree: ["shop", "sell", "category-tree"] as const,
  schema: (categoryId: string) => ["shop", "sell", "schema", categoryId] as const,
  taxClasses: ["shop", "sell", "tax-classes"] as const,
  products: ["shop", "sell", "products"] as const,
  productPage: (offset: number, limit: number) => ["shop", "sell", "products", "page", offset, limit] as const,
  product: (id: string) => ["shop", "sell", "product", id] as const,
  variants: (id: string) => ["shop", "sell", "product", id, "variants"] as const,
  gallery: (id: string) => ["shop", "sell", "product", id, "gallery"] as const,
  productReadiness: (id: string) => ["shop", "sell", "product", id, "readiness"] as const,
  stockAll: ["shop", "sell", "stock"] as const,
  orders: ["shop", "sell", "orders"] as const,
  orderPages: (stage: FulfillmentStage, limit: number) => ["shop", "sell", "orders", "pages", stage, limit] as const,
  order: (id: string) => ["shop", "sell", "order", id] as const,
  orderHistory: (id: string) => ["shop", "sell", "order", id, "history"] as const,
  orderShipments: (id: string) => ["shop", "sell", "order", id, "shipments"] as const,
}

export const SELLER_PAGE_SIZE = 20

// ── Seller status and onboarding ────────────────────────────────

/** GET /onboarding/status. `data` is null (not an error) when the caller has no seller profile yet. */
export function useSellerStatus() {
  return useQuery({
    queryKey: sellKeys.status,
    queryFn: async () => {
      try {
        return await sell.fetchOnboardingStatus()
      } catch (error) {
        if (isNoSeller(error)) return null
        throw error
      }
    },
    retry: false,
    staleTime: 30_000,
  })
}

export function useSellerReadiness(enabled = true) {
  return useQuery({ queryKey: sellKeys.readiness, queryFn: sell.fetchReadiness, enabled, retry: false })
}

function useInvalidateOnboarding() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: sellKeys.status })
    void qc.invalidateQueries({ queryKey: sellKeys.readiness })
    void qc.invalidateQueries({ queryKey: sellKeys.dashboard })
  }
}

export function useStartOnboarding() {
  const invalidate = useInvalidateOnboarding()
  return useMutation({ mutationFn: sell.startOnboarding, onSuccess: invalidate })
}

export function useSaveBasic() {
  const invalidate = useInvalidateOnboarding()
  return useMutation({ mutationFn: sell.saveBasic, onSuccess: invalidate })
}

export function useSaveStorefront() {
  const invalidate = useInvalidateOnboarding()
  return useMutation({ mutationFn: sell.saveStorefront, onSuccess: invalidate })
}

export function useSaveDocuments() {
  const invalidate = useInvalidateOnboarding()
  return useMutation({ mutationFn: sell.saveDocuments, onSuccess: invalidate })
}

/** Fulfilment settings and the pickup address are one step to the seller: two writes, address first (it is the one readiness counts). */
export function useSaveFulfillmentStep() {
  const invalidate = useInvalidateOnboarding()
  return useMutation({
    mutationFn: async (args: { address: Parameters<typeof sell.saveSellerAddress>[0]; fulfillment: Parameters<typeof sell.saveFulfillment>[0] }) => {
      await sell.saveSellerAddress(args.address)
      await sell.saveFulfillment(args.fulfillment)
    },
    onSuccess: invalidate,
  })
}

export function useSavePayout() {
  const invalidate = useInvalidateOnboarding()
  return useMutation({ mutationFn: sell.savePayout, onSuccess: invalidate })
}

export function useSubmitApplication() {
  const invalidate = useInvalidateOnboarding()
  return useMutation({ mutationFn: sell.submitApplication, onSuccess: invalidate })
}

// ── Dashboard ───────────────────────────────────────────────────

export function useDashboard(enabled = true) {
  return useQuery({ queryKey: sellKeys.dashboard, queryFn: sell.fetchDashboard, enabled, retry: false })
}

export function useActionNeeded(enabled = true) {
  return useQuery({ queryKey: sellKeys.actionNeeded, queryFn: sell.fetchActionNeeded, enabled, retry: false })
}

// ── Catalogue ───────────────────────────────────────────────────

export function useCategoryTree() {
  return useQuery({ queryKey: sellKeys.categoryTree, queryFn: sell.fetchCategoryTree, staleTime: 5 * 60_000 })
}

export function useAttributeSchema(categoryId: string | null) {
  return useQuery({
    queryKey: sellKeys.schema(categoryId ?? "none"),
    queryFn: () => sell.fetchAttributeSchema(categoryId as string),
    enabled: !!categoryId,
    staleTime: 5 * 60_000,
  })
}

export function useTaxClasses() {
  return useQuery({ queryKey: sellKeys.taxClasses, queryFn: sell.fetchTaxClasses, staleTime: 5 * 60_000 })
}

// ── Products ────────────────────────────────────────────────────

export function useMyProductsPage(offset: number, limit = SELLER_PAGE_SIZE, enabled = true) {
  return useQuery({
    queryKey: sellKeys.productPage(offset, limit),
    queryFn: () => sell.fetchMyProducts({ limit, offset }),
    enabled,
    retry: false,
  })
}

/** Every product, every page, for the stock screen. Stops on a short page: this route filters before it pages. */
export function useAllMyProducts(enabled = true) {
  return useQuery({
    queryKey: [...sellKeys.products, "all"],
    queryFn: async () => {
      const limit = 100
      let offset = 0
      const out: Awaited<ReturnType<typeof sell.fetchMyProducts>>["items"] = []
      for (let guard = 0; guard < 50; guard += 1) {
        const page = await sell.fetchMyProducts({ limit, offset })
        out.push(...page.items)
        if (page.items.length < limit) break
        offset += limit
      }
      return out
    },
    enabled,
    retry: false,
  })
}

export function useProductDetail(productId: string | null) {
  return useQuery({
    queryKey: sellKeys.product(productId ?? "none"),
    queryFn: () => sell.fetchProductDetail(productId as string),
    enabled: !!productId,
    // The seller is editing: a cached copy from before their last save would seed the form with values they changed.
    staleTime: 0,
    retry: false,
  })
}

export function useProductVariants(productId: string | null) {
  return useQuery({
    queryKey: sellKeys.variants(productId ?? "none"),
    queryFn: () => sell.fetchProductVariants(productId as string),
    enabled: !!productId,
    retry: false,
  })
}

export function useProductGallery(productId: string | null) {
  return useQuery({
    queryKey: sellKeys.gallery(productId ?? "none"),
    queryFn: () => sell.fetchGallery(productId as string),
    enabled: !!productId,
    retry: false,
  })
}

export function useProductReadiness(productId: string | null, enabled = true) {
  return useQuery({
    queryKey: sellKeys.productReadiness(productId ?? "none"),
    queryFn: () => sell.fetchProductReadiness(productId as string),
    enabled: !!productId && enabled,
    retry: false,
  })
}

export function useInvalidateProduct() {
  const qc = useQueryClient()
  return (productId?: string) => {
    void qc.invalidateQueries({ queryKey: sellKeys.products })
    void qc.invalidateQueries({ queryKey: sellKeys.dashboard })
    void qc.invalidateQueries({ queryKey: sellKeys.stockAll })
    if (productId) void qc.invalidateQueries({ queryKey: sellKeys.product(productId) })
  }
}

export function useSubmitProduct() {
  const invalidate = useInvalidateProduct()
  return useMutation({
    mutationFn: (productId: string) => sell.submitProduct(productId),
    onSuccess: (_d, productId) => invalidate(productId),
  })
}

// ── Stock ───────────────────────────────────────────────────────

export function useAdjustStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { variantId: string; productId: string; body: StockAdjustBody }) => sell.adjustStock(args.variantId, args.body),
    onSuccess: (_level, { productId }) => {
      void qc.invalidateQueries({ queryKey: sellKeys.stockAll })
      void qc.invalidateQueries({ queryKey: sellKeys.variants(productId) })
      void qc.invalidateQueries({ queryKey: sellKeys.products })
      void qc.invalidateQueries({ queryKey: sellKeys.dashboard })
    },
  })
}

// ── Orders ──────────────────────────────────────────────────────

export function useSellerOrderPages(stage: FulfillmentStage, enabled = true, limit = SELLER_PAGE_SIZE) {
  return useInfiniteQuery({
    queryKey: sellKeys.orderPages(stage, limit),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number
      const orders = await sell.fetchFulfillment({ stage, limit, offset })
      return { orders, offset }
    },
    getNextPageParam: (last) => nextOffset({ count: last.orders.length, offset: last.offset, limit }),
    enabled,
    retry: false,
  })
}

export function useSellerOrder(orderId: string | null) {
  return useQuery({
    queryKey: sellKeys.order(orderId ?? "none"),
    queryFn: () => sell.fetchSellerOrder(orderId as string),
    enabled: !!orderId,
    retry: false,
  })
}

export function useSellerOrderHistory(orderId: string | null) {
  return useQuery({
    queryKey: sellKeys.orderHistory(orderId ?? "none"),
    queryFn: () => sell.fetchSellerOrderHistory(orderId as string),
    enabled: !!orderId,
    retry: false,
  })
}

export function useOrderShipments(orderId: string | null) {
  return useQuery({
    queryKey: sellKeys.orderShipments(orderId ?? "none"),
    queryFn: () => sell.fetchOrderShipments(orderId as string),
    enabled: !!orderId,
    retry: false,
  })
}

function useInvalidateOrder() {
  const qc = useQueryClient()
  return (orderId: string) => {
    void qc.invalidateQueries({ queryKey: sellKeys.order(orderId) })
    void qc.invalidateQueries({ queryKey: sellKeys.orders })
    void qc.invalidateQueries({ queryKey: sellKeys.dashboard })
  }
}

export function usePackOrder() {
  const invalidate = useInvalidateOrder()
  return useMutation({ mutationFn: (args: { orderId: string }) => sell.packOrder(args.orderId), onSuccess: (_d, { orderId }) => invalidate(orderId) })
}

export function useShipOrder() {
  const invalidate = useInvalidateOrder()
  return useMutation({
    mutationFn: (args: { orderId: string; values: ShipFormValues }) => sell.shipOrder(args.orderId, args.values),
    onSuccess: (_d, { orderId }) => invalidate(orderId),
  })
}

export function useCancelSellerOrder() {
  const invalidate = useInvalidateOrder()
  return useMutation({
    mutationFn: (args: { orderId: string; reason: string }) => sell.cancelSellerOrder(args.orderId, args.reason),
    onSuccess: (_d, { orderId }) => invalidate(orderId),
  })
}

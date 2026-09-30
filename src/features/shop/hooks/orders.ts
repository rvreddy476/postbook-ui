"use client"

/*
  TanStack Query hooks for orders. Keys: ["shop", "orders", …].
*/

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { cancelOrder, createReview, fetchInvoice, fetchOrder, fetchOrdersPage, fetchShipments } from "../api/orders"
import { toInvoiceLink, toOrderDetail, toOrdersPage, type InvoiceLink, type OrderDetail, type OrdersPage, type ReviewBody, type WireShipmentWithEvents } from "../model/orders"

export const ORDERS_LIST_KEY = ["shop", "orders", "list"] as const
export const orderDetailKey = (orderId: string) => ["shop", "orders", "detail", orderId] as const
export const orderShipmentsKey = (orderId: string) => ["shop", "orders", "shipments", orderId] as const

export function useOrdersList() {
  return useInfiniteQuery<OrdersPage, unknown, { pages: OrdersPage[]; pageParams: unknown[] }, typeof ORDERS_LIST_KEY, string>({
    queryKey: ORDERS_LIST_KEY,
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await fetchOrdersPage(pageParam)
      return toOrdersPage(data, meta)
    },
    getNextPageParam: (last) => last.nextCursor || undefined,
  })
}

export function useOrder(orderId: string, options: { refetchIntervalMs?: number } = {}) {
  return useQuery<OrderDetail>({
    queryKey: orderDetailKey(orderId),
    enabled: !!orderId,
    queryFn: async () => toOrderDetail(await fetchOrder(orderId)),
    refetchInterval: options.refetchIntervalMs || false,
  })
}

export function useShipments(orderId: string, enabled = true) {
  return useQuery<WireShipmentWithEvents[]>({
    queryKey: orderShipmentsKey(orderId),
    enabled: !!orderId && enabled,
    queryFn: async () => (await fetchShipments(orderId)).shipments || [],
  })
}

/** Fetched on the button, not on load: the route 404s until the order is paid and invoiced. */
export function useInvoiceLink() {
  return useMutation<InvoiceLink | null, unknown, string>({
    mutationFn: async (orderId) => toInvoiceLink(await fetchInvoice(orderId)),
  })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation<void, unknown, { orderId: string; reason: string }>({
    mutationFn: ({ orderId, reason }) => cancelOrder(orderId, reason),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: orderDetailKey(vars.orderId) })
      void qc.invalidateQueries({ queryKey: ORDERS_LIST_KEY })
    },
  })
}

export function useCreateReview() {
  return useMutation<void, unknown, { productId: string; body: ReviewBody }>({
    mutationFn: ({ productId, body }) => createReview(productId, body),
  })
}

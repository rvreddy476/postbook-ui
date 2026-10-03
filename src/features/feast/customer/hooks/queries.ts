"use client"

/*
  React Query hooks for the Feast customer screens. Every key sits under
  ["feast", "customer"] so a cart change can invalidate exactly what it moves.
*/

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"

import {
  addCartItem,
  cancelOrder,
  clearCart,
  createAddress,
  deleteAddress,
  getCart,
  getInvoice,
  getMenu,
  getOrder,
  getRestaurant,
  getTracking,
  listAddresses,
  listOrders,
  listRestaurants,
  removeCartItem,
  updateAddress,
  updateCartItem,
  type AddCartItemBody,
  type AddressBody,
  type FeastApiError,
  type LatLng,
} from "../api/client"
import { fullBody, pinOf, readChosenId, resolveChosen, writeChosenId } from "../model/address"
import type { Address, Cart } from "../model/wire"

export const FEAST = ["feast", "customer"] as const

export const keys = {
  addresses: [...FEAST, "addresses"] as const,
  restaurants: (near: LatLng | null) => [...FEAST, "restaurants", near ? `${near.lat},${near.lng}` : "anywhere"] as const,
  restaurant: (id: string, near: LatLng | null) => [...FEAST, "restaurant", id, near ? `${near.lat},${near.lng}` : "anywhere"] as const,
  menu: (id: string) => [...FEAST, "menu", id] as const,
  cart: [...FEAST, "cart"] as const,
  orders: [...FEAST, "orders"] as const,
  order: (id: string) => [...FEAST, "order", id] as const,
  tracking: (id: string) => [...FEAST, "tracking", id] as const,
  invoice: (id: string) => [...FEAST, "invoice", id] as const,
}

function localStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

/* addresses */

export function useAddresses() {
  return useQuery<Address[], FeastApiError>({ queryKey: keys.addresses, queryFn: listAddresses, staleTime: 30_000 })
}

/** The chosen delivery address (persisted per browser) and its pin. */
export function useChosenAddress() {
  const addresses = useAddresses()
  const [chosenId, setChosenId] = useState<string | null>(null)
  useEffect(() => setChosenId(readChosenId(localStore())), [])
  const chosen = resolveChosen(addresses.data ?? [], chosenId)
  const choose = useCallback((id: string) => {
    writeChosenId(localStore(), id)
    setChosenId(id)
  }, [])
  return { addresses, chosen, pin: pinOf(chosen), choose }
}

export function useCreateAddress() {
  const qc = useQueryClient()
  return useMutation<Address, FeastApiError, AddressBody>({
    mutationFn: createAddress,
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.addresses }),
  })
}

export function useMakeDefault() {
  const qc = useQueryClient()
  return useMutation<Address, FeastApiError, Address>({
    // The route replaces every field: resend the whole address.
    mutationFn: (a) => updateAddress(a.id, fullBody(a, true)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.addresses }),
  })
}

export function useDeleteAddress() {
  const qc = useQueryClient()
  return useMutation<void, FeastApiError, string>({
    mutationFn: deleteAddress,
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.addresses }),
  })
}

/* discovery */

export function useRestaurants(near: LatLng | null, enabled = true) {
  return useQuery({ queryKey: keys.restaurants(near), queryFn: () => listRestaurants(near), enabled, staleTime: 30_000 })
}

export function useRestaurant(id: string, near: LatLng | null, enabled = true) {
  return useQuery({ queryKey: keys.restaurant(id, near), queryFn: () => getRestaurant(id, near), enabled: enabled && Boolean(id) })
}

export function useMenu(id: string) {
  return useQuery({ queryKey: keys.menu(id), queryFn: () => getMenu(id), enabled: Boolean(id), staleTime: 60_000 })
}

/* cart */

export function useCart() {
  return useQuery<Cart, FeastApiError>({ queryKey: keys.cart, queryFn: getCart })
}

function useCartWrite<V>(fn: (v: V) => Promise<Cart>) {
  const qc = useQueryClient()
  return useMutation<Cart, FeastApiError, V>({
    mutationFn: fn,
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
  })
}

export function useAddToCart() {
  return useCartWrite<AddCartItemBody>(addCartItem)
}

export function useUpdateCartItem() {
  return useCartWrite<{ id: string; quantity: number }>(({ id, quantity }) => updateCartItem(id, quantity))
}

export function useRemoveCartItem() {
  return useCartWrite<string>(removeCartItem)
}

export function useClearCart() {
  const qc = useQueryClient()
  return useMutation<void, FeastApiError, void>({
    mutationFn: clearCart,
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.cart }),
  })
}

/* orders */

export function useOrders() {
  return useQuery({ queryKey: keys.orders, queryFn: listOrders })
}

export function useOrder(id: string, refetchInterval: number | false = false) {
  return useQuery({ queryKey: keys.order(id), queryFn: () => getOrder(id), enabled: Boolean(id), refetchInterval })
}

export function useTracking(id: string, enabled: boolean, refetchInterval: number | false) {
  return useQuery({ queryKey: keys.tracking(id), queryFn: () => getTracking(id), enabled: enabled && Boolean(id), refetchInterval, retry: 1 })
}

export function useInvoice(id: string, enabled: boolean) {
  return useQuery({ queryKey: keys.invoice(id), queryFn: () => getInvoice(id), enabled: enabled && Boolean(id), retry: false })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelOrder(id, reason),
    onSuccess: (order) => {
      qc.setQueryData(keys.order(order.id), order)
      void qc.invalidateQueries({ queryKey: keys.orders })
    },
  })
}

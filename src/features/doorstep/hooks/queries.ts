"use client"

/*
  React Query hooks for the Doorstep customer screens. Every key sits under
  ["doorstep", "customer"] so a write can invalidate exactly what it moves.
*/

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"

import {
  approveExtra,
  cancelBooking,
  createAddress,
  declineExtra,
  deleteAddress,
  getBooking,
  getCatalogue,
  getCategory,
  getExtrasBill,
  getOutstanding,
  getQuote,
  getService,
  getTrustedContact,
  listAddresses,
  listBookingProfessionals,
  listBookings,
  listExtras,
  listMessages,
  listRework,
  listServiceProfessionals,
  listSlots,
  previewCancel,
  rescheduleBooking,
  updateAddress,
  type DoorstepApiError,
  type SlotQuery,
} from "../api/client"
import { fullBody, readChosenId, resolveChosen, writeChosenId, type AddressBody } from "../model/address"
import { professionalsSearch, bookingProfessionalsSearch, type BookingProQuery, type ProListQuery } from "../model/professionals"
import type { Address, Booking, ProfessionalList } from "../model/wire"

/** The professionals lists refresh every 30 s (free times and on-duty professionals move). */
export const PROS_REFRESH_MS = 30_000

export const DOORSTEP = ["doorstep", "customer"] as const

export const keys = {
  catalogue: [...DOORSTEP, "catalogue"] as const,
  category: (slug: string) => [...DOORSTEP, "category", slug] as const,
  service: (id: string) => [...DOORSTEP, "service", id] as const,
  quote: (id: string) => [...DOORSTEP, "quote", id] as const,
  addresses: [...DOORSTEP, "addresses"] as const,
  slots: (q: SlotQuery) => [...DOORSTEP, "slots", q.quoteId ?? "", q.bookingId ?? "", q.addressId ?? "", q.requireFemalePro ? "f" : "-"] as const,
  bookings: (status: string) => [...DOORSTEP, "bookings", status] as const,
  allBookings: [...DOORSTEP, "bookings"] as const,
  booking: (id: string) => [...DOORSTEP, "booking", id] as const,
  extras: (id: string) => [...DOORSTEP, "extras", id] as const,
  extrasBill: (id: string) => [...DOORSTEP, "extras-bill", id] as const,
  outstanding: [...DOORSTEP, "outstanding"] as const,
  rework: (id: string) => [...DOORSTEP, "rework", id] as const,
  messages: (id: string) => [...DOORSTEP, "messages", id] as const,
  trustedContact: [...DOORSTEP, "trusted-contact"] as const,
  cancelPreview: (id: string) => [...DOORSTEP, "cancel-preview", id] as const,
  allPros: [...DOORSTEP, "pros"] as const,
  pros: (q: ProListQuery) => [...DOORSTEP, "pros", "service", q.serviceId, professionalsSearch(q).toString()] as const,
  bookingPros: (id: string, q: BookingProQuery) => [...DOORSTEP, "pros", "booking", id, bookingProfessionalsSearch(q).toString()] as const,
}

function localStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

/* catalogue */

export function useCatalogue() {
  return useQuery({ queryKey: keys.catalogue, queryFn: () => getCatalogue(), staleTime: 60_000, retry: 1 })
}

export function useCategory(slug: string) {
  return useQuery({ queryKey: keys.category(slug), queryFn: () => getCategory(slug), enabled: Boolean(slug), staleTime: 60_000, retry: 1 })
}

export function useService(id: string) {
  return useQuery({ queryKey: keys.service(id), queryFn: () => getService(id), enabled: Boolean(id), staleTime: 60_000, retry: 1 })
}

export function useQuote(id: string) {
  return useQuery({ queryKey: keys.quote(id), queryFn: () => getQuote(id), enabled: Boolean(id), retry: 1 })
}

/* addresses */

export function useAddresses() {
  return useQuery<Address[], DoorstepApiError>({ queryKey: keys.addresses, queryFn: listAddresses, staleTime: 30_000, retry: 1 })
}

/** The chosen visit address (persisted per browser). */
export function useChosenAddress() {
  const addresses = useAddresses()
  const [chosenId, setChosenId] = useState<string | null>(null)
  useEffect(() => setChosenId(readChosenId(localStore())), [])
  const chosen = resolveChosen(addresses.data ?? [], chosenId)
  const choose = useCallback((id: string) => {
    writeChosenId(localStore(), id)
    setChosenId(id)
  }, [])
  return { addresses, chosen, choose }
}

export function useCreateAddress() {
  const qc = useQueryClient()
  return useMutation<Address, DoorstepApiError, AddressBody>({
    mutationFn: createAddress,
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.addresses }),
  })
}

export function useMakeDefault() {
  const qc = useQueryClient()
  return useMutation<Address, DoorstepApiError, Address>({
    mutationFn: (a) => updateAddress(a.id, fullBody(a, true)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.addresses }),
  })
}

export function useDeleteAddress() {
  const qc = useQueryClient()
  return useMutation<void, DoorstepApiError, string>({
    mutationFn: deleteAddress,
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.addresses }),
  })
}

/* slots */

export function useSlots(q: SlotQuery, enabled: boolean, refetchInterval: number | false) {
  return useQuery({ queryKey: keys.slots(q), queryFn: () => listSlots(q), enabled, refetchInterval, retry: 1 })
}

/* B1: professionals */

export function useServiceProfessionals(q: ProListQuery, enabled: boolean) {
  return useQuery<ProfessionalList, DoorstepApiError>({
    queryKey: keys.pros(q),
    queryFn: () => listServiceProfessionals(q),
    enabled: enabled && Boolean(q.serviceId && q.optionId && q.addressId),
    refetchInterval: PROS_REFRESH_MS,
    retry: 1,
  })
}

export function useBookingProfessionals(bookingId: string, q: BookingProQuery, enabled: boolean) {
  return useQuery<ProfessionalList, DoorstepApiError>({
    queryKey: keys.bookingPros(bookingId, q),
    queryFn: () => listBookingProfessionals(bookingId, q),
    enabled: enabled && Boolean(bookingId),
    refetchInterval: PROS_REFRESH_MS,
    retry: false,
  })
}

/* bookings */

export function useBookings(status: "upcoming" | "past" | "all") {
  return useQuery({ queryKey: keys.bookings(status), queryFn: () => listBookings(status), retry: 1 })
}

export function useBooking(id: string, refetchInterval: UseQueryOptions<Booking, DoorstepApiError>["refetchInterval"] = false) {
  return useQuery<Booking, DoorstepApiError>({ queryKey: keys.booking(id), queryFn: () => getBooking(id), enabled: Boolean(id), refetchInterval, retry: 1 })
}

export function useCancelPreview(id: string, enabled: boolean) {
  return useQuery({ queryKey: keys.cancelPreview(id), queryFn: () => previewCancel(id), enabled: enabled && Boolean(id), retry: false, staleTime: 0 })
}

function useBookingWrite<V>(fn: (v: V) => Promise<Booking>) {
  const qc = useQueryClient()
  return useMutation<Booking, DoorstepApiError, V>({
    mutationFn: fn,
    onSuccess: (b) => {
      qc.setQueryData(keys.booking(b.id), b)
      void qc.invalidateQueries({ queryKey: keys.allBookings })
    },
  })
}

export function useCancelBooking() {
  return useBookingWrite<{ id: string; reason: string }>(({ id, reason }) => cancelBooking(id, reason))
}

export function useReschedule() {
  return useBookingWrite<{ id: string; slotStart: string }>(({ id, slotStart }) => rescheduleBooking(id, slotStart))
}

/* the visit */

export function useExtras(bookingId: string, enabled: boolean, refetchInterval: number | false) {
  return useQuery({ queryKey: keys.extras(bookingId), queryFn: () => listExtras(bookingId), enabled: enabled && Boolean(bookingId), refetchInterval, retry: 1 })
}

export function useDecideExtra(bookingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ extraId, approve }: { extraId: string; approve: boolean }) => (approve ? approveExtra(bookingId, extraId) : declineExtra(bookingId, extraId)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.extras(bookingId) })
      void qc.invalidateQueries({ queryKey: keys.extrasBill(bookingId) })
      void qc.invalidateQueries({ queryKey: keys.booking(bookingId) })
    },
  })
}

export function useExtrasBill(bookingId: string, enabled: boolean) {
  return useQuery({ queryKey: keys.extrasBill(bookingId), queryFn: () => getExtrasBill(bookingId), enabled: enabled && Boolean(bookingId), retry: false })
}

export function useOutstanding() {
  return useQuery({ queryKey: keys.outstanding, queryFn: getOutstanding, staleTime: 30_000, retry: 1 })
}

/* after the visit */

export function useRework(bookingId: string, enabled: boolean) {
  return useQuery({ queryKey: keys.rework(bookingId), queryFn: () => listRework(bookingId), enabled: enabled && Boolean(bookingId), retry: false })
}

export function useMessages(bookingId: string, enabled: boolean, refetchInterval: number | false, pages = 1) {
  return useQuery({ queryKey: [...keys.messages(bookingId), pages], queryFn: async () => {
    let result = await listMessages(bookingId)
    for (let page = 1; page < pages && result.nextCursor; page++) {
      const next = await listMessages(bookingId, result.nextCursor)
      result = { ...next, items: [...result.items, ...next.items] }
    }
    return result
  }, enabled: enabled && Boolean(bookingId), refetchInterval, retry: 1 })
}

export function useTrustedContact(enabled: boolean) {
  return useQuery({ queryKey: keys.trustedContact, queryFn: getTrustedContact, enabled, retry: false })
}

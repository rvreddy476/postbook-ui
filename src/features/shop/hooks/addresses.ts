"use client"

// The address book. Key ["shop", "addresses"]; W2's checkout may read the
// same list through this hook.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createAddress, deleteAddress, fetchAddresses, setDefaultAddress, updateAddress } from "../api/addresses"
import { toAddressRequest, type Address, type AddressFormValues } from "../model/addresses"
import { useShopSession } from "./storefront"

export const ADDRESSES_KEY = ["shop", "addresses"] as const

export function useAddresses() {
  const { signedIn, known } = useShopSession()
  return useQuery<Address[]>({
    queryKey: ADDRESSES_KEY,
    queryFn: fetchAddresses,
    enabled: known && signedIn,
    staleTime: 60 * 1000,
  })
}

export function useAddAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: AddressFormValues) => createAddress(toAddressRequest(values)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  })
}

export function useUpdateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: AddressFormValues }) => updateAddress(id, toAddressRequest(values)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  })
}

export function useDeleteAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAddress(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  })
}

export function useSetDefaultAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => setDefaultAddress(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  })
}

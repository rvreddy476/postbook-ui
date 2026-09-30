// Addresses (AUTH).
//
//   GET    /addresses
//   POST   /addresses                {contact_name, phone, address_line_1, address_line_2?, landmark?, city, state, postal_code, country, address_type, is_default}
//   PATCH  /addresses/:id            same body; 204
//   DELETE /addresses/:id            204
//   POST   /addresses/:id/default    204

import api from "@/lib/api"
import { toAddresses, type Address, type AddressRequest, type WireAddress } from "../model/addresses"

const BASE = "/v1/commerce"

export async function fetchAddresses(): Promise<Address[]> {
  const res = await api.get<{ data: WireAddress[] | null }>(`${BASE}/addresses`)
  return toAddresses(res.data?.data)
}

export async function createAddress(body: AddressRequest): Promise<WireAddress> {
  const res = await api.post<{ data: WireAddress }>(`${BASE}/addresses`, body)
  return res.data?.data ?? {}
}

export async function updateAddress(id: string, body: AddressRequest): Promise<void> {
  await api.patch(`${BASE}/addresses/${encodeURIComponent(id)}`, body)
}

export async function deleteAddress(id: string): Promise<void> {
  await api.delete(`${BASE}/addresses/${encodeURIComponent(id)}`)
}

export async function setDefaultAddress(id: string): Promise<void> {
  await api.post(`${BASE}/addresses/${encodeURIComponent(id)}/default`)
}

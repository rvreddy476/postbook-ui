"use client"

// The product page's delivery estimate, and the pincode it is asked for.
// Keys: ["shop", "delivery", productId, pincode | "default"].

import { useCallback, useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchDeliveryEstimate } from "../api/delivery"
import {
  browserStore,
  isValidPincode,
  normalisePincode,
  readStoredPincode,
  shouldAskEstimate,
  writeStoredPincode,
  type DeliveryEstimate,
} from "../model/delivery"
import { apiErrorStatus } from "../model/storefront"
import { useShopSession } from "./storefront"

export const DELIVERY_KEY = (productId: string, pincode: string | null) => ["shop", "delivery", productId, pincode || "default"] as const

/**
 * The pincode the page asks with: the one remembered in this browser
 * (`shop.pincode`), else none, which lets a signed-in buyer's default
 * address answer. Read after mount, so the server render and the first
 * client render agree.
 */
export function usePincode(): { pincode: string | null; ready: boolean; setPincode: (raw: string) => boolean } {
  const [pincode, setState] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setState(readStoredPincode(browserStore()))
    setReady(true)
  }, [])
  const setPincode = useCallback((raw: string) => {
    const value = normalisePincode(raw)
    if (!isValidPincode(value)) return false
    // Remembered when storage allows; used for this page either way.
    writeStoredPincode(browserStore(), value)
    setState(value)
    return true
  }, [])
  return { pincode, ready, setPincode }
}

/** `GET /products/:id/delivery-estimate`. Never asked for a signed-out shopper without a pincode. */
export function useDeliveryEstimate(productId: string | undefined, pincode: string | null, ready: boolean) {
  const { signedIn, known } = useShopSession()
  const asked = !!productId && ready && shouldAskEstimate({ pincode, signedIn, known })
  const query = useQuery<DeliveryEstimate>({
    queryKey: DELIVERY_KEY(productId ?? "", pincode),
    queryFn: () => fetchDeliveryEstimate(productId as string, pincode),
    enabled: asked,
    // A 4xx is an answer (no pincode, a bad one); only an outage is retried, once.
    retry: (count, error) => (apiErrorStatus(error) ?? 500) >= 500 && count < 1,
    staleTime: 5 * 60 * 1000,
  })
  return { ...query, asked }
}

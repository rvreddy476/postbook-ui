"use client"

// Bank offers. Keys: ["shop", "offers", …].

import { useQuery } from "@tanstack/react-query"

import { fetchPaymentOffers } from "../api/offers"
import { offersAmount, type PaymentOffer } from "../model/offers"

/** `GET /payment-offers?amount_minor=`; nothing is asked without a positive amount. The server caches 5 min. */
export function usePaymentOffers(amountMinor: number | null | undefined) {
  const amount = offersAmount(amountMinor)
  return useQuery<PaymentOffer[]>({
    queryKey: ["shop", "offers", "payment", amount ?? 0],
    queryFn: () => fetchPaymentOffers(amount as number),
    enabled: amount !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

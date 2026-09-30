"use client"

/*
  TanStack Query hooks for checkout. Query keys are ["shop", <area>, …].
*/

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { placeOrder, requestQuote, type QuoteRequest } from "../api/checkout"
import { BAG_KEY, useBag } from "./bag"
import {
  toBagSummary,
  toQuote,
  type BagSummary,
  type CheckoutBody,
  type Quote,
  type WireCheckoutResult,
} from "../model/checkout"

// The bag is ONE cache row (W1's useBag, key ["shop","bag"]); checkout only
// reshapes it. Two hooks on one key with two shapes would hand each the
// other's data.
export function useCheckoutBag() {
  return useBag<BagSummary>((cart) => toBagSummary(cart))
}

// One address query for the whole shop: W1's hooks/addresses.ts.
export { useAddresses as useCheckoutAddresses, useAddAddress as useCreateAddress } from "./addresses"

/** A quote is a mutation, not a query: every call prices and persists a new one. */
export function useQuote() {
  return useMutation<Quote, unknown, QuoteRequest>({
    mutationFn: async (body) => toQuote(await requestQuote(body)),
  })
}

export function usePlaceOrder() {
  const qc = useQueryClient()
  return useMutation<WireCheckoutResult, unknown, { body: CheckoutBody; idempotencyKey: string }>({
    mutationFn: ({ body, idempotencyKey }) => placeOrder(body, idempotencyKey),
    onSuccess: () => {
      // The bag is emptied inside the order transaction.
      void qc.invalidateQueries({ queryKey: BAG_KEY })
      void qc.invalidateQueries({ queryKey: ["shop", "orders"] })
    },
  })
}

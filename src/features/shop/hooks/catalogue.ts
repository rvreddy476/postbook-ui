"use client"

// One product's queries. Keys: ["shop", "catalogue", …].

import { useQuery } from "@tanstack/react-query"
import { fetchProductAttributes, fetchProductDetail, fetchProductMedia } from "../api/catalogue"
import { isProductMissing, type WireLegacyAttribute, type WireMediaItem, type WireProductDetailBody } from "../model/catalogue"

export const CATALOGUE_KEYS = {
  detail: (id: string) => ["shop", "catalogue", "detail", id] as const,
  media: (id: string) => ["shop", "catalogue", "media", id] as const,
  attributes: (id: string) => ["shop", "catalogue", "attributes", id] as const,
}

/** `GET /products/:id`. A 404 is a state, not a retry. */
export function useProductDetail(productId: string | undefined) {
  return useQuery<WireProductDetailBody>({
    queryKey: CATALOGUE_KEYS.detail(productId ?? ""),
    queryFn: () => fetchProductDetail(productId as string),
    enabled: !!productId,
    retry: (count, error) => !isProductMissing(error) && count < 2,
    staleTime: 30 * 1000,
  })
}

/**
 * `GET /products/:id/media`. The detail body already carries the same rows
 * under `media`, so this runs only when the body did not (`enabled`), which
 * keeps the hero image in the first paint.
 */
export function useProductMedia(productId: string | undefined, enabled: boolean) {
  return useQuery<WireMediaItem[]>({
    queryKey: CATALOGUE_KEYS.media(productId ?? ""),
    queryFn: () => fetchProductMedia(productId as string),
    enabled: !!productId && enabled,
    staleTime: 60 * 1000,
  })
}

/** `GET /products/:id/attributes`: the legacy rows, read only when the typed list in the body is empty. */
export function useLegacyAttributes(productId: string | undefined, enabled: boolean) {
  return useQuery<WireLegacyAttribute[]>({
    queryKey: CATALOGUE_KEYS.attributes(productId ?? ""),
    queryFn: () => fetchProductAttributes(productId as string),
    enabled: !!productId && enabled,
    staleTime: 60 * 1000,
  })
}

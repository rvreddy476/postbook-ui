import { queryOptions } from "@tanstack/react-query"
import { toDoorstepError } from "../api/client"
import type { Partner } from "./model"

export const partnerKey = (userId: string) => ["doorstep", "partner", userId] as const
export const PARTNER_STATUS_REFRESH_MS = 30_000

export function shouldRefreshPartner(partner: Partner | null | undefined) {
  return Boolean(partner && partner.status !== "draft")
}

export function partnerProfileOptions(userId: string | undefined, load: () => Promise<Partner>) {
  return queryOptions({
    queryKey: [...partnerKey(userId ?? "signed-out"), "me"],
    queryFn: async (): Promise<Partner | null> => {
      try { return await load() }
      catch (error) {
        const failure = toDoorstepError(error)
        // Not having applied yet is a successful empty state, not a failed
        // request. Retaining null keeps the form mounted during invalidation.
        if (failure.status === 404 && failure.code === "DOORSTEP_PRO_NOT_FOUND") return null
        throw failure
      }
    },
    enabled: Boolean(userId),
    retry: false,
    gcTime: 0,
    staleTime: PARTNER_STATUS_REFRESH_MS,
    refetchInterval: query => shouldRefreshPartner(query.state.data) ? PARTNER_STATUS_REFRESH_MS : false,
    refetchOnWindowFocus: query => shouldRefreshPartner(query.state.data),
    refetchOnReconnect: query => shouldRefreshPartner(query.state.data),
  })
}

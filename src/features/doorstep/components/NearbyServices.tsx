"use client"
import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { useCurrentLocation } from "@/features/maps/CurrentLocation"
import { checkServiceability } from "../api/client"
import { AvailabilityState, ErrorState } from "./parts"

export function useCurrentServiceArea() {
  const { point } = useCurrentLocation()
  return useQuery({ queryKey: ["doorstep", "current-area", point?.lat, point?.lng], queryFn: () => checkServiceability(point!.lat, point!.lng), enabled: Boolean(point), staleTime: 60_000, retry: 1 })
}

export function NearbyServices({ children }: { children: ReactNode }) {
  const area = useCurrentServiceArea()
  return <>
    {area.isLoading ? <p role="status">Checking home services at your location…</p> : area.isError ? <ErrorState error={area.error} what="Nearby services" onRetry={() => void area.refetch()} /> : !area.data?.serviceable || !area.data.city ? <AvailabilityState text="We don't currently serve your location. Please check back later, or explore our other apps in the meantime." /> : children}
  </>
}

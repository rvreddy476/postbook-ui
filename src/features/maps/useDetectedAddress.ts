"use client"
import { useQuery } from "@tanstack/react-query"
import { useCurrentLocation } from "./CurrentLocation"
import { reverseCurrentLocation } from "./reverseGeocode"

export function useDetectedAddress() {
  const { point } = useCurrentLocation()
  return useQuery({ queryKey: ["detected-address", point?.lat, point?.lng], queryFn: () => reverseCurrentLocation(point!), enabled: Boolean(point), retry: false, staleTime: 5 * 60_000 })
}

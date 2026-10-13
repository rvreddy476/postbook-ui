"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuthUser } from "@/store/auth"
import { useCurrentLocation } from "./CurrentLocation"
import { reverseCurrentLocation } from "./reverseGeocode"
import { createAddress as saveDoorstep, listAddresses as doorstepAddresses } from "@/features/doorstep/api/client"
import { createAddress as saveFood, listAddresses as foodAddresses } from "@/features/feast/customer/api/client"

export function sameCurrentPin(lat: number | null, lng: number | null, point: { lat: number; lng: number }): boolean {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return false
  const radians = Math.PI / 180
  const a = Math.sin((lat - point.lat) * radians / 2) ** 2 + Math.cos(lat * radians) * Math.cos(point.lat * radians) * Math.sin((lng - point.lng) * radians / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= 50
}

/** Resolve the permitted fix, reusing only this app's matching GPS address.
 * Never choose a different saved/default address behind the user's back.
 */
export function useCurrentAddress(module: "doorstep" | "feast") {
  const location = useCurrentLocation()
  const user = useAuthUser()
  const qc = useQueryClient()
  const point = location.point
  return useQuery({
    queryKey: ["current-address", module, user?.id, point?.lat, point?.lng],
    enabled: Boolean(user && point), retry: false, staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      if (!point) throw new Error("Allow current location to continue.")
      const place = await reverseCurrentLocation(point)
      if (signal.aborted) throw new Error("Location request cancelled.")
      if (module === "doorstep") {
        const addresses = await doorstepAddresses()
        const existing = addresses.find(a => a.label === "Current location" && sameCurrentPin(a.lat, a.lng, point))
        if (existing) return existing
        if (signal.aborted) throw new Error("Location request cancelled.")
        const saved = await saveDoorstep({ label: "Current location", line1: place.address.slice(0, 200), locality: place.locality.slice(0, 100), pincode: place.postalCode, lat: point.lat, lng: point.lng, is_default: false })
        void qc.invalidateQueries({ queryKey: ["doorstep", "customer", "addresses"] })
        return saved
      }
      const addresses = await foodAddresses()
      const existing = addresses.find(a => a.label === "Current location" && sameCurrentPin(a.latitude, a.longitude, point))
      if (existing) return existing
      if (signal.aborted) throw new Error("Location request cancelled.")
      const saved = await saveFood({ label: "Current location", address_line1: place.address, city: place.city, state: place.state, postal_code: place.postalCode, country: "India", latitude: point.lat, longitude: point.lng, is_default: false })
      void qc.invalidateQueries({ queryKey: ["feast", "customer", "addresses"] })
      return saved
    },
  })
}

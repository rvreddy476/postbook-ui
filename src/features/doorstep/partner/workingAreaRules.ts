import { validPoint, type MapPoint } from "@/features/maps/google"

export function areaError(point: MapPoint | null, radius: number, zones: string[], available: string[]): string | null {
  if (!validPoint(point)) return "Choose your location using the button or map."
  if (!Number.isInteger(radius) || radius < 1000 || radius > 15000) return "Choose a travel radius between 1 and 15 km."
  if (zones.length > 20 || zones.some(id => !available.includes(id))) return "Choose up to 20 available working zones."
  if (available.length && !zones.length) return "Select at least one working zone."
  return null
}

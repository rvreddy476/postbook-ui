import type { GooglePlace } from "@/features/maps/google"
import type { decodeSkill } from "./model"

export type ServiceType = Omit<ReturnType<typeof decodeSkill>, "categories"> & { categories?: { id: string; name: string }[] }
/** Categories are supplied by the catalogue, never inferred from service names. */
export function serviceTypeCategories(items: ServiceType[]) {
  const categories = new Map<string, { id: string; name: string }>()
  for (const item of items) for (const category of item.categories ?? []) categories.set(category.id, category)
  return [...categories.values()].sort((a,b) => a.name.localeCompare(b.name))
}
export function filterServiceTypes(items: ServiceType[], search: string) {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return items.filter(item => {
    const text = [item.name, item.code.replaceAll("_", " "), item.description].join(" ").toLowerCase()
    return words.every(word => text.includes(word))
  }).sort((a, b) => a.name.localeCompare(b.name))
}

export function townFromPlace(place: Pick<GooglePlace, "addressComponents">, state: string): string | null {
  const parts = place.addressComponents ?? []
  const region = parts.find(p => p.types.includes("administrative_area_level_1"))?.longText
  const country = parts.find(p => p.types.includes("country"))?.shortText
  const city = parts.find(p => p.types.includes("locality"))?.longText
    ?? parts.find(p => p.types.includes("postal_town"))?.longText
  // Never use a district name as if Google returned an actual town.
  if (country !== "IN" || region?.trim().toLowerCase() !== state.trim().toLowerCase() || !city) return null
  return city
}

/** Invalidates outstanding suggestions AND selections when the user edits or leaves. */
export class TownRequestVersion {
  private version = 0
  next() { return ++this.version }
  isCurrent(version: number) { return version === this.version }
}

import type { CategorySummary, Family, ServiceDetail } from "./wire"
import { chosenOption, type Selection } from "./selection"

/** Discovery always comes from the active city's catalogue, never a second static catalogue. */
export function storefrontCategories(categories: readonly CategorySummary[], query = ""): CategorySummary[] {
  const words = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean)
  const terms = words(query)
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .filter(c => {
      const searchable = words(`${c.name} ${c.description}`)
      return terms.every(term => searchable.some(word => term.length <= 2 ? word === term : word.startsWith(term)))
    })
}

export function featuredCategories(categories: readonly CategorySummary[]): CategorySummary[] {
  const slugs = ["ac-service-repair", "home-cleaning", "appliance-ro-repair"]
  return slugs.flatMap(slug => categories.find(c => c.slug === slug) ?? [])
}

const DIRECTORY_GROUPS: readonly { id: string; label: string; families: readonly Family[] }[] = [
  { id: "cleaning", label: "Cleaning & pest control", families: ["HOME_CLEANING", "PEST_CONTROL"] },
  { id: "repairs", label: "Repairs & installation", families: ["APPLIANCE_REPAIR", "INSTALLATION_REPAIR"] },
  { id: "beauty", label: "Salon & wellness", families: ["BEAUTY_SALON", "FITNESS_WELLNESS"] },
  { id: "home-help", label: "House help", families: ["HOME_STAFFING"] },
  { id: "improvement", label: "Painting & home projects", families: ["PAINTING", "CONSTRUCTION"] },
  { id: "more", label: "More home services", families: ["CAR_CARE", "RELOCATION", "PHOTOGRAPHY"] },
]

/** Display groups organise existing entries, never create unavailable services. */
export function serviceDirectoryGroups(categories: readonly CategorySummary[]) {
  const sorted = storefrontCategories(categories)
  return DIRECTORY_GROUPS.map(group => ({ ...group, categories: sorted.filter(category => group.families.includes(category.family)) }))
    .filter(group => group.categories.length > 0)
}

export function serviceDirectoryCategories(categories: readonly CategorySummary[], groupId = "all", query = "") {
  const group = DIRECTORY_GROUPS.find(group => group.id === groupId)
  return storefrontCategories(categories, query).filter(category => !group || group.families.includes(category.family))
}

export type ServiceArt = "ac" | "kitchen" | "sofa" | "appliance" | "electrician" | "plumber" | "carpenter" | "salon-women" | "salon-men" | "house-help" | null
export function serviceArt(slug: string, categorySlug = slug, family?: Family): ServiceArt {
  if (categorySlug === "ac-service-repair") return "ac"
  if (categorySlug === "home-cleaning") return /sofa|carpet|mattress/.test(slug) ? "sofa" : "kitchen"
  if (/electric/.test(categorySlug)) return "electrician"
  if (/plumb/.test(categorySlug)) return "plumber"
  if (/carpen|furniture/.test(categorySlug)) return "carpenter"
  if (categorySlug === "salon-women") return "salon-women"
  if (categorySlug === "salon-men") return "salon-men"
  if (family === "APPLIANCE_REPAIR" || /appliance|washing-machine|water-purifier/.test(categorySlug)) return "appliance"
  if (family === "HOME_STAFFING") return "house-help"
  return null
}

/** Only approved prices are bookable; suggested prices are never a fallback. */
export function selectionHasApprovedPrice(service: ServiceDetail, selection: Selection): boolean {
  const option = chosenOption(service, selection)
  return Boolean(option && option.fromPricePaise !== null && Number.isSafeInteger(option.fromPricePaise) && option.fromPricePaise >= 0)
}

export function selectionAddonNames(service: ServiceDetail, selection: Selection): string[] {
  return service.addonGroups.flatMap(group => group.addons.filter(addon => selection.addons[group.id]?.includes(addon.id)).map(addon => addon.name))
}

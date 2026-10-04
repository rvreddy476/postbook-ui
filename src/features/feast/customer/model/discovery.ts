import type { Restaurant } from "./wire"

/** Filter locally without changing the server's delivery/serviceability order. */
export function filterRestaurants(restaurants: readonly Restaurant[], query: string, cuisine: string): Restaurant[] {
  const search = query.trim().toLocaleLowerCase()
  return restaurants.filter(r => (!cuisine || r.cuisines.includes(cuisine)) && (!search || `${r.name} ${r.cuisines.join(" ")}`.toLocaleLowerCase().includes(search)))
}

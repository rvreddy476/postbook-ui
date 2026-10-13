import { loadGoogleMaps, selectedPlace, validPoint, type MapPoint, type SelectedPlace } from "./google"

/** Area lookup preserves the selected coordinates and does not require a delivery postcode. */
export async function reverseAreaName(point: MapPoint): Promise<string> {
  if (!validPoint(point)) throw new Error("Choose a valid location.")
  try {
    const google = await loadGoogleMaps()
    const library = await google.maps.importLibrary("geocoding") as GeocodingLibrary
    const { results } = await new library.Geocoder().geocode({ location: point })
    const name = results.find(r => !r.partial_match && r.formatted_address)?.formatted_address
    if (name) return name
  } catch { /* Keep the point; the user can supply its area label. */ }
  throw new Error("Area lookup is unavailable. Enter the area name for your selected location, or search manually.")
}

type GeocodeResult = { formatted_address: string; address_components: { long_name: string; short_name: string; types: string[] }[]; types: string[]; partial_match?: boolean }
type GeocodingLibrary = { Geocoder: new () => { geocode(request: { location: MapPoint }): Promise<{ results: GeocodeResult[] }> } }

export function reverseResult(point: MapPoint, results: GeocodeResult[]): SelectedPlace {
  if (!validPoint(point)) throw new Error("Current location is invalid. Refresh your location.")
  const result = results.find(r => !r.partial_match && r.types.some(t => ["street_address", "premise", "route", "subpremise"].includes(t))) ?? results.find(r => !r.partial_match)
  if (!result) throw new Error("An address could not be identified at your current location. Try location again.")
  const components = result.address_components
  if (components.find(c => c.types.includes("country"))?.short_name !== "IN") throw new Error("These services are currently available in India only.")
  const place = selectedPlace({ location: { lat: () => point.lat, lng: () => point.lng }, formattedAddress: result.formatted_address, addressComponents: components.map(c => ({ longText: c.long_name, shortText: c.short_name, types: c.types })) })!
  if (!place.address || !place.city || !place.locality || !/^[1-9]\d{5}$/.test(place.postalCode)) throw new Error("We could not identify a complete delivery address from this location. Refresh location and try again.")
  return place
}

export async function reverseCurrentLocation(point: MapPoint): Promise<SelectedPlace> {
  try {
    const google = await loadGoogleMaps()
    const library = await google.maps.importLibrary("geocoding") as GeocodingLibrary
    return reverseResult(point, (await new library.Geocoder().geocode({ location: point })).results)
  }
  catch (error) {
    if (error instanceof Error && /^(An address|Current location|These services|We could not)/.test(error.message)) throw error
    throw new Error("Automatic address lookup is unavailable. Please try again shortly; location discovery still works.")
  }
}

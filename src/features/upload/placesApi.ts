import api from "@/lib/api";

/*
  Location search for the upload studio (post-service internal/places,
  Google Places Autocomplete behind the server key):

    GET /v1/posts/places/autocomplete?q=&session=   → {"data":[{place_id, name, secondary}]}
    503 PLACES_DISABLED / PLACES_UNAVAILABLE          → the field stays free text

  The post stores the pick as location_name + location_place_id.
*/

export interface PlaceSuggestion {
  placeId: string;
  name: string;
  secondary: string;
}

export type PlaceSearchResult = { kind: "ok"; places: PlaceSuggestion[] } | { kind: "unavailable" };

export const PLACE_QUERY_MIN = 2;
export const PLACE_QUERY_MAX = 100;

/** Whether the text is worth a (billed) search: long enough, and not the place already picked. */
export function placeQueryReady(text: string, picked: { name: string; placeId: string | null }): boolean {
  const q = text.trim();
  if (q.length < PLACE_QUERY_MIN || q.length > PLACE_QUERY_MAX) return false;
  return !(picked.placeId && q === picked.name.trim());
}

/** Reads the route's rows strictly: anything without an id and a name is dropped. */
export function parsePlaces(raw: unknown): PlaceSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: PlaceSuggestion[] = [];
  for (const row of raw) {
    const r = row as { place_id?: unknown; name?: unknown; secondary?: unknown };
    if (typeof r?.place_id !== "string" || !r.place_id || typeof r.name !== "string" || !r.name.trim()) continue;
    out.push({ placeId: r.place_id, name: r.name.trim(), secondary: typeof r.secondary === "string" ? r.secondary : "" });
  }
  return out;
}

export async function searchPlaces(q: string, session: string, signal?: AbortSignal): Promise<PlaceSearchResult> {
  try {
    const res = await api.get<{ data: unknown }>("/v1/posts/places/autocomplete", { params: { q: q.trim(), session }, signal });
    return { kind: "ok", places: parsePlaces(res.data?.data) };
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    // No key, or Google refused: stop asking for this session, keep free text.
    if (status === 503) return { kind: "unavailable" };
    throw err;
  }
}

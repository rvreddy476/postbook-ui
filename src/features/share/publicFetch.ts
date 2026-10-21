/*
  The one way a route's generateMetadata reads the public API: on the
  server, through the gateway, with NO cookie and no identity header, so the
  preview is exactly what a stranger (or a crawler) may see. A slow or
  failing API costs the page its preview, never its render: every failure is
  a null body with the status that caused it.
*/

import { API_GATEWAY_URL } from "@/app/api/auth/_lib/session";

const TIMEOUT_MS = 3000;

export interface PublicFetchResult<T> {
  data: T | null;
  status: number;
}

/** The whole JSON body of a public GET (`{data, meta}` as the API sends it). */
export async function publicFetchEnvelope<T>(path: string, revalidateSeconds = 60): Promise<PublicFetchResult<T>> {
  try {
    const res = await fetch(`${API_GATEWAY_URL}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { data: null, status: res.status };
    const json = (await res.json()) as T | null;
    return { data: json && typeof json === "object" ? json : null, status: res.status };
  } catch {
    return { data: null, status: 0 };
  }
}

/** The `data` of a public GET, unwrapped. */
export async function publicFetch<T>(path: string, revalidateSeconds = 60): Promise<PublicFetchResult<T>> {
  const res = await publicFetchEnvelope<{ data?: T }>(path, revalidateSeconds);
  return { data: res.data?.data ?? null, status: res.status };
}

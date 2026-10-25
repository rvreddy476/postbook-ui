import api from "@/lib/api";

import { hydrateRows } from "../data/posttubeApi";
import type { HydratedPostRow } from "../model";
import type { PostTubeVideo } from "../types";
import { decodeCreditAnswer, decodeCreditRequestsPage, decodeGenres, type CreditRequest, type CreditStatus, type Genre } from "./creditsModel";

/*
  The credits requests (contract 23 Oct 2026, as the server landed). The
  write side of a video's credits rides on the post routes (studio create
  / draft, Hub PATCH); everything else is here.

    GET    /v1/posts/genres                  [{slug,label}]
    GET    /v1/credits/requests?cursor=      my pending requests, meta.next_cursor
    POST   /v1/credits/:id/accept            → {status:"accepted"} (from any linked status)
    POST   /v1/credits/:id/decline           → {status:"declined"}
    DELETE /v1/credits/:id                   → {status:"unlinked"}: the tagged user removes the link
                                               ("Remove me", pending or accepted); a repeat is 404
    GET    /v1/creators/:creatorId/appearances?cursor=&limit=   accepted appearances, the
                                               channel-videos row shape (no `credits` on the rows)
*/

interface Envelope<T> {
  data: T;
  meta?: { next_cursor?: string | null };
}

/** The appearances route of one person (post-service; /v1/users/* belongs to user-service). */
export function appearancesPath(creatorId: string): string {
  return `/v1/creators/${encodeURIComponent(creatorId)}/appearances`;
}

export async function getGenres(): Promise<Genre[]> {
  const res = await api.get<Envelope<unknown>>("/v1/posts/genres");
  return decodeGenres(res.data?.data ?? res.data);
}

export async function getCreditRequests(cursor?: string | null): Promise<{ items: CreditRequest[]; nextCursor: string | null }> {
  const res = await api.get<unknown>("/v1/credits/requests", { params: cursor ? { cursor } : {} });
  return decodeCreditRequestsPage(res.data);
}

export async function acceptCredit(creditId: string): Promise<CreditStatus | null> {
  const res = await api.post<unknown>(`/v1/credits/${encodeURIComponent(creditId)}/accept`, {});
  return decodeCreditAnswer(res.data);
}

export async function declineCredit(creditId: string): Promise<CreditStatus | null> {
  const res = await api.post<unknown>(`/v1/credits/${encodeURIComponent(creditId)}/decline`, {});
  return decodeCreditAnswer(res.data);
}

function isNotFound(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 404;
}

/**
 * "Remove me from this video": the tagged user drops the link; the name
 * stays as plain text. A repeat answers 404, which means the link is
 * already gone: read as "unlinked", the same end state.
 */
export async function removeMyCredit(creditId: string): Promise<CreditStatus | null> {
  try {
    const res = await api.delete<unknown>(`/v1/credits/${encodeURIComponent(creditId)}`);
    return decodeCreditAnswer(res.data);
  } catch (err) {
    if (isNotFound(err)) return "unlinked";
    throw err;
  }
}

export interface AppearancesPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** The raw rows (the profile grid reads them as posts). */
export async function getAppearanceRows(creatorId: string, cursor?: string | null, limit = 24): Promise<AppearancesPage<HydratedPostRow>> {
  const res = await api.get<Envelope<HydratedPostRow[]>>(appearancesPath(creatorId), {
    params: { limit: String(limit), ...(cursor ? { cursor } : {}) },
  });
  const rows = Array.isArray(res.data?.data) ? res.data.data.filter((r) => r && typeof r.id === "string") : [];
  return { items: rows, nextCursor: res.data?.meta?.next_cursor || null };
}

/** The rows as PostTube cards (the channel grid). */
export async function getAppearances(creatorId: string, cursor?: string | null, limit = 24): Promise<AppearancesPage<PostTubeVideo>> {
  const page = await getAppearanceRows(creatorId, cursor, limit);
  return { items: await hydrateRows(page.items), nextCursor: page.nextCursor };
}

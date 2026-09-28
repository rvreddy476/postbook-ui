import api from "@/lib/api";

import type { HydratedPostRow } from "../model";

/*
  The Library adapter: every request and response shape the Queue, Loved,
  Collections and Recent screens depend on lives here, so a post-service
  contract change is one edit.

  Routes (post-service, through the gateway):
    GET    /v1/playlists/system/:kind            kind = watch_later | liked; created on first read
    GET    /v1/playlists/:id
    PATCH  /v1/playlists/:id                     { title?, description?, visibility? }; 409 SYSTEM_PLAYLIST on a system one
    DELETE /v1/playlists/:id                     409 SYSTEM_PLAYLIST on a system one
    GET    /v1/playlists/:id/items               hydrated rows: { playlist_id, post_id, position, added_at, post }
    PATCH  /v1/playlists/:id/items/:postId       { position } — 0-based target index, clamped; returns the whole order
    DELETE /v1/playlists/:id/items/:postId
    POST   /v1/posts/:id/watch-later             idempotent
    DELETE /v1/posts/:id/watch-later             idempotent
    GET    /v1/creators/:creatorId/playlists     ?limit&offset
    POST   /v1/playlists                         { title, description?, visibility }
*/

interface Envelope<T> {
  data: T;
  meta?: { next_cursor?: string | null };
}

export type CollectionKind = "user" | "watch_later" | "liked";
export type SystemCollectionKind = Exclude<CollectionKind, "user">;
export type CollectionVisibility = "public" | "private" | "unlisted";

/** One normalised playlist, whichever of the two wire variants produced it. */
export interface Collection {
  id: string;
  creatorId: string;
  kind: CollectionKind;
  title: string;
  description: string;
  visibility: CollectionVisibility;
  itemCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CollectionItem {
  playlistId: string;
  postId: string;
  position: number;
  addedAt?: string;
  post: HydratedPostRow | null;
}

/** The wire playlist. Older rows carry `is_public`; current rows carry `visibility`; `kind` is new and may be absent. */
export interface PlaylistWire {
  id: string;
  creator_id?: string;
  kind?: string | null;
  title?: string | null;
  description?: string | null;
  visibility?: string | null;
  is_public?: boolean | null;
  item_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlaylistItemWire {
  playlist_id?: string;
  post_id: string;
  position?: number | null;
  added_at?: string | null;
  post?: HydratedPostRow | null;
}

export const SYSTEM_TITLES: Record<SystemCollectionKind, string> = {
  watch_later: "Watch later",
  liked: "Liked videos",
};

export function isSystemKind(kind: string | null | undefined): kind is SystemCollectionKind {
  return kind === "watch_later" || kind === "liked";
}

function normalizeVisibility(raw: PlaylistWire): CollectionVisibility {
  const v = raw.visibility;
  if (v === "public" || v === "private" || v === "unlisted") return v;
  if (typeof raw.is_public === "boolean") return raw.is_public ? "public" : "private";
  return "private";
}

export function normalizePlaylist(raw: PlaylistWire): Collection {
  const kind: CollectionKind = isSystemKind(raw.kind) ? raw.kind : "user";
  // A system list is named by our vocabulary (Queue, Loved), never by the server's row title.
  const title = kind === "user" ? (raw.title ?? "").trim() || "Untitled" : SYSTEM_TITLES[kind];
  return {
    id: String(raw.id),
    creatorId: raw.creator_id ?? "",
    kind,
    title,
    description: raw.description ?? "",
    visibility: normalizeVisibility(raw),
    itemCount: typeof raw.item_count === "number" && raw.item_count >= 0 ? raw.item_count : 0,
    createdAt: raw.created_at ?? undefined,
    updatedAt: raw.updated_at ?? undefined,
  };
}

export function normalizeItems(rows: unknown, playlistId?: string): CollectionItem[] {
  const list = Array.isArray(rows) ? (rows as PlaylistItemWire[]) : [];
  const seen = new Set<string>();
  const out: CollectionItem[] = [];
  list.forEach((r, i) => {
    if (!r || typeof r.post_id !== "string" || !r.post_id || seen.has(r.post_id)) return;
    seen.add(r.post_id);
    out.push({
      playlistId: r.playlist_id ?? playlistId ?? "",
      postId: r.post_id,
      position: typeof r.position === "number" ? r.position : i,
      addedAt: r.added_at ?? undefined,
      post: r.post ?? null,
    });
  });
  return out.sort((a, b) => a.position - b.position);
}

function statusOf(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

function codeOf(err: unknown): string | undefined {
  const data = (err as { response?: { data?: { error?: { code?: string }; code?: string } } })?.response?.data;
  return data?.error?.code ?? data?.code;
}

/** 409 SYSTEM_PLAYLIST — the Queue and Loved lists refuse rename, delete and visibility. */
export function isSystemPlaylistRefusal(err: unknown): boolean {
  return statusOf(err) === 409 && codeOf(err) === "SYSTEM_PLAYLIST";
}

export function isNotFound(err: unknown): boolean {
  return statusOf(err) === 404;
}

// ── Reads ─────────────────────────────────────────────────────────────

export async function fetchSystemCollection(kind: SystemCollectionKind): Promise<Collection> {
  const res = await api.get<Envelope<PlaylistWire>>(`/v1/playlists/system/${kind}`);
  // The route is the authority on the kind even if the row omits it.
  return normalizePlaylist({ ...res.data.data, kind });
}

export async function fetchCollection(id: string): Promise<Collection | null> {
  try {
    const res = await api.get<Envelope<PlaylistWire>>(`/v1/playlists/${id}`);
    return res.data.data ? normalizePlaylist(res.data.data) : null;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function fetchCollectionItems(id: string): Promise<CollectionItem[]> {
  const res = await api.get<Envelope<PlaylistItemWire[]>>(`/v1/playlists/${id}/items`);
  return normalizeItems(res.data.data, id);
}

export async function fetchCreatorCollections(creatorId: string, params?: { limit?: number; offset?: number }): Promise<Collection[]> {
  const res = await api.get<Envelope<PlaylistWire[]>>(`/v1/creators/${creatorId}/playlists`, {
    params: { limit: String(params?.limit ?? 50), offset: String(params?.offset ?? 0) },
  });
  return (Array.isArray(res.data.data) ? res.data.data : []).map(normalizePlaylist);
}

// ── Writes ────────────────────────────────────────────────────────────

export interface CollectionPatch {
  title?: string;
  description?: string;
  visibility?: CollectionVisibility;
}

export async function patchCollection(id: string, patch: CollectionPatch): Promise<Collection> {
  const res = await api.patch<Envelope<PlaylistWire>>(`/v1/playlists/${id}`, patch);
  return normalizePlaylist(res.data.data);
}

export async function deleteCollection(id: string): Promise<void> {
  await api.delete(`/v1/playlists/${id}`);
}

export async function createCollection(input: { title: string; description?: string; visibility: CollectionVisibility }): Promise<Collection> {
  const res = await api.post<Envelope<PlaylistWire>>("/v1/playlists", input);
  return normalizePlaylist(res.data.data);
}

/** Body `{ position }`: the 0-based index the post should land on. The server re-writes and returns the full order. */
export async function moveCollectionItem(id: string, postId: string, position: number): Promise<CollectionItem[]> {
  const res = await api.patch<Envelope<PlaylistItemWire[]>>(`/v1/playlists/${id}/items/${postId}`, { position });
  return normalizeItems(res.data.data, id);
}

export async function removeCollectionItem(id: string, postId: string): Promise<void> {
  await api.delete(`/v1/playlists/${id}/items/${postId}`);
}

export async function queuePost(postId: string): Promise<void> {
  await api.post(`/v1/posts/${postId}/watch-later`);
}

export async function unqueuePost(postId: string): Promise<void> {
  await api.delete(`/v1/posts/${postId}/watch-later`);
}

/** The `Play all` target: the first row, carrying the list so the watch page can step through it. */
export function playAllHref(collection: Pick<Collection, "id">, items: CollectionItem[]): string | null {
  const first = items[0];
  if (!first) return null;
  return `/posttube/watch/${encodeURIComponent(first.postId)}?list=${encodeURIComponent(collection.id)}`;
}

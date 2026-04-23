import api from "@/lib/api";

import type {
  CreateSlambookInput,
  SaveSlambookResponseInput,
  Slambook,
  SlambookDetail,
  SlambookInvite,
  SlambookOpinionSpaceItem,
  SlambookResponseSession,
  SlambookTemplatePack,
} from "@/features/slambooks/types";

function unwrapDataMap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as T;
    }
  }
  return (payload ?? {}) as T;
}

function unwrapItems<T>(payload: unknown): T[] {
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data as T[];
    }
    if (data && typeof data === "object" && "items" in data) {
      const items = (data as { items?: unknown }).items;
      if (Array.isArray(items)) {
        return items as T[];
      }
    }
  }
  return [];
}

function viewerHeaders(viewerUserId?: string) {
  return viewerUserId ? { headers: { "X-User-Id": viewerUserId } } : undefined;
}

export async function listSlambookTemplatePacks(): Promise<SlambookTemplatePack[]> {
  const response = await api.get("/v1/memories/slambook-template-packs");
  return unwrapItems<SlambookTemplatePack>(response.data);
}

export async function createSlambook(input: CreateSlambookInput): Promise<Slambook> {
  const response = await api.post("/v1/memories/slambooks", {
    title: input.title,
    subtitle: input.subtitle ?? "",
    description: input.description ?? "",
    category: input.category ?? "personal",
    theme_key: input.theme_key ?? "classic",
    visibility: input.visibility ?? "invited_only",
    response_identity_mode: input.response_identity_mode ?? "named",
    approval_required: input.approval_required ?? false,
    template_pack_key: input.template_pack_key ?? "",
    closes_at: input.closes_at,
    custom_cards: input.custom_cards ?? [],
  });
  return unwrapDataMap<Slambook>(response.data);
}

export async function listSlambooks(ownerUserId: string): Promise<Slambook[]> {
  const response = await api.get("/v1/memories/slambooks", {
    params: { owner_user_id: ownerUserId },
  });
  return unwrapItems<Slambook>(response.data);
}

export async function getSlambook(slambookId: string): Promise<SlambookDetail> {
  const response = await api.get(`/v1/memories/slambooks/${slambookId}`);
  return unwrapDataMap<SlambookDetail>(response.data);
}

export async function createSlambookShareLink(slambookId: string): Promise<SlambookInvite> {
  const response = await api.post(`/v1/memories/slambooks/${slambookId}/share-link`);
  return unwrapDataMap<SlambookInvite>(response.data);
}

export async function createSlambookInvites(
  slambookId: string,
  targetUserIds: string[],
  message?: string,
): Promise<SlambookInvite[]> {
  const response = await api.post(`/v1/memories/slambooks/${slambookId}/invites`, {
    target_user_ids: targetUserIds,
    message,
  });
  return unwrapItems<SlambookInvite>(response.data);
}

export async function saveSlambookResponse(
  slambookId: string,
  input: SaveSlambookResponseInput,
  viewerUserId?: string,
): Promise<SlambookResponseSession> {
  const response = await api.post(
    `/v1/memories/slambooks/${slambookId}/responses`,
    {
      display_name: input.display_name ?? "",
      anonymous: input.anonymous ?? false,
      share_token: input.share_token,
      submit: input.submit ?? false,
      answers: input.answers,
    },
    viewerHeaders(viewerUserId),
  );
  return unwrapDataMap<SlambookResponseSession>(response.data);
}

export async function listSlambookOpinionSpace(
  slambookId: string,
  viewerUserId?: string,
): Promise<SlambookOpinionSpaceItem[]> {
  const response = await api.get(
    `/v1/memories/slambooks/${slambookId}/opinion-space`,
    viewerHeaders(viewerUserId),
  );
  return unwrapItems<SlambookOpinionSpaceItem>(response.data);
}

export async function listSlambookModerationQueue(
  slambookId: string,
): Promise<SlambookResponseSession[]> {
  const response = await api.get(`/v1/memories/slambooks/${slambookId}/moderation`);
  return unwrapItems<SlambookResponseSession>(response.data);
}

export async function moderateSlambookSession(
  slambookId: string,
  sessionId: string,
  action: string,
  reason?: string,
): Promise<void> {
  await api.post(`/v1/memories/slambooks/${slambookId}/moderation/${sessionId}`, {
    action,
    reason: reason ?? "",
  });
}

export async function setSlambookOpinionPinned(
  slambookId: string,
  itemId: string,
  pinned: boolean,
): Promise<void> {
  await api.post(`/v1/memories/slambooks/${slambookId}/opinion-space/${itemId}/pin`, {
    pinned,
  });
}

export async function reorderSlambookOpinionItems(
  slambookId: string,
  itemIds: string[],
): Promise<void> {
  await api.post(`/v1/memories/slambooks/${slambookId}/opinion-space/reorder`, {
    item_ids: itemIds,
  });
}

export async function archiveSlambook(slambookId: string): Promise<void> {
  await api.post(`/v1/memories/slambooks/${slambookId}/archive`);
}

export async function getSlambookByShareToken(
  token: string,
  viewerUserId?: string,
): Promise<SlambookDetail> {
  const response = await api.get(`/v1/memories/share/${token}`, viewerHeaders(viewerUserId));
  return unwrapDataMap<SlambookDetail>(response.data);
}

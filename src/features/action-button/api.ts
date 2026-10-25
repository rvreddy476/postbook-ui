/*
  The Action button's own requests, axios only. Bodies and decoders come
  from model.ts / links.ts (where the tests are); this file only sends them.
  The post create and edit carry `action` through their own adapters
  (post-compose, the upload studio, the Hub); the profile button goes with
  PATCH /v1/channels/me through useUpdateChannel.
*/

import api from "@/lib/api"

import { decodeLink, type LinkTarget } from "./links"
import { toActionLabels, toActionStats, type ActionLabelOption, type ActionStats } from "./model"

export async function fetchActionLabels(): Promise<ActionLabelOption[]> {
  const res = await api.get("/v1/posts/action-labels")
  return toActionLabels(res.data)
}

function status(err: unknown): number {
  return (err as { response?: { status?: number } })?.response?.status ?? 0
}

/** GET /v1/links/:id; null when the link is gone (404) or not one we may open. */
export async function fetchLink(id: string): Promise<LinkTarget | null> {
  try {
    const res = await api.get(`/v1/links/${encodeURIComponent(id)}`)
    return decodeLink(res.data)
  } catch (err) {
    if (status(err) === 404 || status(err) === 410) return null
    throw err
  }
}

export async function fetchActionStats(postId: string): Promise<ActionStats> {
  const res = await api.get(`/v1/posts/${encodeURIComponent(postId)}/action/stats`)
  return toActionStats(res.data)
}

/** The profile/channel button, read from GET /v1/channels/:ref when the profile payload does not carry it. */
export async function fetchChannelAction(ref: string): Promise<unknown> {
  try {
    const res = await api.get(`/v1/channels/${encodeURIComponent(ref)}`)
    const data = (res.data as { data?: { action?: unknown } } | undefined)?.data
    return data?.action ?? null
  } catch (err) {
    if (status(err) === 404) return null
    throw err
  }
}

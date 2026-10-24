import { UUID_RE } from '@/lib/graphApi'

/*
  Incoming follow requests for a private account (graph-service
  internal/http/handler.go, "Follow requests (private accounts)").

    GET  /v1/graph/follow-requests/incoming?limit=&cursor=
         -> {"data":[{"requester_id","created_at"}],"meta":{"next_cursor"}}
            newest first; next_cursor is absent on the last page.
    POST /v1/graph/follow-requests/:requesterId/accept   -> {"data":{"status":"accepted"}}
    POST /v1/graph/follow-requests/:requesterId/decline  -> {"data":{"status":"declined"}}
         404 NOT_FOUND when nothing is pending from that person any more.

  The rows carry ids only, so the names and faces come from the profile
  batch route. X-User-Id (the signed-in viewer) is the target on every
  call, so there is no target id to send.
*/

export const FOLLOW_REQUESTS_PAGE_SIZE = 20

export interface FollowRequestRow {
  requester_id: string
  created_at: string
}

export interface FollowRequestPage {
  items: FollowRequestRow[]
  /** null = the last page. */
  next_cursor: string | null
}

export interface FollowRequestEntry {
  user_id: string
  display_name: string
  username?: string
  avatar_media_id?: string
  created_at: string
}

export type FollowRequestDecision = 'accept' | 'decline'

export function followRequestsListPath(cursor: string | null, limit = FOLLOW_REQUESTS_PAGE_SIZE): string {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  if (cursor) params.set('cursor', cursor)
  return `/v1/graph/follow-requests/incoming?${params}`
}

/** The accept / decline route for one requester; a non-UUID id is refused before any request. */
export function followRequestActionPath(requesterId: string, decision: FollowRequestDecision): string {
  if (!UUID_RE.test(requesterId)) throw new Error('That request could not be found.')
  return `/v1/graph/follow-requests/${encodeURIComponent(requesterId)}/${decision}`
}

/** One page of the incoming list. A row without a UUID requester is skipped, not fatal. */
export function decodeFollowRequestPage(value: unknown): FollowRequestPage {
  const envelope = value as { data?: unknown; meta?: { next_cursor?: unknown } | null } | null
  if (!envelope || typeof envelope !== 'object' || !Array.isArray(envelope.data)) {
    throw new Error('Follow requests could not be loaded. Please try again.')
  }
  const items: FollowRequestRow[] = []
  const seen = new Set<string>()
  for (const raw of envelope.data) {
    const r = raw as Record<string, unknown> | null
    if (!r || typeof r.requester_id !== 'string' || !UUID_RE.test(r.requester_id)) continue
    if (seen.has(r.requester_id)) continue
    seen.add(r.requester_id)
    items.push({ requester_id: r.requester_id, created_at: typeof r.created_at === 'string' ? r.created_at : '' })
  }
  const next = envelope.meta?.next_cursor
  return { items, next_cursor: typeof next === 'string' && next ? next : null }
}

interface ProfileLite {
  display_name?: string
  username?: string
  avatar_media_id?: string
}

/**
 * The profile batch answer, in any of the shapes it has had: {profiles:[…]},
 * {data:{profiles:[…]}}, or an id-keyed map (bare or under data).
 */
export function decodeProfileBatch(value: unknown): Map<string, ProfileLite> {
  const out = new Map<string, ProfileLite>()
  const root = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  if (!root) return out
  const body = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root
  const pick = (p: Record<string, unknown>): ProfileLite => ({
    display_name: typeof p.display_name === 'string' ? p.display_name : undefined,
    username: typeof p.username === 'string' ? p.username : undefined,
    avatar_media_id: typeof p.avatar_media_id === 'string' && p.avatar_media_id ? p.avatar_media_id : undefined,
  })
  if (Array.isArray(body.profiles)) {
    for (const raw of body.profiles) {
      const p = raw as Record<string, unknown> | null
      const id = p && (typeof p.user_id === 'string' ? p.user_id : typeof p.id === 'string' ? p.id : undefined)
      if (p && id) out.set(id, pick(p))
    }
    return out
  }
  for (const [key, raw] of Object.entries(body)) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) out.set(key, pick(raw as Record<string, unknown>))
  }
  return out
}

/** A row with its person; an unknown profile reads "Someone", never a blank. */
export function toFollowRequestEntry(row: FollowRequestRow, profile: ProfileLite | undefined): FollowRequestEntry {
  return {
    user_id: row.requester_id,
    display_name: profile?.display_name?.trim() || profile?.username?.trim() || 'Someone',
    username: profile?.username?.trim() || undefined,
    avatar_media_id: profile?.avatar_media_id,
    created_at: row.created_at,
  }
}

export interface FollowRequestHttp {
  get: (path: string) => Promise<unknown>
  post: (path: string, body?: unknown) => Promise<unknown>
}

export interface FollowRequestLoad {
  items: FollowRequestEntry[]
  next_cursor: string | null
}

/** One page of incoming requests, with names. A failed name lookup still shows the requests. */
export async function loadFollowRequests(http: FollowRequestHttp, cursor: string | null, limit = FOLLOW_REQUESTS_PAGE_SIZE): Promise<FollowRequestLoad> {
  const page = decodeFollowRequestPage(await http.get(followRequestsListPath(cursor, limit)))
  let profiles = new Map<string, ProfileLite>()
  if (page.items.length > 0) {
    try {
      profiles = decodeProfileBatch(await http.post('/v1/profiles/batch', { user_ids: page.items.map((r) => r.requester_id) }))
    } catch {
      // Names are a nicety; the request can still be answered.
    }
  }
  return { items: page.items.map((r) => toFollowRequestEntry(r, profiles.get(r.requester_id))), next_cursor: page.next_cursor }
}

/** Accept or decline one request. */
export async function respondToFollowRequest(http: FollowRequestHttp, requesterId: string, decision: FollowRequestDecision): Promise<void> {
  await http.post(followRequestActionPath(requesterId, decision))
}

/** Every entry of every page once, in order. */
export function flattenFollowRequestPages(pages: readonly FollowRequestLoad[]): FollowRequestEntry[] {
  const seen = new Set<string>()
  const out: FollowRequestEntry[] = []
  for (const page of pages) {
    for (const e of page.items) {
      if (seen.has(e.user_id)) continue
      seen.add(e.user_id)
      out.push(e)
    }
  }
  return out
}

/** Drops one answered requester from every cached page. */
export function removeFollowRequest(pages: readonly FollowRequestLoad[], requesterId: string): FollowRequestLoad[] {
  return pages.map((p) => ({ ...p, items: p.items.filter((e) => e.user_id !== requesterId) }))
}

/**
 * The notification types that are a follow request, and so get Accept /
 * Decline in place. notification-service emits `follow_request`; the
 * event names are kept in case a row arrives under one. Exact matches only:
 * `follow_request_accepted` is the answer coming back, not a request.
 */
export const FOLLOW_REQUEST_NOTIFICATION_TYPES: readonly string[] = [
  'follow_request',
  'user.follow_requested',
  'graph.follow_requested',
]

export function isFollowRequestNotification(type: string, actorId: string | undefined): boolean {
  return FOLLOW_REQUEST_NOTIFICATION_TYPES.includes(type) && !!actorId && UUID_RE.test(actorId)
}

/** The Requests tab badge: both kinds pending; "20+" style when more pages exist. null for none. */
export function requestsBadgeText(followCount: number, followHasMore: boolean, connectionCount: number): string | null {
  const total = Math.max(0, followCount) + Math.max(0, connectionCount)
  if (total < 1) return null
  if (total > 99) return '99+'
  return followHasMore ? `${total}+` : String(total)
}

/** A sentence for a refused accept / decline. */
export function followRequestErrorCopy(err: unknown): string {
  const response = err && typeof err === 'object' && 'response' in err
    ? (err as { response?: { status?: number; data?: { error?: { code?: unknown } } } }).response
    : undefined
  const code = response?.data?.error?.code
  if (code === 'NOT_FOUND' || response?.status === 404) return 'This request is no longer pending.'
  if (code === 'RATE_LIMITED' || response?.status === 429) return 'Too many changes at once. Wait a moment and try again.'
  if (err && typeof err === 'object' && 'isAxiosError' in err && !response) return 'You seem to be offline. Check your connection and try again.'
  return 'That request couldn’t be updated. Please try again.'
}

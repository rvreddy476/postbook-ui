/*
  The Requests folder (DM consent contract §5): incoming message requests,
  paged, with a "Hidden requests" variant and a count for the badge.

  GET /v1/chat/requests
    ?limit=N                1..100
    &cursor=C               opaque, from meta.next_cursor
    &filtered=true|false    Hidden requests, or the normal list
    &direction=incoming     the server's default now; sent anyway
    &filter=filtered        legacy name of filtered=true, for an older server
    &offset=K               legacy paging, only when no cursor ever came back
  → {data: [row…], meta: {next_cursor, has_more}}, newest request first.
    Rows carry `preview` (the request's message) and `requested_at`.

  GET /v1/chat/requests/count
  → {data: {count, filtered_count, capped}}: the Requests badge and the
    Hidden requests count; "999+" when capped.

  An older server without cursors pages by offset: a full page means "ask
  again with the next offset", and a page that adds nothing stops paging
  rather than looping.
*/

import { arr, decodeInboxRow, nextCursorOf, unwrap, type InboxRow } from './contract'
import { isIncomingRequest, withoutDating } from './inbox'

export type RequestsFilter = 'all' | 'filtered'

export const REQUESTS_PAGE = 30

/** Where the next page starts. Null when there is nothing more. `{offset: 0}` is the first page. */
export type RequestsCursor = { cursor: string } | { offset: number } | null

export const FIRST_REQUESTS_PAGE: Exclude<RequestsCursor, null> = { offset: 0 }

export function requestsQuery(filter: RequestsFilter, at: Exclude<RequestsCursor, null>, limit = REQUESTS_PAGE): string {
  const q = new URLSearchParams({ limit: String(Math.min(100, Math.max(1, limit))), direction: 'incoming' })
  q.set('filtered', filter === 'filtered' ? 'true' : 'false')
  if (filter === 'filtered') q.set('filter', 'filtered')
  if ('cursor' in at) q.set('cursor', at.cursor)
  else if (at.offset > 0) q.set('offset', String(at.offset))
  return q.toString()
}

export interface RequestsPage {
  rows: InboxRow[]
  nextCursor: string | null
  /** meta.has_more; null from a server that does not say. */
  hasMore: boolean | null
  /** Rows the server returned, before this client dropped any. */
  received: number
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

/**
 * One page of the Requests list, incoming only. A row says its own
 * `direction`; without it a request is incoming when someone else created
 * it. The request's own message (`preview`) is what the row shows. Dating
 * chats never show here.
 */
export function decodeRequestsPage(body: unknown, myId: string): RequestsPage {
  const data = unwrap(body)
  const d = obj(data)
  const list = Array.isArray(data) ? data : d ? arr(d.items ?? d.requests ?? d.conversations) : []
  const rows: InboxRow[] = []
  for (const raw of list) {
    let row = decodeInboxRow(raw, myId)
    if (!row) continue
    const r = obj(raw)!
    const direction = r.direction
    const incoming =
      direction === 'incoming' ? true : direction === 'outgoing' ? false : isIncomingRequest({ ...row, isRequest: true }, myId)
    if (!incoming) continue
    const preview = str(r.preview)
    const requestedAt = str(r.requested_at)
    if (preview) {
      row = {
        ...row,
        lastMessage: { type: 'text', preview, senderId: row.peer?.userId ?? null, at: requestedAt ?? row.lastMessage?.at ?? null, ownStatus: null },
      }
    }
    if (requestedAt && !row.lastMessageAt) row = { ...row, lastMessageAt: requestedAt }
    rows.push({ ...row, isRequest: true })
  }
  const meta = obj(obj(body)?.meta)
  return {
    rows: withoutDating(rows),
    nextCursor: nextCursorOf(body),
    hasMore: typeof meta?.has_more === 'boolean' ? meta.has_more : null,
    received: list.length,
  }
}

/**
 * Where the page after `page` starts. `at` is where `page` started; `added`
 * is how many of its rows were new to the list.
 */
export function nextRequestsCursor(page: RequestsPage, at: Exclude<RequestsCursor, null>, added: number, limit = REQUESTS_PAGE): RequestsCursor {
  if (page.hasMore === false) return null
  if (page.nextCursor) return { cursor: page.nextCursor }
  // An older server: offset paging.
  if (added === 0 || page.received < limit) return null
  const offset = 'offset' in at ? at.offset : 0
  return { offset: offset + page.received }
}

/** Append a page, keeping the server's order and each request once. */
export function mergeRequestPages(current: readonly InboxRow[], incoming: readonly InboxRow[]): { rows: InboxRow[]; added: number } {
  const seen = new Set(current.map((r) => r.id))
  const rows = current.slice()
  let added = 0
  for (const r of incoming) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    rows.push(r)
    added++
  }
  return { rows, added }
}

export function withoutRequest(rows: readonly InboxRow[], conversationId: string): InboxRow[] {
  return rows.filter((r) => r.id !== conversationId)
}

/* ---- Count (GET /requests/count) ---------------------------------- */

export interface RequestCount {
  count: number
  filteredCount: number
  /** The server stopped counting; the badge says "999+". */
  capped: boolean
}

function n(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}

/** `{data: {count, filtered_count, capped}}`; null when the body is not one. */
export function decodeRequestCount(body: unknown): RequestCount | null {
  const d = obj(unwrap(body))
  if (!d || typeof d.count !== 'number') return null
  return { count: n(d.count), filteredCount: n(d.filtered_count), capped: d.capped === true }
}

export const REQUEST_COUNT_CAP_TEXT = '999+'

/** Where the server stops counting. */
export const REQUEST_COUNT_CAP = 999

/**
 * The badge's words: the number, "999+" for a count the server capped, ''
 * for none. `capped` is one flag for the response, so it only turns a count
 * that reached the cap into "999+", never a small one.
 */
export function requestCountText(count: number, capped: boolean): string {
  if (capped && count >= REQUEST_COUNT_CAP) return REQUEST_COUNT_CAP_TEXT
  return count > 0 ? String(count) : ''
}

/**
 * The "Message requests" row's second line when no visible request waits:
 * the safety filter's Hidden requests still name themselves, so they are
 * never out of sight (founder, 2026-10-20). '' when nothing waits at all.
 */
export function hiddenRequestsLine(hidden: number, hiddenText: string): string {
  if (hidden <= 0) return ''
  return hidden === 1 ? '1 hidden request' : `${hiddenText || hidden} hidden requests`
}

/** The badge count: the count route's number when there is one, else the rows loaded. */
export function requestBadgeCount(count: number | null, loaded: readonly InboxRow[]): number {
  return count ?? loaded.length
}

/**
 * After a request leaves a list, its count drops with it. A capped count is
 * left alone (it is a floor, not a total); the next count read corrects it.
 */
export function decrementCount(count: RequestCount | null, filtered: boolean): RequestCount | null {
  if (!count || count.capped) return count
  return filtered
    ? { ...count, filteredCount: Math.max(0, count.filteredCount - 1) }
    : { ...count, count: Math.max(0, count.count - 1) }
}

/* ---- Realtime --------------------------------------------------------- */

/**
 * A `message_request_removed` frame (sent to the recipient when a request
 * expires): the conversation id, from the top level or the payload.
 */
export function decodeRequestRemovedFrame(frame: unknown): { conversationId: string; reason: string | null } | null {
  const f = obj(frame)
  if (!f || f.type !== 'message_request_removed') return null
  const p = obj(f.payload) ?? obj(f.data) ?? f
  const conversationId = str(p.conversation_id) ?? str(f.conversation_id)
  if (!conversationId) return null
  return { conversationId, reason: str(p.reason) ?? str(f.reason) }
}

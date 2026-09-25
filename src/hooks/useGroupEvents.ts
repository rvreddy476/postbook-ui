"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type {
  GroupEvent,
  GroupEventCreateInput,
  GroupEventRSVPStatus,
} from "@/types/groups"

interface EventsResponse { data: GroupEvent[] | null }
interface EventResponse { data: GroupEvent }

/** The store clamps anything outside 1..100 back to 20, so this is the real ceiling. */
const PAGE_SIZE = 100

/**
 * How many pages we will walk before giving up. 20 pages is 2,000 events; a
 * group with more history than that gets its oldest events cut, which is the
 * harmless end to cut.
 */
const MAX_PAGES = 20

// === QUERIES ===

/**
 * Every event of one group.
 *
 * Three server behaviours are absorbed here rather than at each call site:
 *
 * `?? []` is load-bearing, not defensive. ListGroupEvents builds
 * `var events []GroupEvent`, appends nothing when the group has no events, and
 * the handler hands that nil slice to the JSON encoder — which writes
 * `"data": null`, not `[]`. Without the fallback the first render of an empty
 * group calls `.map` on null and the whole tab throws.
 *
 * The order is `ORDER BY start_at ASC`, which puts PAST events first. Nothing
 * here re-sorts: partitionEvents in GroupEventsTab owns that, so the raw server
 * order stays inspectable in the cache.
 *
 * And that ascending order is why this walks the pages instead of asking for
 * one. A single page of the FIRST N rows is a page of the group's OLDEST
 * events: a group with 120 past meetups and one next Tuesday would answer a
 * `limit=100&offset=0` request with a hundred finished events and none of the
 * future. "Upcoming" would render empty while an upcoming event existed. There
 * is no `ORDER BY start_at DESC` and no filter for future-only, so the only way
 * to be sure the future is in hand is to read to the end of the list.
 *
 * A short page ends the walk; MAX_PAGES bounds it for a group whose history is
 * pathological.
 */
export function useGroupEvents(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-events", groupId],
    queryFn: async () => {
      const all: GroupEvent[] = []
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const res = await api.get<EventsResponse>(`/v1/groups/${groupId}/events`, {
          params: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
        })
        const batch = res.data.data ?? []
        all.push(...batch)
        if (batch.length < PAGE_SIZE) break
      }
      return all
    },
    enabled: !!groupId,
  })
}

/**
 * One event by id. The route exists and enforces that the event belongs to the
 * group in the path, so a stale id from another group reads as not-found rather
 * than leaking across groups.
 */
export function useGroupEvent(groupId: string | undefined, eventId: string | undefined) {
  return useQuery({
    queryKey: ["group-event", groupId, eventId],
    queryFn: async () => {
      const res = await api.get<EventResponse>(`/v1/groups/${groupId}/events/${eventId}`)
      return res.data.data
    },
    enabled: !!groupId && !!eventId,
  })
}

// === MUTATIONS ===

/**
 * Create an event. Restricted server-side to owner / admin / moderator — a
 * member gets a 403 — so the affordance that reaches this must be gated on the
 * viewer's role, not merely on membership.
 */
export function useCreateGroupEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, ...payload }: { groupId: string } & GroupEventCreateInput) => {
      const res = await api.post<EventResponse>(`/v1/groups/${groupId}/events`, payload)
      return res.data.data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["group-events", vars.groupId] })
    },
  })
}

/**
 * Cancel an event. DELETE is a soft cancel — it sets `status = 'cancelled'`,
 * and every read filters those out — so the row survives but the event
 * disappears from the tab. There is no undo route.
 */
export function useDeleteGroupEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, eventId }: { groupId: string; eventId: string }) => {
      await api.delete(`/v1/groups/${groupId}/events/${eventId}`)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["group-events", vars.groupId] })
      qc.invalidateQueries({ queryKey: ["group-event", vars.groupId, vars.eventId] })
    },
  })
}

/**
 * RSVP to an event.
 *
 * The response is `{ok: true}` and carries no counts, and there is no route
 * that reads back the caller's own RSVP, so the refetch triggered here is the
 * only way the new counts arrive. `not_going` moves no counter at all — the
 * store only touches going_count and maybe_count — so a switch to not_going
 * decrements whichever count you were in and increments nothing.
 *
 * Requires membership and `rsvp_enabled`; both 403/400 rather than failing
 * quietly, so the buttons are hidden when either does not hold.
 */
export function useRSVPGroupEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId,
      eventId,
      status,
    }: {
      groupId: string
      eventId: string
      status: GroupEventRSVPStatus
    }) => {
      await api.post(`/v1/groups/${groupId}/events/${eventId}/rsvp`, { status })
      return status
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["group-events", vars.groupId] })
      qc.invalidateQueries({ queryKey: ["group-event", vars.groupId, vars.eventId] })
    },
  })
}

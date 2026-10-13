import { describe, expect, test } from "bun:test"
import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { DoorstepApiError } from "../../api/client"
import { partnerProfileOptions, shouldRefreshPartner, PARTNER_STATUS_REFRESH_MS } from "../profileQuery"
import { decodePartner } from "../model"
import { LENIENT } from "../../model/decode"

function partner(status = "pending_verification") {
  return decodePartner({ id: "p", user_id: "u", status, display_name: "Test Partner", city_code: "HYD", gender: null, photo_media_id: null, rating_avg: null, rating_count: 0, jobs_completed: 0, max_jobs_per_day: 6, created_at: "now", updated_at: "now" }, LENIENT)
}
const missing = () => new DoorstepApiError(404, "DOORSTEP_PRO_NOT_FOUND", "Not applied yet", true)

describe("partner application refresh", () => {
  test("a new applicant stays in a successful empty state while rechecking, never a loading screen", async () => {
    const client = new QueryClient()
    let release: (() => void) | undefined
    let delay = false
    const options = partnerProfileOptions("u", async () => {
      if (delay) await new Promise<void>(resolve => { release = resolve })
      throw missing()
    })
    const observer = new QueryObserver(client, options)
    const unsubscribe = observer.subscribe(() => {})
    try {
      await observer.refetch()
      expect(observer.getCurrentResult().data).toBeNull()
      expect(observer.getCurrentResult().status).toBe("success")
      delay = true
      const pending = observer.refetch()
      expect(observer.getCurrentResult().isFetching).toBe(true)
      expect(observer.getCurrentResult().isPending).toBe(false)
      expect(observer.getCurrentResult().data).toBeNull()
      release?.()
      await pending
      expect(observer.getCurrentResult().isPending).toBe(false)
      expect(observer.getCurrentResult().data).toBeNull()
    } finally { unsubscribe(); client.clear() }
  })

  test("drafts and new applications disable timer, focus and reconnect refetches", () => {
    for (const value of [null, partner("draft")]) {
      const client = new QueryClient()
      const options = partnerProfileOptions("u", async () => partner())
      client.setQueryData(options.queryKey, value)
      const query = client.getQueryCache().find({ queryKey: options.queryKey })!
      expect(typeof options.refetchInterval === "function" && options.refetchInterval(query)).toBe(false)
      expect(typeof options.refetchOnWindowFocus === "function" && options.refetchOnWindowFocus(query)).toBe(false)
      expect(typeof options.refetchOnReconnect === "function" && options.refetchOnReconnect(query)).toBe(false)
      client.clear()
    }
  })

  test("submission invalidates the same query and enables approval checks without navigation", async () => {
    const client = new QueryClient()
    let submitted = false
    const options = partnerProfileOptions("u", async () => { if (!submitted) throw missing(); return partner() })
    const observer = new QueryObserver(client, options)
    const unsubscribe = observer.subscribe(() => {})
    try {
      await observer.refetch()
      expect(observer.getCurrentResult().data).toBeNull()
      submitted = true
      await client.invalidateQueries({ queryKey: ["doorstep", "partner", "u"] })
      expect(observer.getCurrentResult().data?.status).toBe("pending_verification")
      const query = client.getQueryCache().find({ queryKey: options.queryKey })!
      expect(typeof options.refetchInterval === "function" && options.refetchInterval(query)).toBe(PARTNER_STATUS_REFRESH_MS)
      expect(typeof options.refetchOnWindowFocus === "function" && options.refetchOnWindowFocus(query)).toBe(true)
    } finally { unsubscribe(); client.clear() }
  })

  test("real failures are not treated as an empty application", async () => {
    for (const error of [new DoorstepApiError(404, "NOT_FOUND", "Unavailable", true), new DoorstepApiError(401, "UNAUTHORIZED", "Sign in", true), new DoorstepApiError(503, "UNAVAILABLE", "Try again", true)]) {
      const client = new QueryClient()
      try { await expect(client.fetchQuery(partnerProfileOptions("u", async () => { throw error }))).rejects.toBe(error) }
      finally { client.clear() }
    }
  })

  test("the query is isolated per account and disabled when signed out", () => {
    expect(partnerProfileOptions(undefined, async () => partner()).enabled).toBe(false)
    expect(partnerProfileOptions("u", async () => partner()).queryKey).not.toEqual(partnerProfileOptions("other", async () => partner()).queryKey)
    expect(shouldRefreshPartner(undefined)).toBe(false)
    expect(shouldRefreshPartner(partner("approved"))).toBe(true)
  })
})

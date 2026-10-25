import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

import {
  FOLLOW_REQUESTS_PATH,
  creditNotificationHref,
  decodeNotificationPage,
  followRequestNotificationCopy,
} from "@/lib/notificationInbox"
import { isFollowRequestNotification } from "@/lib/followRequests"
import { inboxTabFromParam } from "@/lib/activityInbox"
import { ActivityList } from "../ActivityList"
import { FollowRequestInlineView } from "../FollowRequestActions"

/*
  notification-service's two follow-request types:
    follow_request           "{requester} requested to follow you" → /notifications?tab=requests
    follow_request_accepted  "{name} accepted your follow request" → their profile
*/

const ADA = "3f1c2a8e-5b6d-4e7f-8a9b-0c1d2e3f4a5b"
const row = (fields: Record<string, unknown>) => ({
  notification_id: "n1",
  type: "follow_request",
  bucket: 202610,
  ts: "2026-10-24T09:00:00Z",
  created_at: "2026-10-24T09:00:00Z",
  is_read: false,
  actor_user_id: ADA,
  actor: { id: ADA, username: "ada", display_name: "Ada Lovelace" },
  ...fields,
})
const decode = (fields: Record<string, unknown>) => decodeNotificationPage({ data: [row(fields)] }).notifications[0]

describe("follow_request", () => {
  test("names the requester and opens the Requests tab", () => {
    const n = decode({ deep_link: "/notifications?tab=requests" })
    expect(n.title).toBe("Ada Lovelace requested to follow you")
    expect(n.body).toBe("Accept or decline their request.")
    expect(n.deep_link).toBe("/notifications?tab=requests")
    expect(FOLLOW_REQUESTS_PATH).toBe("/notifications?tab=requests")
  })

  test("opens the Requests tab whatever link the row carries, or with none", () => {
    expect(decode({ deep_link: "/u/ada" }).deep_link).toBe(FOLLOW_REQUESTS_PATH)
    expect(decode({}).deep_link).toBe(FOLLOW_REQUESTS_PATH)
    expect(creditNotificationHref("follow_request", "/u/ada")).toBe(FOLLOW_REQUESTS_PATH)
    expect(creditNotificationHref("follow_request", undefined)).toBe(FOLLOW_REQUESTS_PATH)
  })

  test("the server's sentence wins; no actor reads Someone", () => {
    expect(decode({ title: "Ada requested to follow you." }).title).toBe("Ada requested to follow you.")
    expect(decode({ actor: undefined, actor_user_id: undefined }).title).toBe("Someone requested to follow you")
    expect(decode({ actor: { id: ADA, username: "ada" } }).title).toBe("ada requested to follow you")
  })

  test("the row gets Accept / Decline in place, by its type", () => {
    const n = decode({})
    expect(isFollowRequestNotification(n.type, n.actor_id)).toBe(true)
    const html = renderToStaticMarkup(
      <ActivityList
        notifications={[n]}
        onOpen={() => undefined}
        renderActions={(x) => (isFollowRequestNotification(x.type, x.actor_id)
          ? <FollowRequestInlineView state={{ kind: "idle" }} actorName={x.actor_name} onAnswer={() => undefined} />
          : null)}
      />,
    )
    expect(html).toContain('aria-label="Accept follow request from Ada Lovelace"')
    expect(html).toContain('aria-label="Decline follow request from Ada Lovelace"')
    expect(html).toContain('href="/notifications?tab=requests"')
  })

  test("the Activity page wires the inline answer to that match", () => {
    const src = readFileSync(join(import.meta.dir, "..", "page.tsx"), "utf8")
    expect(src).toContain("isFollowRequestNotification(n.type, n.actor_id)")
    expect(src).toContain("<FollowRequestInlineActions requesterId={n.actor_id}")
  })
})

describe("follow_request_accepted", () => {
  test("names who accepted and opens the row's profile link", () => {
    const n = decode({ type: "follow_request_accepted", deep_link: "/u/ada" })
    expect(n.title).toBe("Ada Lovelace accepted your follow request")
    expect(n.body).toBe("You can now see their posts.")
    expect(n.deep_link).toBe("/u/ada")
  })

  test("no link: the actor's profile, by handle then by id", () => {
    expect(decode({ type: "follow_request_accepted" }).deep_link).toBe("/u/ada")
    expect(decode({ type: "follow_request_accepted", actor: { id: ADA, display_name: "Ada" } }).deep_link).toBe(`/u/${ADA}`)
    expect(followRequestNotificationCopy("follow_request_accepted", undefined, undefined)?.link).toBeUndefined()
  })

  test("an unsafe link is dropped, never followed", () => {
    expect(decode({ type: "follow_request_accepted", deep_link: "https://evil.example/u/ada" }).deep_link).toBe("/u/ada")
    expect(creditNotificationHref("follow_request_accepted", "//evil.example")).toBeUndefined()
    expect(creditNotificationHref("follow_request_accepted", "momentum://u/ada")).toBe("/u/ada")
    expect(creditNotificationHref("follow_request_accepted", undefined)).toBeUndefined()
  })

  test("is not a request: no Accept / Decline", () => {
    const n = decode({ type: "follow_request_accepted" })
    expect(isFollowRequestNotification(n.type, n.actor_id)).toBe(false)
  })
})

test("other types are untouched", () => {
  expect(followRequestNotificationCopy("follow", "Ada", undefined)).toBeNull()
  expect(decode({ type: "follow" }).title).toBe("New follower")
})

describe("/notifications?tab=requests opens the Requests tab", () => {
  test("the address names the tab; unknown or none is All", () => {
    expect(inboxTabFromParam("requests")).toBe("requests")
    expect(inboxTabFromParam(new URLSearchParams(FOLLOW_REQUESTS_PATH.split("?")[1]).get("tab"))).toBe("requests")
    expect(inboxTabFromParam("followers")).toBe("followers")
    expect(inboxTabFromParam("nope")).toBe("all")
    expect(inboxTabFromParam(null)).toBe("all")
    expect(inboxTabFromParam(undefined)).toBe("all")
  })

  test("the page follows the address on every change, not only on mount", () => {
    const src = readFileSync(join(import.meta.dir, "..", "page.tsx"), "utf8")
    expect(src).toContain("useSearchParams().get('tab')")
    expect(src).toContain("useEffect(() => onTab(inboxTabFromParam(tab)), [tab, onTab])")
    expect(src).toMatch(/<Suspense fallback=\{null\}>\s*<TabFromAddress onTab=\{setTab\} \/>/)
  })
})

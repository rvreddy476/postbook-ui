import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { creditNotificationHref, decodeNotificationPage } from "@/lib/notificationInbox"
import { cardMetadata, noteCard, resolveShareBases, type WirePost } from "@/features/share/siteMeta"

import { echoNoteIdFromLink, echoNotificationCopy, echoNotificationHref } from "../notifications"
import { readFixture } from "./contractFixtures"

const NOTE = "f1111111-1111-4111-8111-111111111111"

function row(type: string, deepLink: string, extra: Record<string, unknown> = {}) {
  return { notification_id: "n1", type, deep_link: deepLink, bucket: 1, ts: "t", created_at: "2026-11-12T09:30:00Z", is_read: false, ...extra }
}

describe("note_reply and note_quote open the note", () => {
  test("the app link momentum://echo/note/{id} becomes /echo/note/{id} in the inbox", () => {
    const { notifications } = decodeNotificationPage({
      data: [
        row("note_reply", `momentum://echo/note/${NOTE}`, { actor: { id: "b2222222-2222-4222-8222-222222222222", display_name: "Bob Das" } }),
        row("note_quote", `/echo/note/${NOTE}`, { title: "Alice Rao quoted your note" }),
      ],
    })
    expect(notifications[0]).toMatchObject({ title: "Bob Das replied to your note", deep_link: `/echo/note/${NOTE}` })
    expect(notifications[1]).toMatchObject({ title: "Alice Rao quoted your note", deep_link: `/echo/note/${NOTE}` })
  })

  test("the bell menus resolve the same place", () => {
    expect(creditNotificationHref("note_reply", `momentum://echo/note/${NOTE}`)).toBe(`/echo/note/${NOTE}`)
    expect(creditNotificationHref("note_quote", `/echo/note/${NOTE}`)).toBe(`/echo/note/${NOTE}`)
  })

  test("only an Echo note path is kept; any other link is not an Echo destination", () => {
    expect(echoNoteIdFromLink(`/echo/note/${NOTE}`)).toBe(NOTE)
    expect(echoNoteIdFromLink("/echo/note/../../admin")).toBeNull()
    expect(echoNoteIdFromLink("https://evil.example/echo/note/x")).toBeNull()
    expect(echoNotificationHref("note_reply", "/settings")).toBeUndefined()
    expect(echoNotificationHref("comment", `/echo/note/${NOTE}`)).toBeUndefined()
    expect(echoNotificationCopy("post.liked", "x", undefined, undefined)).toBeNull()
    expect(echoNotificationCopy("note_quote", undefined, undefined, undefined)?.title).toBe("Someone quoted your note")
  })
})

describe("web push opens the note too", () => {
  const SOURCE = readFileSync(join(import.meta.dir, "..", "..", "..", "..", "public", "push-sw.js"), "utf8")
  function show(deepLink: string) {
    const listeners = new Map<string, (event: unknown) => void>()
    const shown: { options: { data: { path: string | null } } }[] = []
    const self = {
      location: { origin: "https://app.example" },
      addEventListener: (type: string, fn: (event: unknown) => void) => void listeners.set(type, fn),
      skipWaiting: () => undefined,
      registration: { showNotification: async (_t: string, options: { data: { path: string | null } }) => void shown.push({ options }) },
      clients: { claim: async () => undefined, matchAll: async () => [], openWindow: async () => undefined },
    }
    new Function("self", SOURCE)(self)
    let pending: Promise<unknown> = Promise.resolve()
    listeners.get("push")!({ data: { json: () => ({ data: { type: "note_reply", deep_link: deepLink } }) }, waitUntil: (p: Promise<unknown>) => void (pending = p) })
    return pending.then(() => shown[0].options.data.path)
  }

  test("momentum://echo/note/{id} only; other app links stay dropped", async () => {
    expect(await show(`momentum://echo/note/${NOTE}`)).toBe(`/echo/note/${NOTE}`)
    expect(await show("momentum://echo/note/../x")).toBeNull()
    expect(await show("momentum://doorstep/bookings/b1")).toBeNull()
  })
})

describe("the link preview of /echo/note/<id>", () => {
  const bases = resolveShareBases({ siteUrl: "https://cleestudio.com", apiBaseUrl: "https://api.example" })
  const wire = (readFixture("note") as { data: WirePost }).data

  test("a public note: the author, its words, its first picture", () => {
    const card = noteCard(wire, bases)!
    expect(card.title).toBe("Alice Rao (@alice) on Echo")
    expect(card.description).toBe("Rain all week in #Bengaluru")
    expect(card.path).toBe(`/echo/note/${NOTE}`)
    expect(card.image?.url).toBe("https://api.example/v1/media/e1111111-1111-4111-8111-111111111111/serve")
    const meta = cardMetadata(card, bases)
    expect(meta.openGraph).toMatchObject({ type: "article", url: `https://cleestudio.com/echo/note/${NOTE}` })
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" })
  })

  test("nothing a stranger may not see, and nothing that is not a note", () => {
    expect(noteCard(null, bases)).toBeNull()
    expect(noteCard({ ...wire, visibility: "followers" }, bases)).toBeNull()
    expect(noteCard({ ...wire, content_type: "post" }, bases)).toBeNull()
    expect(noteCard({ ...wire, id: "../x" }, bases)).toBeNull()
  })
})

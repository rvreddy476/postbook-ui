import { describe, expect, test } from "bun:test"
import { NextRequest } from "next/server"

import { ALL_MORE_ITEMS, ALL_PRIMARY_ITEMS, launchedItems, moreItems, primaryItems } from "@/components/sidebarNav"
import { visibleProfileTabKeys } from "@/components/profile/ProfileTabs"
import { ALL_APP_LAUNCHER, APP_LAUNCHER, launchedTiles } from "@/lib/appBrand"
import {
  PRODUCT_KEYS,
  hiddenAppKeys,
  hiddenNavIds,
  parseFeatures,
  productEntryVisible,
  productForPath,
  productPageAvailable,
  type ProductFlags,
  type ProductKey,
} from "@/lib/productFeatures"
import { middleware } from "@/middleware"

/*
  Echo is a parked product, switched off on the server. Security-relevant:
  while GET /v1/features says echo is closed — or has not answered, or
  failed — no way into Echo may show anywhere, and /echo routes render the
  closed-product page. When it is open, the ways in come back.
*/

function body(open: Partial<Record<ProductKey, boolean>>) {
  return { data: { products: Object.fromEntries(PRODUCT_KEYS.map((k) => [k, { enabled: open[k] ?? false }])) } }
}
const allClosed = parseFeatures(body({})) as ProductFlags
const echoOnly = parseFeatures(body({ echo: true })) as ProductFlags
const allOpenButEcho = parseFeatures(body(Object.fromEntries(PRODUCT_KEYS.map((k) => [k, k !== "echo"])))) as ProductFlags

const railIds = (state: ProductFlags | null) =>
  launchedItems([...ALL_PRIMARY_ITEMS, ...ALL_MORE_ITEMS], hiddenNavIds(state)).map((i) => i.id)
const tileKeys = (state: ProductFlags | null) => launchedTiles(ALL_APP_LAUNCHER, undefined, hiddenAppKeys(state)).map((t) => t.key)

describe("the product key", () => {
  test("echo is read from GET /v1/features like every other product", () => {
    expect(PRODUCT_KEYS).toContain("echo")
    expect(parseFeatures(body({ echo: true }))?.echo).toBe(true)
    expect(parseFeatures(body({}))?.echo).toBe(false)
    // Anything but a literal true is closed.
    expect(parseFeatures({ data: { products: { echo: { enabled: "true" } } } })?.echo).toBe(false)
    expect(parseFeatures({ data: { products: {} } })?.echo).toBe(false)
  })

  test("/echo and everything under it belong to echo; nothing else does", () => {
    expect(productForPath("/echo")).toBe("echo")
    expect(productForPath("/echo/note/f1111111-1111-4111-8111-111111111111")).toBe("echo")
    expect(productForPath("/echo?x=1")).toBe("echo")
    expect(productForPath("/echoes")).toBeNull()
    expect(productForPath("/feed")).toBeNull()
  })
})

describe("closed: no way in anywhere, and the pages say Not available", () => {
  for (const [label, state] of [["closed by the route", allClosed], ["closed while everything else is open", allOpenButEcho], ["no answer (fails closed)", null]] as const) {
    test(label, () => {
      expect(productEntryVisible("echo", state)).toBe(false)
      expect(productPageAvailable("echo", state)).toBe(false)
      expect(railIds(state)).not.toContain("Echo")
      expect(tileKeys(state)).not.toContain("echo")
      expect(visibleProfileTabKeys({ isOwn: true, echoOpen: productPageAvailable("echo", state) })).not.toContain("echo")
      expect(visibleProfileTabKeys({ isOwn: false, echoOpen: productPageAvailable("echo", state) })).not.toContain("echo")
    })
  }

  test("the static lists (no features answer) carry no Echo entry", () => {
    expect(moreItems.map((i) => i.id)).not.toContain("Echo")
    expect(primaryItems.map((i) => i.id)).not.toContain("Echo")
    expect(APP_LAUNCHER.map((t) => t.key)).not.toContain("echo")
  })

  test("the profile tab is off unless told otherwise", () => {
    expect(visibleProfileTabKeys({ isOwn: true })).not.toContain("echo")
  })
})

describe("open: the ways in come back", () => {
  test("rail, launcher, profile tab and pages", () => {
    expect(productEntryVisible("echo", echoOnly)).toBe(true)
    expect(productPageAvailable("echo", echoOnly)).toBe(true)
    expect(railIds(echoOnly)).toContain("Echo")
    expect(tileKeys(echoOnly)).toContain("echo")
    expect(visibleProfileTabKeys({ isOwn: false, echoOpen: true })).toContain("echo")
    expect(ALL_MORE_ITEMS.find((i) => i.id === "Echo")?.href).toBe("/echo")
  })
})

describe("middleware: a note opens signed out, the timelines do not", () => {
  const visit = (path: string, cookie?: string) => {
    const headers = new Headers()
    if (cookie) headers.set("cookie", cookie)
    return middleware(new NextRequest(`https://cleestudio.com${path}`, { headers }))
  }
  const passes = (res: Response) => res.headers.get("x-middleware-next") === "1" && res.headers.get("location") === null

  test("/echo/note/<id> passes with no session", () => {
    expect(passes(visit("/echo/note/f1111111-1111-4111-8111-111111111111"))).toBe(true)
  })

  test("/echo and anything else under it sends a stranger to sign in", () => {
    for (const path of ["/echo", "/echo/", "/echo/compose", "/echo/notes"]) {
      const res = visit(path)
      expect(passes(res), path).toBe(false)
      expect(res.headers.get("location") ?? "", path).toContain("/login")
    }
    expect(passes(visit("/echo", "pb_auth=1"))).toBe(true)
  })
})

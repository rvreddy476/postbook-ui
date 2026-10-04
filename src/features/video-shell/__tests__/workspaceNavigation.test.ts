import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { resolveAppBrand, APP_LAUNCHER } from "@/lib/appBrand"
import { ADMIN_LINKS, DATING_ADMIN_LINKS, FOOD_LINKS, MOPEDU_LINKS, workspaceLinkCurrent } from "../workspaceNavigation"

describe("service workspace navigation",() => {
  test("uses the most specific app brand without changing Reels",() => {
    expect(resolveAppBrand("/admin/mopedu/partners/abc").key).toBe("mopedu")
    expect(resolveAppBrand("/admin").key).toBe("admin")
    expect(resolveAppBrand("/feast/kitchen").key).toBe("feast")
    expect(resolveAppBrand("/dating/settings").name).toBe("Pulse")
    expect(resolveAppBrand("/reels").name).toBe("Reels")
    expect(resolveAppBrand("/admin/mopedux").key).toBe("admin")
  })
  test("marks only one deepest matching menu entry current",() => {
    const links = [...MOPEDU_LINKS,ADMIN_LINKS[0]]
    const active = links.filter(link => workspaceLinkCurrent("/admin/mopedu/partners/abc",link.href,links))
    expect(active.map(link => link.label)).toEqual(["Partners"])
    expect(workspaceLinkCurrent("/feast/checkout","/feast",FOOD_LINKS)).toBe(true)
    expect(workspaceLinkCurrent("/feast/orders/abc","/feast/orders",FOOD_LINKS)).toBe(true)
  })
  test("links only to existing app routes and makes Feast available",() => {
    for (const link of [...FOOD_LINKS,...ADMIN_LINKS,...MOPEDU_LINKS,...DATING_ADMIN_LINKS]) expect(existsSync(`src/app${link.href}/page.tsx`)).toBe(true)
    expect(APP_LAUNCHER.find(tile => tile.key === "feast")?.soon).toBeUndefined()
    expect(APP_LAUNCHER.find(tile => tile.key === "ride")?.soon).toBe(true)
    expect(APP_LAUNCHER.some(tile => tile.href.startsWith("/admin"))).toBe(false)
  })
})

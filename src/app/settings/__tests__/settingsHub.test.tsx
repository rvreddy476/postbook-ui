import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { THEME_CHOICES, THEME_STORAGE_KEY, chooseTheme, readThemeChoice, type ThemeRoot } from "@/features/video-shell/themeChoice"

import { AppearanceRow, LogoutRow, SettingsHub } from "../_components/SettingsHub"
import { APPEARANCE_WORDS, SETTINGS_GROUPS, nextLogoutStep } from "../_lib/settingsHub"

const appDir = resolve(import.meta.dir, "../..")
const routeExists = (href: string) => existsSync(resolve(appDir, `.${href.split("?")[0]}/page.tsx`))
const row = (key: string) => SETTINGS_GROUPS.flatMap((g) => g.rows).find((r) => r.key === key)!
const noop = () => undefined

describe("settings hub: groups and rows", () => {
    test("groups read Account, Privacy & safety, Notifications, Content & display, Data & storage, Support & about, then the untitled Log out card", () => {
        expect(SETTINGS_GROUPS.map((g) => [g.key, g.title])).toEqual([
            ["account", "Account"],
            ["privacy", "Privacy & safety"],
            ["notifications", "Notifications"],
            ["display", "Content & display"],
            ["data", "Data & storage"],
            ["support", "Support & about"],
            ["session", undefined],
        ])
    })

    test("rows, in order, with their destinations", () => {
        const rows = Object.fromEntries(SETTINGS_GROUPS.map((g) => [g.key, g.rows.map((r) => [r.label, r.href ?? r.action])]))
        expect(rows.account).toEqual([
            ["Profile", "/settings/profile"],
            ["Account & security", "/settings/security"],
            ["Verification", "/settings/verification"],
            ["Addresses", "/settings/addresses"],
            ["Tax profile", "/settings/tax-profile"],
        ])
        expect(rows.privacy).toEqual([
            ["Privacy", "/settings/privacy"],
            ["Who can connect with you", "/settings/social-preferences"],
            ["Friend requests", "/settings/friend-requests"],
            ["Blocked accounts", "/settings/blocked"],
            ["Hidden channels", "/settings/hidden-channels"],
        ])
        expect(rows.notifications).toEqual([["Notifications", "/settings/notifications"]])
        expect(rows.display).toEqual([
            ["Appearance", "theme"],
            ["Time & wellbeing", "/settings/wellbeing"],
            ["Module profiles", "/settings/modules"],
            ["Channel settings", "/settings/channel"],
            ["Mini apps", "/apps"],
        ])
        expect(rows.data).toEqual([
            ["Data saver", "/settings/data-saver"],
            ["Your data", "/settings/data"],
            ["Offline", "/posttube/offline"],
        ])
        expect(rows.support).toEqual([
            ["Report a problem", "/grievance"],
            ["Terms & Policies", "/terms"],
            ["Privacy policy", "/privacy"],
        ])
        expect(rows.session).toEqual([["Log out", "logout"]])
    })

    test("every row has an icon, a unique key, and exactly one of href or action; every link is a page", () => {
        const all = SETTINGS_GROUPS.flatMap((g) => g.rows)
        expect(new Set(all.map((r) => r.key)).size).toBe(all.length)
        for (const r of all) {
            expect(typeof r.icon).not.toBe("undefined")
            const hasHref = typeof r.href === "string" && r.href.startsWith("/")
            const hasAction = r.action === "theme" || r.action === "logout"
            expect(hasHref !== hasAction).toBe(true)
        }
        const dead = all.filter((r) => r.href && !routeExists(r.href)).map((r) => r.href)
        expect(dead).toEqual([])
        // There is no help page, so there is no Help row.
        expect(all.some((r) => /help/i.test(r.label) || r.href === "/help")).toBe(false)
    })

    test("every settings sub-page is reachable from the hub", () => {
        const linked = new Set(SETTINGS_GROUPS.flatMap((g) => g.rows).map((r) => r.href).filter(Boolean))
        const { readdirSync } = require("node:fs") as typeof import("node:fs")
        const pages = readdirSync(resolve(appDir, "settings"), { withFileTypes: true })
            .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("__"))
            .filter((d) => existsSync(resolve(appDir, "settings", d.name, "page.tsx")))
            .map((d) => `/settings/${d.name}`)
        expect(pages.length).toBeGreaterThan(10)
        expect(pages.filter((p) => !linked.has(p))).toEqual([])
    })
})

describe("settings hub: rendering", () => {
    test("draws every group and row as a card row with a chevron link; nothing logs out on first paint", () => {
        const html = renderToStaticMarkup(<SettingsHub onLogout={noop} />)
        for (const g of SETTINGS_GROUPS) if (g.title) expect(html).toContain(`>${g.title.replace("&", "&amp;")}</h2>`)
        for (const r of SETTINGS_GROUPS.flatMap((g) => g.rows)) if (r.href) expect(html).toContain(`href="${r.href}"`)
        expect(html.match(/class="settings-hub__card"/g)?.length).toBe(SETTINGS_GROUPS.length)
        expect(html).toContain("settings-hub__chevron")
        // The confirm step is not drawn until Log out is pressed.
        expect(html).not.toContain("data-logout-confirm")
        expect(html).toContain('aria-expanded="false"')
    })

    test("the page draws the hub inside AppShell and runs the panel's logout flow", () => {
        const src = readFileSync(resolve(appDir, "settings/page.tsx"), "utf8")
        expect(src).toContain("<AppShell>")
        expect(src).toContain("<SettingsHub onLogout={logout} />")
        expect(src).toMatch(/logoutUser\(\)\s+window\.location\.assign\("\/api\/auth\/logout"\)/)
    })

    test("the hub's CSS uses Momentum tokens only — no hex colours", () => {
        const css = readFileSync(resolve(appDir, "settings/_components/settings-hub.css"), "utf8")
        expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
        expect(css).toContain("rgb(var(--danger))")
        expect(css).toContain("padding: 20px 16px 48px")
    })
})

describe("settings hub: Appearance", () => {
    test("the switch is inline in its row: System, Dark, Light radios", () => {
        const html = renderToStaticMarkup(<AppearanceRow row={row("appearance")} />)
        expect(html).toContain('role="radiogroup"')
        expect(html.match(/role="radio"/g)?.length).toBe(3)
        expect(THEME_CHOICES.map((c) => APPEARANCE_WORDS[c.value])).toEqual(["System", "Dark", "Light"])
        for (const word of ["System", "Dark", "Light"]) expect(html).toContain(`<span>${word}</span>`)
        expect(html).toContain(">Appearance</span>")
    })

    test("each choice writes the theme key the root layout reads (dark/light stored, System clears it)", () => {
        const data = new Map<string, string>()
        const storage = {
            getItem: (k: string) => data.get(k) ?? null,
            setItem: (k: string, v: string) => void data.set(k, v),
            removeItem: (k: string) => void data.delete(k),
        }
        const root: ThemeRoot = { className: "light", style: { colorScheme: "light" } }
        chooseTheme("dark", { storage, root, prefersDark: false })
        expect([data.get(THEME_STORAGE_KEY), root.className, readThemeChoice(storage)]).toEqual(["dark", "dark", "dark"])
        chooseTheme("light", { storage, root, prefersDark: true })
        expect([data.get(THEME_STORAGE_KEY), root.className]).toEqual(["light", "light"])
        chooseTheme("auto", { storage, root, prefersDark: true })
        expect([data.has(THEME_STORAGE_KEY), root.className, readThemeChoice(storage)]).toEqual([false, "dark", "auto"])
    })

    test("the hub component writes through chooseTheme and readThemeChoice, as the More panel did", () => {
        const src = readFileSync(resolve(appDir, "settings/_components/SettingsHub.tsx"), "utf8")
        expect(src).toContain("chooseTheme(choice, {")
        expect(src).toContain("storage: localStorage")
        expect(src).toContain("readThemeChoice(localStorage)")
    })
})

describe("settings hub: Log out asks first", () => {
    test("a press only opens the confirm step; cancel closes it; only confirm from that step logs out", () => {
        expect(nextLogoutStep("idle", "press")).toEqual({ step: "confirming", logout: false })
        expect(nextLogoutStep("confirming", "cancel")).toEqual({ step: "idle", logout: false })
        expect(nextLogoutStep("idle", "confirm")).toEqual({ step: "idle", logout: false })
        expect(nextLogoutStep("confirming", "confirm").logout).toBe(true)
    })

    test("idle: one red row, no confirm button", () => {
        const html = renderToStaticMarkup(<LogoutRow row={row("logout")} onLogout={noop} />)
        expect(html).toContain("settings-hub__row--danger")
        expect(html).toContain('aria-expanded="false"')
        expect(html).not.toContain("data-logout-confirm")
        expect(html.match(/<button/g)?.length).toBe(1)
    })

    test("confirming: the question, Cancel and a red Log out", () => {
        const html = renderToStaticMarkup(<LogoutRow row={row("logout")} onLogout={noop} initialStep="confirming" />)
        expect(html).toContain('aria-expanded="true"')
        expect(html).toContain("Log out of your account on this browser?")
        expect(html).toContain(">Cancel</button>")
        expect(html).toMatch(/settings-hub__button--danger" data-logout-confirm="">Log out<\/button>/)
    })
})

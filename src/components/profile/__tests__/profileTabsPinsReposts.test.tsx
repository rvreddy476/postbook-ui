import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ProfileTabs, REPOSTS_TAB_ENABLED, visibleProfileTabKeys } from "../ProfileTabs"
import { MAX_PINNED_POSTS, pinnedHref, pinnedLabel, pinnedPosts, pinnedPostsRequest, unpinRequest } from "../pinned"
import { REPOSTS_PATH, parseRepostsPage, repostOriginalIds, repostRows, repostsParams, repostsPath } from "../tabs/reposts"

const profileDir = resolve(import.meta.dir, "..")
const noop = () => undefined

describe("profile tabs: the list", () => {
    test("no Orders or Bookings placeholders, for the owner or a visitor", () => {
        for (const isOwn of [true, false]) {
            const keys = visibleProfileTabKeys({ isOwn, hasMembers: true, hasAppearances: true }) as string[]
            expect(keys).not.toContain("orders")
            expect(keys).not.toContain("bookings")
        }
        const src = readFileSync(join(profileDir, "ProfilePage.tsx"), "utf8")
        expect(src).not.toContain("Coming soon")
        expect(src).not.toContain("ComingSoonTab")
    })

    test("the owner's full list, in order", () => {
        expect(visibleProfileTabKeys({ isOwn: true, hasMembers: true, hasAppearances: true, repostsEnabled: true })).toEqual([
            "posts", "about", "connections", "videos", "flicks", "members", "appears", "reposts", "stashed", "liked", "portfolio",
        ])
        expect(visibleProfileTabKeys({ isOwn: false, repostsEnabled: true })).toEqual([
            "posts", "about", "connections", "videos", "flicks", "reposts", "portfolio",
        ])
    })

    test("Reposts shows for everyone now the route is reachable, and the switch can still hide it", () => {
        expect(visibleProfileTabKeys({ isOwn: false, repostsEnabled: true })).toContain("reposts")
        expect(visibleProfileTabKeys({ isOwn: true, repostsEnabled: false })).not.toContain("reposts")
        expect(REPOSTS_TAB_ENABLED).toBe(true)
        expect(visibleProfileTabKeys({ isOwn: true })).toContain("reposts")
    })

    test("the tab row draws theme tokens only: one accent, no raw palette colours", () => {
        const src = readFileSync(join(profileDir, "ProfileTabs.tsx"), "utf8")
        expect(src).not.toMatch(/\b(?:bg|text|border|from|to)-(?:violet|cyan|pink|amber|red|orange|emerald|blue|rose|indigo|zinc|gray|slate)-\d{2,3}\b/)
        expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
        const html = renderToStaticMarkup(<ProfileTabs activeTab="posts" onTabChange={noop} isOwn hasMedia={false} />)
        expect(html).toContain("bg-primary-tint text-primary-ink")
        expect(html.match(/role="tab"/g)?.length).toBe(visibleProfileTabKeys({ isOwn: true }).length)
        expect(html).toMatch(/aria-selected="true"[^>]*data-tab="posts"/)
    })
})

describe("pinned posts: read from by-author's leading is_pinned rows", () => {
    test("the request is one default-order page of 3 (pins lead only in the default order)", () => {
        expect(pinnedPostsRequest("u 1")).toEqual({ url: "/v1/posts/by-author/u%201", params: { limit: "3" } })
        expect(MAX_PINNED_POSTS).toBe(3)
    })

    test("keeps the leading pinned rows and stops at the first unpinned one", () => {
        const body = {
            data: [
                { id: "a", is_pinned: true, text: "first" },
                { id: "b", is_pinned: true, text: "second" },
                { id: "c", is_pinned: false, text: "latest" },
                { id: "d", is_pinned: true, text: "never reached" },
            ],
        }
        expect(pinnedPosts<{ id: string; is_pinned?: boolean }>(body).map((p) => p.id)).toEqual(["a", "b"])
    })

    test("no pins, an empty page, or a body that is not a page draw nothing", () => {
        expect(pinnedPosts({ data: [{ id: "x", is_pinned: false }] })).toEqual([])
        expect(pinnedPosts({ data: [] })).toEqual([])
        expect(pinnedPosts({ data: null })).toEqual([])
        expect(pinnedPosts(undefined)).toEqual([])
        expect(pinnedPosts({ data: [{ id: "x" }] })).toEqual([])
    })

    test("never more than three", () => {
        const body = { data: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, is_pinned: true })) }
        expect(pinnedPosts(body)).toHaveLength(3)
    })

    test("unpin is PUT /v1/posts/:id/pin { pinned: false }; the chip links the post", () => {
        expect(unpinRequest("p1")).toEqual({ method: "put", url: "/v1/posts/p1/pin", body: { pinned: false } })
        expect(pinnedHref("p1")).toBe("/post/p1")
        expect(pinnedLabel({ title: "", text: "  hello  " })).toBe("hello")
        expect(pinnedLabel({ content_type: "short" })).toBe("Reel")
        expect(pinnedLabel({ content_type: "long_video" })).toBe("Video")
        expect(pinnedLabel({})).toBe("Post")
        expect(pinnedLabel({ text: "x".repeat(80) })).toHaveLength(60)
    })

    test("the page no longer reads user-service's unwritten /pins table", () => {
        const src = readFileSync(join(profileDir, "ProfilePage.tsx"), "utf8")
        expect(src).not.toContain("/pins")
        expect(src).toContain("<PinnedPosts userId={profile.id} isOwn={isOwn} />")
    })
})

describe("reposts: the decoder", () => {
    const body = {
        data: {
            items: [
                { repost_id: "r1", type: "plain", original_post_id: "p1", created_at: "2026-10-23T10:00:00Z" },
                { repost_id: "r2", type: "quote", quote_text: "  so true  ", original_post_id: "p2", created_at: "2026-10-22T10:00:00Z" },
                { repost_id: "r3", type: "plain", quote_text: "ignored", original_post_id: "p1", created_at: "2026-10-21T10:00:00Z" },
                { repost_id: "", original_post_id: "p9" },
                { repost_id: "r4" },
                { repost_id: "r1", original_post_id: "p1" },
            ],
            next_cursor: "2026-10-21T10:00:00Z",
        },
    }

    test("reads post-service's { data: { items, next_cursor } }", () => {
        const page = parseRepostsPage(body)
        expect(page.items).toEqual([
            { repostId: "r1", kind: "plain", quoteText: "", originalPostId: "p1", createdAt: "2026-10-23T10:00:00Z" },
            { repostId: "r2", kind: "quote", quoteText: "so true", originalPostId: "p2", createdAt: "2026-10-22T10:00:00Z" },
            { repostId: "r3", kind: "plain", quoteText: "", originalPostId: "p1", createdAt: "2026-10-21T10:00:00Z" },
        ])
        expect(page.nextCursor).toBe("2026-10-21T10:00:00Z")
    })

    test("no items is an empty page; a body that is not the document throws", () => {
        expect(parseRepostsPage({ data: { items: [] } })).toEqual({ items: [], nextCursor: null })
        expect(parseRepostsPage({ data: {} })).toEqual({ items: [], nextCursor: null })
        expect(() => parseRepostsPage(undefined)).toThrow()
        expect(() => parseRepostsPage({ data: [] })).toThrow()
        expect(() => parseRepostsPage({ items: [] })).toThrow()
        expect(() => parseRepostsPage({ data: { items: "x" } })).toThrow()
    })

    test("one batch of distinct originals; rows keep repost order and drop originals the viewer can't see", () => {
        const items = parseRepostsPage(body).items
        expect(repostOriginalIds(items)).toEqual(["p1", "p2"])
        const rows = repostRows(items, new Map([["p1", { id: "p1" }]]))
        expect(rows.map((r) => r.repost.repostId)).toEqual(["r1", "r3"])
    })

    test("the request", () => {
        // /v1/users/* goes to user-service at the gateway; /v1/creators reaches post-service.
        expect(REPOSTS_PATH).toBe("/v1/creators/:creatorId/reposts")
        expect(repostsPath("u1")).toBe("/v1/creators/u1/reposts")
        expect(repostsPath("a/b c")).toBe("/v1/creators/a%2Fb%20c/reposts")
        expect(repostsParams()).toEqual({ limit: "20" })
        expect(repostsParams("c")).toEqual({ limit: "20", cursor: "c" })
    })

    test("the page renders the Reposts tab when chosen", () => {
        const src = readFileSync(join(profileDir, "ProfilePage.tsx"), "utf8")
        expect(src).toContain('activeTab === "reposts"')
        expect(src).toContain("<RepostsTab userId={profile.id} isOwn={isOwn} />")
    })
})

function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return name === "__tests__" ? [] : files(path)
        return /\.tsx?$/.test(name) ? [path] : []
    })
}

describe("profile folder: type scale", () => {
    test("no text below 12px (text-xs, --type-xs, is the floor)", () => {
        const small = files(profileDir).filter((f) => /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]|\btext-2xs\b/.test(readFileSync(f, "utf8")))
        expect(small).toEqual([])
    })
})

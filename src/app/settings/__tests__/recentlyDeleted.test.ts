import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
    DELETED_POSTS_PATH,
    daysLeft,
    daysLeftText,
    deletedPostKind,
    deletedPostsParams,
    parseDeletedPostsPage,
    restoreFailure,
    restorePostPath,
    restoreRemovesRow,
    restoreText,
    runRestore,
    withoutDeletedPost,
} from "../_lib/recentlyDeleted"

const appDir = resolve(import.meta.dir, "../..")
const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse("2026-10-24T12:00:00Z")

// GET /v1/posts/me/deleted as post-service sends it: PostDetail rows with
// deleted_at + purge_at, the cursor in meta.
const body = {
    data: [
        {
            id: "p1",
            author_id: "me",
            text: "  beach day  ",
            title: "",
            content_type: "reel",
            deleted_at: "2026-10-20T12:00:00Z",
            purge_at: "2026-11-19T12:00:00Z",
            counts: null,
        },
        { id: "p2", text: "", title: "My long video", content_type: "long_video", deleted_at: "2026-10-01T00:00:00Z", purge_at: "2026-10-31T00:00:00Z" },
        { id: "p3", text: "a post", content_type: "post", deleted_at: "2026-10-02T00:00:00Z" },
        { id: "", text: "no id", deleted_at: "2026-10-02T00:00:00Z" },
        { id: "p4", text: "never deleted?" },
        { id: "p1", text: "duplicate", deleted_at: "2026-10-20T12:00:00Z" },
        null,
    ],
    meta: { next_cursor: "2026-10-02T00:00:00Z" },
}

describe("Recently deleted: the list decoder", () => {
    test("reads id, words, kind, deleted_at and purge_at; drops rows without an id or a deletion time, and repeats", () => {
        const page = parseDeletedPostsPage(body)
        expect(page.items).toEqual([
            { id: "p1", text: "beach day", kind: "reel", deletedAt: "2026-10-20T12:00:00Z", purgeAt: "2026-11-19T12:00:00Z" },
            { id: "p2", text: "My long video", kind: "video", deletedAt: "2026-10-01T00:00:00Z", purgeAt: "2026-10-31T00:00:00Z" },
            { id: "p3", text: "a post", kind: "post", deletedAt: "2026-10-02T00:00:00Z", purgeAt: null },
        ])
        expect(page.nextCursor).toBe("2026-10-02T00:00:00Z")
    })

    test("the title wins over the caption", () => {
        const page = parseDeletedPostsPage({ data: [{ id: "x", title: "Title", text: "Caption", deleted_at: "2026-10-01T00:00:00Z" }] })
        expect(page.items[0].text).toBe("Title")
    })

    test("an empty list is a real answer (and so is null); no meta means no next page", () => {
        expect(parseDeletedPostsPage({ data: [] })).toEqual({ items: [], nextCursor: null })
        expect(parseDeletedPostsPage({ data: null })).toEqual({ items: [], nextCursor: null })
        expect(parseDeletedPostsPage({ data: [], meta: { next_cursor: "" } }).nextCursor).toBeNull()
    })

    test("a body that is not the envelope throws instead of reading as 'nothing deleted'", () => {
        expect(() => parseDeletedPostsPage(undefined)).toThrow()
        expect(() => parseDeletedPostsPage([])).toThrow()
        expect(() => parseDeletedPostsPage({ items: [] })).toThrow()
        expect(() => parseDeletedPostsPage({ data: { items: [] } })).toThrow()
    })

    test("kinds: reels, videos, everything else is a post", () => {
        expect(["reel", "flick", "short", "SHORTS"].map(deletedPostKind)).toEqual(["reel", "reel", "reel", "reel"])
        expect(["video", "long_video"].map(deletedPostKind)).toEqual(["video", "video"])
        expect(["post", "photo", undefined, 3].map(deletedPostKind)).toEqual(["post", "post", "post", "post"])
    })

    test("the request: post-service's path, limit 20, a cursor only after the first page", () => {
        expect(DELETED_POSTS_PATH).toBe("/v1/posts/me/deleted")
        expect(deletedPostsParams()).toEqual({ limit: "20" })
        expect(deletedPostsParams(null)).toEqual({ limit: "20" })
        expect(deletedPostsParams("c1")).toEqual({ limit: "20", cursor: "c1" })
    })
})

describe("Recently deleted: days left", () => {
    test("whole days, rounded down, never negative", () => {
        expect(daysLeft(new Date(NOW + 30 * DAY).toISOString(), NOW)).toBe(30)
        expect(daysLeft(new Date(NOW + 29.9 * DAY).toISOString(), NOW)).toBe(29)
        expect(daysLeft(new Date(NOW + 0.5 * DAY).toISOString(), NOW)).toBe(0)
        expect(daysLeft(new Date(NOW - DAY).toISOString(), NOW)).toBe(0)
        expect(daysLeft(null, NOW)).toBeNull()
        expect(daysLeft("not a date", NOW)).toBeNull()
    })

    test("the words beside each row", () => {
        expect(daysLeftText(new Date(NOW + 26.2 * DAY).toISOString(), NOW)).toBe("26 days left")
        expect(daysLeftText(new Date(NOW + 1.5 * DAY).toISOString(), NOW)).toBe("1 day left")
        expect(daysLeftText(new Date(NOW + 2 * 60 * 60 * 1000).toISOString(), NOW)).toBe("Less than a day left")
        expect(daysLeftText(new Date(NOW).toISOString(), NOW)).toBe("Being removed permanently")
        expect(daysLeftText(null, NOW)).toBe("Can be restored for now")
    })
})

const axiosError = (status: number, code?: string) => ({ response: { status, data: code ? { error: { code, message: "x" } } : {} } })

describe("Recently deleted: the restore flow", () => {
    test("POSTs an empty body to /v1/posts/:id/restore and reads 200 as restored", async () => {
        const calls: [string, unknown][] = []
        const outcome = await runRestore(async (url, b) => {
            calls.push([url, b])
            return { status: 200 }
        }, "p 1")
        expect(outcome).toBe("restored")
        expect(calls).toEqual([["/v1/posts/p%201/restore", {}]])
        expect(restorePostPath("abc")).toBe("/v1/posts/abc/restore")
    })

    test("410 RESTORE_WINDOW_EXPIRED is too late; 409 NOT_DELETED is already back; anything else failed", async () => {
        const fail = (err: unknown) => runRestore(async () => Promise.reject(err), "p1")
        expect(await fail(axiosError(410, "RESTORE_WINDOW_EXPIRED"))).toBe("expired")
        expect(await fail(axiosError(409, "NOT_DELETED"))).toBe("already_restored")
        expect(await fail(axiosError(500, "INTERNAL_ERROR"))).toBe("failed")
        expect(await fail(new Error("Network Error"))).toBe("failed")
        expect(restoreFailure(axiosError(400, "RESTORE_WINDOW_EXPIRED"))).toBe("expired")
        expect(restoreFailure(axiosError(400, "NOT_DELETED"))).toBe("already_restored")
        expect(restoreFailure(null)).toBe("failed")
    })

    test("only a plain failure keeps the row (to try again); restored, already back and expired leave the list", () => {
        expect(restoreRemovesRow("restored")).toBe(true)
        expect(restoreRemovesRow("already_restored")).toBe(true)
        expect(restoreRemovesRow("expired")).toBe(true)
        expect(restoreRemovesRow("failed")).toBe(false)
    })

    test("removing a row keeps every page and its cursor", () => {
        const pages = [
            { items: parseDeletedPostsPage(body).items.slice(0, 2), nextCursor: "c1" },
            { items: parseDeletedPostsPage(body).items.slice(2), nextCursor: null },
        ]
        const next = withoutDeletedPost(pages, "p2")
        expect(next.map((p) => p.items.map((i) => i.id))).toEqual([["p1"], ["p3"]])
        expect(next.map((p) => p.nextCursor)).toEqual(["c1", null])
        expect(pages[0].items).toHaveLength(2)
    })

    test("each outcome has its own words", () => {
        const texts = (["restored", "already_restored", "expired", "failed"] as const).map(restoreText)
        expect(new Set(texts).size).toBe(4)
        expect(restoreText("expired")).toContain("permanently")
    })
})

describe("Recently deleted: wiring", () => {
    test("the page exists and the reels delete confirm links it", () => {
        expect(existsSync(resolve(appDir, "settings/recently-deleted/page.tsx"))).toBe(true)
        const reels = readFileSync(resolve(appDir, "../features/reels/components/ReelsScreen.tsx"), "utf8")
        expect(reels).toMatch(/It goes to <Link href="\/settings\/recently-deleted"[^>]*>Recently deleted<\/Link>/)
    })

    test("the page restores through runRestore and shows days left and an empty state", () => {
        const src = readFileSync(resolve(appDir, "settings/recently-deleted/page.tsx"), "utf8")
        expect(src).toContain("runRestore(")
        expect(src).toContain("daysLeftText(post.purgeAt)")
        expect(src).toContain("Nothing here")
        expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    })
})

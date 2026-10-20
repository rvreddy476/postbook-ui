import { describe, expect, test } from "bun:test"

import type { Relationship } from "@/types/profile"
import { bumpFollowingCount, connectionRowPill, type ConnectionListType } from "../tabs/connectionRows"

const ME = "viewer-1"
const THEM = "user-2"

function rel(over: Partial<Relationship> = {}): Relationship {
    return {
        following: false,
        followed_by: false,
        is_connection: false,
        connection_status: "none",
        follow_request_status: "none",
        blocked: false,
        blocked_by: false,
        is_muted: false,
        can_dm: true,
        can_see_online: false,
        can_add_to_group: false,
        ...over,
    }
}

const pill = (list: ConnectionListType, isOwn: boolean, relationship?: Relationship | null, override?: "following" | "requested" | "not_following") =>
    connectionRowPill({ rowUserId: THEM, viewerId: ME, list, isOwn, relationship, override })

describe("connection row pill", () => {
    test("own Following list: Following, even before the batch answers", () => {
        expect(pill("following", true, undefined)).toBe("following")
        expect(pill("following", true, rel({ following: true }))).toBe("following")
    })

    test("own Following list after an unfollow: Follow (the row stays)", () => {
        expect(pill("following", true, rel({ following: true }), "not_following")).toBe("follow")
        expect(pill("following", true, rel({ following: false }))).toBe("follow")
    })

    test("own Followers list: Follow back when not following them, else Following", () => {
        expect(pill("followers", true, rel({ followed_by: true }))).toBe("follow_back")
        expect(pill("followers", true, rel({ followed_by: true, following: true }))).toBe("following")
        expect(pill("followers", true, rel({ following: true }), "not_following")).toBe("follow_back")
    })

    test("own Followers list: nothing until the relationship is known", () => {
        expect(pill("followers", true, undefined)).toBe("none")
    })

    test("someone else's lists show the viewer's own relationship: Follow / Following / Requested", () => {
        for (const list of ["followers", "following", "friends"] as const) {
            expect(pill(list, false, rel())).toBe("follow")
            expect(pill(list, false, rel({ followed_by: true }))).toBe("follow")
            expect(pill(list, false, rel({ following: true }))).toBe("following")
            expect(pill(list, false, rel({ follow_request_status: "pending_sent" }))).toBe("requested")
            expect(pill(list, false, undefined)).toBe("none")
        }
    })

    test("an override wins over the server relationship", () => {
        expect(pill("followers", false, rel(), "following")).toBe("following")
        expect(pill("followers", false, rel(), "requested")).toBe("requested")
        expect(pill("followers", false, rel({ following: true }), "not_following")).toBe("follow")
    })

    test("never a pill on the viewer's own row, signed out, or a blocked pair", () => {
        expect(connectionRowPill({ rowUserId: ME, viewerId: ME, list: "followers", isOwn: false, relationship: rel() })).toBe("none")
        expect(connectionRowPill({ rowUserId: ME, viewerId: ME, list: "following", isOwn: true, relationship: undefined })).toBe("none")
        expect(connectionRowPill({ rowUserId: THEM, viewerId: "", list: "followers", isOwn: false, relationship: rel() })).toBe("none")
        expect(pill("followers", false, rel({ blocked: true }))).toBe("none")
        expect(pill("following", true, rel({ blocked_by: true, following: true }))).toBe("none")
    })
})

describe("optimistic following_count", () => {
    const mine = { profile: { id: ME }, stats: { following_count: 10, follower_count: 3 } }

    test("moves the viewer's own count and keeps the other stats", () => {
        expect(bumpFollowingCount(mine, ME, -1)).toEqual({ profile: { id: ME }, stats: { following_count: 9, follower_count: 3 } })
        expect(bumpFollowingCount(mine, ME, 1).stats.following_count).toBe(11)
    })

    test("a follow then its rollback is back where it started", () => {
        expect(bumpFollowingCount(bumpFollowingCount(mine, ME, 1), ME, -1)).toEqual(mine)
    })

    test("never below zero", () => {
        expect(bumpFollowingCount({ profile: { id: ME }, stats: { following_count: 0 } }, ME, -1).stats.following_count).toBe(0)
    })

    test("another person's cached profile, or nothing cached, is untouched", () => {
        const theirs = { profile: { id: THEM }, stats: { following_count: 5 } }
        expect(bumpFollowingCount(theirs, ME, 1)).toBe(theirs)
        expect(bumpFollowingCount(undefined, ME, 1)).toBeUndefined()
    })

    test("does not mutate the cached object", () => {
        const before = JSON.stringify(mine)
        bumpFollowingCount(mine, ME, 1)
        expect(JSON.stringify(mine)).toBe(before)
    })
})

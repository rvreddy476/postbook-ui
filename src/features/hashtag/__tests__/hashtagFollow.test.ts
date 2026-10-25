import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  HASHTAG_OFFLINE_TEXT,
  followSignInHref,
  followedHashtagPostsParams,
  followedHashtagsParams,
  hashtagFollowErrorText,
  hashtagFollowPath,
  hashtagFollowRequest,
  parseFollowedHashtags,
  parseHashtagFollowState,
  withoutFollowedHashtag,
} from "../hashtagFollow"

/*
  Fixtures from post-service (546eec063), under
  Architecture/services/post-service/internal/:
  - follow / unfollow / state: http/hashtag_follows_handler.go:16-18;
    HashtagFollowState is service/hashtag_follows.go:86-90, display_name
    "#" + tag (followState, :92-94).
  - followed list: http/hashtag_follows_handler.go:19-20, 89-105; row
    service/hashtag_follows.go:154-159; meta.next_cursor only when there is
    a next page (shared/api/response.go:26-28).
  - errors: http/hashtag_follows_handler.go:30-45.
*/
const follow200 = { data: { tag: "cricket", display_name: "#cricket", following: true } }
const unfollow200 = { data: { tag: "cricket", display_name: "#cricket", following: false } }
const followed200 = {
  data: [
    { tag: "cricket", display_name: "#cricket", followed_at: "2026-10-24T09:00:00Z" },
    { tag: "chennai_food", display_name: "#chennai_food", followed_at: "2026-10-23T09:00:00Z" },
  ],
  meta: { next_cursor: "2026-10-23T09:00:00Z|chennai_food" },
}

function apiError(status: number, code: string, message: string) {
  return { isAxiosError: true, response: { status, data: { error: { code, message } } } }
}

describe("requests", () => {
  test("follow is POST, unfollow DELETE, same path, no body", () => {
    expect(hashtagFollowRequest("cricket", true)).toEqual({ method: "post", url: "/v1/hashtags/cricket/follow" })
    expect(hashtagFollowRequest("cricket", false)).toEqual({ method: "delete", url: "/v1/hashtags/cricket/follow" })
  })

  test("the tag goes without its #, encoded; the server lowercases it", () => {
    expect(hashtagFollowPath("#Cricket")).toBe("/v1/hashtags/Cricket/follow")
    expect(hashtagFollowPath("  ##café ")).toBe("/v1/hashtags/caf%C3%A9/follow")
    expect(hashtagFollowPath("a/b")).toBe("/v1/hashtags/a%2Fb/follow")
  })

  test("list and feed paging", () => {
    expect(followedHashtagsParams()).toEqual({ limit: "50" })
    expect(followedHashtagsParams("cur")).toEqual({ limit: "50", cursor: "cur" })
    expect(followedHashtagPostsParams()).toEqual({ limit: "20" })
    expect(followedHashtagPostsParams("cur")).toEqual({ limit: "20", cursor: "cur" })
  })

  test("a visitor's Follow is the sign-in page, back to the tag", () => {
    expect(followSignInHref("cricket")).toBe("/login?next=%2Fhashtag%2Fcricket&redirect=%2Fhashtag%2Fcricket")
  })
})

describe("decoders", () => {
  test("follow state", () => {
    expect(parseHashtagFollowState(follow200)).toEqual({ tag: "cricket", displayName: "#cricket", following: true })
    expect(parseHashtagFollowState(unfollow200)?.following).toBe(false)
    expect(parseHashtagFollowState({ data: { tag: "x", following: true } })?.displayName).toBe("#x")
    expect(parseHashtagFollowState({ data: { tag: "x" } })).toBeNull()
    expect(parseHashtagFollowState({ data: { tag: "", following: true } })).toBeNull()
    expect(parseHashtagFollowState({ data: { tag: "x", following: "true" } })).toBeNull()
    expect(parseHashtagFollowState(null)).toBeNull()
  })

  test("followed list, newest first as sent, with the cursor", () => {
    expect(parseFollowedHashtags(followed200)).toEqual({
      items: [
        { tag: "cricket", displayName: "#cricket", followedAt: "2026-10-24T09:00:00Z" },
        { tag: "chennai_food", displayName: "#chennai_food", followedAt: "2026-10-23T09:00:00Z" },
      ],
      nextCursor: "2026-10-23T09:00:00Z|chennai_food",
    })
  })

  test("last page, junk and repeats", () => {
    expect(parseFollowedHashtags({ data: [] })).toEqual({ items: [], nextCursor: null })
    const odd = parseFollowedHashtags({ data: [null, { tag: "" }, followed200.data[0], followed200.data[0], { tag: "x" }] })
    expect(odd.items.map((h) => h.tag)).toEqual(["cricket", "x"])
    expect(odd.items[1].displayName).toBe("#x")
  })

  test("an unfollowed tag leaves the list without a refetch", () => {
    const pages = [parseFollowedHashtags(followed200)]
    expect(withoutFollowedHashtag(pages, "cricket")[0].items.map((h) => h.tag)).toEqual(["chennai_food"])
    expect(withoutFollowedHashtag(pages, "other")[0].items).toHaveLength(2)
    expect(pages[0].items).toHaveLength(2)
  })
})

describe("error copy", () => {
  test("each refusal is a sentence", () => {
    expect(hashtagFollowErrorText(apiError(400, "INVALID_HASHTAG", "A hashtag is 1-50 letters, digits or underscores"), "follow")).toBe(
      "A hashtag is 1 to 50 letters, numbers or underscores.",
    )
    expect(hashtagFollowErrorText(apiError(404, "HASHTAG_UNAVAILABLE", "This hashtag is unavailable"), "follow")).toBe(
      "This hashtag can't be followed.",
    )
    expect(hashtagFollowErrorText(apiError(409, "HASHTAG_FOLLOW_LIMIT", "You can follow at most 500 hashtags"), "follow")).toBe(
      "You can follow up to 500 hashtags. Unfollow one to follow another.",
    )
    expect(hashtagFollowErrorText(apiError(401, "UNAUTHORIZED", "x"), "follow")).toBe("Log in to follow hashtags.")
    expect(hashtagFollowErrorText({ isAxiosError: true, response: { status: 401 } }, "unfollow")).toBe("Log in to follow hashtags.")
  })

  test("offline and the rest, by what was being done", () => {
    expect(hashtagFollowErrorText({ isAxiosError: true }, "follow")).toBe(HASHTAG_OFFLINE_TEXT)
    expect(hashtagFollowErrorText(apiError(500, "INTERNAL_ERROR", "x"), "follow")).toBe("That hashtag couldn't be followed. Try again.")
    expect(hashtagFollowErrorText(apiError(500, "INTERNAL_ERROR", "x"), "unfollow")).toBe("That hashtag couldn't be unfollowed. Try again.")
    expect(hashtagFollowErrorText(new Error("x"), "load")).toBe("Your followed hashtags couldn't load. Try again.")
  })
})

describe("the screens", () => {
  const src = (p: string) => readFileSync(resolve(import.meta.dir, "../../..", p), "utf8")

  test("the hashtag page has Follow next to Share, and stays public", () => {
    const page = src("app/hashtag/[tag]/HashtagClient.tsx")
    expect(page).toContain("{tag && <FollowHashtagButton tag={tag} />}")
    expect(page).toContain("<PublicPageChrome>")
    const button = src("features/hashtag/FollowHashtagButton.tsx")
    expect(button).toContain("toggle.mutate(!following")
    expect(button).toContain("href={followSignInHref(tag)}")
    expect(button).toContain("{following ? 'Following' : 'Follow'}")
  })

  test("the home feed has a Hashtags tab reading the followed-posts feed", () => {
    const feed = src("components/Feed.tsx")
    expect(feed).toContain('{ key: "hashtags", label: "Hashtags" }')
    expect(feed).toContain('useFollowedHashtagPosts(tab === "hashtags")')
    expect(feed).toContain('enabled: posts.length > 0 && tab !== "hashtags"')
    const hooks = src("hooks/useHashtagFollow.ts")
    expect(hooks).toContain('FOLLOWED_HASHTAG_POSTS_KEY = ["home-feed", "followed-hashtags"]')
  })

  test("settings lists the followed hashtags with Unfollow", () => {
    const page = src("app/settings/followed-hashtags/page.tsx")
    expect(page).toContain("useFollowedHashtags()")
    expect(page).toContain("toggle.mutate(false")
  })
})

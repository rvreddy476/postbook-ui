import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

mock.module("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} }),
  usePathname: () => "/post/a1",
  useSearchParams: () => new URLSearchParams(),
}))

const { default: api } = await import("@/lib/api")
const { cancelMembership, patchLevel, setPostMembersOnly, startJoin, startRenewal, changeLevel, fetchMyLevels } = await import("../api")
const { CommentsLock, PostLock, StageLock } = await import("../components/LockCards")
const { MembersOnlyChoices, membersOnlySummary } = await import("../components/MembersOnlyChoices")
const { EligibilityCard } = await import("../components/LevelsScreen")
const { toTiers, activeLevels } = await import("../model")
const { decodeNotificationPage, creditNotificationHref } = await import("@/lib/notificationInbox")
const { toReelItem } = await import("@/features/reels/model")
const { normalizeWatchDetail } = await import("@/features/posttube/watch/watchApi")
const { rowToVideo } = await import("@/features/posttube/model")
const { normalizePostDetail } = await import("@/features/posttube/hub/hubApi")
const { visibleTabs, TAB_LABELS } = await import("@/features/posttube/channel/channelModel")
const { visibleProfileTabKeys } = await import("@/components/profile/ProfileTabs")
const { NOTIFICATION_CATEGORIES, decodeNotificationSettings, categoryTogglePatch } = await import("@/app/settings/_lib/notificationPreferences")
const { fixture } = await import("./fixtures")

const T1 = "6f1c2a10-1111-4a3b-9c00-000000000001"
const CREATOR = "c0ffee00-0000-4000-8000-000000000001"

const spies: { mockRestore(): void }[] = []
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore()
})

/* ── the requests on the wire ───────────────────────────────────── */

describe("requests", () => {
  test("join sends tier_id and the Idempotency-Key it was given; the same key on a retry", async () => {
    const calls: { url: string; body: unknown; headers: Record<string, string> }[] = []
    const post = spyOn(api, "post").mockImplementation((async (url: string, body: unknown, config?: { headers?: Record<string, string> }) => {
      calls.push({ url, body, headers: config?.headers ?? {} })
      return { data: fixture("subscribe_201") }
    }) as never)
    spies.push(post)
    const a = await startJoin(CREATOR, T1, "key-A")
    await startJoin(CREATOR, T1, "key-A")
    expect(a.paymentId).toBe("9a7e0000-0000-4000-8000-000000000020")
    expect(calls).toEqual([
      { url: `/v1/monetization/subscribe/${CREATOR}`, body: { tier_id: T1 }, headers: { "Idempotency-Key": "key-A" } },
      { url: `/v1/monetization/subscribe/${CREATOR}`, body: { tier_id: T1 }, headers: { "Idempotency-Key": "key-A" } },
    ])
  })

  test("renew and change level answer checkouts / tier changes; cancel posts an empty body", async () => {
    const urls: string[] = []
    const bodies: unknown[] = []
    const post = spyOn(api, "post").mockImplementation((async (url: string, body: unknown) => {
      urls.push(url)
      bodies.push(body)
      if (url.endsWith("/upgrade")) return { data: fixture("upgrade_200_scheduled") }
      if (url.endsWith("/cancel")) return { data: { data: { status: "cancelled_at_period_end" } } }
      return { data: fixture("subscribe_201") }
    }) as never)
    spies.push(post)
    expect((await startRenewal("s1", "k")).kind).toBe("join")
    expect(await changeLevel("s1", T1, "k")).toEqual({ kind: "scheduled", effectiveAt: "2026-11-23T09:00:00Z" })
    await cancelMembership("s1")
    expect(urls).toEqual(["/v1/monetization/subscriptions/s1/renew", "/v1/monetization/subscriptions/s1/upgrade", "/v1/monetization/subscriptions/s1/cancel"])
    expect(bodies).toEqual([{}, { tier_id: T1 }, {}])
  })

  test("a level PATCH sends exactly the patch, and nothing at all when nothing changed", async () => {
    const sent: unknown[] = []
    const patch = spyOn(api, "patch").mockImplementation((async (_url: string, body: unknown) => {
      sent.push(body)
      return { data: fixture("tier_patch_200") }
    }) as never)
    spies.push(patch)
    const t = await patchLevel(T1, { price_paise: 5900 })
    expect(t?.pricePaise).toBe(5900)
    expect(await patchLevel(T1, {})).toBeNull()
    expect(sent).toEqual([{ price_paise: 5900 }])
  })

  test("the gate: PUT with tier_required_id, null to clear", async () => {
    const sent: [string, unknown][] = []
    const put = spyOn(api, "put").mockImplementation((async (url: string, body: unknown) => {
      sent.push([url, body])
      return { data: fixture("post_gate_put_200") }
    }) as never)
    spies.push(put)
    await setPostMembersOnly("p1", T1)
    await setPostMembersOnly("p1", null)
    expect(sent).toEqual([
      ["/v1/posts/p1/membership", { tier_required_id: T1 }],
      ["/v1/posts/p1/membership", { tier_required_id: null }],
    ])
  })

  test("my levels decode from the GET", async () => {
    const get = spyOn(api, "get").mockResolvedValue({ data: fixture("tiers_mine_200") } as never)
    spies.push(get)
    expect((await fetchMyLevels()).map((t) => t.name)).toEqual(["Supporter", "Superfan", "Old level"])
  })
})

/* ── what the cards draw ────────────────────────────────────────── */

function html(node: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } })
  return renderToStaticMarkup(<QueryClientProvider client={qc}>{node}</QueryClientProvider>)
}

describe("lock cards", () => {
  test("a locked post: Members only, the creator, Join (signed out: to sign in, back here); never a body", () => {
    const out = html(<PostLock creatorId={CREATOR} creatorName="Asha" tierRequiredId={T1} durationMs={754000} />)
    expect(out).toContain("Members only")
    expect(out).toContain("Join Asha&#x27;s membership to see this post.")
    expect(out).toContain("12:34")
    expect(out).toContain('href="/login?next=%2Fpost%2Fa1"')
  })

  test("a locked reel: the cover blurred behind the lock, no caption, no player", () => {
    const out = html(<StageLock creatorId={CREATOR} creatorName="Asha" coverUrl="/v1/media/c3/serve" title="Studio tour" durationMs={42000} />)
    expect(out).toContain('data-membership="reel-lock"')
    expect(out).toContain("mship-stage-lock__cover")
    expect(out).toContain("Studio tour")
    expect(out).not.toContain("<video")
  })

  test("comments on a members-only post", () => {
    expect(html(<CommentsLock creatorId={CREATOR} />)).toContain("Only members can read and write comments")
  })

  test("the Members only choice: Everyone plus each level and above; a level no longer offered still shows", () => {
    const levels = activeLevels(toTiers(fixture("tiers_mine_200")))
    const out = html(<MembersOnlyChoices levels={levels} value={T1} onChange={() => {}} />)
    expect(out.match(/role="radio"/g)?.length).toBe(3)
    expect(out).toContain("Supporter and above")
    expect(out).toContain('aria-checked="true" data-gate="' + T1 + '"')
    const stale = html(<MembersOnlyChoices levels={levels} value="gone" onChange={() => {}} />)
    expect(stale).toContain("A level you no longer offer")
    expect(membersOnlySummary(levels, null)).toBe("Everyone")
    expect(membersOnlySummary(levels, T1)).toBe("Members only · Supporter and above")
  })

  test("the eligibility card lists what is missing, with where to fix it", () => {
    const out = html(<EligibilityCard missing={["pan", "followers"]} hasLevels={false} />)
    expect(out).toContain("Before you can offer memberships")
    expect(out).toContain('data-missing="pan"')
    expect(out).toContain('href="/settings/tax-profile"')
    expect(out).toContain("Reach 500 followers")
    expect(out).not.toContain('data-missing="age"')
  })
})

/* ── the surfaces that carry the gate ───────────────────────────── */

describe("reels", () => {
  test("a redacted members-only short stays on the stage as a locked item: cover, title, counts, nothing to play", () => {
    const item = toReelItem(fixture("feed_row_reel_redacted") as never)!
    expect(item.locked).toEqual({ tierRequiredId: "6f1c2a10-1111-4a3b-9c00-000000000002" })
    expect([item.caption, item.hashtags, item.media.mediaId, item.media.fileUrl, item.media.hlsUrl, item.sound]).toEqual(["", [], "", "", null, null])
    expect(item.media.posterUrl).toContain("/v1/media/cccc0000-0000-4000-8000-000000000003/serve")
    expect([item.title, item.likeCount, item.media.durationMs, item.authorName]).toEqual(["Studio tour", 5, 42000, "Asha"])
  })

  test("a redacted long video is not a reel; an unredacted gated short is a normal reel", () => {
    expect(toReelItem({ ...(fixture("feed_row_reel_redacted") as object), content_type: "long_video" } as never)).toBeNull()
    const served = toReelItem({ ...(fixture("feed_row_reel_redacted") as object), body_redacted: false, media: [{ media_id: "m1", kind: "video", duration_ms: 42000 }] } as never)!
    expect(served.locked).toBeUndefined()
    expect(served.media.mediaId).toBe("m1")
  })
})

describe("watch page", () => {
  test("the detail says when the server redacted it", () => {
    const row = { id: "v1", author_id: CREATOR, content_type: "long_video", tier_required_id: T1, body_redacted: true, media: [] }
    const d = normalizeWatchDetail(row as never, rowToVideo(row as never))
    expect([d.tierRequiredId, d.bodyRedacted, d.mediaId]).toEqual([T1, true, null])
    const open = { id: "v2", author_id: CREATOR, content_type: "long_video" }
    expect(normalizeWatchDetail(open as never, rowToVideo(open as never)).bodyRedacted).toBe(false)
  })
})

describe("creator hub", () => {
  test("the edit sheet's detail carries the gate only when there is one", () => {
    const row = { id: "v1", author_id: CREATOR, content_type: "long_video", visibility: "public", title: "T" }
    expect(normalizePostDetail({ ...row, tier_required_id: T1 })?.tier_required_id).toBe(T1)
    expect(normalizePostDetail(row)).not.toHaveProperty("tier_required_id")
    expect(normalizePostDetail({ ...row, tier_required_id: "" })).not.toHaveProperty("tier_required_id")
  })
})

describe("channel and profile: the Members tab", () => {
  test("the channel shows Members after Posts when the creator offers a level, for owner and visitor", () => {
    expect(TAB_LABELS.members).toBe("Members")
    expect(visibleTabs({}, false, false, false, true)).toEqual(["videos", "shorts", "live", "collections", "posts", "members"])
    expect(visibleTabs({}, true, false, true, true)).toEqual(["videos", "shorts", "live", "collections", "posts", "members", "appears"])
    expect(visibleTabs({}, false)).not.toContain("members")
  })

  test("the profile shows Members only for a person with a level", () => {
    expect(visibleProfileTabKeys({ isOwn: false, hasMembers: true })).toContain("members")
    expect(visibleProfileTabKeys({ isOwn: true })).not.toContain("members")
  })
})

describe("notifications", () => {
  const page = decodeNotificationPage(fixture("notification_page_memberships"))
  const byType = Object.fromEntries(page.notifications.map((n) => [n.type, n]))

  test("all six types: the server's sentence wins, our second line, and the right destination", () => {
    expect(page.notifications.map((n) => [n.type, n.title, n.deep_link])).toEqual([
      ["membership_new_member", "Ravi joined your membership", "/monetization/tiers"],
      ["membership_joined", "You're a member of Asha", "/memberships/5ab0c0de-0000-4000-8000-000000000010"],
      ["membership_renewal_due", "Your Asha membership ends soon — renew to keep access", "/memberships/5ab0c0de-0000-4000-8000-000000000010"],
      // momentum:// becomes the web path.
      ["membership_payment_failed", "Your membership payment to a creator didn't go through", "/memberships/5ab0c0de-0000-4000-8000-000000000010"],
      // An outside link is dropped: the list.
      ["membership_ended", "Your membership with a creator has ended", "/memberships"],
      ["membership_renewed", "Your membership with a creator was renewed", "/memberships"],
    ])
    expect(byType.membership_renewal_due.body).toBe("Renewal isn't automatic. Pay to keep your access.")
    expect(byType.membership_new_member.body).toBe("See your levels and members.")
  })

  test("the bell menus route membership notices too", () => {
    expect(creditNotificationHref("membership_new_member", "/anything")).toBe("/monetization/tiers")
    expect(creditNotificationHref("membership_joined", "/memberships/5ab0c0de-0000-4000-8000-000000000010")).toBe("/memberships/5ab0c0de-0000-4000-8000-000000000010")
    expect(creditNotificationHref("membership_ended", undefined)).toBe("/memberships")
    expect(creditNotificationHref("follow", "/u/x")).toBeUndefined()
  })

  test("settings: a Memberships switch pair, on by default", () => {
    expect(NOTIFICATION_CATEGORIES.find((c) => c.key === "memberships")).toEqual({ key: "memberships", label: "Memberships", primary: false })
    const s = decodeNotificationSettings({ data: { push_enabled: true, push_memberships: false } })!
    expect([s.channels.push_memberships, s.channels.inapp_memberships]).toEqual([false, true])
    expect(categoryTogglePatch("memberships", "push", true)).toEqual({ push_memberships: true })
  })
})

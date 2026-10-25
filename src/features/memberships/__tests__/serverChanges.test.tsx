/*
  The 23 Oct 2026 server changes (post-service + monetization-service
  2fc016a5d): the gate written with the post, the members-only list, the
  required price on gated rows, the MEMBERS_ONLY details, named creators,
  one membership, and the creator's members list.
*/

import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

mock.module("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} }),
  usePathname: () => "/monetization/members",
  useSearchParams: () => new URLSearchParams(),
}))

const { default: api } = await import("@/lib/api")
const m = await import("../model")
const { fetchCreatorMembers, fetchMembership, fetchMembersOnlyRows } = await import("../api")
const { MEMBERSHIP_KEYS } = await import("../hooks")
const { MembershipDetailView } = await import("../components/MyMemberships")
const { CreatorMembersScreen, memberDates } = await import("../components/CreatorMembers")
const compose = await import("@/features/post-compose/model")
const { createPost } = await import("@/features/post-compose/api")
const { studioCreateFields, studioDraftGateField, publishFailure, isTierGateRefusal } = await import("@/features/upload/studioApi")
const { INITIAL_FORM_STATE } = await import("@/features/upload/types")
const { updateDraft } = await import("@/features/reels/data/reelsApi")
const { updatePost, normalizeDraft } = await import("@/features/posttube/hub/hubApi")
const { readableHubError } = await import("@/features/posttube/hub/hubModel")
const { creditNotificationHref } = await import("@/lib/notificationInbox")
const { fixture, httpError } = await import("./fixtures")

const T1 = "6f1c2a10-1111-4a3b-9c00-000000000001"
const T2 = "6f1c2a10-1111-4a3b-9c00-000000000002"
const CREATOR = "c0ffee00-0000-4000-8000-000000000001"

const spies: { mockRestore(): void }[] = []
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore()
})

const tier = (id: string, name: string, pricePaise: number, isActive = true): import("../model").Tier => ({ id, creatorId: CREATOR, name, pricePaise, currency: "INR", perks: [], subscriberCount: 0, isActive })
const FAN = tier("t-fan", "Fan", 2900)
const SUP = tier("t-sup", "Supporter", 4900)
const GOLD = tier("t-gold", "Gold", 19900)
const OFF = tier("t-off", "Old VIP", 99900, false)
const LEVELS = [GOLD, FAN, SUP, OFF]

/* ── 1. the gate rides with the write ───────────────────────────── */

describe("gate request fields", () => {
  test("create: the level when chosen, nothing at all for everyone", () => {
    expect(m.gateCreateField(T1)).toEqual({ tier_required_id: T1 })
    expect(m.gateCreateField(` ${T1} `)).toEqual({ tier_required_id: T1 })
    expect(m.gateCreateField(null)).toEqual({})
    expect(m.gateCreateField(undefined)).toEqual({})
    expect(m.gateCreateField("")).toEqual({})
    expect(m.gateCreateField("   ")).toEqual({})
  })

  test("PATCH: a level sets it, null (or empty) clears it — never omitted", () => {
    expect(m.gatePatchField(T1)).toEqual({ tier_required_id: T1 })
    expect(m.gatePatchField(null)).toEqual({ tier_required_id: null })
    expect(m.gatePatchField("")).toEqual({ tier_required_id: null })
    expect(m.gatePatchField(undefined)).toEqual({ tier_required_id: null })
  })

  test("an edit sends the field only when the level changed", () => {
    expect(m.gateEditField(T1, T1)).toEqual({})
    expect(m.gateEditField(null, null)).toEqual({})
    expect(m.gateEditField(null, "")).toEqual({})
    expect(m.gateEditField(T1, null)).toEqual({ tier_required_id: null })
    expect(m.gateEditField(null, T1)).toEqual({ tier_required_id: T1 })
    expect(m.gateEditField(T1, T2)).toEqual({ tier_required_id: T2 })
  })
})

describe("the post composer sends the level with the post and keeps it in the draft", () => {
  const input = (tierRequiredId: string | null | undefined) => ({
    text: "For members",
    details: { ...compose.emptyDetails("en"), tierRequiredId },
    media: [],
    extras: { contentType: "post" as const },
  })

  test("POST /v1/posts carries tier_required_id; an open post carries none", () => {
    expect(compose.buildCreateRequest(input(T1)).tier_required_id).toBe(T1)
    expect(compose.buildCreateRequest(input(null))).not.toHaveProperty("tier_required_id")
    expect(compose.buildCreateRequest(input(undefined))).not.toHaveProperty("tier_required_id")
  })

  test("the draft payload holds it, and the draft reopens on it", () => {
    const req = compose.buildDraftRequest(input(T1))
    expect(req.payload.tier_required_id).toBe(T1)
    expect(compose.buildDraftRequest(input(null)).payload).not.toHaveProperty("tier_required_id")
    const row = compose.toDraftRow({ id: "d1", post_type: "post", status: "draft", payload: req.payload })!
    expect(row.payload.tier_required_id).toBe(T1)
    expect(compose.draftToCompose(row, "en").details.tierRequiredId).toBe(T1)
    const open = compose.toDraftRow({ id: "d2", status: "draft", payload: { text: "x", tier_required_id: "" } })!
    expect(compose.draftToCompose(open, "en").details.tierRequiredId).toBeUndefined()
  })

  test("the create goes out with the level in the body, under the Idempotency-Key", async () => {
    const sent: unknown[] = []
    const post = spyOn(api, "post").mockImplementation((async (_url: string, body: unknown) => {
      sent.push(body)
      return { data: { data: { id: "p1", tier_required_id: T1 } } }
    }) as never)
    spies.push(post)
    await createPost(compose.buildCreateRequest(input(T1)), "k1")
    expect((sent[0] as { tier_required_id?: string }).tier_required_id).toBe(T1)
  })

  test("a gate refusal is said in words: nothing was posted", () => {
    expect(compose.refusalCopy("INVALID_TIER", "tier_required_id must be one of your active membership tiers", "x")).toBe("That level isn't available any more — pick another.")
    expect(compose.refusalCopy("MEMBERSHIP_TIERS_UNAVAILABLE", "dial tcp …", "x")).toBe("Couldn't check your membership levels. Nothing was posted — try again.")
  })
})

describe("the upload studio (long videos and shorts) gates at create and on the draft", () => {
  test("create fields carry the level; none for everyone", () => {
    expect(studioCreateFields({ ...INITIAL_FORM_STATE, tierRequiredId: T1 }).tier_required_id).toBe(T1)
    expect(studioCreateFields({ ...INITIAL_FORM_STATE, tierRequiredId: T1 }, { longVideo: true }).tier_required_id).toBe(T1)
    expect(studioCreateFields(INITIAL_FORM_STATE)).not.toHaveProperty("tier_required_id")
  })

  test("the draft save always says the level, null to keep it open", () => {
    expect(studioDraftGateField({ tierRequiredId: T1 })).toEqual({ tier_required_id: T1 })
    expect(studioDraftGateField({ tierRequiredId: null })).toEqual({ tier_required_id: null })
  })

  test("PATCH /v1/reels/drafts/:id sends tier_required_id null as null", async () => {
    const sent: [string, unknown][] = []
    const patch = spyOn(api, "patch").mockImplementation((async (url: string, body: unknown) => {
      sent.push([url, body])
      return { data: { data: { id: "d1" } } }
    }) as never)
    spies.push(patch)
    await updateDraft("d1", { caption: "c", ...studioDraftGateField({ tierRequiredId: null }) })
    expect(sent).toEqual([["/v1/reels/drafts/d1", { caption: "c", tier_required_id: null }]])
  })

  test("a gate refusal stops the publish (no direct-create fallback) and is said in words", () => {
    expect(isTierGateRefusal(httpError(400, "post_create_400_invalid_tier"))).toBe(true)
    expect(isTierGateRefusal(httpError(503, "post_create_503_tiers_unavailable"))).toBe(true)
    expect(isTierGateRefusal(httpError(503, "subscribe_503_not_enabled"))).toBe(false)
    expect(isTierGateRefusal(new Error("boom"))).toBe(false)
    expect(publishFailure(httpError(400, "post_create_400_invalid_tier"))?.message).toBe("That level isn't available any more — pick another.")
    expect(publishFailure(httpError(503, "post_create_503_tiers_unavailable"))).toEqual({ code: "MEMBERSHIP_TIERS_UNAVAILABLE", message: "Couldn't check your membership levels. Nothing was posted — try again." })
  })

  test("a reel draft row keeps its level", () => {
    expect(normalizeDraft({ id: "d1", tier_required_id: T1 })?.tier_required_id).toBe(T1)
    expect(normalizeDraft({ id: "d2" })?.tier_required_id).toBeNull()
  })
})

describe("the Creator Hub edit: the level in the post PATCH", () => {
  test("PATCH /v1/posts/:id with tier_required_id: a level, or null to clear", async () => {
    const sent: unknown[] = []
    const patch = spyOn(api, "patch").mockImplementation((async (_url: string, body: unknown) => {
      sent.push(body)
      return { data: { data: { id: "v1", author_id: CREATOR, content_type: "long_video", visibility: "public", title: "T" } } }
    }) as never)
    spies.push(patch)
    await updatePost("v1", { title: "T", ...m.gateEditField(T1, null) })
    await updatePost("v1", { ...m.gateEditField(null, T2) })
    await updatePost("v1", { title: "U", ...m.gateEditField(T1, T1) })
    expect(sent).toEqual([{ title: "T", tier_required_id: null }, { tier_required_id: T2 }, { title: "U" }])
  })

  test("its refusals say nothing was saved", () => {
    expect(readableHubError("INVALID_TIER")).toBe("That level isn't available any more — pick another.")
    expect(readableHubError("MEMBERSHIP_TIERS_UNAVAILABLE")).toBe("Couldn't check your membership levels. Nothing was saved — try again.")
  })
})

describe("the gate refusals", () => {
  test("INVALID_TIER and MEMBERSHIP_TIERS_UNAVAILABLE, per verb; anything else is not one", () => {
    expect(m.tierGateError(httpError(400, "post_create_400_invalid_tier"))).toBe("That level isn't available any more — pick another.")
    expect(m.tierGateError(httpError(503, "post_create_503_tiers_unavailable"))).toBe("Couldn't check your membership levels. Nothing was posted — try again.")
    expect(m.tierGateError(httpError(503, "post_create_503_tiers_unavailable"), "saved")).toBe("Couldn't check your membership levels. Nothing was saved — try again.")
    expect(m.tierGateError(httpError(503, "subscribe_503_not_enabled"))).toBeNull()
    expect(m.tierGateMessage(null)).toBeNull()
    // The membership screens' own sentence for it is not "memberships aren't available".
    expect(m.membershipErrorMessage(httpError(503, "post_create_503_tiers_unavailable"))).toBe("Couldn't check your membership levels. Nothing was saved — try again.")
  })
})

/* ── 2. the Members tab: members_only=true ──────────────────────── */

describe("the Members tab list", () => {
  test("by-author with members_only=true and the same cursor", async () => {
    const calls: [string, unknown][] = []
    const get = spyOn(api, "get").mockImplementation((async (url: string, config?: { params?: unknown }) => {
      calls.push([url, config?.params])
      return { data: fixture("by_author_200_members_only") }
    }) as never)
    spies.push(get)
    const first = await fetchMembersOnlyRows(CREATOR)
    await fetchMembersOnlyRows(CREATOR, first.nextCursor)
    expect(first.nextCursor).toBe("cur-mo-2")
    expect(calls).toEqual([
      [`/v1/posts/by-author/${CREATOR}`, { limit: "50", members_only: "true" }],
      [`/v1/posts/by-author/${CREATOR}`, { limit: "50", members_only: "true", cursor: "cur-mo-2" }],
    ])
  })

  test("params builder", () => {
    expect(m.membersOnlyParams()).toEqual({ limit: "50", members_only: "true" })
    expect(m.membersOnlyParams("c", 20)).toEqual({ limit: "20", members_only: "true", cursor: "c" })
  })
})

/* ── 3. the required price and the unlock highlight ─────────────── */

describe("gated rows carry tier_required_price_paise", () => {
  test("decoded when present; null when the server could not read it", () => {
    const rows = m.gatedRows((fixture("by_author_200_members_only") as { data: unknown[] }).data)
    expect(rows.map((r) => [r.tierRequiredId, r.requiredPricePaise])).toEqual([
      [T2, 19900],
      [T1, null],
    ])
    expect(m.requiredPriceOfRow({ tier_required_price_paise: 0 })).toBeNull()
    expect(m.requiredPriceOfRow({ tier_required_price_paise: -5 })).toBeNull()
    expect(m.requiredPriceOfRow({ tier_required_price_paise: "4900" })).toBeNull()
    expect(m.requiredPriceOfRow({ tier_required_price_paise: 4900 })).toBe(4900)
  })
})

describe("the unlock rule: a level unlocks an item when its price ≥ the required price", () => {
  test("the boundary: equal unlocks, one paisa less does not, unknown never", () => {
    expect(m.unlocksAt({ pricePaise: 4900 }, 4900)).toBe(true)
    expect(m.unlocksAt({ pricePaise: 4899 }, 4900)).toBe(false)
    expect(m.unlocksAt({ pricePaise: 4901 }, 4900)).toBe(true)
    expect(m.unlocksAt({ pricePaise: 99900 }, null)).toBe(false)
  })

  test("the required price: the row's own first, else its level's, else unknown", () => {
    expect(m.requiredPriceOf(LEVELS, "t-sup", 19900)).toBe(19900)
    expect(m.requiredPriceOf(LEVELS, "t-sup", null)).toBe(4900)
    expect(m.requiredPriceOf(LEVELS, "t-sup", 0)).toBe(4900)
    expect(m.requiredPriceOf(LEVELS, "gone", null)).toBeNull()
    expect(m.requiredPriceOf(LEVELS, "gone", 4900)).toBe(4900)
    expect(m.requiredPriceOf(LEVELS, null, null)).toBeNull()
  })

  test("the Join sheet: every active level, the unlocking ones highlighted, starting on the cheapest of them", () => {
    // The public route only lists active levels: the item's level is not there, its price is.
    const c = m.joinChoices([GOLD, FAN, SUP], "t-hidden", 4900)
    expect(c.levels.map((t) => t.id)).toEqual(["t-fan", "t-sup", "t-gold"])
    expect(c.unlocking).toEqual(["t-sup", "t-gold"])
    expect(c.lowest?.id).toBe("t-sup")
    expect(c.line).toBe("Unlocks with Supporter or higher")
  })

  test("the dearest level: no 'or higher'", () => {
    expect(m.joinChoices(LEVELS, "t-gold", 19900).line).toBe("Unlocks with Gold")
    expect(m.unlockLine(GOLD, [FAN, SUP, GOLD])).toBe("Unlocks with Gold")
    expect(m.unlockLine(FAN, [FAN, SUP, GOLD])).toBe("Unlocks with Fan or higher")
  })

  test("by the listed level's price when the row has none", () => {
    const c = m.joinChoices(LEVELS, "t-sup", null)
    expect(c.unlocking).toEqual(["t-sup", "t-gold"])
    // A turned-off level in the list (the creator's own view) still prices it.
    expect(m.joinChoices(LEVELS, "t-off", null).unlocking).toEqual([])
    expect(m.joinChoices(LEVELS, "t-off", null).line).toBe(m.NO_LEVEL_UNLOCKS)
  })

  test("nothing required (a profile's Join) or nothing known: nothing highlighted, cheapest first", () => {
    for (const c of [m.joinChoices(LEVELS, null, null), m.joinChoices(LEVELS, "gone", null)]) {
      expect(c.levels.map((t) => t.id)).toEqual(["t-fan", "t-sup", "t-gold"])
      expect(c.unlocking).toEqual([])
      expect(c.lowest).toBeNull()
      expect(c.line).toBeNull()
    }
    expect(m.joinChoices([], "t-sup", 4900).line).toBeNull()
  })

  test("levelsThatUnlock takes the row's price too", () => {
    expect(m.levelsThatUnlock([GOLD, FAN, SUP], "t-hidden", 4900).map((t) => t.id)).toEqual(["t-sup", "t-gold"])
    expect(m.levelsThatUnlock([GOLD, FAN, SUP], "t-hidden").map((t) => t.id)).toEqual(["t-fan", "t-sup", "t-gold"])
  })
})

/* ── 4. MEMBERS_ONLY names the gate ─────────────────────────────── */

describe("the members-only comment refusal", () => {
  test("details {creator_id, tier_required_id} open Join on that creator and level", () => {
    expect(m.membersOnlyGate(httpError(403, "comments_403_members_only_details"))).toEqual({ creatorId: CREATOR, tierRequiredId: T2 })
    expect(m.isMembersOnlyError(httpError(403, "comments_403_members_only_details"))).toBe(true)
  })

  test("no details (an older server), or not that refusal: null", () => {
    expect(m.membersOnlyGate(httpError(403, "comments_403_members_only"))).toBeNull()
    expect(m.membersOnlyGate({ response: { status: 403, data: { error: { code: "MEMBERS_ONLY", details: { tier_required_id: T1 } } } } })).toBeNull()
    expect(m.membersOnlyGate({ response: { status: 403, data: { error: { code: "MEMBERS_ONLY", details: { creator_id: CREATOR } } } } })).toEqual({ creatorId: CREATOR, tierRequiredId: null })
    expect(m.membersOnlyGate({ response: { status: 404, data: { error: { code: "MEMBERS_ONLY", details: { creator_id: CREATOR } } } } })).toBeNull()
  })
})

/* ── 5. my memberships name the creator ─────────────────────────── */

describe("my memberships carry the creator", () => {
  const list = m.toMyMemberships(fixture("memberships_200_named"))

  test("a named creator, and an id-only one (its lookup failed)", () => {
    expect(list[0].creator).toEqual({ id: CREATOR, username: "asha", displayName: "Asha Rao", avatarUrl: "https://cdn.example.test/avatars/asha.jpg" })
    expect(list[0].creatorId).toBe(CREATOR)
    expect(list[1].creator).toEqual({ id: "c0ffee00-0000-4000-8000-000000000002", username: "", displayName: "", avatarUrl: "" })
    expect(m.personName(list[0].creator)).toBe("Asha Rao")
    expect(m.personName(list[1].creator)).toBe("Creator")
  })

  test("only the unnamed ones go to the fallback profile batch", () => {
    expect(m.unnamedCreatorIds(list)).toEqual(["c0ffee00-0000-4000-8000-000000000002"])
    expect(m.unnamedCreatorIds(m.toMyMemberships(fixture("memberships_200")))).toHaveLength(3)
  })

  test("the fallback fills an id-only person; a named one is left alone", () => {
    expect(m.fillPerson(list[1].creator, { username: "gold", display_name: "Gold Studio", avatar_media_id: "m1" })).toEqual({ id: "c0ffee00-0000-4000-8000-000000000002", username: "gold", displayName: "Gold Studio", avatarUrl: "/v1/media/m1/serve" })
    expect(m.fillPerson(list[0].creator, { username: "other", display_name: "Other" })).toBe(list[0].creator)
    expect(m.fillPerson(list[1].creator, undefined)).toBe(list[1].creator)
  })

  test("an avatar must be a site path or http(s)", () => {
    expect(m.toPerson({ id: "x", avatar_url: "javascript:alert(1)" }).avatarUrl).toBe("")
    expect(m.toPerson({ id: "x", avatar_url: "//evil.test/a.png" }).avatarUrl).toBe("")
    expect(m.toPerson({ id: "x", avatar_url: "/v1/media/a/serve" }).avatarUrl).toBe("/v1/media/a/serve")
  })
})

/* ── 6. one membership ──────────────────────────────────────────── */

describe("one membership: GET /memberships/:id", () => {
  test("perks and the booked downgrade", () => {
    const d = m.toMembershipDetail(fixture("membership_detail_200_downgrade"))!
    expect([d.subscriptionId, d.creator.displayName, d.tier.name, d.tier.pricePaise, d.tier.perks, d.status]).toEqual(["5ab0c0de-0000-4000-8000-000000000010", "Asha Rao", "Superfan", 19900, ["Members-only videos", "Monthly live Q&A"], "active"])
    expect(d.pendingDowngrade).toEqual({ tierId: T1, tierName: "Supporter", pricePaise: 4900, effectiveAt: "2026-11-23T09:00:00Z" })
    expect(m.downgradeLine(d.pendingDowngrade!)).toBe("Moves to Supporter (₹49 a month) on 23 Nov 2026. Nothing is charged now.")
  })

  test("none booked, no perks, the creator by id only", () => {
    const d = m.toMembershipDetail(fixture("membership_detail_200_plain"))!
    expect([d.pendingDowngrade, d.tier.perks, d.creator.username, d.status]).toEqual([null, [], "", "cancelled_at_period_end"])
    expect(m.toMembershipDetail({ data: {} })).toBeNull()
    expect(m.toMembershipDetail({ data: { subscription_id: "s", pending_downgrade: { tier_id: "" } } })?.pendingDowngrade).toBeNull()
    expect(m.downgradeLine({ tierId: "t", tierName: "", pricePaise: 0, effectiveAt: "" })).toBe("Moves to a lower level at your next renewal. Nothing is charged now.")
  })

  test("the request, and someone else's is 404 NOT_FOUND", async () => {
    const urls: string[] = []
    const get = spyOn(api, "get").mockImplementation((async (url: string) => {
      urls.push(url)
      return { data: fixture("membership_detail_200_downgrade") }
    }) as never)
    spies.push(get)
    expect((await fetchMembership("5ab0c0de 10"))?.pendingDowngrade?.tierName).toBe("Supporter")
    expect(urls).toEqual(["/v1/monetization/memberships/5ab0c0de%2010"])
    expect(m.toMembershipError(httpError(404, "membership_detail_404"))).toMatchObject({ status: 404, code: "NOT_FOUND" })
  })

  test("the page shows the perks and the pending downgrade", () => {
    const d = m.toMembershipDetail(fixture("membership_detail_200_downgrade"))!
    const out = html(<MembershipDetailView m={d} creator={d.creator} />)
    expect(out).toContain('data-membership="perks"')
    expect(out).toContain("Monthly live Q&amp;A")
    expect(out).toContain('data-membership="pending-downgrade"')
    expect(out).toContain("Moves to Supporter")
    expect(out).toContain("@asha")
    const plain = m.toMembershipDetail(fixture("membership_detail_200_plain"))!
    const none = html(<MembershipDetailView m={plain} creator={plain.creator} />)
    expect(none).not.toContain("pending-downgrade")
    expect(none).not.toContain('data-membership="perks"')
  })
})

/* ── 7. the creator's members ───────────────────────────────────── */

describe("the creator's members: GET /members", () => {
  test("rows with the subscriber, level, since and until; the next cursor", () => {
    const page = m.toCreatorMembersPage(fixture("members_200_page"))
    expect(page.rows.map((r) => [r.subscriber.username, r.subscriber.displayName, r.tier.name, r.tier.pricePaise, r.status, r.since, r.accessUntil])).toEqual([
      ["ravi", "Ravi K", "Superfan", 19900, "active", "2026-10-23T08:00:00Z", "2026-11-23T08:00:00Z"],
      ["", "", "Supporter", 4900, "past_due", "2026-09-01T08:00:00Z", "2026-10-28T08:00:00Z"],
    ])
    expect(page.nextCursor).toBe("MjAyNi0wOS0wMVQwODowMDowMFp8NWFiMGMwZGUtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDIx")
  })

  test("the last page: no cursor; an unsafe avatar dropped; no access_until", () => {
    const page = m.toCreatorMembersPage(fixture("members_200_last"))
    expect(page).not.toHaveProperty("nextCursor")
    expect(page.rows[0].subscriber).toEqual({ id: "b0b00000-0000-4000-8000-000000000003", username: "", displayName: "Meera", avatarUrl: "" })
    expect(page.rows[0].accessUntil).toBe("")
    expect(memberDates(page.rows[0])).toBe("Since 15 Aug 2026")
    expect(m.toCreatorMembersPage({ data: [{ subscription_id: "s" }, { subscriber: { id: "u" } }] }).rows).toEqual([])
  })

  test("limit 1..50, the cursor only when there is one", async () => {
    expect(m.membersListParams()).toEqual({ limit: "30" })
    expect(m.membersListParams("c1", 80)).toEqual({ limit: "50", cursor: "c1" })
    expect(m.membersListParams(null, 0)).toEqual({ limit: "1" })
    expect(m.membersListParams(undefined, 50)).toEqual({ limit: "50" })
    expect(m.membersListParams(undefined, 49.7)).toEqual({ limit: "49" })
    const calls: [string, unknown][] = []
    const get = spyOn(api, "get").mockImplementation((async (url: string, config?: { params?: unknown }) => {
      calls.push([url, config?.params])
      return { data: fixture("members_200_page") }
    }) as never)
    spies.push(get)
    const first = await fetchCreatorMembers()
    await fetchCreatorMembers(first.nextCursor)
    expect(calls).toEqual([
      ["/v1/monetization/members", { limit: "30" }],
      ["/v1/monetization/members", { limit: "30", cursor: first.nextCursor }],
    ])
  })

  test("the page lists each member with their level; a person the server could not name is 'A member'", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } })
    const page = m.toCreatorMembersPage(fixture("members_200_page"))
    qc.setQueryData(MEMBERSHIP_KEYS.creatorMembers, { pages: [page], pageParams: [undefined] })
    const out = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <CreatorMembersScreen />
      </QueryClientProvider>,
    )
    expect(out).toContain('data-membership="creator-members"')
    expect(out).toContain("Ravi K")
    expect(out).toContain('href="/u/ravi"')
    expect(out).toContain("A member")
    expect(out).toContain("Superfan · ₹199 a month")
    expect(out).toMatch(/aria-current="page"[^>]*href="\/monetization\/members">Members<\/a>/)
    expect(out).toContain("Load more")
  })

  test("the new-member notice opens the members list, whatever the server linked", () => {
    expect(m.membershipNotificationCopy("membership_new_member", "Ravi", undefined, "/monetization/tiers")?.link).toBe("/monetization/members")
    expect(creditNotificationHref("membership_new_member", "/monetization/tiers")).toBe(m.CREATOR_MEMBERS_PATH)
    expect(creditNotificationHref("membership_joined", undefined)).toBe("/memberships")
  })
})

function html(node: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } })
  return renderToStaticMarkup(<QueryClientProvider client={qc}>{node}</QueryClientProvider>)
}

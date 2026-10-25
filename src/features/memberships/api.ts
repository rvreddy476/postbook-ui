/*
  Paid memberships, axios only. Every URL and body comes from a builder in
  model.ts (where the tests are); this file only sends them.
*/

import api from "@/lib/api"

import {
  activePatch,
  cancelRequest,
  createTierBody,
  entitlementParams,
  gateRequest,
  membersListParams,
  membershipUrl,
  membersOnlyParams,
  paymentUrl,
  renewRequest,
  subscribeRequest,
  toAccess,
  toCheckout,
  toCreatorMembersPage,
  toEligibility,
  toMembershipDetail,
  toMyMemberships,
  toPaymentReading,
  toTier,
  toTierChange,
  toTiers,
  unwrap,
  upgradeRequest,
  verifyRequest,
  type Access,
  type Checkout,
  type CreatorMember,
  type Eligibility,
  type MembershipDetail,
  type MyMembership,
  type PaymentReading,
  type Tier,
  type TierChangeResult,
  type TierForm,
  type TierPatch,
} from "./model"

const M = "/v1/monetization"

export async function fetchMyLevels(): Promise<Tier[]> {
  const res = await api.get(`${M}/tiers`)
  return toTiers(res.data)
}

export async function fetchCreatorLevels(creatorId: string): Promise<Tier[]> {
  const res = await api.get(`${M}/creators/${encodeURIComponent(creatorId)}/tiers`)
  return toTiers(res.data)
}

export async function createLevel(form: TierForm): Promise<Tier | null> {
  const res = await api.post(`${M}/tiers`, createTierBody(form))
  return toTier(unwrap(res.data))
}

/** PATCH with exactly the fields given; an empty patch is not sent. */
export async function patchLevel(id: string, patch: TierPatch): Promise<Tier | null> {
  if (Object.keys(patch).length === 0) return null
  const res = await api.patch(`${M}/tiers/${encodeURIComponent(id)}`, patch)
  // 200 {status:"updated", tier} (handler.go UpdateTier)
  const data = unwrap(res.data) as { tier?: unknown } | null
  return toTier(data?.tier)
}

export const setLevelActive = (id: string, on: boolean) => patchLevel(id, activePatch(on))

export async function fetchEligibility(creatorId: string): Promise<Eligibility> {
  const res = await api.get(`${M}/creators/${encodeURIComponent(creatorId)}/membership-eligibility`)
  return toEligibility(res.data)
}

export async function startJoin(creatorId: string, tierId: string, idempotencyKey: string): Promise<Checkout> {
  const r = subscribeRequest(creatorId, tierId, idempotencyKey)
  const res = await api.post(r.url, r.body, { headers: r.headers })
  return toCheckout(res.data)
}

export async function startRenewal(subscriptionId: string, idempotencyKey: string): Promise<Checkout> {
  const r = renewRequest(subscriptionId, idempotencyKey)
  const res = await api.post(r.url, r.body, { headers: r.headers })
  return toCheckout(res.data)
}

export async function changeLevel(subscriptionId: string, tierId: string, idempotencyKey: string): Promise<TierChangeResult> {
  const r = upgradeRequest(subscriptionId, tierId, idempotencyKey)
  const res = await api.post(r.url, r.body, { headers: r.headers })
  return toTierChange(res.data)
}

export async function cancelMembership(subscriptionId: string): Promise<void> {
  const r = cancelRequest(subscriptionId)
  await api.post(r.url, r.body)
}

export async function readMembershipPayment(paymentId: string): Promise<PaymentReading> {
  const res = await api.get(paymentUrl(paymentId))
  return toPaymentReading(res.data)
}

/** Advisory: may let the poll say "confirming" sooner; never grants access. Failures are ignored. */
export async function verifyMembershipPayment(paymentId: string, resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }): Promise<void> {
  const r = verifyRequest(paymentId, resp)
  try {
    await api.post(r.url, r.body)
  } catch {
    /* the signed event decides; this only speeds the poll */
  }
}

export async function fetchMyMemberships(): Promise<MyMembership[]> {
  const res = await api.get(`${M}/memberships`)
  return toMyMemberships(res.data)
}

export async function fetchAccess(creatorId: string, tierId?: string | null): Promise<Access> {
  const res = await api.get(`${M}/entitlements`, { params: entitlementParams(creatorId, tierId) })
  return toAccess(res.data)
}

/**
  Members only on a post the caller wrote; null makes it public again. Only
  where no other write fits: a create, a draft and the post PATCH all take
  tier_required_id themselves (gateCreateField / gatePatchField).
*/
export async function setPostMembersOnly(postId: string, tierId: string | null): Promise<void> {
  const r = gateRequest(postId, tierId)
  await api.put(r.url, r.body)
}

/** GET /v1/posts/by-author/:id?members_only=true: only the author's members-only posts, every kind, newest first. */
export async function fetchMembersOnlyRows(authorId: string, cursor?: string, limit = 50): Promise<{ rows: unknown[]; nextCursor?: string }> {
  const res = await api.get(`/v1/posts/by-author/${encodeURIComponent(authorId)}`, { params: membersOnlyParams(cursor, limit) })
  const data = (res.data as { data?: unknown; meta?: { next_cursor?: string } }) ?? {}
  return { rows: Array.isArray(data.data) ? data.data : [], nextCursor: data.meta?.next_cursor || undefined }
}

/** GET /memberships/:subscriptionId: the subscriber's own only (404 NOT_FOUND otherwise). */
export async function fetchMembership(subscriptionId: string): Promise<MembershipDetail | null> {
  const res = await api.get(membershipUrl(subscriptionId))
  return toMembershipDetail(res.data)
}

/** GET /members: one page of the caller's members, as their creator. */
export async function fetchCreatorMembers(cursor?: string, limit?: number): Promise<{ rows: CreatorMember[]; nextCursor?: string }> {
  const res = await api.get(`${M}/members`, { params: membersListParams(cursor, limit) })
  return toCreatorMembersPage(res.data)
}

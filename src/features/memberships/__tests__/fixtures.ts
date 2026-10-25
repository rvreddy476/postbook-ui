import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

/*
  Hand-written fixtures for the membership routes. There are no golden
  files for these routes yet, so each body is built from the Go handler
  and struct that answers it; SOURCES names that code (file:line in
  Architecture/services, as of 23 Oct 2026; the rows marked @2fc016a5d
  cite that commit's line numbers). Replace a fixture with a byte copy
  once the service writes goldens for it.
*/

const M = "monetization-service/internal"
const P = "post-service/internal"

export const SOURCES: Record<string, string> = {
  // @2fc016a5d — membership reads with people, the detail, the members list.
  memberships_200_named: `${M}/http/membership_payments_handler.go:337 ListMyMemberships → []service.MembershipView (${M}/service/membership_reads.go:107); creator per MembershipPerson (:88), {id} only when the profile lookup failed (:98 personOf)`,
  membership_detail_200_downgrade: `${M}/http/membership_payments_handler.go:352 GetMyMembership → service.MembershipDetailView (${M}/service/membership_reads.go:182), perks per perksOf (:194), PendingDowngrade (:173) effective_at = current_period_end (:229)`,
  membership_detail_200_plain: `${M}/service/membership_reads.go:182 MembershipDetailView: pending_downgrade null, perks [] (:196 perksOf), creator {id} only`,
  membership_detail_404: `${M}/http/membership_payments_handler.go:143 writeMembershipError ErrMembershipNotFound → 404 NOT_FOUND (someone else's or unknown)`,
  members_200_page: `${M}/http/membership_payments_handler.go:372 ListCreatorMembers → []service.MemberView (${M}/service/membership_reads.go:254) + meta.next_cursor (base64 activated_at|id, :263)`,
  members_200_last: `${M}/service/membership_reads.go:314 next "" on the last page → no meta; access_until *time.Time null; subscriber per MembershipPerson (:88)`,
  by_author_200_members_only: `${P}/http/handler.go:1353 GetPostsByAuthor ?members_only=true → redacted rows + tier_required_price_paise (${P}/store/postgres/posts.go:144, ${P}/service/members_tiers.go:180 attachTierPrices; absent when unknown)`,
  comments_403_members_only_details: `${P}/http/post_edit.go:556 writeMembersOnlyError → 403 MEMBERS_ONLY details {creator_id, tier_required_id} (:563)`,
  post_create_400_invalid_tier: `${P}/http/handler.go:1188 writeTierGateError ErrInvalidTier → 400 INVALID_TIER (create, drafts, PATCH, PUT)`,
  post_create_503_tiers_unavailable: `${P}/http/handler.go:1191 writeTierGateError ErrTierLookupUnavailable → 503 MEMBERSHIP_TIERS_UNAVAILABLE, nothing written`,
  tiers_mine_200: `${M}/http/handler.go:900 GetMyTiers → []postgres.CreatorTier (${M}/store/postgres/store.go:144); perks is json.RawMessage (null when unset)`,
  tier_patch_200: `${M}/http/handler.go:980 UpdateTier → 200 {status:"updated", tier} (handler.go:1010)`,
  tier_create_409_limit: `${M}/http/handler.go:889 writeTierError ErrTierLimit → 409 TIER_LIMIT`,
  tier_create_403_not_eligible: `${M}/http/membership_payments_handler.go:114 writeMembershipError NotEligibleError → 403 MEMBERSHIPS_NOT_ELIGIBLE details {missing}`,
  eligibility_200_missing: `${M}/http/membership_payments_handler.go:344 GetMembershipEligibility → service.Eligibility (${M}/service/membership_payments.go:572), missing order membership/membership.go:178`,
  eligibility_200_ok: `${M}/service/membership_payments.go:651 Eligible = len(missing) == 0`,
  subscribe_201: `${M}/http/membership_payments_handler.go:178 Subscribe → 201 service.Checkout (${M}/service/membership_payments.go:88) + payments.ClientSession (${M}/payments/client.go:69)`,
  subscribe_201_no_session: `${M}/service/membership_payments.go:129 openCheckout: a local/dev intent may carry no client_session`,
  subscribe_201_replay_paid: `${M}/service/membership_payments.go:92 "A replay of a join that is already paid answers the subscription's status instead, with no client_session"`,
  subscribe_409_already: `${M}/http/membership_payments_handler.go:123 ErrAlreadySubscribed → 409 ALREADY_SUBSCRIBED`,
  subscribe_503_not_enabled: `${M}/http/handler.go:372 launchBoundary membershipGate → 503 {error:{code:"MEMBERSHIPS_NOT_ENABLED"}} (no meta)`,
  upgrade_201: `${M}/http/membership_payments_handler.go:241 UpgradeSubscription: change.Checkout → 201 Checkout kind "upgrade"`,
  upgrade_200_scheduled: `${M}/http/membership_payments_handler.go:274 → 200 service.TierChange (${M}/service/subscription.go:169) status "scheduled"`,
  upgrade_200_upgraded: `${M}/service/subscription.go:159 TierChangeUpgraded: a zero difference applies at once`,
  payment_200_confirming: `${M}/http/membership_payments_handler.go:283 GetMembershipPayment → service.PaymentView (${M}/service/membership_payments.go:156)`,
  payment_200_paid: `${M}/service/membership_payments.go:176 paymentView: paid | refunded → "paid"`,
  payment_200_failed_late: `${M}/service/membership_payments.go:174 paymentView: late capture → "failed" + refund_status`,
  memberships_200: `${M}/http/membership_payments_handler.go:337 ListMyMemberships → []service.MembershipView (${M}/service/membership_reads.go:107, @2fc016a5d); creator {id} only (profile lookup failed or unset); Go's zero time for a never-activated row`,
  entitlement_200_allowed: `${M}/http/entitlement_handler.go:15 CheckEntitlement → service.Entitlement (${M}/service/entitlement.go:34)`,
  entitlement_200_denied: `${M}/service/entitlement.go:34 allowed=false with reason`,
  post_gate_put_200: "post-service/internal/http/handler.go:1149 SetPostMembershipGate → 200 {tier_required_id}",
  comments_403_members_only: "post-service/internal/http/post_edit.go:516 writeMembersOnlyError → 403 MEMBERS_ONLY",
  by_author_200_mixed: "post-service/internal/http/handler.go:1282 GetPostsByAuthor (no type) through redactForViewer (internal/service/members_read.go:62); redacted rows per RedactGatedPost (internal/service/membership.go:273)",
  feed_row_reel_redacted: "feed-service hydrates from POST /v1/posts/batch → redactDetailPtrsForViewer (post-service internal/service/members_read.go:123); a redacted short keeps title, cover, counts, tier_required_id, duration_ms",
  notification_page_memberships: "notification-service internal/service/inbox_copy.go:313 titles, internal/service/membership_notify.go:59 (/monetization/tiers) and :63 MembershipDeepLink (/memberships/{id})",
}

const DIR = join(import.meta.dir, "fixtures")

export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf8"))
}

export function fixtureNames(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort()
}

/** An axios-shaped error carrying a fixture body. */
export function httpError(status: number, name?: string): unknown {
  return { isAxiosError: true, response: { status, data: name ? fixture(name) : {} } }
}

export const NETWORK_ERROR = { isAxiosError: true, message: "Network Error" }

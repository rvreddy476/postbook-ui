"use client"

import { CreatorMembersScreen } from "@/features/memberships/components/CreatorMembers"

/**
 * `/monetization/members` — the creator's members: who, on which level, since
 * when and until when (GET /v1/monetization/members). The new-member notice
 * opens here (the server still links it to /monetization/tiers; the web routes
 * it, features/memberships membershipNotificationCopy).
 */
export default function MembersPage() {
    return <CreatorMembersScreen />
}

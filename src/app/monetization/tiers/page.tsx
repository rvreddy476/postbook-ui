"use client"

import { LevelsScreen } from "@/features/memberships/components/LevelsScreen"

/**
 * `/monetization/tiers` — the creator's membership levels: list, add, edit,
 * turn off, and what is still missing before memberships can be offered.
 * The new-member notice lands here (notification-service
 * MembershipCreatorDeepLink).
 */
export default function TiersPage() {
    return <LevelsScreen />
}

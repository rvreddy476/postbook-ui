'use client'

import AppShell from '@/components/AppShell'
import { MyMembershipsScreen } from '@/features/memberships/components/MyMemberships'

/**
 * `/memberships` — the creators I'm a member of (GET /v1/monetization/memberships).
 * Linked from Settings → Account. Signed-in only (the middleware protects
 * every route not listed as public).
 */
export default function MyMembershipsPage() {
  return (
    <AppShell>
      <MyMembershipsScreen />
    </AppShell>
  )
}

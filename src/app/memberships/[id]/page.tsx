'use client'

import { use } from 'react'

import AppShell from '@/components/AppShell'
import { MembershipDetailScreen } from '@/features/memberships/components/MyMemberships'

/**
 * `/memberships/[id]` — one membership (the subscription id): where every
 * membership notice to the member lands (notification-service
 * MembershipDeepLink). Renew, change level, cancel.
 */
export default function MembershipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <AppShell>
      <MembershipDetailScreen subscriptionId={id} />
    </AppShell>
  )
}

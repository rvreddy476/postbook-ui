'use client'

import AppShell from '@/components/AppShell'
import { CreditRequestsScreen } from '@/features/posttube/credits/components/CreditRequests'

/**
 * `/credits/requests` — the credit_request notification's deep link: the
 * videos that credit me and wait for Accept or Decline. Signed-in only
 * (the middleware protects every route not listed as public).
 */
export default function CreditRequestsPage() {
  return (
    <AppShell>
      <CreditRequestsScreen />
    </AppShell>
  )
}

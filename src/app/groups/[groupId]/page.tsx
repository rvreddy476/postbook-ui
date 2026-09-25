'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import GroupView from '@/components/groups/GroupView'

/**
 * A group's own page.
 *
 * This was a 22-line redirect into `/groups?space=<id>`, which rendered the
 * group inside the directory's middle column. The group is the destination,
 * so it gets the route.
 *
 * Suspense because GroupView reads `?tab=` through useSearchParams, which
 * Next requires a boundary for — the directory page already wraps for the
 * same reason.
 */
export default function GroupPage() {
  const params = useParams()
  const groupIdOrHandle = params.groupId as string

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl space-y-4 p-5">
          <div className="h-52 animate-pulse rounded-2xl bg-brand-secondary" />
          <div className="h-7 w-56 animate-pulse rounded-lg bg-brand-secondary" />
        </div>
      }
    >
      <GroupView groupIdOrHandle={groupIdOrHandle} />
    </Suspense>
  )
}

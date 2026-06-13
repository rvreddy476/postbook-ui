'use client'

import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import AppShell from '@/components/AppShell'
import FriendCard from '@/components/FriendCard'
import {
  usePendingFriendRequests,
  useAcceptFriendRequest,
  useRejectFriendRequest,
} from '@/hooks/useConnections'

export default function FriendRequestsPage() {
  const { data, isLoading } = usePendingFriendRequests()
  const accept = useAcceptFriendRequest()
  const reject = useRejectFriendRequest()

  const items = data?.items ?? []

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl p-4">
        <Link href="/settings" className="text-sm text-neutral-500 hover:text-rose-600">
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold mt-2 mb-6">Friend requests</h1>

        {isLoading ? (
          <div className="py-12 text-center text-neutral-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-neutral-500">
            No pending friend requests.
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {items.map((r) => (
                <FriendCard
                  key={r.user_id}
                  userId={r.user_id}
                  displayName={r.display_name}
                  username={r.username}
                  avatarMediaId={r.avatar_media_id}
                  primaryLabel="Confirm"
                  onPrimary={() => accept.mutate(r.user_id)}
                  primaryDisabled={accept.isPending || reject.isPending}
                  primaryLoading={accept.isPending}
                  secondaryLabel="Delete"
                  onSecondary={() => reject.mutate(r.user_id)}
                  secondaryDisabled={accept.isPending || reject.isPending}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppShell>
  )
}

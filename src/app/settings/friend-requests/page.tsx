'use client'

import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  usePendingFriendRequests,
  useAcceptFriendRequest,
  useRejectFriendRequest,
} from '@/hooks/useConnections'

function mediaUrl(mediaId: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ''
  return `${base}/v1/media/${mediaId}/serve`
}

export default function FriendRequestsPage() {
  const { data, isLoading } = usePendingFriendRequests()
  const accept = useAcceptFriendRequest()
  const reject = useRejectFriendRequest()

  const items = data?.items ?? []

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl p-4">
        <Link href="/settings" className="text-sm text-neutral-500 hover:text-violet-600">
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
          <div className="space-y-2">
            {items.map((r) => (
              <div
                key={r.user_id}
                className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4"
              >
                <Link
                  href={r.username ? `/u/${r.username}` : `/profile?id=${r.user_id}`}
                  className="w-12 h-12 rounded-full bg-neutral-100 overflow-hidden flex items-center justify-center text-neutral-400"
                >
                  {r.avatar_media_id ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(r.avatar_media_id)} alt={r.display_name} className="w-full h-full object-cover" />
                  ) : (
                    r.display_name.charAt(0).toUpperCase()
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.display_name}</div>
                  {r.username ? <div className="text-xs text-neutral-500">@{r.username}</div> : null}
                  <div className="text-xs text-neutral-400 mt-0.5">
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => accept.mutate(r.user_id)}
                    disabled={accept.isPending || reject.isPending}
                    className="bg-violet-600 text-white px-4 py-2 rounded text-sm disabled:bg-gray-300 hover:bg-violet-700"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => reject.mutate(r.user_id)}
                    disabled={accept.isPending || reject.isPending}
                    className="border border-neutral-300 px-4 py-2 rounded text-sm hover:bg-neutral-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

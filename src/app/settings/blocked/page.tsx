'use client'

import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useBlockedUsers, useUnblockUser } from '@/hooks/useBlocking'
import { useBatchProfiles } from '@/hooks/useProfile'

function mediaUrl(mediaId: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ''
  return `${base}/v1/media/${mediaId}/serve`
}

export default function BlockedUsersPage() {
  const { data, isLoading } = useBlockedUsers()
  const unblock = useUnblockUser()

  const items = data?.items ?? []
  const userIds = items.map((b) => b.blocked_id)
  const { data: profileMap } = useBatchProfiles(userIds)

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl p-4">
        <Link href="/settings" className="text-sm text-neutral-500 hover:text-violet-600">
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold mt-2 mb-6">Blocked users</h1>

        {isLoading ? (
          <div className="py-12 text-center text-neutral-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-neutral-500">
            You haven&apos;t blocked anyone.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((b) => {
              const p = profileMap?.get(b.blocked_id)
              const name = p?.display_name ?? p?.username ?? b.blocked_id
              const username = p?.username
              return (
                <div
                  key={b.blocked_id}
                  className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4"
                >
                  <div className="w-12 h-12 rounded-full bg-neutral-100 overflow-hidden flex items-center justify-center text-neutral-400">
                    {p?.avatar_media_id ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(p.avatar_media_id)} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{name}</div>
                    {username ? <div className="text-xs text-neutral-500">@{username}</div> : null}
                    <div className="text-xs text-neutral-400 mt-0.5">
                      Blocked {new Date(b.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (username && confirm(`Unblock ${name}?`)) unblock.mutate(username)
                    }}
                    disabled={unblock.isPending || !username}
                    className="text-sm text-violet-600 hover:underline disabled:opacity-50"
                  >
                    Unblock
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}

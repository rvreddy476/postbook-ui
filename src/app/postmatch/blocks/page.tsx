'use client'

import Link from 'next/link'
import { usePostMatchBlocks, useUnblockPostMatchUser } from '@/hooks/usePostmatch'

export default function PostMatchBlocksPage() {
  const { data, isLoading } = usePostMatchBlocks()
  const unblock = useUnblockPostMatchUser()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#1a1a1a]">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/postmatch/settings" className="text-sm text-[#888] hover:text-white">
            ← Settings
          </Link>
          <h1 className="text-lg font-bold">Blocked users</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {isLoading ? (
          <p className="text-[#888]">Loading…</p>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-16 text-[#888]">
            <div className="text-4xl mb-3">🛡️</div>
            You haven&apos;t blocked anyone.
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((b) => {
              const name = b.blocked_user?.display_name ?? b.blocked_user?.first_name ?? b.blocked_user_id
              return (
                <div
                  key={b.blocked_user_id}
                  className="flex items-center gap-4 rounded-xl border border-[#1a1a1a] bg-[#101010] p-4"
                >
                  <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center overflow-hidden text-[#555]">
                    {b.blocked_user?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.blocked_user.avatar_url} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{name}</div>
                    <div className="text-xs text-[#888]">
                      Blocked {new Date(b.created_at).toLocaleDateString()}
                      {b.reason ? ` · ${b.reason}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Unblock ${name}?`)) unblock.mutate(b.blocked_user_id)
                    }}
                    disabled={unblock.isPending}
                    className="text-sm text-rose-400 hover:text-rose-300 disabled:opacity-50"
                  >
                    Unblock
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

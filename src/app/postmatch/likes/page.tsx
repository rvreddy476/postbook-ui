'use client'

import Link from 'next/link'
import { useLikesReceived } from '@/hooks/usePostmatch'

export default function PostMatchLikesPage() {
  const { data, isLoading } = useLikesReceived()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#1a1a1a]">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/postmatch/discover" className="text-sm text-[#888] hover:text-white">
            ← Discover
          </Link>
          <h1 className="text-lg font-bold">Likes received</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="py-16 text-center text-[#888]">Loading…</div>
        ) : !data || data.length === 0 ? (
          <div className="py-16 text-center text-[#888]">
            <div className="text-4xl mb-4">💌</div>
            <p>No likes yet — keep discovering!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {data.map((l) => (
              <Link
                key={l.user_id}
                href={`/postmatch/discover?profile=${l.user_id}`}
                className="block rounded-2xl overflow-hidden border border-[#1a1a1a] hover:border-rose-500/40 transition-colors bg-[#101010]"
              >
                <div className="aspect-square bg-[#1a1a1a] flex items-center justify-center text-[#555]">
                  {l.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.photo_url} alt={l.first_name} className="w-full h-full object-cover" />
                  ) : (
                    <span>No photo</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-semibold">{l.first_name}</div>
                  <div className="text-xs text-[#888]">
                    {new Date(l.liked_at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

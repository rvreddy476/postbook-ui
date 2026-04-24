'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePostMatchLogout } from '@/hooks/usePostmatch'

type Row = { href: string; label: string; desc: string; icon: string }

const ROWS: Row[] = [
  { href: '/postmatch/preferences', label: 'Preferences', desc: 'Age range, distance, intent, gender', icon: '💝' },
  { href: '/postmatch/likes', label: 'Likes received', desc: 'See who liked your profile', icon: '💌' },
  { href: '/postmatch/blocks', label: 'Blocked users', desc: 'People you have blocked', icon: '🛡️' },
  { href: '/postmatch/profile', label: 'Edit profile', desc: 'Name, bio, photos', icon: '👤' },
]

export default function PostMatchSettingsPage() {
  const router = useRouter()
  const logout = usePostMatchLogout()

  const handleLogout = async () => {
    if (!confirm('Sign out of PostMatch?')) return
    await logout.mutateAsync()
    router.push('/postmatch')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#1a1a1a]">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/postmatch/discover" className="text-sm text-[#888] hover:text-white">
            ← Discover
          </Link>
          <h1 className="text-lg font-bold">Settings</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {ROWS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="flex items-center gap-4 rounded-xl border border-[#1a1a1a] bg-[#101010] p-4 hover:border-rose-500/40 transition-colors"
          >
            <div className="text-2xl">{r.icon}</div>
            <div className="flex-1">
              <div className="font-semibold">{r.label}</div>
              <div className="text-sm text-[#888]">{r.desc}</div>
            </div>
            <div className="text-[#555]">→</div>
          </Link>
        ))}

        <div className="pt-6">
          <button
            onClick={handleLogout}
            disabled={logout.isPending}
            className="w-full bg-transparent border border-[#2a2a2a] text-rose-400 py-3 rounded-xl hover:bg-rose-500/10 disabled:opacity-50"
          >
            {logout.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </main>
    </div>
  )
}

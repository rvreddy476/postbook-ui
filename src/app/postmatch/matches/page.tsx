'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { checkPostMatchAuth, postmatchLoginRedirect } from '@/lib/postmatchGuard'
import { usePostMatchMatches, usePostMatchConversations, useUnmatch, useLikesReceived } from '@/hooks/usePostmatch'

function PostMatchNav({ active }: { active: 'discover' | 'matches' | 'chat' | 'profile' }) {
  const items = [
    { id: 'discover' as const, label: 'Discover', href: '/postmatch/discover', icon: '✦' },
    { id: 'matches' as const, label: 'Matches', href: '/postmatch/matches', icon: '♥' },
    { id: 'chat' as const, label: 'Chat', href: '/postmatch/matches', icon: '💬' },
    { id: 'profile' as const, label: 'Profile', href: '/postmatch/profile', icon: '⚙' },
  ]
  return (
    <nav className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#1a1a1a]">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
        <Link href="/postmatch" className="text-sm font-black bg-gradient-to-r from-rose-600 to-orange-500 bg-clip-text text-transparent">PostMatch</Link>
        <div className="flex gap-1">
          {items.map(i => (
            <Link key={i.id} href={i.href} className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${active === i.id ? 'bg-rose-50 text-rose-600' : 'text-[#666] hover:text-white'}`}>
              <span className="mr-1">{i.icon}</span>{i.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

export default function MatchesPage() {
  const router = useRouter()
  const { data: matches = [], isLoading: loadingMatches } = usePostMatchMatches()
  const { data: conversations = [], isLoading: loadingConvos } = usePostMatchConversations()
  const { data: likesReceived = [] } = useLikesReceived()
  const unmatch = useUnmatch()

  useEffect(() => {
    const state = checkPostMatchAuth()
    if (state === 'unauthenticated') router.replace(postmatchLoginRedirect('/postmatch/matches'))
    else if (state === 'needs_onboarding') router.replace('/postmatch/onboarding')
  }, [router])

  const isLoading = loadingMatches || loadingConvos

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <PostMatchNav active="matches" />

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Likes You */}
        {likesReceived.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-orange-500">Likes You</h2>
              <span className="w-5 h-5 rounded-full bg-gradient-to-r from-rose-600 to-orange-500 flex items-center justify-center text-[10px] font-black text-white">
                {likesReceived.length}
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {likesReceived.map(l => (
                <Link
                  key={l.user_id}
                  href="/postmatch/discover"
                  className="flex-shrink-0 flex flex-col items-center group"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-rose-400 p-[3px] relative">
                    <div className="w-full h-full rounded-full bg-[#1a1a1a] overflow-hidden">
                      {l.photo_url ? (
                        <img src={l.photo_url} alt="" className="w-full h-full object-cover blur-sm" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#555] text-2xl font-black">
                          {l.first_name[0]}
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-gradient-to-r from-rose-600 to-orange-500 flex items-center justify-center text-white text-xs">
                      ♥
                    </div>
                  </div>
                  <span className="text-xs font-bold text-white mt-1.5 group-hover:text-orange-600 transition truncate max-w-[80px]">
                    {l.first_name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* New Matches */}
        <div className="mb-8">
          <h2 className="text-xs font-black uppercase tracking-widest text-rose-500 mb-4">New Matches</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : matches.length === 0 ? (
            <div className="bg-[#111] rounded-2xl border border-[#222] p-8 text-center">
              <div className="text-4xl mb-3">♡</div>
              <h3 className="font-bold text-white mb-1">No matches yet</h3>
              <p className="text-[#666] text-sm mb-4">Keep discovering — your match is out there!</p>
              <Link href="/postmatch/discover" className="inline-block px-5 py-2.5 bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-xl font-bold text-sm">
                Discover
              </Link>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {matches.map(m => (
                <button
                  key={m.id}
                  onClick={() => m.conversation_id && router.push(`/postmatch/chat/${m.conversation_id}`)}
                  className="flex-shrink-0 flex flex-col items-center group"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 p-[3px]">
                    <div className="w-full h-full rounded-full bg-[#1a1a1a] overflow-hidden">
                      {m.other_user?.photo_url ? (
                        <img src={m.other_user.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#555] text-2xl font-black">
                          {m.other_user?.first_name?.[0] ?? '?'}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-white mt-1.5 group-hover:text-rose-600 transition truncate max-w-[80px]">
                    {m.other_user?.first_name ?? 'Match'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversations */}
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-[#666] mb-4">Conversations</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="bg-[#111] rounded-2xl border border-[#222] p-6 text-center">
              <p className="text-[#666] text-sm">No conversations yet. Match with someone to start chatting!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map(c => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/postmatch/chat/${c.id}`)}
                  className="w-full bg-[#111] rounded-2xl border border-[#222] p-4 flex items-center gap-4 hover:border-rose-200 hover:shadow-md hover:shadow-rose-500/5 transition text-left group"
                >
                  <div className="w-14 h-14 rounded-full bg-[#1a1a1a] flex-shrink-0 overflow-hidden">
                    <div className="w-full h-full flex items-center justify-center text-[#555] text-xl font-black">
                      {c.other_user?.first_name?.[0] ?? '?'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white group-hover:text-rose-600 transition">{c.other_user?.first_name ?? 'Unknown'}</h3>
                      {c.last_message && (
                        <span className="text-[10px] text-[#555] font-bold">
                          {new Date(c.last_message.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#666] truncate mt-0.5">
                      {c.last_message?.body_text || 'Start the conversation...'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, Check, Clock, Plus, X } from 'lucide-react'
import { useJoinCommunity } from '@/hooks/useCommunities'
import type { Community } from '@/types/communities'

interface CommunityCardProps {
  community: Community
  /** When rendered under "My Communities" tab, force membership display */
  isMyCommunity?: boolean
}

const categoryEmojis: Record<string, string> = {
  technology: '💻', gaming: '🎮', 'art & design': '🎨', education: '📚',
  music: '🎵', sports: '⚽', food: '🍕', travel: '✈️',
  photography: '📸', business: '💼', wellness: '🧘', 'film & tv': '🎬',
}

const gradients = [
  'from-violet-400 to-purple-300',
  'from-sky-400 to-blue-300',
  'from-emerald-400 to-teal-300',
  'from-amber-400 to-orange-300',
  'from-rose-400 to-pink-300',
  'from-indigo-400 to-blue-300',
]

function hashIndex(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % gradients.length
  return h
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const CommunityCard: React.FC<CommunityCardProps> = ({ community, isMyCommunity }) => {
  const joinMut = useJoinCommunity()
  const [toast, setToast] = useState<string | null>(null)

  const viewerRole = community.viewer_role ?? (isMyCommunity ? 'member' : 'outsider')
  const isMember = viewerRole !== 'outsider' && viewerRole !== 'pending' && !!viewerRole
  const isPending = viewerRole === 'pending'
  const isPrivate = community.community_type === 'private' || community.join_mode === 'request' || community.join_mode === 'invite_only'

  const idx = hashIndex(community.name)
  const emoji = categoryEmojis[community.category?.toLowerCase() ?? ''] ?? '🌐'

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const handleJoin = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    joinMut.mutate(community.id, {
      onSuccess: (data: any) => {
        const status = data?.data?.status ?? data?.status
        if (status === 'pending' || isPrivate) {
          setToast('Request sent! Waiting for admin approval.')
        } else {
          setToast('You joined the community!')
        }
      },
      onError: () => setToast('Failed to join. Try again.'),
    })
  }

  return (
    <Link
      href={`/communities/${community.id}`}
      className="group/card flex items-center gap-4 p-4 rounded-2xl border border-brand-divider/60 bg-white/70 dark:bg-brand-bg/70 backdrop-blur-md hover:bg-white dark:hover:bg-brand-bg hover:border-brand-text/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative"
    >
      {/* Avatar */}
      <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 shadow-md ring-1 ring-black/5 dark:ring-white/10 group-hover/card:scale-105 transition-transform duration-300">
        {community.avatar_media_id ? (
          <img
            src={`/v1/media/${community.avatar_media_id}/serve`}
            alt={community.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradients[idx]} flex items-center justify-center text-white font-black text-2xl`}>
            {emoji}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[13px] font-bold text-brand-text truncate leading-tight">{community.name}</h3>
          {community.is_verified && (
            <svg className="w-3.5 h-3.5 text-brand-text flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-brand-text/45">
          <span className="flex items-center gap-0.5">
            <Users className="w-3 h-3" />
            {formatCount(community.member_count)} members
          </span>
          {community.category && (
            <>
              <span className="text-brand-text/20">·</span>
              <span className="truncate max-w-[80px]">{community.category}</span>
            </>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="flex-shrink-0">
        {isMember ? (
          <span className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-text/5 border border-brand-text/20 text-brand-text rounded-full text-[11px] font-bold">
            <Check className="w-3.5 h-3.5" />
            Joined
          </span>
        ) : isPending ? (
          <span className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full text-[11px] font-bold">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joinMut.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-text text-brand-bg rounded-full text-[11px] font-bold hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            <Plus className="w-3.5 h-3.5" />
            Join
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 bg-brand-text text-brand-bg text-[11px] font-semibold rounded-lg shadow-lg whitespace-nowrap">
          {toast}
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setToast(null) }}>
            <X className="w-3 h-3 opacity-60" />
          </button>
        </div>
      )}
    </Link>
  )
}

export default CommunityCard

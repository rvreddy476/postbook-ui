'use client'

import React from 'react'
import Link from 'next/link'
import { useJoinCommunity } from '@/hooks/useCommunities'
import type { Community } from '@/types/communities'

interface CommunityCardProps {
  community: Community
}

const categoryGradients: Record<string, string> = {
  technology: 'from-slate-700 to-slate-500',
  gaming: 'from-zinc-700 to-zinc-500',
  'art & design': 'from-stone-700 to-stone-500',
  education: 'from-neutral-700 to-neutral-500',
  music: 'from-gray-700 to-gray-500',
  sports: 'from-slate-600 to-zinc-500',
  food: 'from-stone-600 to-neutral-500',
  travel: 'from-zinc-600 to-gray-500',
  photography: 'from-neutral-600 to-slate-500',
  business: 'from-gray-600 to-stone-500',
  wellness: 'from-slate-500 to-neutral-500',
  'film & tv': 'from-zinc-500 to-gray-500',
}

const categoryEmojis: Record<string, string> = {
  technology: '💻',
  gaming: '🎮',
  'art & design': '🎨',
  education: '📚',
  music: '🎵',
  sports: '⚽',
  food: '🍕',
  travel: '✈️',
  photography: '📸',
  business: '💼',
  wellness: '🧘',
  'film & tv': '🎬',
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const CommunityCard: React.FC<CommunityCardProps> = ({ community }) => {
  const joinMut = useJoinCommunity()

  const isMember = community.viewer_role && community.viewer_role !== 'outsider'
  const gradient =
    categoryGradients[community.category?.toLowerCase() ?? ''] ?? 'from-slate-700 to-slate-500'
  const emoji = categoryEmojis[community.category?.toLowerCase() ?? ''] ?? '🌐'

  return (
    <div className="bg-white rounded-2xl border border-brand-divider overflow-hidden hover:shadow-lg hover:border-brand-text/20 transition-all duration-300 group/card flex flex-col">
      <Link href={`/communities/${community.id}`}>
        <div className="h-[100px] relative overflow-hidden">
          {community.banner_media_id ? (
            <img
              src={`/v1/media/${community.banner_media_id}/serve`}
              alt=""
              className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
            />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
            >
              <span className="text-4xl opacity-40">{emoji}</span>
            </div>
          )}
        </div>
      </Link>

      <div className="p-4 flex-1 flex flex-col">
        <Link href={`/communities/${community.id}`} className="flex-1">
          <h3 className="text-sm font-bold text-brand-text truncate" style={{ fontWeight: 700 }}>
            {community.name}
          </h3>
          <p className="text-[11px] text-brand-text/50 font-mono mt-0.5">@{community.handle}</p>

          {community.description && (
            <p className="text-xs text-brand-text/60 mt-1.5 line-clamp-2 leading-relaxed">
              {community.description}
            </p>
          )}
        </Link>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-[11px] font-mono text-brand-text/60">
            {formatCount(community.member_count)} members
          </span>
          <span className="text-brand-text/20">|</span>
          <span className="text-[11px] font-mono text-brand-text/60">
            {community.space_count} spaces
          </span>
          {community.category && (
            <>
              <span className="text-brand-text/20">|</span>
              <span className="px-2 py-0.5 bg-brand-bg text-brand-text/60 text-[10px] font-semibold rounded-full truncate max-w-[90px]">
                {community.category}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-brand-divider">
          <div className="flex items-center">
            {community.mutual_members && community.mutual_members.length > 0 ? (
              <div className="flex -space-x-1.5">
                {community.mutual_members.slice(0, 3).map((member, index) => (
                  <div
                    key={member.user_id}
                    className="w-5 h-5 rounded-full border border-white bg-brand-bg flex items-center justify-center overflow-hidden"
                    style={{ zIndex: 3 - index }}
                  >
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[8px] font-bold text-brand-text/40">
                        {member.display_name?.charAt(0) ?? '?'}
                      </span>
                    )}
                  </div>
                ))}
                {community.mutual_members.length > 3 && (
                  <span className="text-[10px] text-brand-text/40 ml-1.5">
                    +{community.mutual_members.length - 3}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[10px] text-brand-text/30">No mutual members</span>
            )}
          </div>

          {isMember ? (
            <span className="px-3 py-1 border border-brand-divider text-brand-text text-xs font-semibold rounded-lg">
              Joined
            </span>
          ) : (
            <button
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                joinMut.mutate(community.id)
              }}
              disabled={joinMut.isPending}
              className="px-3 py-1 bg-brand-text text-brand-bg text-xs font-bold rounded-lg hover:bg-brand-text/90 transition-colors disabled:opacity-60"
            >
              Join
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CommunityCard

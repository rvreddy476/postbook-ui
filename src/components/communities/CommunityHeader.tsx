'use client'

import React, { useState } from 'react'
import { BadgeCheck, Bell, Share2, MoreHorizontal, ChevronDown } from 'lucide-react'
import { useJoinCommunity, useLeaveCommunity } from '@/hooks/useCommunities'
import type { Community } from '@/types/communities'

interface CommunityHeaderProps {
  community: Community
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const CommunityHeader: React.FC<CommunityHeaderProps> = ({ community }) => {
  const joinMut = useJoinCommunity()
  const leaveMut = useLeaveCommunity()
  const [showLeaveMenu, setShowLeaveMenu] = useState(false)

  const isMember = community.viewer_role && community.viewer_role !== 'outsider'
  const gradient = 'from-slate-700 to-slate-500'
  const avatarSrc = community.avatar_media_id
    ? `/v1/media/${community.avatar_media_id}/serve`
    : null

  return (
    <div className="bg-white rounded-2xl border border-brand-divider overflow-hidden">
      {/* Cover (120px) with overlay */}
      <div className="h-[120px] relative overflow-hidden">
        {community.banner_media_id ? (
          <img
            src={`/v1/media/${community.banner_media_id}/serve`}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} opacity-80`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      </div>

      {/* Info section */}
      <div className="px-6 pb-5 -mt-10 relative">
        {/* Avatar overlapping cover */}
        <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-xl mb-3 inline-block">
          <div className="w-full h-full rounded-xl overflow-hidden">
            {avatarSrc ? (
              <img src={avatarSrc} alt={community.name} className="w-full h-full object-cover" />
            ) : (
              <div
                className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-2xl`}
              >
                {community.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Name + verified */}
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-brand-text truncate" style={{ fontWeight: 700 }}>
                {community.name}
              </h1>
              {community.is_verified && (
                <BadgeCheck className="w-5 h-5 text-brand-text flex-shrink-0" />
              )}
            </div>

            {/* Handle */}
            <p className="text-sm text-brand-text/50 font-mono">@{community.handle}</p>

            {/* Category + members + spaces */}
            <div className="flex items-center gap-3 mt-2 text-sm text-brand-text/60 font-mono">
              {community.category && (
                <>
                  <span>{community.category}</span>
                  <span className="text-brand-text/20">·</span>
                </>
              )}
              <span>{formatCount(community.member_count)} members</span>
              <span className="text-brand-text/20">·</span>
              <span>{community.space_count} spaces</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 pt-2">
            {isMember ? (
              <div className="relative">
                <button
                  onClick={() => setShowLeaveMenu(!showLeaveMenu)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-brand-divider text-brand-text text-sm font-semibold rounded-xl hover:bg-brand-bg transition-colors"
                >
                  Joined ✓
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showLeaveMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-brand-divider rounded-xl shadow-lg py-1 z-10 min-w-[120px]">
                    <button
                      onClick={() => {
                        leaveMut.mutate(community.id)
                        setShowLeaveMenu(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-brand-text/70 hover:bg-brand-bg transition-colors"
                    >
                      Leave Community
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => joinMut.mutate(community.id)}
                disabled={joinMut.isPending}
                className="flex items-center gap-1.5 px-5 py-2 bg-brand-text text-brand-bg text-sm font-bold rounded-xl hover:bg-brand-text/90 transition-colors shadow-sm"
              >
                Join
              </button>
            )}
            <button className="p-2 border border-brand-divider text-brand-text rounded-xl hover:bg-brand-bg transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <button className="p-2 border border-brand-divider text-brand-text rounded-xl hover:bg-brand-bg transition-colors">
              <Share2 className="w-4 h-4" />
            </button>
            <button className="p-2 border border-brand-divider text-brand-text rounded-xl hover:bg-brand-bg transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommunityHeader

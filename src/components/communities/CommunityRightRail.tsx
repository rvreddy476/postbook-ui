'use client'

import React, { useMemo } from 'react'
import { Shield, BookOpen, Users } from 'lucide-react'
import { useCommunityMembers, useCommunity } from '@/hooks/useCommunities'
import { useBatchProfiles } from '@/hooks/useProfile'
import { ROLE_BADGE_CONFIG } from '@/lib/communityRoles'

interface Props {
  communityId: string
  viewerRole?: string
}

export default function CommunityRightRail({ communityId }: Props) {
  const { data: community } = useCommunity(communityId)
  const { data: members } = useCommunityMembers(communityId)

  // Filter admins/mods
  const adminMods = useMemo(
    () => (members ?? []).filter(m => ['owner', 'admin', 'moderator'].includes(m.role)).slice(0, 5),
    [members]
  )

  const adminIds = useMemo(() => adminMods.map(m => m.user_id), [adminMods])
  const { data: profileMap } = useBatchProfiles(adminIds)

  return (
    <div className="space-y-4 sticky top-24">
      {/* Admins & Moderators */}
      {adminMods.length > 0 && (
        <div className="bg-white border border-brand-divider rounded-2xl p-4">
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-brand-text/60 uppercase tracking-wide mb-3">
            <Shield className="w-3.5 h-3.5" /> Admins & Mods
          </h4>
          <div className="space-y-2">
            {adminMods.map(m => {
              const profile = profileMap?.get(m.user_id)
              const name = profile?.display_name || profile?.username || m.display_name || m.user_id.slice(0, 8)
              const avatar = profile?.avatar_media_id ? `/v1/media/${profile.avatar_media_id}/serve` : m.avatar_url
              const badge = ROLE_BADGE_CONFIG[m.role]

              return (
                <div key={m.user_id} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-brand-bg flex items-center justify-center shrink-0">
                    {avatar ? (
                      <img src={avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-brand-text/30">{name[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-brand-text truncate flex-1">{name}</span>
                  {badge && (
                    <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-full uppercase ${badge.color}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Community Rules */}
      {community?.rules && community.rules.length > 0 && (
        <div className="bg-white border border-brand-divider rounded-2xl p-4">
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-brand-text/60 uppercase tracking-wide mb-3">
            <BookOpen className="w-3.5 h-3.5" /> Rules
          </h4>
          <ol className="space-y-1.5">
            {community.rules.slice(0, 3).map((rule, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-brand-text/70">
                <span className="font-mono text-brand-text/30 text-[10px] mt-0.5">{i + 1}.</span>
                <span className="line-clamp-2">{rule}</span>
              </li>
            ))}
          </ol>
          {community.rules.length > 3 && (
            <p className="text-[10px] text-brand-text/40 mt-2">+{community.rules.length - 3} more rules</p>
          )}
        </div>
      )}

      {/* About snippet */}
      {community && (
        <div className="bg-white border border-brand-divider rounded-2xl p-4">
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-brand-text/60 uppercase tracking-wide mb-3">
            <Users className="w-3.5 h-3.5" /> About
          </h4>
          <div className="space-y-2 text-xs text-brand-text/60">
            <div className="flex justify-between">
              <span>Members</span>
              <span className="font-semibold text-brand-text">{community.member_count.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Spaces</span>
              <span className="font-semibold text-brand-text">{community.space_count}</span>
            </div>
            {community.category && (
              <div className="flex justify-between">
                <span>Category</span>
                <span className="font-semibold text-brand-text">{community.category}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Type</span>
              <span className="font-semibold text-brand-text capitalize">{community.community_type}</span>
            </div>
            <div className="flex justify-between">
              <span>Created</span>
              <span className="font-mono text-brand-text/70 text-[10px]">
                {new Date(community.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import React from 'react'
import Link from 'next/link'
import { Globe, Lock, Users } from 'lucide-react'
import type { Group } from '@/types/groups'

interface GroupCardProps {
  group: Group
}

const GroupCard: React.FC<GroupCardProps> = ({ group }) => {
  const avatarSrc = group.avatar_media_id
    ? `/v1/media/${group.avatar_media_id}/serve`
    : null

  return (
    <Link href={`/groups/${group.id}`}>
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg hover:border-violet-200 transition-all duration-300 cursor-pointer group/card">
        {/* Cover */}
        <div className="h-24 relative overflow-hidden">
          {group.cover_media_id ? (
            <img
              src={`/v1/media/${group.cover_media_id}/serve`}
              alt=""
              className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full orchid-gradient opacity-60" />
          )}
        </div>

        {/* Content */}
        <div className="p-4 -mt-6 relative">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-xl bg-white border-2 border-white shadow-md overflow-hidden mb-3">
            {avatarSrc ? (
              <img src={avatarSrc} alt={group.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full orchid-gradient flex items-center justify-center text-white font-black text-lg">
                {group.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <h3 className="text-sm font-black text-slate-800 truncate">{group.name}</h3>

          {group.description && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{group.description}</p>
          )}

          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1 text-slate-400">
              {group.visibility === 'public' ? (
                <Globe className="w-3 h-3" />
              ) : (
                <Lock className="w-3 h-3" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {group.visibility}
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Users className="w-3 h-3" />
              <span className="text-[10px] font-bold">
                {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default GroupCard

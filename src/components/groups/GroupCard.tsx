'use client'

import React from 'react'
import Link from 'next/link'
import { Globe, Lock, Shield, Users, MessageSquare } from 'lucide-react'
import type { Group } from '@/types/groups'

interface GroupCardProps {
  group: Group
}

const categoryGradients: Record<string, string> = {
  gaming: 'from-violet-600 to-indigo-600',
  technology: 'from-cyan-600 to-blue-600',
  music: 'from-pink-600 to-rose-600',
  sports: 'from-green-600 to-emerald-600',
  art: 'from-amber-500 to-orange-600',
  food: 'from-yellow-500 to-orange-500',
  travel: 'from-teal-500 to-cyan-600',
  education: 'from-blue-600 to-violet-600',
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const GroupCard: React.FC<GroupCardProps> = ({ group }) => {
  const avatarSrc = group.avatar_media_id
    ? `/v1/media/${group.avatar_media_id}/serve`
    : null

  const gradient = categoryGradients[group.category?.toLowerCase() ?? ''] || 'from-slate-600 to-slate-800'
  const privacy = group.privacy_level ?? (group.visibility === 'private' ? 'private' : 'public')

  const privacyConfig = {
    public: { icon: <Globe className="w-3 h-3" />, label: 'Public', color: 'text-emerald-500' },
    restricted: { icon: <Shield className="w-3 h-3" />, label: 'Restricted', color: 'text-amber-500' },
    private: { icon: <Lock className="w-3 h-3" />, label: 'Private', color: 'text-rose-500' },
  }
  const privacyInfo = privacyConfig[privacy] ?? privacyConfig.public

  return (
    <Link href={`/groups/${group.handle || group.id}`}>
      <div className="bg-brand-card rounded-2xl border border-brand-divider overflow-hidden hover:shadow-lg hover:border-brand-divider transition-all duration-300 cursor-pointer group/card">
        {/* Cover */}
        <div className="h-28 relative overflow-hidden">
          {group.cover_media_id ? (
            <img
              src={`/v1/media/${group.cover_media_id}/serve`}
              alt=""
              className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} opacity-80`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

          {/* Privacy badge on cover */}
          <div className="absolute top-2.5 right-2.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-card/90 backdrop-blur-sm ${privacyInfo.color}`}>
              {privacyInfo.icon} {privacyInfo.label}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 -mt-7 relative">
          {/* Avatar */}
          <div className="w-13 h-13 rounded-xl bg-brand-card p-0.5 shadow-lg mb-2.5 inline-block">
            <div className="w-12 h-12 rounded-[10px] overflow-hidden">
              {avatarSrc ? (
                <img src={avatarSrc} alt={group.name} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-lg`}>
                  {group.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <h3 className="text-sm font-bold text-slate-800 truncate">{group.name}</h3>

          {group.handle && (
            <p className="text-[11px] text-brand-text/60 font-medium mt-0.5">@{group.handle}</p>
          )}

          {group.description && (
            <p className="text-xs text-brand-text/60 mt-1.5 line-clamp-2 leading-relaxed">{group.description}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-50">
            <div className="flex items-center gap-1 text-brand-text/60">
              <Users className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">
                {formatCount(group.member_count)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-brand-text/60">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">
                {formatCount(group.post_count)}
              </span>
            </div>
            {group.category && (
              <span className="ml-auto px-2 py-0.5 bg-brand-secondary text-brand-text/60 text-[10px] font-semibold rounded-full truncate max-w-[80px]">
                {group.category}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default GroupCard

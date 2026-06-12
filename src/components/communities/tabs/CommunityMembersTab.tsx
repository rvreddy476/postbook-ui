'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Users, Search, MoreHorizontal, Shield, UserX, ArrowUpDown } from 'lucide-react'
import { useCommunityMembers } from '@/hooks/useCommunities'
import { useBatchProfiles } from '@/hooks/useProfile'
import { useChangeMemberRole, useBanMember } from '@/hooks/useCommunityAdmin'
import { ROLE_BADGE_CONFIG, isAtLeast, canManageRole } from '@/lib/communityRoles'
import type { CommunityRole } from '@/types/communities'

interface Props {
  communityId: string
  viewerRole?: CommunityRole | string
}

type Filter = 'all' | 'admin' | 'moderator' | 'member' | 'pending'

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'admin', label: 'Admins' },
  { key: 'moderator', label: 'Moderators' },
  { key: 'member', label: 'Members' },
  { key: 'pending', label: 'Pending' },
]

const avatarColors = [
  'from-amber-200 to-orange-300', 'from-blue-200 to-cyan-300',
  'from-emerald-200 to-teal-300', 'from-purple-200 to-pink-300',
]

function pickColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

export default function CommunityMembersTab({ communityId, viewerRole }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const { data: members, isLoading } = useCommunityMembers(communityId)
  const canAdmin = isAtLeast(viewerRole, 'moderator')

  // Batch profile enrichment
  const memberIds = useMemo(() => (members ?? []).map(m => m.user_id), [members])
  const { data: profileMap } = useBatchProfiles(memberIds)

  const enriched = useMemo(() => (members ?? []).map(m => {
    const p = profileMap?.get(m.user_id)
    return {
      ...m,
      display_name: p?.display_name || p?.username || m.display_name || m.username || m.user_id.slice(0, 8),
      avatar_url: p?.avatar_media_id ? `/v1/media/${p.avatar_media_id}/serve` : m.avatar_url,
    }
  }), [members, profileMap])

  // Filter
  const filtered = useMemo(() => {
    let list = enriched
    if (filter === 'admin') list = list.filter(m => m.role === 'admin' || m.role === 'owner')
    else if (filter !== 'all') list = list.filter(m => m.role === filter)
    if (search.length >= 2) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        m.display_name?.toLowerCase().includes(q) ||
        m.username?.toLowerCase().includes(q) ||
        m.user_id.toLowerCase().includes(q)
      )
    }
    return list
  }, [enriched, filter, search])

  // Group by role section (when filter=all)
  const sections = useMemo(() => {
    if (filter !== 'all') return [{ title: '', members: filtered }]
    const admins = filtered.filter(m => ['owner', 'admin'].includes(m.role))
    const mods = filtered.filter(m => m.role === 'moderator')
    const rest = filtered.filter(m => !['owner', 'admin', 'moderator'].includes(m.role))
    const result: { title: string; members: typeof filtered }[] = []
    if (admins.length > 0) result.push({ title: 'Admins & Owners', members: admins })
    if (mods.length > 0) result.push({ title: 'Moderators', members: mods })
    if (rest.length > 0) result.push({ title: 'Members', members: rest })
    return result
  }, [filtered, filter])

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 bg-brand-card border border-brand-divider rounded-xl animate-pulse">
            <div className="w-10 h-10 rounded-full bg-brand-bg" />
            <div className="flex-1"><div className="h-3 w-24 bg-brand-bg rounded mb-1" /><div className="h-2 w-16 bg-brand-bg rounded" /></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Filter chips */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
        {filters.filter(f => f.key !== 'pending' || canAdmin).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === f.key ? 'bg-brand-text text-brand-bg' : 'bg-brand-card border border-brand-divider text-brand-text/60 hover:bg-brand-bg'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/30" />
        <input
          type="text"
          placeholder="Search members..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-brand-card border border-brand-divider rounded-xl text-sm placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/20 text-brand-text"
        />
      </div>

      {/* Sections */}
      {sections.map((section, si) => (
        <div key={si} className="mb-4">
          {section.title && (
            <h3 className="text-xs font-bold text-brand-text/50 uppercase tracking-wide mb-2">{section.title}</h3>
          )}
          <div className="space-y-2">
            {section.members.map(member => (
              <MemberRow
                key={member.user_id}
                member={member}
                communityId={communityId}
                viewerRole={viewerRole}
                canAdmin={canAdmin}
              />
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-8 h-8 text-brand-text/20 mx-auto mb-2" />
          <p className="text-sm text-brand-text/50">{search ? 'No members found' : 'No members to show'}</p>
        </div>
      )}
    </div>
  )
}

function MemberRow({ member, communityId, viewerRole, canAdmin }: {
  member: { user_id: string; display_name?: string; username?: string; avatar_url?: string; role: string; joined_at: string }
  communityId: string
  viewerRole?: string
  canAdmin: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const changeRole = useChangeMemberRole(communityId)
  const ban = useBanMember(communityId)
  const badge = ROLE_BADGE_CONFIG[member.role]
  const showMenu = canAdmin && canManageRole(viewerRole, member.role)
  const gradient = pickColor(member.user_id)

  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-card border border-brand-divider">
      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-sm font-bold text-white`}>
            {(member.display_name || '?')[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-brand-text truncate">{member.display_name}</p>
        {member.username && <p className="text-[11px] font-mono text-brand-text/50">@{member.username}</p>}
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${badge.color}`}>
            {badge.label}
          </span>
        )}
        <span className="text-[10px] font-mono text-brand-text/40">
          {new Date(member.joined_at).toLocaleDateString()}
        </span>
        {showMenu && (
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-text/30 hover:bg-brand-bg transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-brand-card border border-brand-divider rounded-xl shadow-lg z-50 py-1">
                {isAtLeast(viewerRole, 'admin') && member.role === 'member' && (
                  <button onClick={() => { changeRole.mutate({ userId: member.user_id, role: 'moderator' }); setMenuOpen(false) }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                    <ArrowUpDown className="w-3.5 h-3.5" /> Promote to Moderator
                  </button>
                )}
                {isAtLeast(viewerRole, 'admin') && member.role === 'moderator' && (
                  <button onClick={() => { changeRole.mutate({ userId: member.user_id, role: 'member' }); setMenuOpen(false) }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                    <ArrowUpDown className="w-3.5 h-3.5" /> Demote to Member
                  </button>
                )}
                <div className="border-t border-brand-divider my-1" />
                <button onClick={() => {
                  const reason = prompt('Ban reason (optional):')
                  ban.mutate({ userId: member.user_id, reason: reason || undefined })
                  setMenuOpen(false)
                }}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 w-full text-left">
                  <UserX className="w-3.5 h-3.5" /> Ban Member
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

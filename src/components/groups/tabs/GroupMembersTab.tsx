'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useGroupMembers, useUpdateMemberRole, useRemoveMember, useBanMember } from '@/hooks/useGroups'
import {
  Crown, ShieldCheck, Wrench, UserMinus, Search, Shield,
  MoreHorizontal, ChevronDown, Ban
} from 'lucide-react'
import type { GroupMember } from '@/types/groups'

interface GroupMembersTabProps {
  groupId: string
  currentUserRole: string | null
}

const roleConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  owner: { label: 'Owner', icon: <Crown className="w-3 h-3" />, color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-100' },
  admin: { label: 'Admin', icon: <ShieldCheck className="w-3 h-3" />, color: 'text-violet-600', bgColor: 'bg-violet-50 border-violet-100' },
  moderator: { label: 'Mod', icon: <Wrench className="w-3 h-3" />, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-100' },
  member: { label: 'Member', icon: <Shield className="w-3 h-3" />, color: 'text-brand-highlight', bgColor: 'bg-brand-secondary border-brand-divider' },
}

function MemberCard({
  member,
  canManage,
  isAdmin,
  onRoleChange,
  onRemove,
  onBan,
}: {
  member: GroupMember
  canManage: boolean
  isAdmin: boolean
  onRoleChange: (member: GroupMember, newRole: string) => void
  onRemove: (member: GroupMember) => void
  onBan: (member: GroupMember) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const badge = roleConfig[member.role] || roleConfig.member
  const avatarSrc = member.avatar_media_id ? `/v1/media/${member.avatar_media_id}/serve` : null
  // Owner can manage anyone except themselves; admins can manage mods and members only
  const isOwnerViewer = isAdmin && canManage // isAdmin includes owner check from parent
  const canManageThis = member.role === 'owner'
    ? false // nobody manages the owner
    : member.role === 'admin'
      ? isOwnerViewer // only owner can manage admins
      : canManage // admins/mods can manage mods and members

  return (
    <div className="flex items-center gap-3 p-3 bg-brand-card rounded-xl border border-brand-divider hover:border-brand-divider transition-all group/card">
      <Link href={`/profile/${member.username || member.user_id}`} className="shrink-0">
        <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-sm font-bold text-white">
              {(member.display_name || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/profile/${member.username || member.user_id}`}>
          <p className="text-sm font-bold text-slate-700 truncate hover:text-[#D8103F] transition-colors">
            {member.display_name || member.username || 'Unknown'}
          </p>
        </Link>
        <div className="flex items-center gap-1.5 mt-0.5">
          {member.username && (
            <span className="text-[11px] text-brand-text/60 font-medium">@{member.username}</span>
          )}
          <span className="text-slate-200">·</span>
          <span className="text-[11px] text-slate-300">
            Joined {new Date(member.joined_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Role Badge */}
      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${badge.color} ${badge.bgColor}`}>
        {badge.icon}
        {badge.label}
      </div>

      {/* Admin Actions */}
      {canManageThis && (
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 text-slate-300 hover:text-brand-highlight rounded-lg hover:bg-brand-secondary transition-all sm:opacity-0 sm:group-hover/card:opacity-100"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 bg-brand-card border border-brand-divider rounded-xl shadow-lg py-1 z-20">
                {isAdmin && (
                  <>
                    {/* Promote / Demote options based on current role */}
                    {member.role === 'admin' && (
                      <button
                        onClick={() => { onRoleChange(member, 'member'); setShowMenu(false) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-brand-highlight hover:bg-brand-secondary transition-colors"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Demote to Member
                      </button>
                    )}
                    {member.role === 'moderator' && (
                      <>
                        <button
                          onClick={() => { onRoleChange(member, 'admin'); setShowMenu(false) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-brand-highlight hover:bg-brand-secondary transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Make Admin
                        </button>
                        <button
                          onClick={() => { onRoleChange(member, 'member'); setShowMenu(false) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-brand-highlight hover:bg-brand-secondary transition-colors"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Remove Mod
                        </button>
                      </>
                    )}
                    {member.role === 'member' && (
                      <>
                        <button
                          onClick={() => { onRoleChange(member, 'admin'); setShowMenu(false) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-brand-highlight hover:bg-brand-secondary transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Make Admin
                        </button>
                        <button
                          onClick={() => { onRoleChange(member, 'moderator'); setShowMenu(false) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-brand-highlight hover:bg-brand-secondary transition-colors"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          Make Moderator
                        </button>
                      </>
                    )}
                    <hr className="my-1 border-brand-divider" />
                  </>
                )}
                <button
                  onClick={() => { onRemove(member); setShowMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-50 transition-colors"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  Remove
                </button>
                <button
                  onClick={() => { onBan(member); setShowMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Ban
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function GroupMembersTab({ groupId, currentUserRole }: GroupMembersTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const { data: members, isLoading } = useGroupMembers(groupId, 100)
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()
  const banMember = useBanMember()

  const isOwner = currentUserRole === 'owner'
  const isAdmin = currentUserRole === 'admin' || isOwner
  const isMod = currentUserRole === 'moderator'
  const canManage = isAdmin || isMod

  const handleRoleChange = (member: GroupMember, newRole: string) => {
    updateRole.mutate({ groupId, userId: member.user_id, role: newRole })
  }

  const handleRemove = (member: GroupMember) => {
    if (confirm(`Remove ${member.display_name || member.username || 'this member'} from the group?`)) {
      removeMember.mutate({ groupId, userId: member.user_id })
    }
  }

  const handleBan = (member: GroupMember) => {
    if (confirm(`Ban ${member.display_name || member.username || 'this member'}? They won't be able to rejoin.`)) {
      banMember.mutate({ groupId, userId: member.user_id })
    }
  }

  // Filter and group by role
  const filtered = useMemo(() => {
    if (!members) return []
    const q = searchQuery.toLowerCase().trim()
    return members.filter(m => {
      if (!q) return true
      return (m.display_name?.toLowerCase().includes(q)) ||
        (m.username?.toLowerCase().includes(q))
    })
  }, [members, searchQuery])

  const sections = useMemo(() => {
    const adminsMods = filtered.filter(m => m.role === 'owner' || m.role === 'admin' || m.role === 'moderator')
    const regularMembers = filtered.filter(m => m.role === 'member')
    return { adminsMods, regularMembers }
  }, [filtered])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-brand-secondary rounded-xl animate-pulse" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 bg-brand-card rounded-xl border border-brand-divider animate-pulse">
            <div className="w-11 h-11 rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-24 bg-slate-100 rounded" />
              <div className="h-2.5 w-16 bg-brand-secondary rounded" />
            </div>
            <div className="h-6 w-14 bg-brand-secondary rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  if (!members || members.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-14 h-14 rounded-2xl bg-brand-secondary mx-auto mb-4 flex items-center justify-center">
          <Shield className="w-7 h-7 text-slate-200" />
        </div>
        <p className="text-sm font-semibold text-brand-text/60">No members found</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
        <input
          type="text"
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-brand-secondary border border-brand-divider rounded-xl text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20 focus:border-[#D8103F]/30 transition-all"
        />
      </div>

      {/* Admins & Moderators Section */}
      {sections.adminsMods.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60 mb-2 px-1">
            Admins & Moderators ({sections.adminsMods.length})
          </h3>
          <div className="space-y-2">
            {sections.adminsMods.map(member => (
              <MemberCard
                key={member.user_id}
                member={member}
                canManage={canManage}
                isAdmin={isAdmin}
                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
                onBan={handleBan}
              />
            ))}
          </div>
        </div>
      )}

      {/* Members Section */}
      {sections.regularMembers.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60 mb-2 px-1">
            Members ({sections.regularMembers.length})
          </h3>
          <div className="space-y-2">
            {sections.regularMembers.map(member => (
              <MemberCard
                key={member.user_id}
                member={member}
                canManage={canManage}
                isAdmin={isAdmin}
                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
                onBan={handleBan}
              />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <p className="text-sm text-brand-text/60">No members matching &ldquo;{searchQuery}&rdquo;</p>
        </div>
      )}
    </div>
  )
}

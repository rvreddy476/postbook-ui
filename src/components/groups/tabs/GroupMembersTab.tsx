'use client'

import React from 'react'
import Link from 'next/link'
import { useGroupMembers, useUpdateMemberRole, useRemoveMember } from '@/hooks/useGroups'
import { Shield, ShieldCheck, Crown, UserMinus } from 'lucide-react'
import type { GroupMember } from '@/types/groups'

interface GroupMembersTabProps {
  groupId: string
  currentUserRole: string | null
}

const roleBadge: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  admin: { label: 'Admin', icon: <Crown className="w-3 h-3" />, color: 'text-amber-600 bg-amber-50 border-amber-100' },
  moderator: { label: 'Mod', icon: <ShieldCheck className="w-3 h-3" />, color: 'text-blue-600 bg-blue-50 border-blue-100' },
  member: { label: 'Member', icon: <Shield className="w-3 h-3" />, color: 'text-slate-500 bg-slate-50 border-slate-100' },
}

export default function GroupMembersTab({ groupId, currentUserRole }: GroupMembersTabProps) {
  const { data: members, isLoading } = useGroupMembers(groupId)
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()

  const isAdmin = currentUserRole === 'admin'
  const isMod = currentUserRole === 'moderator'
  const canManage = isAdmin || isMod

  const handleRoleChange = (member: GroupMember, newRole: string) => {
    updateRole.mutate({ groupId, userId: member.user_id, role: newRole })
  }

  const handleRemove = (member: GroupMember) => {
    if (confirm(`Remove ${member.display_name || member.user_id} from the group?`)) {
      removeMember.mutate({ groupId, userId: member.user_id })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!members || members.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 text-sm">No members found.</p>
      </div>
    )
  }

  // Sort: admins first, then mods, then members
  const sorted = [...members].sort((a, b) => {
    const order = { admin: 0, moderator: 1, member: 2 }
    return (order[a.role as keyof typeof order] ?? 3) - (order[b.role as keyof typeof order] ?? 3)
  })

  return (
    <div className="space-y-2">
      {sorted.map((member) => {
        const badge = roleBadge[member.role] || roleBadge.member
        const avatarSrc = member.avatar_media_id
          ? `/v1/media/${member.avatar_media_id}/serve`
          : null

        return (
          <div
            key={member.user_id}
            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-all"
          >
            {/* Avatar */}
            <Link href={`/profile/${member.username || member.user_id}`}>
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-black text-slate-300">
                    {(member.display_name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </Link>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <Link href={`/profile/${member.username || member.user_id}`}>
                <p className="text-sm font-bold text-slate-700 truncate hover:text-violet-600 transition-colors">
                  {member.display_name || member.username || 'Unknown'}
                </p>
              </Link>
              {member.username && (
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">@{member.username}</p>
              )}
            </div>

            {/* Role Badge */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${badge.color}`}>
              {badge.icon}
              {badge.label}
            </div>

            {/* Admin Actions */}
            {canManage && member.role !== 'admin' && (
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member, e.target.value)}
                    className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-300"
                  >
                    <option value="member">Member</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                )}
                <button
                  onClick={() => handleRemove(member)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all"
                  title="Remove member"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useGroupMembers, useUpdateMemberRole, useRemoveMember, useBanMember } from '@/hooks/useGroups'
import { useBatchProfiles } from '@/hooks/useProfile'
import { useBatchRelationships } from '@/hooks/useConnections'
import { useFollowUser, useUnfollowUser } from '@/hooks/useEditProfile'
import { useAuthUser } from '@/store/auth'
import ChatWindow from '@/components/ChatWindow'
import {
  Crown, ShieldCheck, Wrench, UserMinus, Search, Shield,
  MoreHorizontal, ChevronDown, Ban, MessageCircle, UserPlus, Check
} from 'lucide-react'
import type { GroupMember } from '@/types/groups'
import type { User } from '@/types'
import { FriendRequestButton } from '@/components/connections/FriendRequestButton'

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
  cta,
}: {
  member: GroupMember
  canManage: boolean
  isAdmin: boolean
  onRoleChange: (member: GroupMember, newRole: string) => void
  onRemove: (member: GroupMember) => void
  onBan: (member: GroupMember) => void
  cta?: React.ReactNode
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
        <div className="w-11 h-11 rounded-xl overflow-hidden bg-brand-secondary">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-secondary to-brand-text/30 flex items-center justify-center text-sm font-bold text-white">
              {(member.display_name || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/profile/${member.username || member.user_id}`}>
          <p className="text-sm font-bold text-brand-text truncate hover:text-brand-text/80 transition-colors">
            {member.display_name || member.username || 'Unknown'}
          </p>
        </Link>
        <div className="flex items-center gap-1.5 mt-0.5">
          {member.username && (
            <span className="text-[11px] text-brand-text/60 font-medium">@{member.username}</span>
          )}
          <span className="text-brand-secondary">·</span>
          <span className="text-[11px] text-brand-text/30">
            Joined {new Date(member.joined_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Relationship CTA (Add friend / Message / Requested) */}
      {cta}

      {/* Role tag — admins/mods only; regular members carry no badge */}
      {member.role !== 'member' && (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${badge.color} ${badge.bgColor}`}>
          {badge.icon}
          {badge.label}
        </div>
      )}

      {/* Admin Actions */}
      {canManageThis && (
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 text-brand-text/30 hover:text-brand-highlight rounded-lg hover:bg-brand-secondary transition-all sm:opacity-0 sm:group-hover/card:opacity-100"
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
  const authUser = useAuthUser()
  const [searchQuery, setSearchQuery] = useState('')
  const [chats, setChats] = useState<User[]>([])
  // Optimistic overrides while the relationships batch refetches.
  const [followOverride, setFollowOverride] = useState<Map<string, boolean>>(new Map())
  const { data: members, isLoading } = useGroupMembers(groupId, 100)
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()
  const banMember = useBanMember()
  const followUser = useFollowUser()
  const unfollowUser = useUnfollowUser()

  const isOwner = currentUserRole === 'owner'
  const isAdmin = currentUserRole === 'admin' || isOwner
  const isMod = currentUserRole === 'moderator'
  const canManage = isAdmin || isMod

  // Batch-fetch profiles for all members
  const memberUserIds = useMemo(() => members?.map(m => m.user_id) ?? [], [members])
  const { data: profileMap } = useBatchProfiles(memberUserIds)
  // Viewer <-> member relationships drive the per-row CTA.
  const { data: relMap } = useBatchRelationships(authUser?.id ?? '', memberUserIds)

  const openChat = (m: GroupMember) => {
    setChats((prev) => {
      if (prev.some((c) => c.id === m.user_id)) return prev
      const contact: User = {
        id: m.user_id,
        name: m.display_name || m.username || 'Member',
        username: m.username || m.user_id,
        avatar: m.avatar_media_id ? `/v1/media/${m.avatar_media_id}/serve` : '',
        isOnline: false,
      }
      const next = [contact, ...prev]
      return next.length > 3 ? next.slice(0, 3) : next
    })
  }
  const closeChat = (id: string) => setChats((prev) => prev.filter((c) => c.id !== id))

  const setOverride = (userId: string, val: boolean) =>
    setFollowOverride((prev) => new Map(prev).set(userId, val))

  // CTA matrix (DB-driven via the graph relationships batch):
  //   creator / hub / page  -> Follow/Following toggle only (no Message)
  //   user, already friend  -> "Following" state + Message
  //   user, request pending -> Requested / Respond
  //   user, not friend      -> Add friend
  const ctaFor = (m: GroupMember): React.ReactNode => {
    if (!authUser || m.user_id === authUser.id) return null
    const prof = profileMap?.get(m.user_id) as (Record<string, unknown> | undefined)
    const isPage = (prof?.entityType ?? prof?.entity_type) === 'page'
    const rel = relMap?.get(m.user_id)
    const isFriend = !!rel?.is_connection || rel?.connection_status === 'accepted'
    const following = followOverride.get(m.user_id) ?? !!rel?.following

    if (isPage) {
      const handleToggleFollow = () => {
        const target = m.username || m.user_id
        if (following) {
          setOverride(m.user_id, false)
          unfollowUser.mutate(target, { onError: () => setOverride(m.user_id, true) })
        } else {
          setOverride(m.user_id, true)
          followUser.mutate(target, { onError: () => setOverride(m.user_id, false) })
        }
      }
      return (
        <button
          onClick={handleToggleFollow}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
            following
              ? 'bg-brand-text/8 text-brand-text/60 hover:bg-brand-text/12'
              : 'bg-brand-text text-brand-bg hover:opacity-90'
          }`}
        >
          {following ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
          {following ? 'Following' : 'Follow'}
        </button>
      )
    }

    if (isFriend) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1.5 rounded-lg bg-brand-text/8 px-3 py-1.5 text-[11px] font-bold text-brand-text/60">
            <Check className="w-3.5 h-3.5" />
            Following
          </span>
          <button
            onClick={() => openChat(m)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-text px-3 py-1.5 text-[11px] font-bold text-brand-bg transition-all hover:opacity-90"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Message
          </button>
        </div>
      )
    }

    return (
      <FriendRequestButton
        targetUserId={m.user_id}
        targetUsername={m.username}
        relationship={rel}
        addLabel="Add friend"
        className="flex items-center gap-1.5 rounded-lg bg-brand-text px-3 py-1.5 text-[11px] font-bold text-brand-bg transition-all hover:opacity-90 disabled:opacity-50"
        sentClassName="bg-brand-text/8 text-brand-text/50 hover:opacity-100"
        acceptClassName="flex items-center gap-1.5 rounded-lg bg-brand-text px-3 py-1.5 text-[11px] font-bold text-brand-bg transition-all hover:opacity-90 disabled:opacity-50"
        declineClassName="rounded-lg border border-brand-divider px-3 py-1.5 text-[11px] font-bold text-brand-text transition-all hover:bg-brand-text/5 disabled:opacity-50"
      />
    )
  }

  // Enrich members with profile data
  const enrichedMembers = useMemo(() => {
    if (!members) return undefined
    return members.map(m => {
      const profile = profileMap?.get(m.user_id)
      if (!profile) return m
      return {
        ...m,
        display_name: profile.display_name || profile.username || m.display_name,
        username: profile.username || m.username,
        avatar_media_id: profile.avatar_media_id || m.avatar_media_id,
      }
    })
  }, [members, profileMap])

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

  // Filter and group by role. Depend on enrichedMembers (not the raw
  // members) so names refresh when the batch profiles land — a stale
  // dep here showed "Unknown" for everyone.
  const filtered = useMemo(() => {
    if (!enrichedMembers) return []
    const q = searchQuery.toLowerCase().trim()
    return enrichedMembers.filter(m => {
      if (!q) return true
      return (m.display_name?.toLowerCase().includes(q)) ||
        (m.username?.toLowerCase().includes(q))
    })
  }, [enrichedMembers, searchQuery])

  // One flat list under a single "Members" heading — admins sort first
  // and carry their role tag; regular members get no badge at all.
  const ordered = useMemo(() => {
    const rank = (r: string) => (r === 'owner' ? 0 : r === 'admin' ? 1 : r === 'moderator' ? 2 : 3)
    return [...filtered].sort((a, b) => rank(a.role) - rank(b.role))
  }, [filtered])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-brand-secondary rounded-xl animate-pulse" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 bg-brand-card rounded-xl border border-brand-divider animate-pulse">
            <div className="w-11 h-11 rounded-xl bg-brand-secondary" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-24 bg-brand-secondary rounded" />
              <div className="h-2.5 w-16 bg-brand-secondary rounded" />
            </div>
            <div className="h-6 w-14 bg-brand-secondary rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  if (!enrichedMembers || enrichedMembers.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-14 h-14 rounded-2xl bg-brand-secondary mx-auto mb-4 flex items-center justify-center">
          <Shield className="w-7 h-7 text-brand-secondary" />
        </div>
        <p className="text-sm font-semibold text-brand-text/60">No members found</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/30" />
        <input
          type="text"
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-brand-secondary border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/20 focus:border-brand-text/30 transition-all"
        />
      </div>

      {/* Members — single heading, admins first */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand-text/60 mb-2 px-1">
          Members ({ordered.length})
        </h3>
        <div className="space-y-2">
          {ordered.map(member => (
            <MemberCard
              key={member.user_id}
              member={member}
              canManage={canManage}
              isAdmin={isAdmin}
              onRoleChange={handleRoleChange}
              onRemove={handleRemove}
              onBan={handleBan}
              cta={ctaFor(member)}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <p className="text-sm text-brand-text/60">No members matching &ldquo;{searchQuery}&rdquo;</p>
        </div>
      )}

      {/* Floating chat dock - Message opens an in-place ChatWindow. */}
      <div className="fixed bottom-0 right-4 z-[1500] flex items-end gap-3">
        {chats.map((c) => (
          <ChatWindow key={c.id} contact={c} onClose={() => closeChat(c.id)} />
        ))}
      </div>
    </div>
  )
}

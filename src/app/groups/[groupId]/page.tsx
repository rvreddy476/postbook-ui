'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import AppShell from '@/components/AppShell'
import CreatePortal from '@/components/CreatePortal'
import { useParams, useRouter } from 'next/navigation'
import { useGroupDetails, useGroupByHandle, useGroupMembers, useGroupRules, useJoinGroup, useLeaveGroup, useDeleteGroup } from '@/hooks/useGroups'
import { useBatchProfiles } from '@/hooks/useProfile'
import { useAuthUser } from '@/store/auth'
import GroupFeedTab from '@/components/groups/tabs/GroupFeedTab'
import GroupMembersTab from '@/components/groups/tabs/GroupMembersTab'
import GroupAboutTab from '@/components/groups/tabs/GroupAboutTab'
import GroupRulesTab from '@/components/groups/tabs/GroupRulesTab'
import GroupMediaTab from '@/components/groups/tabs/GroupMediaTab'
import GroupJoinRequestsPanel from '@/components/groups/GroupJoinRequestsPanel'
import GroupInviteModal from '@/components/groups/GroupInviteModal'
import GroupEditModal from '@/components/groups/GroupEditModal'
import {
  Users, MessageSquare, Image, ScrollText, Info, Calendar,
  Globe, Lock, Shield, ArrowLeft, Plus, UserPlus, MessageCircle,
  Pencil, Settings, MoreHorizontal, Share2, LogOut, Flag,
  Trash2, Link2, Crown, ShieldCheck, Wrench, Clock
} from 'lucide-react'
import type { GroupTab } from '@/types/groups'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type DetailTab = GroupTab | 'events'

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function GroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const param = params.groupId as string
  const isUUID = UUID_REGEX.test(param)

  const [activeTab, setActiveTab] = useState<DetailTab>('feed')
  const [showInvite, setShowInvite] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showOverflow, setShowOverflow] = useState(false)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  const authUser = useAuthUser()
  const { data: groupById, isLoading: loadingById } = useGroupDetails(isUUID ? param : undefined)
  const { data: groupByHandle, isLoading: loadingByHandle } = useGroupByHandle(!isUUID ? param : undefined)

  const group = groupById ?? groupByHandle
  const isLoading = isUUID ? loadingById : loadingByHandle
  const resolvedId = group?.id

  const { data: members } = useGroupMembers(resolvedId)
  const { data: rules } = useGroupRules(resolvedId)

  const joinGroup = useJoinGroup()
  const leaveGroup = useLeaveGroup()
  const deleteGroup = useDeleteGroup()

  const viewerRole = group?.viewer_role ?? 'outsider'
  const isOwner = viewerRole === 'owner'
  const isAdmin = viewerRole === 'admin' || isOwner
  const isAdminOrMod = isAdmin || viewerRole === 'moderator'
  const isMember = isAdminOrMod || viewerRole === 'member'

  const adminsAndMods = members?.filter(m => m.role === 'admin' || m.role === 'moderator' || m.role === 'owner') ?? []

  // Batch-fetch profiles for sidebar admins/mods
  const adminUserIds = useMemo(() => adminsAndMods.map(m => m.user_id), [adminsAndMods])
  const { data: adminProfileMap } = useBatchProfiles(adminUserIds)

  // Enrich admins/mods with profile data
  const enrichedAdmins = useMemo(() => adminsAndMods.map(m => {
    const profile = adminProfileMap?.get(m.user_id)
    if (!profile) return m
    return {
      ...m,
      display_name: profile.display_name || profile.username || m.display_name,
      username: profile.username || m.username,
      avatar_media_id: profile.avatar_media_id || m.avatar_media_id,
    }
  }), [adminsAndMods, adminProfileMap])

  useEffect(() => {
    if (!showOverflow) return

    const handleClickOutside = (event: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) {
        setShowOverflow(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showOverflow])

  const handleJoin = () => joinGroup.mutate(group!.id)
  const handleLeave = () => {
    if (confirm('Are you sure you want to leave this space?')) {
      leaveGroup.mutate(group!.id)
    }
  }
  const handleDelete = () => {
    if (confirm('Delete this space? This cannot be undone.')) {
      deleteGroup.mutate(group!.id, { onSuccess: () => router.push('/groups') })
    }
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <AppShell>
      <div className="max-w-5xl mx-auto py-6 space-y-4 px-4">
        <div className="h-[140px] bg-brand-text/5 rounded-2xl animate-pulse" />
        <div className="flex gap-4">
          <div className="w-20 h-20 rounded-2xl bg-brand-text/5 animate-pulse -mt-7" />
          <div className="flex-1 space-y-2 pt-2">
            <div className="h-6 w-48 bg-brand-text/5 rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-brand-text/5 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-12 bg-brand-text/5 rounded-xl animate-pulse" />
      </div>
      </AppShell>
    )
  }

  // Not found
  if (!group) {
    return (
      <AppShell>
      <div className="max-w-5xl mx-auto py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-text/5 mx-auto mb-4 flex items-center justify-center">
          <Users className="w-8 h-8 text-brand-text/20" />
        </div>
        <h2 className="text-xl font-bold text-brand-text">Space not found</h2>
        <p className="text-brand-text/60 mt-2 text-sm max-w-sm mx-auto">This space may have been deleted or you don&apos;t have access.</p>
      </div>
      </AppShell>
    )
  }

  const privacy = group.privacy_level ?? 'public'
  const coverSrc = group.cover_media_id ? `/v1/media/${group.cover_media_id}/serve` : null

  const coverGradients = [
    'from-amber-100 to-orange-50',
    'from-blue-100 to-cyan-50',
    'from-emerald-100 to-teal-50',
    'from-purple-100 to-pink-50',
    'from-rose-100 to-red-50',
    'from-indigo-100 to-blue-50',
  ]
  const nameHash = group.name.charCodeAt(0) % coverGradients.length
  const coverGrad = coverGradients[nameHash]

  const tabs: { key: DetailTab; label: string; icon: React.ReactNode }[] = [
    { key: 'feed', label: 'Feed', icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'members', label: 'Members', icon: <Users className="w-4 h-4" /> },
    { key: 'media', label: 'Media', icon: <Image className="w-4 h-4" /> },
    { key: 'events', label: 'Events', icon: <Calendar className="w-4 h-4" /> },
    { key: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
    { key: 'rules', label: 'Rules', icon: <ScrollText className="w-4 h-4" /> },
  ]

  const roleBadge = () => {
    if (isOwner) return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-brand-text/8 text-brand-text/60 rounded-full"><Crown className="w-3 h-3" />Owner</span>
    if (viewerRole === 'admin') return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-brand-text/8 text-brand-text/60 rounded-full"><ShieldCheck className="w-3 h-3" />Admin</span>
    if (viewerRole === 'moderator') return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-brand-text/8 text-brand-text/60 rounded-full"><Wrench className="w-3 h-3" />Mod</span>
    return null
  }

  return (
    <AppShell>
    <div className="max-w-5xl mx-auto pb-16">
      {/* Cover image */}
      <div className="relative h-[164px] w-full overflow-hidden rounded-b-2xl sm:h-[180px] sm:rounded-2xl">
        {coverSrc ? (
          <img src={coverSrc} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${coverGrad} flex items-center justify-center`}>
            <span className="text-6xl opacity-20 font-black">{group.name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Back button on cover */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-20 p-2 bg-black/30 backdrop-blur-sm rounded-full text-white hover:bg-black/50 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Space header: name, meta, actions — no profile photo for spaces,
          the cover image is the identity. */}
      <div className="relative z-10 mx-auto mt-4 max-w-4xl px-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Identity block */}
          <div className="flex-1 min-w-0 pt-1 sm:pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-[800] text-brand-text tracking-tight truncate" style={{ fontFamily: 'var(--font-outfit, Outfit, sans-serif)' }}>
                {group.name}
              </h1>
              {roleBadge()}
            </div>

            {group.handle && (
              <p className="text-sm text-brand-text/50 font-medium mt-0.5">@{group.handle}</p>
            )}

            {/* Meta row: privacy pill + category */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-text/8 text-brand-text/60">
                {privacy === 'public' && <Globe className="w-3 h-3" />}
                {privacy === 'restricted' && <Shield className="w-3 h-3" />}
                {privacy === 'private' && <Lock className="w-3 h-3" />}
                {privacy.charAt(0).toUpperCase() + privacy.slice(1)}
              </span>
              {group.category && (
                <span className="px-2 py-0.5 bg-brand-text/8 text-brand-text/60 text-[10px] font-semibold rounded-full">
                  {group.category}
                </span>
              )}
            </div>

            {/* Stats row — font-mono */}
            <div className="flex items-center gap-4 mt-3 text-[11px] font-mono text-brand-text/50">
              <span><strong className="text-brand-text">{formatCount(group.member_count)}</strong> Members</span>
              <span className="w-px h-3 bg-brand-divider" />
              <span><strong className="text-brand-text">{formatCount(group.post_count)}</strong> Posts today</span>
              <span className="w-px h-3 bg-brand-divider hidden sm:block" />
              <span className="hidden sm:inline">Created {formatDate(group.created_at)}</span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {isMember ? (
                <>
                  <button
                    onClick={() => setShowCreatePost(true)}
                    className="flex items-center gap-1.5 px-5 py-2 bg-brand-text text-brand-bg text-sm font-bold rounded-xl hover:opacity-90 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    New Post
                  </button>
                  <button
                    onClick={() => setShowInvite(true)}
                    className="flex items-center gap-1.5 px-4 py-2 border border-brand-divider text-brand-text text-sm font-semibold rounded-xl hover:bg-brand-text/5 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invite
                  </button>
                  {group.chat_conversation_id && (
                    <button
                      onClick={() => router.push(`/chat?conversation=${group.chat_conversation_id}`)}
                      className="flex items-center gap-1.5 px-4 py-2 border border-brand-divider text-brand-text text-sm font-semibold rounded-xl hover:bg-brand-text/5 transition-all"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Chat
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setShowEdit(true)}
                      className="p-2 border border-brand-divider text-brand-text rounded-xl hover:bg-brand-text/5 transition-all"
                      title="Edit Space"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => router.push(`/groups/${group.id}/settings`)}
                      className="p-2 border border-brand-divider text-brand-text rounded-xl hover:bg-brand-text/5 transition-all"
                      title="Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}

                  {/* Overflow menu */}
                  <div className="relative ml-auto" ref={overflowRef}>
                    <button
                      onClick={() => setShowOverflow(!showOverflow)}
                      className="p-2 border border-brand-divider text-brand-text/60 rounded-xl hover:bg-brand-text/5 transition-all"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {showOverflow && (
                      <div className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-brand-divider bg-brand-card py-1 shadow-lg">
                        {isAdmin && (
                          <button onClick={() => { setShowEdit(true); setShowOverflow(false); }} className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm text-brand-text transition-colors hover:bg-brand-text/5">
                            <Pencil className="w-4 h-4" /> Edit Space
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => { router.push(`/groups/${group.id}/settings`); setShowOverflow(false); }} className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm text-brand-text transition-colors hover:bg-brand-text/5">
                            <Settings className="w-4 h-4" /> Space Settings
                          </button>
                        )}
                        <button onClick={() => setShowOverflow(false)} className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm text-brand-text transition-colors hover:bg-brand-text/5">
                          <Share2 className="w-4 h-4" /> Share
                        </button>
                        <button onClick={() => setShowOverflow(false)} className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm text-brand-text transition-colors hover:bg-brand-text/5">
                          <Link2 className="w-4 h-4" /> Copy Link
                        </button>
                        <button onClick={() => { handleLeave(); setShowOverflow(false); }} className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm text-brand-text transition-colors hover:bg-brand-text/5">
                          <LogOut className="w-4 h-4" /> Leave Space
                        </button>
                        <button onClick={() => setShowOverflow(false)} className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm text-brand-text/60 transition-colors hover:bg-brand-text/5">
                          <Flag className="w-4 h-4" /> Report
                        </button>
                        {isOwner && (
                          <button onClick={() => { handleDelete(); setShowOverflow(false); }} className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-text/5">
                            <Trash2 className="w-4 h-4" /> Delete Space
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : group.join_mode === 'request' ? (
                <button
                  onClick={handleJoin}
                  disabled={joinGroup.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 border border-brand-divider text-brand-text text-sm font-bold rounded-xl hover:bg-brand-text/5 transition-all disabled:opacity-50"
                >
                  <Clock className="w-4 h-4" />
                  {joinGroup.isPending ? 'Requesting...' : 'Request to Join'}
                </button>
              ) : group.join_mode === 'invite_only' || group.privacy_level === 'private' ? (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-brand-text/5 text-brand-text/40 text-sm font-semibold rounded-xl">
                  <Lock className="w-4 h-4" />
                  Invite Only
                </div>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={joinGroup.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 bg-brand-text text-brand-bg text-sm font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                >
                  <Users className="w-4 h-4" />
                  {joinGroup.isPending ? 'Joining...' : 'Join Space'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Join Requests Panel (admin/mod only) */}
      {isAdminOrMod && group.join_mode === 'request' && resolvedId && (
        <div className="px-4 mt-4 max-w-5xl mx-auto">
          <GroupJoinRequestsPanel groupId={resolvedId} />
        </div>
      )}

      {/* Tab bar */}
      <div className="sticky top-0 z-20 bg-brand-card/95 backdrop-blur-sm border-b border-brand-divider mt-6">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex items-center gap-0 overflow-x-auto scrollbar-hide -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'text-brand-text'
                    : 'text-brand-text/40 hover:text-brand-text/70'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.key === 'members' && group.member_count > 0 && (
                  <span className="text-[10px] font-mono text-brand-text/30 ml-0.5">{formatCount(group.member_count)}</span>
                )}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 border-b-2 border-brand-text rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Pinned announcement — Asphalt bg */}
      {activeTab === 'feed' && group.description && (
        <div className="max-w-5xl mx-auto px-4 mt-4">
          <div className="bg-brand-text text-brand-bg rounded-xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1">Pinned</p>
            <p className="text-sm leading-relaxed">{group.description}</p>
          </div>
        </div>
      )}

      {/* Content area — 2-column: feed + sidebar (240px desktop) */}
      <div className="px-4 mt-6">
        {(activeTab === 'feed' || activeTab === 'about') ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6 max-w-5xl mx-auto">
            {/* Main content */}
            <div>
              {activeTab === 'feed' && resolvedId && (
                <GroupFeedTab groupId={resolvedId} isMember={isMember} viewerRole={viewerRole} />
              )}
              {activeTab === 'about' && <GroupAboutTab group={group} />}
            </div>

            {/* Sidebar — 240px */}
            <aside className="hidden lg:block space-y-4">
              {/* Admins & Mods card */}
              {enrichedAdmins.length > 0 && (
                <div className="bg-brand-card border border-brand-divider rounded-2xl p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-3">Admins & Mods</h3>
                  <div className="space-y-2.5">
                    {enrichedAdmins.slice(0, 5).map(m => {
                      const avatarUrl = m.avatar_media_id ? `/v1/media/${m.avatar_media_id}/serve` : null
                      const roleIcon = m.role === 'owner' || m.role === 'admin'
                        ? <Crown className="w-3 h-3 text-brand-text/40" />
                        : m.role === 'moderator'
                          ? <Wrench className="w-3 h-3 text-brand-text/40" />
                          : null
                      return (
                        <div key={m.user_id} className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg overflow-hidden bg-brand-text/5 shrink-0">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-brand-text/40">
                                {(m.display_name || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <p className="flex-1 text-xs font-semibold text-brand-text truncate">{m.display_name || m.username || 'Member'}</p>
                          {roleIcon}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* People you may know card — placeholder */}
              <div className="bg-brand-card border border-brand-divider rounded-2xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-3">People you may know</h3>
                <p className="text-xs text-brand-text/40">Suggestions coming soon</p>
              </div>

              {/* Rules condensed card */}
              {rules && rules.length > 0 && (
                <div className="bg-brand-card border border-brand-divider rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text/50">Rules</h3>
                    <button onClick={() => setActiveTab('rules')} className="text-[10px] font-bold text-brand-text hover:underline">View All</button>
                  </div>
                  <div className="space-y-2">
                    {rules.slice(0, 3).map((rule, i) => (
                      <div key={rule.id} className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-text/5 flex items-center justify-center text-[10px] font-mono font-bold text-brand-text/40 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-xs text-brand-text/60 leading-relaxed">{rule.title}</p>
                      </div>
                    ))}
                    {rules.length > 3 && (
                      <p className="text-[10px] text-brand-text/30 font-semibold pl-7">+{rules.length - 3} more</p>
                    )}
                  </div>
                </div>
              )}
            </aside>
          </div>
        ) : activeTab === 'events' ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <Calendar className="w-12 h-12 text-brand-text/20 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-brand-text/60">Events coming soon</h3>
            <p className="text-sm text-brand-text/40 mt-1">Group events will be available in a future update</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {activeTab === 'members' && resolvedId && <GroupMembersTab groupId={resolvedId} currentUserRole={viewerRole} />}
            {activeTab === 'media' && resolvedId && <GroupMediaTab groupId={resolvedId} />}
            {activeTab === 'rules' && resolvedId && <GroupRulesTab groupId={resolvedId} isAdmin={isAdmin} />}
          </div>
        )}
      </div>

      {showInvite && resolvedId && (
        <GroupInviteModal groupId={resolvedId} onClose={() => setShowInvite(false)} />
      )}
      {showEdit && group && (
        <GroupEditModal group={group} onClose={() => setShowEdit(false)} />
      )}
      {showCreatePost && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCreatePost(false)}>
          <div onClick={e => e.stopPropagation()}>
            <CreatePortal onClose={() => setShowCreatePost(false)} groupId={group.id} />
          </div>
        </div>
      )}
    </div>
    </AppShell>
  )
}

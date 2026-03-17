'use client'

import React, { useState } from 'react'
import { useGroupDetails, useGroupByHandle, useGroupMembers, useGroupRules } from '@/hooks/useGroups'
import { useAuthUser } from '@/store/auth'
import GroupHeader from './GroupHeader'
import GroupFeedTab from './tabs/GroupFeedTab'
import GroupMembersTab from './tabs/GroupMembersTab'
import GroupAboutTab from './tabs/GroupAboutTab'
import GroupRulesTab from './tabs/GroupRulesTab'
import GroupMediaTab from './tabs/GroupMediaTab'
import GroupJoinRequestsPanel from './GroupJoinRequestsPanel'
import GroupInviteModal from './GroupInviteModal'
import GroupEditModal from './GroupEditModal'
import { Users, MessageSquare, Image, ScrollText, Info, Crown, ShieldCheck, Wrench } from 'lucide-react'
import type { GroupTab } from '@/types/groups'

interface GroupPageProps {
  groupId?: string
  handle?: string
  onBack?: () => void
}

export default function GroupPage({ groupId, handle, onBack }: GroupPageProps) {
  const [activeTab, setActiveTab] = useState<GroupTab>('feed')
  const [showInvite, setShowInvite] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const authUser = useAuthUser()
  const { data: groupById, isLoading: loadingById } = useGroupDetails(groupId)
  const { data: groupByHandle, isLoading: loadingByHandle } = useGroupByHandle(handle)

  const group = groupById ?? groupByHandle
  const isLoading = groupId ? loadingById : loadingByHandle
  const resolvedId = group?.id

  const { data: members } = useGroupMembers(resolvedId)
  const { data: rules } = useGroupRules(resolvedId)

  const membership = members?.find((m) => m.user_id === authUser?.id) ?? null
  const viewerRole = group?.viewer_role ?? 'outsider'
  const isOwner = viewerRole === 'owner'
  const isAdmin = viewerRole === 'admin' || isOwner
  const isAdminOrMod = isAdmin || viewerRole === 'moderator'
  const isMember = isAdminOrMod || viewerRole === 'member'

  // Sidebar admin list
  const adminsAndMods = members?.filter(m => m.role === 'admin' || m.role === 'moderator' || m.role === 'owner') ?? []

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-6 space-y-4 px-4">
        <div className="h-56 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="flex gap-4">
          <div className="w-24 h-24 rounded-2xl bg-slate-100 animate-pulse -mt-12" />
          <div className="flex-1 space-y-2 pt-2">
            <div className="h-6 w-48 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-brand-secondary rounded animate-pulse" />
          </div>
        </div>
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-brand-secondary rounded-xl animate-pulse" />)}
          </div>
          <div className="space-y-4">
            <div className="h-40 bg-brand-secondary rounded-xl animate-pulse" />
            <div className="h-28 bg-brand-secondary rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="max-w-5xl mx-auto py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 mx-auto mb-4 flex items-center justify-center">
          <Users className="w-8 h-8 text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-slate-700">Group not found</h2>
        <p className="text-brand-text/60 mt-2 text-sm max-w-sm mx-auto">This group may have been deleted or you don&apos;t have access.</p>
      </div>
    )
  }

  const tabs: { key: GroupTab; label: string; icon: React.ReactNode }[] = [
    { key: 'feed', label: 'Discussion', icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'members', label: 'Members', icon: <Users className="w-4 h-4" /> },
    { key: 'media', label: 'Media', icon: <Image className="w-4 h-4" /> },
    { key: 'rules', label: 'Rules', icon: <ScrollText className="w-4 h-4" /> },
    { key: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
  ]

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <GroupHeader
        group={group}
        viewerRole={viewerRole}
        onOpenInvite={() => setShowInvite(true)}
        onEditProfile={isAdmin ? () => setShowEdit(true) : undefined}
        onBack={onBack}
      />

      {/* Join Requests Panel (admin/mod only) */}
      {isAdminOrMod && group.join_mode === 'request' && resolvedId && (
        <div className="px-4 mt-4 max-w-5xl mx-auto">
          <GroupJoinRequestsPanel groupId={resolvedId} />
        </div>
      )}

      {/* Tab Navigation — sticky with coral accent underline */}
      <div className="sticky top-0 z-20 bg-brand-card/95 backdrop-blur-sm border-b border-brand-divider mt-4">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex items-center gap-0 overflow-x-auto scrollbar-hide -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'text-[#D8103F]'
                    : 'text-brand-text/60 hover:text-brand-highlight'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.key === 'members' && group.member_count > 0 && (
                  <span className="text-[10px] font-bold text-slate-300 ml-0.5">{group.member_count}</span>
                )}
                {/* Coral accent underline */}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#D8103F] rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content Area — 3-column desktop layout for feed/about */}
      <div className="px-4 mt-6">
        {(activeTab === 'feed' || activeTab === 'about') ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content area */}
            <div className="lg:col-span-2">
              {activeTab === 'feed' && resolvedId && <GroupFeedTab groupId={resolvedId} isMember={isMember} />}
              {activeTab === 'about' && <GroupAboutTab group={group} />}
            </div>

            {/* Side cards — desktop only */}
            <aside className="hidden lg:block space-y-4">
              {/* Group Info Card */}
              <div className="bg-brand-card rounded-xl border border-brand-divider p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text/60 mb-3">About this group</h3>
                {group.description && (
                  <p className="text-sm text-brand-highlight leading-relaxed line-clamp-4 mb-3">{group.description}</p>
                )}
                <div className="space-y-2 text-xs text-brand-text/60">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    <span><b className="text-brand-highlight">{group.member_count}</b> members</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span><b className="text-brand-highlight">{group.post_count}</b> posts</span>
                  </div>
                </div>
              </div>

              {/* Admins & Mods Card */}
              {adminsAndMods.length > 0 && (
                <div className="bg-brand-card rounded-xl border border-brand-divider p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text/60 mb-3">Admins & Moderators</h3>
                  <div className="space-y-2.5">
                    {adminsAndMods.slice(0, 5).map(m => {
                      const avatarUrl = m.avatar_media_id ? `/v1/media/${m.avatar_media_id}/serve` : null
                      const roleIcon = m.role === 'owner' || m.role === 'admin'
                        ? <Crown className="w-3 h-3 text-amber-500" />
                        : m.role === 'moderator'
                          ? <Wrench className="w-3 h-3 text-blue-500" />
                          : null
                      return (
                        <div key={m.user_id} className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-brand-text/60">
                                {(m.display_name || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{m.display_name || m.username || 'Unknown'}</p>
                          </div>
                          {roleIcon}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Rules Preview Card */}
              {rules && rules.length > 0 && (
                <div className="bg-brand-card rounded-xl border border-brand-divider p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text/60">Group Rules</h3>
                    <button onClick={() => setActiveTab('rules')} className="text-[10px] font-bold text-[#D8103F] hover:underline">View All</button>
                  </div>
                  <div className="space-y-2">
                    {rules.slice(0, 3).map((rule, i) => (
                      <div key={rule.id} className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-secondary flex items-center justify-center text-[10px] font-bold text-brand-text/60 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-xs text-brand-highlight leading-relaxed">{rule.title}</p>
                      </div>
                    ))}
                    {rules.length > 3 && (
                      <p className="text-[10px] text-slate-300 font-semibold pl-7">+{rules.length - 3} more rules</p>
                    )}
                  </div>
                </div>
              )}
            </aside>
          </div>
        ) : (
          /* Full-width tabs: members, media, rules */
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
    </div>
  )
}

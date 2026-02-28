'use client'

import React, { useState } from 'react'
import { useGroupDetails, useGroupMembers } from '@/hooks/useGroups'
import { useAuthUser } from '@/store/auth'
import GroupHeader from './GroupHeader'
import GroupFeedTab from './tabs/GroupFeedTab'
import GroupMembersTab from './tabs/GroupMembersTab'
import GroupAboutTab from './tabs/GroupAboutTab'
import GroupInviteModal from './GroupInviteModal'
import GroupEditModal from './GroupEditModal'
import type { GroupTab } from '@/types/groups'

interface GroupPageProps {
  groupId: string
  onBack?: () => void
}

export default function GroupPage({ groupId, onBack }: GroupPageProps) {
  const [activeTab, setActiveTab] = useState<GroupTab>('feed')
  const [showInvite, setShowInvite] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const authUser = useAuthUser()
  const { data: group, isLoading } = useGroupDetails(groupId)
  const { data: members } = useGroupMembers(groupId)

  const membership = members?.find((m) => m.user_id === authUser?.id) ?? null
  const isAdmin = membership?.role === 'admin'

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8 space-y-6">
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <h2 className="text-xl font-bold text-slate-700">Group not found</h2>
        <p className="text-slate-400 mt-2 text-sm">This group may have been deleted or you don't have access.</p>
      </div>
    )
  }

  const tabs: { key: GroupTab; label: string }[] = [
    { key: 'feed', label: 'Feed' },
    { key: 'members', label: 'Members' },
    { key: 'about', label: 'About' },
  ]

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <GroupHeader group={group} membership={membership} onOpenInvite={() => setShowInvite(true)} onEditProfile={isAdmin ? () => setShowEdit(true) : undefined} onBack={onBack} />

      {/* Tabs */}
      <div className="px-4 mt-6">
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-violet-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 mt-6">
        {activeTab === 'feed' && <GroupFeedTab groupId={groupId} isMember={!!membership} />}
        {activeTab === 'members' && <GroupMembersTab groupId={groupId} currentUserRole={membership?.role ?? null} />}
        {activeTab === 'about' && <GroupAboutTab group={group} />}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <GroupInviteModal groupId={groupId} onClose={() => setShowInvite(false)} />
      )}

      {/* Edit Modal */}
      {showEdit && group && (
        <GroupEditModal group={group} onClose={() => setShowEdit(false)} />
      )}
    </div>
  )
}

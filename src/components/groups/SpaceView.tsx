'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import CreatePortal from '@/components/CreatePortal'
import GroupFeedTab from '@/components/groups/tabs/GroupFeedTab'
import GroupMembersTab from '@/components/groups/tabs/GroupMembersTab'
import GroupAboutTab from '@/components/groups/tabs/GroupAboutTab'
import GroupRulesTab from '@/components/groups/tabs/GroupRulesTab'
import GroupMediaTab from '@/components/groups/tabs/GroupMediaTab'
import GroupInviteModal from '@/components/groups/GroupInviteModal'
import SpaceManagePanel from '@/components/groups/SpaceManagePanel'
import { useGroupDetails, useJoinGroup } from '@/hooks/useGroups'
import {
  Users, MessageSquare, Image as ImageIcon, ScrollText, Info,
  Globe, Lock, Shield, Plus, UserPlus, Check, Clock, ExternalLink, Wrench,
} from 'lucide-react'

type SpaceTab = 'discussion' | 'about' | 'people' | 'media' | 'rules' | 'manage'

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const COVER_GRADIENTS = [
  'from-amber-100 to-orange-50',
  'from-blue-100 to-cyan-50',
  'from-emerald-100 to-teal-50',
  'from-purple-100 to-pink-50',
  'from-rose-100 to-red-50',
  'from-indigo-100 to-blue-50',
]

interface SpaceViewProps {
  groupId: string
}

/**
 * Embedded space view for the MySpace page — renders a full space
 * (cover, identity, actions, tabs, feed) in the middle column while the
 * MySpace left rail stays in place. The standalone /groups/[id] route
 * keeps working for deep links; this is the in-page experience.
 */
export default function SpaceView({ groupId }: SpaceViewProps) {
  const [tab, setTab] = useState<SpaceTab>('discussion')
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [showInvite, setShowInvite] = useState(false)

  const { data: group, isLoading } = useGroupDetails(groupId)
  const joinGroup = useJoinGroup()

  if (isLoading || !group) {
    return (
      <div className="space-y-4">
        <div className="h-44 rounded-2xl bg-brand-text/5 animate-pulse" />
        <div className="h-7 w-56 rounded-lg bg-brand-text/5 animate-pulse" />
        <div className="h-4 w-40 rounded bg-brand-text/5 animate-pulse" />
        <div className="h-10 rounded-xl bg-brand-text/5 animate-pulse" />
      </div>
    )
  }

  const viewerRole = group.viewer_role ?? 'outsider'
  const isOwner = viewerRole === 'owner'
  const isAdmin = isOwner || viewerRole === 'admin'
  const isMember = isAdmin || viewerRole === 'moderator' || viewerRole === 'member'

  const privacy = group.privacy_level ?? 'public'
  const coverSrc = group.cover_media_id ? `/v1/media/${group.cover_media_id}/serve` : null
  const coverGrad = COVER_GRADIENTS[group.name.charCodeAt(0) % COVER_GRADIENTS.length]
  const PrivacyIcon = privacy === 'public' ? Globe : privacy === 'restricted' ? Shield : Lock

  const tabs: { key: SpaceTab; label: string; icon: React.ReactNode }[] = [
    { key: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
    { key: 'discussion', label: 'Discussion', icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'people', label: 'People', icon: <Users className="w-4 h-4" /> },
    { key: 'media', label: 'Media', icon: <ImageIcon className="w-4 h-4" /> },
    { key: 'rules', label: 'Rules', icon: <ScrollText className="w-4 h-4" /> },
    // Lean admin toolkit — only for owners/admins.
    ...(isAdmin ? [{ key: 'manage' as const, label: 'Manage', icon: <Wrench className="w-4 h-4" /> }] : []),
  ]

  return (
    <div>
      {/* Cover */}
      <div className="relative h-44 w-full overflow-hidden rounded-2xl sm:h-52">
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${coverGrad}`}>
            <span className="text-6xl font-black opacity-20">{group.name.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Identity + actions — one compact row: avatar · name/meta · actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3 px-1">
        {/* Space avatar */}
        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-brand-text/10">
          {group.avatar_media_id ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/v1/media/${group.avatar_media_id}/serve`}
              alt={group.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-black text-brand-text/50">
              {group.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name + meta */}
        <div className="min-w-0">
          <h2
            className="truncate text-lg font-[800] tracking-tight text-brand-text sm:text-xl"
            style={{ fontFamily: 'var(--font-outfit, Outfit, sans-serif)' }}
          >
            {group.name}
          </h2>
          <p className="flex items-center gap-1.5 text-[13px] text-brand-text/50">
            <PrivacyIcon className="h-3.5 w-3.5" />
            {privacy.charAt(0).toUpperCase() + privacy.slice(1)} space
            <span className="text-brand-text/25">·</span>
            <strong className="font-bold text-brand-text/70">{formatCount(group.member_count)}</strong> members
            {group.is_mature && (
              <span className="ml-1 rounded-md border border-brand-divider px-1.5 py-0.5 text-[10px] font-black text-brand-text/60">18+</span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isMember ? (
            <>
              <button
                onClick={() => setShowCreatePost(true)}
                className="flex items-center gap-1.5 rounded-xl bg-brand-text px-4 py-2 text-sm font-bold text-brand-bg transition-all hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Create Post
              </button>
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 rounded-xl border border-brand-divider px-3.5 py-2 text-sm font-semibold text-brand-text transition-all hover:bg-brand-text/5"
              >
                <UserPlus className="h-4 w-4" />
                Invite
              </button>
              <span className="flex items-center gap-1.5 rounded-xl bg-brand-text/8 px-3.5 py-2 text-sm font-semibold text-brand-text/60">
                <Check className="h-4 w-4" />
                Joined
              </span>
            </>
          ) : group.join_mode === 'request' ? (
            <button
              onClick={() => joinGroup.mutate(group.id)}
              disabled={joinGroup.isPending}
              className="flex items-center gap-2 rounded-xl border border-brand-divider px-5 py-2 text-sm font-bold text-brand-text transition-all hover:bg-brand-text/5 disabled:opacity-50"
            >
              <Clock className="h-4 w-4" />
              {joinGroup.isPending ? 'Requesting...' : 'Request to Join'}
            </button>
          ) : group.join_mode === 'invite_only' || privacy === 'private' ? (
            <span className="flex items-center gap-2 rounded-xl bg-brand-text/5 px-4 py-2 text-sm font-semibold text-brand-text/40">
              <Lock className="h-4 w-4" />
              Invite Only
            </span>
          ) : (
            <button
              onClick={() => joinGroup.mutate(group.id)}
              disabled={joinGroup.isPending}
              className="flex items-center gap-2 rounded-xl bg-brand-text px-5 py-2 text-sm font-bold text-brand-bg transition-all hover:opacity-90 disabled:opacity-50"
            >
              <Users className="h-4 w-4" />
              {joinGroup.isPending ? 'Joining...' : 'Join Space'}
            </button>
          )}
          <Link
            href={`/groups/${group.id}`}
            title="Open full page"
            className="rounded-xl border border-brand-divider p-2 text-brand-text/50 transition-colors hover:bg-brand-text/5 hover:text-brand-text"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 border-b border-brand-divider">
        <nav className="-mb-px flex items-center gap-0 overflow-x-auto scrollbar-hide">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors ${
                tab === t.key ? 'text-brand-text' : 'text-brand-text/45 hover:text-brand-text/70'
              }`}
            >
              {t.icon}
              {t.label}
              {tab === t.key && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand-text" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {tab === 'discussion' && (
          <GroupFeedTab groupId={group.id} isMember={isMember} viewerRole={viewerRole} hideComposer />
        )}
        {tab === 'about' && <GroupAboutTab group={group} />}
        {tab === 'people' && <GroupMembersTab groupId={group.id} currentUserRole={viewerRole} />}
        {tab === 'media' && <GroupMediaTab groupId={group.id} />}
        {tab === 'rules' && <GroupRulesTab groupId={group.id} isAdmin={isAdmin} />}
        {tab === 'manage' && isAdmin && (
          <SpaceManagePanel groupId={group.id} onOpenRules={() => setTab('rules')} />
        )}
      </div>

      {/* Modals */}
      {showInvite && <GroupInviteModal groupId={group.id} onClose={() => setShowInvite(false)} />}
      {showCreatePost && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowCreatePost(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <CreatePortal onClose={() => setShowCreatePost(false)} groupId={group.id} />
          </div>
        </div>
      )}
    </div>
  )
}

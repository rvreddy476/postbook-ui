'use client'

import React from 'react'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import GroupJoinRequestsPanel from '@/components/groups/GroupJoinRequestsPanel'
import {
  usePendingGroupPosts,
  useApproveGroupPost,
  useRejectGroupPost,
  useGroupBans,
  useGroupJoinRequests,
} from '@/hooks/useGroupAdmin'
import { Check, X, Settings, ScrollText, ShieldOff, FileClock, UserPlus } from 'lucide-react'

interface SpaceManagePanelProps {
  groupId: string
  onOpenRules?: () => void
}

interface PendingPost {
  id: string
  author_id: string
  title?: string
  body?: string
  created_at: string
}

interface BanEntry {
  id?: string
  user_id: string
  reason?: string
  created_at?: string
}

/**
 * The lean admin toolkit for a space — deliberately just the features
 * that matter: member requests, pending posts, banned members, and
 * quick links to rules + settings. (No badge requests / admin assist /
 * insights sprawl.)
 */
export default function SpaceManagePanel({ groupId, onOpenRules }: SpaceManagePanelProps) {
  const qc = useQueryClient()
  const { data: pendingPosts } = usePendingGroupPosts(groupId)
  const approvePost = useApproveGroupPost(groupId)
  const rejectPost = useRejectGroupPost(groupId)
  const { data: bans } = useGroupBans(groupId)

  const unban = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/v1/groups/${groupId}/members/${userId}/ban`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-bans', groupId] }),
  })

  const { data: joinRequests } = useGroupJoinRequests(groupId)
  const posts: PendingPost[] = pendingPosts ?? []
  const banned: BanEntry[] = bans ?? []
  const requestCount = (joinRequests ?? []).length

  return (
    <div className="space-y-4">
      {/* Quick links */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/groups/${groupId}/settings`}
          className="flex items-center gap-1.5 rounded-xl border border-brand-divider px-4 py-2 text-sm font-semibold text-brand-text transition-all hover:bg-brand-text/5"
        >
          <Settings className="h-4 w-4" />
          Space Settings
        </Link>
        <button
          onClick={onOpenRules}
          className="flex items-center gap-1.5 rounded-xl border border-brand-divider px-4 py-2 text-sm font-semibold text-brand-text transition-all hover:bg-brand-text/5"
        >
          <ScrollText className="h-4 w-4" />
          Edit Rules
        </button>
      </div>

      {/* Member requests */}
      <div className="rounded-2xl border border-brand-divider bg-brand-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-brand-text/50" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text/50">
            Member requests {requestCount > 0 && <span className="text-brand-highlight">({requestCount})</span>}
          </h3>
        </div>
        {requestCount === 0 ? (
          <p className="text-xs text-brand-text/40">No pending member requests.</p>
        ) : (
          <GroupJoinRequestsPanel groupId={groupId} />
        )}
      </div>

      {/* Pending posts */}
      <div className="rounded-2xl border border-brand-divider bg-brand-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <FileClock className="h-4 w-4 text-brand-text/50" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text/50">
            Pending posts {posts.length > 0 && <span className="text-brand-highlight">({posts.length})</span>}
          </h3>
        </div>
        {posts.length === 0 ? (
          <p className="text-xs text-brand-text/40">No posts waiting for approval.</p>
        ) : (
          <div className="space-y-2">
            {posts.map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-xl border border-brand-divider p-3">
                <div className="min-w-0 flex-1">
                  {p.title && <p className="truncate text-sm font-bold text-brand-text">{p.title}</p>}
                  <p className="line-clamp-2 text-xs text-brand-text/60">{p.body || '(no text)'}</p>
                  <p className="mt-1 text-[10px] text-brand-text/35">
                    {new Date(p.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <button
                  onClick={() => approvePost.mutate(p.id)}
                  disabled={approvePost.isPending}
                  className="flex items-center gap-1 rounded-lg bg-brand-text px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand-bg transition-all hover:opacity-90 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  Approve
                </button>
                <button
                  onClick={() => rejectPost.mutate(p.id)}
                  disabled={rejectPost.isPending}
                  className="flex items-center gap-1 rounded-lg bg-brand-text/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand-text/60 transition-all hover:bg-brand-text/12 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                  Reject
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Banned members */}
      <div className="rounded-2xl border border-brand-divider bg-brand-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldOff className="h-4 w-4 text-brand-text/50" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text/50">Banned members</h3>
        </div>
        {banned.length === 0 ? (
          <p className="text-xs text-brand-text/40">No one is banned from this space.</p>
        ) : (
          <div className="space-y-2">
            {banned.map((b) => (
              <div key={b.user_id} className="flex items-center gap-3 rounded-xl border border-brand-divider p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-brand-text">{b.user_id}</p>
                  {b.reason && <p className="truncate text-[11px] text-brand-text/45">{b.reason}</p>}
                </div>
                <button
                  onClick={() => unban.mutate(b.user_id)}
                  disabled={unban.isPending}
                  className="rounded-lg bg-brand-text/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand-text/60 transition-all hover:bg-brand-text/12 disabled:opacity-50"
                >
                  Unban
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

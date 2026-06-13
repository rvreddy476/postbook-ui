'use client'

import React, { useState, useMemo } from 'react'
import { Check, X, Shield, UserX, Clock, AlertCircle } from 'lucide-react'
import {
  useCommunityJoinRequests,
  useApproveJoinRequest,
  useRejectJoinRequest,
  useCommunityBans,
  useUnbanMember,
  useCommunityModlog,
} from '@/hooks/useCommunityAdmin'
import { useBatchProfiles } from '@/hooks/useProfile'
import CommunityQASettingsTab from '@/components/communities/CommunityQASettingsTab'
import { HelpCircle } from 'lucide-react'

interface Props {
  communityId: string
}

type Section = 'requests' | 'bans' | 'modlog' | 'qa'

const sections: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: 'requests', label: 'Join Requests', icon: <Clock className="w-3.5 h-3.5" /> },
  { key: 'bans', label: 'Ban List', icon: <UserX className="w-3.5 h-3.5" /> },
  { key: 'modlog', label: 'Mod Log', icon: <Shield className="w-3.5 h-3.5" /> },
  { key: 'qa', label: 'Q&A Settings', icon: <HelpCircle className="w-3.5 h-3.5" /> },
]

export default function CommunityAdminTab({ communityId }: Props) {
  const [active, setActive] = useState<Section>('requests')

  return (
    <div>
      <h2 className="text-lg font-bold text-brand-text mb-4">Admin Tools</h2>

      {/* Section tabs */}
      <div className="flex items-center gap-1.5 mb-5">
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              active === s.key ? 'bg-brand-text text-brand-bg' : 'bg-brand-card border border-brand-divider text-brand-text/60 hover:bg-brand-bg'
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {active === 'requests' && <JoinRequestsSection communityId={communityId} />}
      {active === 'bans' && <BansSection communityId={communityId} />}
      {active === 'modlog' && <ModlogSection communityId={communityId} />}
      {active === 'qa' && <CommunityQASettingsTab communityId={communityId} />}
    </div>
  )
}

/* ===== Join Requests ===== */
function JoinRequestsSection({ communityId }: { communityId: string }) {
  const { data: requests, isLoading } = useCommunityJoinRequests(communityId)
  const approve = useApproveJoinRequest(communityId)
  const reject = useRejectJoinRequest(communityId)

  const userIds = useMemo(() => (requests ?? []).map(r => r.user_id), [requests])
  const { data: profileMap } = useBatchProfiles(userIds)

  if (isLoading) return <LoadingSkeleton count={3} />

  if (!requests || requests.length === 0) {
    return (
      <EmptyState icon={<Check className="w-8 h-8" />} text="No pending requests" />
    )
  }

  return (
    <div className="space-y-2">
      {requests.map(req => {
        const profile = profileMap?.get(req.user_id)
        const name = profile?.display_name || profile?.username || req.user_id.slice(0, 8)
        const avatar = profile?.avatar_media_id ? `/v1/media/${profile.avatar_media_id}/serve` : undefined

        return (
          <div key={req.id} className="flex items-center gap-3 p-3 bg-brand-card border border-brand-divider rounded-xl">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-bg flex items-center justify-center shrink-0">
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-brand-text/30">{name[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand-text truncate">{name}</p>
              <p className="text-[10px] text-brand-text/40">
                Requested {new Date(req.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => approve.mutate(req.id)}
                disabled={approve.isPending}
                className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => reject.mutate(req.id)}
                disabled={reject.isPending}
                className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ===== Bans ===== */
function BansSection({ communityId }: { communityId: string }) {
  const { data: bans, isLoading } = useCommunityBans(communityId)
  const unban = useUnbanMember(communityId)

  if (isLoading) return <LoadingSkeleton count={2} />

  if (!bans || bans.length === 0) {
    return <EmptyState icon={<Check className="w-8 h-8" />} text="No banned members" />
  }

  return (
    <div className="space-y-2">
      {(bans as any[]).map((ban: any) => (
        <div key={ban.user_id || ban.id} className="flex items-center gap-3 p-3 bg-brand-card border border-brand-divider rounded-xl">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-text truncate">{ban.display_name || ban.user_id}</p>
            {ban.reason && <p className="text-[10px] text-brand-text/40 truncate">Reason: {ban.reason}</p>}
          </div>
          <button
            onClick={() => unban.mutate(ban.user_id)}
            disabled={unban.isPending}
            className="px-3 py-1.5 text-xs font-semibold border border-brand-divider rounded-lg text-brand-text hover:bg-brand-bg transition-colors disabled:opacity-50"
          >
            Unban
          </button>
        </div>
      ))}
    </div>
  )
}

/* ===== Mod Log ===== */
function ModlogSection({ communityId }: { communityId: string }) {
  const { data: entries, isLoading } = useCommunityModlog(communityId)

  if (isLoading) return <LoadingSkeleton count={3} />

  if (!entries || entries.length === 0) {
    return <EmptyState icon={<Shield className="w-8 h-8" />} text="No moderation actions recorded" />
  }

  const actionColors: Record<string, string> = {
    ban_member: 'text-red-600 bg-red-50',
    unban_member: 'text-emerald-600 bg-emerald-50',
    role_change: 'text-blue-600 bg-blue-50',
    remove_post: 'text-orange-600 bg-orange-50',
    quarantine_space: 'text-amber-600 bg-amber-50',
  }

  return (
    <div className="space-y-2">
      {entries.map(entry => {
        const color = actionColors[entry.action] ?? 'text-brand-text/60 bg-brand-bg'
        return (
          <div key={entry.id} className="flex items-start gap-3 p-3 bg-brand-card border border-brand-divider rounded-xl">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-brand-text">
                <span className="font-semibold">{entry.action.replace(/_/g, ' ')}</span>
                {entry.reason && <span className="text-brand-text/50"> — {entry.reason}</span>}
              </p>
              <p className="text-[10px] text-brand-text/40 mt-0.5">
                {new Date(entry.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ===== Shared ===== */
function LoadingSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-brand-card border border-brand-divider rounded-xl animate-pulse">
          <div className="w-10 h-10 rounded-full bg-brand-bg" />
          <div className="flex-1"><div className="h-3 w-32 bg-brand-bg rounded mb-1" /><div className="h-2 w-20 bg-brand-bg rounded" /></div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-brand-divider p-8 text-center">
      <div className="text-brand-text/20 mx-auto mb-2 flex justify-center">{icon}</div>
      <p className="text-sm text-brand-text/50">{text}</p>
    </div>
  )
}

'use client'

import React, { useMemo } from 'react'
import { useJoinRequests, useApproveJoinRequest, useRejectJoinRequest } from '@/hooks/useGroups'
import { useBatchProfiles } from '@/hooks/useProfile'
import { Check, X, Clock, UserPlus, Loader2 } from 'lucide-react'

interface GroupJoinRequestsPanelProps {
  groupId: string
}

export default function GroupJoinRequestsPanel({ groupId }: GroupJoinRequestsPanelProps) {
  const { data: requests } = useJoinRequests(groupId)
  const approve = useApproveJoinRequest()
  const reject = useRejectJoinRequest()

  // Batch-fetch profiles for request user IDs
  const requestUserIds = useMemo(() => requests?.map(r => r.user_id) ?? [], [requests])
  const { data: profileMap } = useBatchProfiles(requestUserIds)

  if (!requests || requests.length === 0) return null

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
          <UserPlus className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-amber-800">
            {requests.length} Pending {requests.length === 1 ? 'Request' : 'Requests'}
          </h3>
          <p className="text-[11px] text-amber-500">People waiting to join your space</p>
        </div>
      </div>

      <div className="space-y-2">
        {requests.map((req) => {
          const profile = profileMap?.get(req.user_id)
          const name = profile?.display_name || profile?.username || 'User'
          const avatarUrl = profile?.avatar_media_id ? `/v1/media/${profile.avatar_media_id}/serve` : null
          return (
          <div key={req.id} className="flex items-center justify-between bg-brand-card/80 backdrop-blur-sm rounded-xl p-3 border border-amber-100/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-xs font-bold text-amber-600">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-brand-text">{name}</p>
                <p className="text-[11px] text-brand-text/60 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => approve.mutate({ groupId, requestId: req.id })}
                disabled={approve.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {approve.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Accept
              </button>
              <button
                onClick={() => reject.mutate({ groupId, requestId: req.id })}
                disabled={reject.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-card border border-brand-divider text-brand-highlight text-xs font-bold hover:border-rose-200 hover:text-rose-500 transition-all disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Decline
              </button>
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}

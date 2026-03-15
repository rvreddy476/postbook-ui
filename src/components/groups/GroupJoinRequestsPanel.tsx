'use client'

import React from 'react'
import { useJoinRequests, useApproveJoinRequest, useRejectJoinRequest } from '@/hooks/useGroups'
import { Check, X, Clock, UserPlus, Loader2 } from 'lucide-react'

interface GroupJoinRequestsPanelProps {
  groupId: string
}

export default function GroupJoinRequestsPanel({ groupId }: GroupJoinRequestsPanelProps) {
  const { data: requests } = useJoinRequests(groupId)
  const approve = useApproveJoinRequest()
  const reject = useRejectJoinRequest()

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
          <p className="text-[11px] text-amber-500">People waiting to join your group</p>
        </div>
      </div>

      <div className="space-y-2">
        {requests.map((req) => (
          <div key={req.id} className="flex items-center justify-between bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-amber-100/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-xs font-bold text-amber-600">
                {req.user_id.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">{req.user_id.slice(0, 8)}...</p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
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
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-bold hover:border-rose-200 hover:text-rose-500 transition-all disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import React from 'react'
import { Globe, Lock, Calendar, Users, FileText, MessageCircle } from 'lucide-react'
import type { Group } from '@/types/groups'

interface GroupAboutTabProps {
  group: Group
}

export default function GroupAboutTab({ group }: GroupAboutTabProps) {
  const createdDate = new Date(group.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-6 max-w-lg">
      {/* Description */}
      {group.description && (
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">About</h3>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{group.description}</p>
        </div>
      )}

      {/* Details */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Details</h3>

        <div className="flex items-center gap-3">
          {group.visibility === 'public' ? (
            <Globe className="w-4 h-4 text-slate-400" />
          ) : (
            <Lock className="w-4 h-4 text-slate-400" />
          )}
          <div>
            <p className="text-sm font-bold text-slate-700 capitalize">{group.visibility} Group</p>
            <p className="text-xs text-slate-400">
              {group.visibility === 'public' ? 'Anyone can find and join this group' : 'Only invited members can join'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Users className="w-4 h-4 text-slate-400" />
          <div>
            <p className="text-sm font-bold text-slate-700">{group.member_count} Members</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-slate-400" />
          <div>
            <p className="text-sm font-bold text-slate-700">{group.post_count} Posts</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-slate-400" />
          <div>
            <p className="text-sm font-bold text-slate-700">Created {createdDate}</p>
          </div>
        </div>

        {group.chat_conversation_id && (
          <div className="flex items-center gap-3">
            <MessageCircle className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-sm font-bold text-slate-700">Group Chat Enabled</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

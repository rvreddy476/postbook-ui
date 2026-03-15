'use client'

import React from 'react'
import {
  Globe, Lock, Shield, Calendar, Users, FileText, MessageCircle,
  MapPin, Languages, Tag, Clock, ShieldCheck, UserPlus
} from 'lucide-react'
import type { Group } from '@/types/groups'

interface GroupAboutTabProps {
  group: Group
}

function DetailRow({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value?: string; sub?: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-slate-300 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function GroupAboutTab({ group }: GroupAboutTabProps) {
  const createdDate = new Date(group.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const privacyInfo = () => {
    switch (group.privacy_level) {
      case 'restricted':
        return { icon: <Shield className="w-4 h-4 text-amber-400" />, label: 'Restricted Group', desc: 'Anyone can find this group, but content is for members only' }
      case 'private':
        return { icon: <Lock className="w-4 h-4 text-rose-400" />, label: 'Private Group', desc: 'Only invited members can find and join this group' }
      default:
        return { icon: <Globe className="w-4 h-4 text-emerald-400" />, label: 'Public Group', desc: 'Anyone can find, join, and see posts in this group' }
    }
  }

  const joinModeLabel = () => {
    switch (group.join_mode) {
      case 'request': return 'Members must be approved by an admin'
      case 'invite_only': return 'Only invited users can join'
      default: return 'Anyone can join immediately'
    }
  }

  const privacy = privacyInfo()

  return (
    <div className="space-y-5">
      {/* Description Card */}
      {group.description && (
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">About</h3>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{group.description}</p>
        </div>
      )}

      {/* Details Card */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Details</h3>

        <div className="divide-y divide-slate-50">
          <DetailRow
            icon={privacy.icon}
            label={privacy.label}
            value={privacy.desc}
          />

          {group.join_mode && (
            <DetailRow
              icon={<UserPlus className="w-4 h-4 text-slate-400" />}
              label={`Join Mode: ${group.join_mode === 'request' ? 'Request' : group.join_mode === 'invite_only' ? 'Invite Only' : 'Open'}`}
              value={joinModeLabel()}
            />
          )}

          <DetailRow
            icon={<Users className="w-4 h-4 text-slate-400" />}
            label={`${group.member_count} Members`}
            value={`${group.post_count} posts shared`}
          />

          {group.pending_request_count != null && group.pending_request_count > 0 && (
            <DetailRow
              icon={<Clock className="w-4 h-4 text-amber-400" />}
              label={`${group.pending_request_count} Pending Requests`}
              value="Waiting for admin approval"
            />
          )}

          <DetailRow
            icon={<Calendar className="w-4 h-4 text-slate-400" />}
            label={`Created ${createdDate}`}
            value={`Active since ${new Date(group.created_at).getFullYear()}`}
          />

          {group.category && (
            <DetailRow
              icon={<Tag className="w-4 h-4 text-slate-400" />}
              label="Category"
              value={group.category}
            />
          )}

          {group.location && (
            <DetailRow
              icon={<MapPin className="w-4 h-4 text-slate-400" />}
              label="Location"
              value={group.location}
            />
          )}

          {group.language && (
            <DetailRow
              icon={<Languages className="w-4 h-4 text-slate-400" />}
              label="Language"
              value={group.language}
            />
          )}

          {group.chat_conversation_id && (
            <DetailRow
              icon={<MessageCircle className="w-4 h-4 text-slate-400" />}
              label="Group Chat"
              value="Chat is enabled for this group"
            />
          )}
        </div>
      </div>

      {/* Permissions Card */}
      {(group.who_can_post || group.who_can_invite) && (
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Permissions</h3>

          <div className="divide-y divide-slate-50">
            {group.who_can_post && (
              <DetailRow
                icon={<FileText className="w-4 h-4 text-slate-400" />}
                label="Who can post"
                value={group.who_can_post.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              />
            )}

            {group.who_can_invite && (
              <DetailRow
                icon={<ShieldCheck className="w-4 h-4 text-slate-400" />}
                label="Who can invite"
                value={group.who_can_invite.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

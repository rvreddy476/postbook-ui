'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Globe, Lock, Shield, Users, Check, Clock, Plus, LogOut, BellOff, MessageSquare, X } from 'lucide-react'
import { useJoinGroup, useLeaveGroup } from '@/hooks/useGroups'
import type { Group } from '@/types/groups'

interface GroupCardProps {
  group: Group
  /** When rendered under "My Groups" tab, force membership display */
  isMyGroup?: boolean
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const gradients = [
  'from-violet-400 to-purple-300',
  'from-sky-400 to-blue-300',
  'from-emerald-400 to-teal-300',
  'from-amber-400 to-orange-300',
  'from-rose-400 to-pink-300',
  'from-indigo-400 to-blue-300',
]

function hashIndex(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % gradients.length
  return h
}

const GroupCard: React.FC<GroupCardProps> = ({ group, isMyGroup }) => {
  const joinGroup = useJoinGroup()
  const leaveGroup = useLeaveGroup()
  const [showDropdown, setShowDropdown] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const privacy = group.privacy_level ?? (group.visibility === 'private' ? 'private' : 'public')
  const viewerRole = group.viewer_role ?? (isMyGroup ? 'member' : 'outsider')
  const isMember = viewerRole === 'member' || viewerRole === 'admin' || viewerRole === 'moderator' || viewerRole === 'owner'
  const isPending = viewerRole === 'pending' || (group.pending_request_count != null && group.pending_request_count > 0 && viewerRole === 'outsider' && group.join_mode === 'request')

  const idx = hashIndex(group.name)
  const PrivacyIcon = privacy === 'private' ? Lock : privacy === 'restricted' ? Shield : Globe
  const privacyLabel = privacy === 'public' ? 'Public' : privacy === 'restricted' ? 'Restricted' : 'Private'

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [showDropdown])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const handleJoin = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    joinGroup.mutate(group.id, {
      onSuccess: (data) => {
        if (data?.status === 'pending' || group.join_mode === 'request' || privacy === 'private') {
          setToast('Request sent! Waiting for admin approval.')
        } else {
          setToast('You joined the space!')
        }
      },
      onError: () => setToast('Failed to join. Try again.'),
    })
  }

  const handleLeave = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm('Leave this space?')) {
      leaveGroup.mutate(group.id)
    }
    setShowDropdown(false)
  }

  return (
    <Link
      href={`/groups/${group.handle || group.id}`}
      className="group/card flex items-center gap-3.5 p-3 rounded-xl border border-brand-divider bg-white hover:border-brand-text/15 hover:shadow-sm transition-all relative"
    >
      {/* Avatar */}
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
        {group.avatar_media_id ? (
          <img
            src={`/v1/media/${group.avatar_media_id}/serve`}
            alt={group.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradients[idx]} flex items-center justify-center text-white font-bold text-base`}>
            {group.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[13px] font-bold text-brand-text truncate leading-tight">{group.name}</h3>
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-brand-text/5 flex-shrink-0">
            <PrivacyIcon className="w-2.5 h-2.5 text-brand-text/40" />
            <span className="text-[9px] font-semibold text-brand-text/40">{privacyLabel}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-brand-text/45">
          <span className="flex items-center gap-0.5">
            <Users className="w-3 h-3" />
            {formatCount(group.member_count)}
          </span>
          <span className="text-brand-text/20">·</span>
          <span className="flex items-center gap-0.5">
            <MessageSquare className="w-3 h-3" />
            {formatCount(group.post_count)} posts
          </span>
        </div>
      </div>

      {/* Action */}
      <div className="flex-shrink-0" ref={dropdownRef}>
        {isMember ? (
          <div className="relative">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDropdown(!showDropdown) }}
              className="flex items-center gap-1 px-3 py-1.5 border border-brand-divider text-brand-text rounded-lg text-[10px] font-bold hover:bg-brand-text/5 transition-all"
            >
              <Check className="w-3 h-3" />
              Joined
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[8rem] overflow-hidden rounded-lg border border-brand-divider bg-white py-0.5 shadow-lg">
                <button
                  onClick={handleLeave}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50"
                >
                  <LogOut className="w-3 h-3" /> Leave
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDropdown(false) }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-brand-text hover:bg-brand-text/5"
                >
                  <BellOff className="w-3 h-3" /> Mute
                </button>
              </div>
            )}
          </div>
        ) : isPending ? (
          <button
            disabled
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold cursor-default"
          >
            <Clock className="w-3 h-3" />
            Pending
          </button>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joinGroup.isPending}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand-text text-brand-bg rounded-lg text-[10px] font-bold hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
            Join
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 bg-brand-text text-brand-bg text-[11px] font-semibold rounded-lg shadow-lg whitespace-nowrap">
          {toast}
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setToast(null) }}>
            <X className="w-3 h-3 opacity-60" />
          </button>
        </div>
      )}
    </Link>
  )
}

export default GroupCard

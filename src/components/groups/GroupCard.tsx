'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Globe, Lock, Shield, Users, Check, Clock, Plus, LogOut, BellOff, MessageSquare } from 'lucide-react'
import { useJoinGroup, useLeaveGroup } from '@/hooks/useGroups'
import type { Group } from '@/types/groups'

interface GroupCardProps {
  group: Group
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const coverGradients = [
  'from-amber-100 to-orange-50',
  'from-blue-100 to-cyan-50',
  'from-emerald-100 to-teal-50',
  'from-purple-100 to-pink-50',
  'from-rose-100 to-red-50',
  'from-indigo-100 to-blue-50',
]

const avatarGradients = [
  'from-amber-300 to-orange-200',
  'from-blue-300 to-cyan-200',
  'from-emerald-300 to-teal-200',
  'from-purple-300 to-pink-200',
  'from-rose-300 to-red-200',
  'from-indigo-300 to-blue-200',
]

function getGradientIndex(name: string): number {
  return name.charCodeAt(0) % coverGradients.length
}

const GroupCard: React.FC<GroupCardProps> = ({ group }) => {
  const router = useRouter()
  const joinGroup = useJoinGroup()
  const leaveGroup = useLeaveGroup()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const privacy = group.privacy_level ?? (group.visibility === 'private' ? 'private' : 'public')
  const viewerRole = group.viewer_role ?? 'outsider'
  const isMember = viewerRole === 'member' || viewerRole === 'admin' || viewerRole === 'moderator' || viewerRole === 'owner'
  const isPending = viewerRole === 'outsider' && group.join_mode === 'request'

  const gradIdx = getGradientIndex(group.name)

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

  const handleJoin = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    joinGroup.mutate(group.id)
  }

  const handleLeave = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm('Leave this group?')) {
      leaveGroup.mutate(group.id)
    }
    setShowDropdown(false)
  }

  const PrivacyIcon = privacy === 'private' ? Lock : privacy === 'restricted' ? Shield : Globe

  return (
    <Link
      href={`/groups/${group.handle || group.id}`}
      className="block h-full w-full overflow-hidden rounded-2xl border border-brand-divider bg-white transition-all duration-200 hover:border-brand-text/10 hover:shadow-lg"
    >
      {/* Cover photo */}
      <div className="relative h-20 overflow-hidden sm:h-24">
        {group.cover_media_id ? (
          <img
            src={`/v1/media/${group.cover_media_id}/serve`}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${coverGradients[gradIdx]}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-black opacity-15">{group.name.charAt(0).toUpperCase()}</span>
            </div>
          </div>
        )}
        {/* Privacy pill */}
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-black/30 backdrop-blur-sm text-white">
            <PrivacyIcon className="w-2.5 h-2.5" />
            {privacy === 'public' ? 'Public' : privacy === 'restricted' ? 'Restricted' : 'Private'}
          </span>
        </div>
      </div>

      {/* Avatar overlapping cover */}
      <div className="relative -mt-5 px-3.5">
        <div className="h-11 w-11 rounded-xl border border-brand-divider bg-white/95 p-[2px] shadow-md">
          <div className="h-full w-full overflow-hidden rounded-[10px] bg-brand-text/5">
            {group.avatar_media_id ? (
              <img
                src={`/v1/media/${group.avatar_media_id}/serve`}
                alt={group.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${avatarGradients[gradIdx]} text-sm font-black text-white`}>
                {group.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3.5 pb-3.5 pt-2">
        <h3 className="truncate text-[14px] font-bold leading-tight text-brand-text">{group.name}</h3>

        {group.description && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-brand-text/50">{group.description}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-2 text-[10px] text-brand-text/45 mt-2">
          <span className="flex items-center gap-0.5">
            <Users className="w-3 h-3" />
            {formatCount(group.member_count)}
          </span>
          <span className="w-px h-2.5 bg-brand-divider" />
          <span className="flex items-center gap-0.5">
            <MessageSquare className="w-3 h-3" />
            {formatCount(group.post_count)}
          </span>
        </div>

        {/* Action button */}
        <div className="mt-3" ref={dropdownRef}>
          {isMember ? (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowDropdown(!showDropdown)
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-brand-divider text-brand-text rounded-xl text-[11px] font-bold hover:bg-brand-text/5 transition-all"
              >
                <Check className="w-3 h-3" />
                Joined
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full z-50 mt-2 min-w-[9rem] overflow-hidden rounded-xl border border-brand-divider bg-white py-1 shadow-lg">
                  <button
                    onClick={handleLeave}
                    className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium text-red-500 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="w-3 h-3" />
                    Leave
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDropdown(false) }}
                    className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium text-brand-text transition-colors hover:bg-brand-text/5"
                  >
                    <BellOff className="w-3 h-3" />
                    Mute
                  </button>
                </div>
              )}
            </div>
          ) : isPending ? (
            <button
              disabled
              onClick={(e) => e.preventDefault()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-text/5 text-brand-text/40 rounded-xl text-[11px] font-bold cursor-not-allowed"
            >
              <Clock className="w-3 h-3" />
              Pending
            </button>
          ) : (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleJoin(e) }}
              disabled={joinGroup.isPending}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-text text-brand-bg rounded-xl text-[11px] font-bold hover:opacity-90 transition-all disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
              Join Group
            </button>
          )}
        </div>
      </div>
    </Link>
  )
}

export default GroupCard

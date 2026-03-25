'use client'

import React, { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Bell, BellOff, Check, ChevronDown, Copy, MoreHorizontal, Pencil, Share2, Trash2, Flag, Users } from 'lucide-react'
import { useJoinCommunity, useLeaveCommunity } from '@/hooks/useCommunities'
import { isAtLeast } from '@/lib/communityRoles'
import type { Community } from '@/types/communities'

interface CommunityHeaderProps {
  community: Community
  canEdit?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const CommunityHeader: React.FC<CommunityHeaderProps> = ({ community, canEdit, onEdit, onDelete }) => {
  const joinMut = useJoinCommunity()
  const leaveMut = useLeaveCommunity()
  const [showLeaveMenu, setShowLeaveMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const leaveMenuRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  const isMember = community.viewer_role && community.viewer_role !== 'outsider'
  const gradient = 'from-slate-700 to-slate-500'
  const avatarSrc = community.avatar_media_id
    ? `/v1/media/${community.avatar_media_id}/serve`
    : null

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (leaveMenuRef.current && !leaveMenuRef.current.contains(event.target as Node)) {
        setShowLeaveMenu(false)
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false)
      }
    }

    if (showLeaveMenu || showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showLeaveMenu, showMoreMenu])

  const copyLink = async () => {
    if (typeof window === 'undefined') return
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch (error) {
      console.error('Failed to copy community link:', error)
    } finally {
      setShowMoreMenu(false)
    }
  }

  return (
    <div className="bg-white dark:bg-brand-bg rounded-3xl border border-brand-divider/60 overflow-hidden shadow-sm">
      <div className="h-[140px] relative overflow-hidden group">
        {community.banner_media_id ? (
          <img
            src={`/v1/media/${community.banner_media_id}/serve`}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} opacity-90 group-hover:scale-105 transition-transform duration-700`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      </div>

      <div className="px-6 pb-6 -mt-10 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="w-24 h-24 rounded-[1.5rem] bg-brand-bg p-1 shadow-xl ring-1 ring-black/5 dark:ring-white/10 relative flex-shrink-0">
              <div className="w-full h-full rounded-[1.25rem] overflow-hidden">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={community.name} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-3xl`}
                  >
                    {community.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-brand-text truncate tracking-tight">
                  {community.name}
                </h1>
                {community.is_verified && (
                  <BadgeCheck className="w-5 h-5 text-brand-text flex-shrink-0" />
                )}
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-xs text-brand-text/70 flex-wrap font-semibold">
                <span className="text-brand-text/50">@{community.handle}</span>
                <span className="text-brand-text/20">•</span>
                {community.category && (
                  <>
                    <span className="text-brand-text uppercase tracking-wider">
                      {community.category}
                    </span>
                    <span className="text-brand-text/20">•</span>
                  </>
                )}
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5"/>{formatCount(community.member_count)} members</span>
                <span className="text-brand-text/20">•</span>
                <span>{community.space_count} spaces</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 pt-3 sm:pt-0 sm:self-end sm:mb-2">
            {canEdit ? (
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 px-4 py-2 border border-brand-divider text-brand-text text-xs font-bold rounded-xl hover:bg-brand-bg transition-colors hover:shadow-sm"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            ) : isMember ? (
              <div className="relative" ref={leaveMenuRef}>
                <button
                  onClick={() => setShowLeaveMenu(!showLeaveMenu)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-text/5 border border-brand-text/10 text-brand-text text-xs font-bold rounded-xl hover:bg-brand-text/10 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Joined
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showLeaveMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-white/90 dark:bg-brand-bg/90 backdrop-blur-md border border-brand-divider/60 rounded-xl shadow-xl py-2 z-20 min-w-[160px]">
                    <button
                      onClick={() => {
                        leaveMut.mutate(community.id)
                        setShowLeaveMenu(false)
                      }}
                      disabled={leaveMut.isPending}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-brand-text/70 hover:bg-brand-text/5 hover:text-brand-text transition-colors disabled:opacity-50"
                    >
                      Leave Community
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => joinMut.mutate(community.id)}
                disabled={joinMut.isPending}
                className="flex items-center gap-1.5 px-5 py-2 bg-brand-text text-brand-bg text-xs font-bold rounded-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                Join
              </button>
            )}

            <div className="flex items-center gap-1.5 p-1 bg-brand-text/5 rounded-2xl">
              <button className="p-2 text-brand-text/70 hover:text-brand-text hover:bg-white dark:hover:bg-brand-bg rounded-xl transition-all shadow-sm">
                <Bell className="w-4 h-4" />
              </button>
              <button
                onClick={copyLink}
                className="p-2 text-brand-text/70 hover:text-brand-text hover:bg-white dark:hover:bg-brand-bg rounded-xl transition-all shadow-sm"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-2 text-brand-text/70 hover:text-brand-text hover:bg-white dark:hover:bg-brand-bg rounded-xl transition-all shadow-sm"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {showMoreMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-white/90 dark:bg-brand-bg/90 backdrop-blur-md border border-brand-divider/60 rounded-2xl shadow-xl py-2 z-20 min-w-[200px]">
                    <button
                      onClick={copyLink}
                      className="w-full text-left px-5 py-2.5 text-sm font-semibold text-brand-text/70 hover:bg-brand-text/5 hover:text-brand-text transition-colors flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </button>
                    {isMember && (
                      <button
                        onClick={() => setShowMoreMenu(false)}
                        className="w-full text-left px-4 py-2 text-sm text-brand-text hover:bg-brand-bg transition-colors flex items-center gap-2"
                      >
                        <BellOff className="w-4 h-4" />
                        Mute Notifications
                      </button>
                    )}
                    {canEdit && onEdit && (
                      <button
                        onClick={() => {
                          onEdit()
                          setShowMoreMenu(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-brand-text hover:bg-brand-bg transition-colors flex items-center gap-2"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit Community
                      </button>
                    )}
                    {!isMember && (
                      <button
                        onClick={() => setShowMoreMenu(false)}
                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
                      >
                        <Flag className="w-4 h-4" />
                        Report Community
                      </button>
                    )}
                    {isAtLeast(community.viewer_role, 'owner') && onDelete && (
                      <>
                        <div className="border-t border-brand-divider my-1" />
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this community? This action cannot be undone.')) {
                              onDelete()
                            }
                            setShowMoreMenu(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Community
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommunityHeader

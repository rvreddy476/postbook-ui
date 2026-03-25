'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Users, Search, ChevronDown, MoreHorizontal, ShieldCheck, Clock, UserX, Ban, CheckCircle2, XCircle } from 'lucide-react'
import type { BroadcastChannel, ChannelMember } from '@/types/channels'
import { useBatchProfiles } from '@/hooks/useProfile'

interface SubscribersTabProps {
  channel: BroadcastChannel
  subscribers?: ChannelMember[]
  isLoading?: boolean
  onRemove?: (userId: string) => void
  onBlock?: (userId: string) => void
  onApprove?: (userId: string) => void
  onDecline?: (userId: string) => void
}

type SortOption = 'newest' | 'oldest' | 'name_asc'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function roleBadge(role: string) {
  switch (role) {
    case 'admin':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[10px] font-bold uppercase tracking-wider">
          <ShieldCheck className="w-3 h-3" /> Admin
        </span>
      )
    case 'moderator':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
          <ShieldCheck className="w-3 h-3" /> Mod
        </span>
      )
    case 'pending':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-600 text-[10px] font-bold uppercase tracking-wider">
          <Clock className="w-3 h-3" /> Pending
        </span>
      )
    default:
      return null
  }
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-divider animate-pulse">
      <div className="w-9 h-9 rounded-full bg-brand-secondary/60 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3 w-28 bg-brand-secondary/60 rounded" />
        <div className="h-2.5 w-20 bg-brand-secondary/40 rounded" />
      </div>
      <div className="h-3 w-16 bg-brand-secondary/40 rounded" />
    </div>
  )
}

function ActionsDropdown({ userId, onRemove, onBlock }: { userId: string; onRemove?: (id: string) => void; onBlock?: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState<'remove' | 'block' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setConfirming(null)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); setConfirming(null) }}
        className="p-1.5 rounded-lg hover:bg-brand-secondary/50 text-brand-text/40 hover:text-brand-text transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white rounded-xl shadow-lg border border-brand-divider py-1">
          {confirming === null ? (
            <>
              {onRemove && (
                <button
                  onClick={() => setConfirming('remove')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-brand-text hover:bg-brand-secondary/40 transition-colors"
                >
                  <UserX className="w-3.5 h-3.5 text-red-500" />
                  Remove subscriber
                </button>
              )}
              {onBlock && (
                <button
                  onClick={() => setConfirming('block')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-brand-text hover:bg-brand-secondary/40 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5 text-red-500" />
                  Block user
                </button>
              )}
            </>
          ) : (
            <div className="px-3 py-2 space-y-2">
              <p className="text-[11px] font-semibold text-brand-text">
                {confirming === 'remove' ? 'Remove this subscriber?' : 'Block this user?'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (confirming === 'remove') onRemove?.(userId)
                    else onBlock?.(userId)
                    setOpen(false)
                    setConfirming(null)
                  }}
                  className="flex-1 px-2 py-1 rounded-lg bg-red-500 text-white text-[11px] font-semibold hover:bg-red-600 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="flex-1 px-2 py-1 rounded-lg bg-brand-secondary/60 text-brand-text text-[11px] font-semibold hover:bg-brand-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SubscribersTab({
  channel,
  subscribers = [],
  isLoading = false,
  onRemove,
  onBlock,
  onApprove,
  onDecline,
}: SubscribersTabProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('newest')
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  // Fetch user profiles for subscriber names
  const subscriberIds = useMemo(() => subscribers.map(s => s.user_id), [subscribers])
  const { data: profileMap } = useBatchProfiles(subscriberIds)

  const getName = (userId: string) => {
    const p = profileMap?.get(userId)
    if (p) {
      if (p.display_name) return p.display_name
      if (p.first_name || p.last_name) return `${p.first_name || ''} ${p.last_name || ''}`.trim()
      if (p.username) return p.username
    }
    return userId.slice(0, 8) + '...'
  }
  const getHandle = (userId: string) => {
    const p = profileMap?.get(userId)
    return p?.username ? `@${p.username}` : `@${userId.slice(0, 8)}`
  }
  const getAvatar = (userId: string) => {
    const p = profileMap?.get(userId)
    if (p?.avatar_media_id) return `/v1/media/${p.avatar_media_id}/serve`
    return null
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    if (sortOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [sortOpen])

  const pendingMembers = useMemo(
    () => subscribers.filter(s => s.role === 'pending'),
    [subscribers]
  )

  const activeMembers = useMemo(
    () => subscribers.filter(s => s.role !== 'pending'),
    [subscribers]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let list = q
      ? activeMembers.filter(s => {
          const name = getName(s.user_id).toLowerCase()
          const handle = getHandle(s.user_id).toLowerCase()
          return name.includes(q) || handle.includes(q) || s.user_id.toLowerCase().includes(q)
        })
      : activeMembers

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'newest':
          return new Date(b.subscribed_at).getTime() - new Date(a.subscribed_at).getTime()
        case 'oldest':
          return new Date(a.subscribed_at).getTime() - new Date(b.subscribed_at).getTime()
        case 'name_asc':
          return getName(a.user_id).localeCompare(getName(b.user_id))
        default:
          return 0
      }
    })

    return list
  }, [activeMembers, search, sort, profileMap]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortLabels: Record<SortOption, string> = {
    newest: 'Newest',
    oldest: 'Oldest',
    name_asc: 'Name A-Z',
  }

  const count = channel.subscriber_count
  const countLabel = `${count} ${count === 1 ? 'Subscriber' : 'Subscribers'}`

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-text/40" />
          <div className="h-4 w-32 bg-brand-secondary/50 rounded animate-pulse" />
        </div>
        <div className="bg-white border border-brand-divider rounded-xl overflow-hidden">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    )
  }

  // Empty state
  if (subscribers.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-text/50" />
          <h3 className="text-sm font-bold text-brand-text">{countLabel}</h3>
        </div>
        <div className="bg-white border border-brand-divider rounded-xl p-8 text-center">
          <Users className="w-10 h-10 text-brand-text/15 mx-auto mb-3" />
          <p className="text-sm font-semibold text-brand-text/50">No subscribers yet</p>
          <p className="text-xs text-brand-text/35 mt-1">Share your channel to start growing your audience</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-brand-text/50" />
        <h3 className="text-sm font-bold text-brand-text">{countLabel}</h3>
      </div>

      {/* Search + Sort */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search subscribers..."
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-brand-divider bg-white text-xs text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-violet-200 transition-shadow"
          />
        </div>
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setSortOpen(o => !o)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-brand-divider bg-white text-xs font-medium text-brand-text/60 hover:text-brand-text transition-colors"
          >
            {sortLabels[sort]}
            <ChevronDown className="w-3 h-3" />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-32 bg-white rounded-xl shadow-lg border border-brand-divider py-1">
              {(Object.keys(sortLabels) as SortOption[]).map(key => (
                <button
                  key={key}
                  onClick={() => { setSort(key); setSortOpen(false) }}
                  className={`w-full px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                    sort === key ? 'text-violet-600 bg-violet-50' : 'text-brand-text/60 hover:bg-brand-secondary/40'
                  }`}
                >
                  {sortLabels[key]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending approvals */}
      {pendingMembers.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-orange-200">
            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
              {pendingMembers.length} Pending {pendingMembers.length === 1 ? 'Approval' : 'Approvals'}
            </p>
          </div>
          {pendingMembers.map(member => {
            const name = getName(member.user_id)
            const handle = getHandle(member.user_id)
            return (
            <div
              key={member.user_id}
              className="flex items-center gap-3 px-4 py-3 border-b border-orange-200 last:border-b-0"
            >
              <div className="w-9 h-9 rounded-full bg-orange-200/60 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-orange-600">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-brand-text truncate">{name}</p>
                <p className="text-[11px] text-brand-text/40 truncate">{handle}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {onApprove && (
                  <button
                    onClick={() => onApprove(member.user_id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[11px] font-semibold hover:bg-emerald-600 transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Approve
                  </button>
                )}
                {onDecline && (
                  <button
                    onClick={() => onDecline(member.user_id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-secondary/60 text-brand-text text-[11px] font-semibold hover:bg-brand-secondary transition-colors"
                  >
                    <XCircle className="w-3 h-3" /> Decline
                  </button>
                )}
              </div>
            </div>
          )})}
        </div>
      )}

      {/* Subscriber list */}
      {filtered.length > 0 ? (
        <div className="bg-white border border-brand-divider rounded-xl overflow-hidden">
          {filtered.map(member => {
            const name = getName(member.user_id)
            const handle = getHandle(member.user_id)
            const avatar = getAvatar(member.user_id)
            return (
              <div
                key={member.user_id}
                className="flex items-center gap-3 px-4 py-3 border-b border-brand-divider last:border-b-0"
              >
                <div className="w-9 h-9 rounded-full bg-brand-secondary/60 flex items-center justify-center shrink-0 overflow-hidden">
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-brand-text/50">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-brand-text truncate">{name}</p>
                    {roleBadge(member.role)}
                  </div>
                  <p className="text-[11px] text-brand-text/40 truncate">{handle}</p>
                </div>
                <p className="text-[11px] text-brand-text/35 shrink-0 hidden sm:block">
                  Subscribed {formatDate(member.subscribed_at)}
                </p>
                <ActionsDropdown userId={member.user_id} onRemove={onRemove} onBlock={onBlock} />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white border border-brand-divider rounded-xl p-8 text-center">
          <Search className="w-8 h-8 text-brand-text/15 mx-auto mb-2" />
          <p className="text-sm font-semibold text-brand-text/50">No matching subscribers</p>
          <p className="text-xs text-brand-text/35 mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  )
}

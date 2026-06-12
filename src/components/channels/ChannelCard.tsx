'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Users, BadgeCheck, Check, ChevronDown, Eye, BellOff, Bell, LogOut } from 'lucide-react'
import type { BroadcastChannel } from '@/types/channels'

interface ChannelCardProps {
  channel: BroadcastChannel
  onSubscribe?: (channelId: string) => void
  onUnsubscribe?: (channelId: string) => void
}

const avatarColors = [
  'from-stone-700 to-stone-900',
  'from-zinc-600 to-zinc-800',
  'from-neutral-600 to-neutral-800',
  'from-stone-600 to-stone-800',
  'from-gray-600 to-gray-800',
  'from-slate-600 to-slate-800',
]

function pickColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}

const ChannelCard: React.FC<ChannelCardProps> = ({ channel, onSubscribe, onUnsubscribe }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const avatarSrc = channel.avatar_media_id
    ? `/v1/media/${channel.avatar_media_id}/serve`
    : null
  const gradient = pickColor(channel.name)
  const isSubscribed = channel.viewer_role === 'subscriber'
  const isManager = channel.viewer_role === 'admin' || channel.viewer_role === 'editor'

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  return (
    <div className="bg-brand-card border border-brand-divider rounded-2xl px-4 py-3 hover:bg-brand-secondary/30 transition-all duration-200">
      <div className="flex items-center gap-3.5">
        {/* Channel icon */}
        <Link href={`/channels/${channel.id}`} className="flex-shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden">
            {avatarSrc ? (
              <img src={avatarSrc} alt={channel.name} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-lg`}>
                {channel.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </Link>

        {/* Body */}
        <Link href={`/channels/${channel.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-brand-text truncate">{channel.name}</h3>
            {channel.is_verified && (
              <BadgeCheck className="w-3.5 h-3.5 text-brand-text flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-brand-text/50 mt-0.5 truncate">{channel.description || 'No description'}</p>
          <p className="font-mono text-[11px] text-brand-text/40 mt-1">
            <span className="inline-flex items-center gap-0.5">
              <Users className="w-3 h-3" />
              {formatCount(channel.subscriber_count)} subscribers
            </span>
          </p>
        </Link>

        {/* Right side: time + button */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="text-[11px] text-brand-text/40 font-medium">
            {timeAgo(channel.updated_at)}
          </span>

          {isManager ? (
            <Link
              href={`/channels/${channel.id}`}
              className="flex items-center gap-1 border border-brand-divider text-brand-text text-[11px] font-semibold rounded-lg px-3 py-1.5 hover:bg-brand-secondary/50 transition-colors"
            >
              <Eye className="w-3 h-3" />
              Manage
            </Link>
          ) : isSubscribed ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDropdownOpen(!dropdownOpen)
                }}
                className="flex items-center gap-1 border border-brand-divider text-brand-text text-[11px] font-semibold rounded-lg px-3 py-1.5 hover:bg-brand-secondary/50 transition-colors"
              >
                <Check className="w-3 h-3" />
                Subscribed
                <ChevronDown className="w-3 h-3" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-brand-card border border-brand-divider rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                  <Link
                    href={`/channels/${channel.id}`}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Channel
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDropdownOpen(false)
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 transition-colors w-full text-left"
                  >
                    <BellOff className="w-3.5 h-3.5" />
                    Mute
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDropdownOpen(false)
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 transition-colors w-full text-left"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    Notifications
                  </button>
                  <div className="border-t border-brand-divider my-1" />
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onUnsubscribe?.(channel.id)
                      setDropdownOpen(false)
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text/60 hover:bg-brand-secondary/50 transition-colors w-full text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Unsubscribe
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSubscribe?.(channel.id)
              }}
              className="flex items-center gap-1 bg-brand-text text-brand-bg text-[11px] font-semibold rounded-lg px-3 py-1.5 hover:opacity-90 transition-opacity"
            >
              + Subscribe
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChannelCard

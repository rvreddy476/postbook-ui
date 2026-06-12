'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Users, BadgeCheck, Radio, Bell, Check, ChevronDown, BellOff, LogOut, Calendar, Pencil } from 'lucide-react'
import type { BroadcastChannel } from '@/types/channels'

interface ChannelHeaderProps {
  channel: BroadcastChannel
  onSubscribe?: () => void
  onUnsubscribe?: () => void
  activeTab?: string
  onTabChange?: (tab: string) => void
  isOwner?: boolean
  onEdit?: () => void
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
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

const ChannelHeader: React.FC<ChannelHeaderProps> = ({
  channel,
  onSubscribe,
  onUnsubscribe,
  activeTab = 'updates',
  onTabChange,
  isOwner,
  onEdit,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const bannerSrc = channel.banner_media_id
    ? `/v1/media/${channel.banner_media_id}/serve`
    : null
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

  const tabs = [
    { key: 'updates', label: 'Updates' },
    { key: 'about', label: 'About' },
    ...(isOwner ? [{ key: 'subscribers', label: 'Subscribers' }] : []),
  ]

  return (
    <div className="bg-brand-card border border-brand-divider rounded-2xl overflow-hidden">
      {/* Cover image (120px) */}
      <div className="h-[120px] relative overflow-hidden">
        {bannerSrc ? (
          <img src={bannerSrc} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} opacity-80`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="px-6 pb-0 -mt-7 relative">
        <div className="flex items-end justify-between">
          <div className="w-[52px] h-[52px] rounded-xl bg-white p-0.5 shadow-lg">
            <div className="w-full h-full rounded-[10px] overflow-hidden">
              {avatarSrc ? (
                <img src={avatarSrc} alt={channel.name} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-xl`}>
                  {channel.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-1">
            {isOwner ? (
              onEdit ? (
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 border border-brand-divider text-brand-text text-xs font-semibold rounded-lg px-3 py-1.5 hover:bg-brand-secondary/50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Channel
                </button>
              ) : null
            ) : isManager ? (
              <span className="inline-flex items-center rounded-lg border border-brand-divider px-3 py-1.5 text-xs font-semibold text-brand-text/60">
                Manager
              </span>
            ) : isSubscribed ? (
              <>
                <button className="w-8 h-8 rounded-lg border border-brand-divider flex items-center justify-center text-brand-text/60 hover:bg-brand-secondary/50 transition-colors">
                  <Bell className="w-4 h-4" />
                </button>

                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-1.5 border border-brand-divider text-brand-text text-xs font-semibold rounded-lg px-3 py-1.5 hover:bg-brand-secondary/50 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Subscribed
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-brand-card border border-brand-divider rounded-xl shadow-lg z-50 py-1">
                      <button className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 transition-colors w-full text-left">
                        <BellOff className="w-3.5 h-3.5" />
                        Mute
                      </button>
                      <button className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 transition-colors w-full text-left">
                        <Bell className="w-3.5 h-3.5" />
                        Notification settings
                      </button>
                      <div className="border-t border-brand-divider my-1" />
                      <button
                        onClick={() => {
                          onUnsubscribe?.()
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
              </>
            ) : (
              <button
                onClick={onSubscribe}
                className="flex items-center gap-1.5 bg-brand-text text-brand-bg text-xs font-semibold rounded-lg px-4 py-1.5 hover:opacity-90 transition-opacity"
              >
                + Subscribe
              </button>
            )}
          </div>
        </div>

        {/* Name + verified + handle */}
        <div className="mt-3">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-extrabold text-brand-text">{channel.name}</h1>
            {channel.is_verified && (
              <BadgeCheck className="w-5 h-5 text-brand-text flex-shrink-0" />
            )}
          </div>
          <p className="font-mono text-[13px] text-brand-text/50">@{channel.handle}</p>
        </div>

        {/* Description */}
        {channel.description && (
          <p className="text-sm text-brand-text/70 mt-2 leading-relaxed">{channel.description}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-brand-text/50">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span className="font-mono text-xs">{formatCount(channel.subscriber_count)}</span>
            <span className="text-xs">subscribers</span>
          </span>
          <span className="text-brand-divider">|</span>
          <span className="flex items-center gap-1">
            <Radio className="w-3.5 h-3.5" />
            <span className="font-mono text-xs">{formatCount(channel.update_count)}</span>
            <span className="text-xs">updates</span>
          </span>
          <span className="text-brand-divider">|</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-xs">{formatDate(channel.created_at)}</span>
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 mt-4 border-t border-brand-divider -mx-6 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange?.(tab.key)}
              className={`relative px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-brand-text text-brand-text'
                  : 'text-brand-text/50 hover:text-brand-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ChannelHeader

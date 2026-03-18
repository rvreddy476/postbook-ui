'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Pin, Megaphone, Image, Video, Headphones, BarChart3,
  Calendar, ShoppingBag, AlertTriangle, BookOpen,
  MessageCircle, Share2, MoreHorizontal, Pencil, Trash2,
  Sparkles,
} from 'lucide-react'
import type { ChannelUpdate, BroadcastChannel } from '@/types/channels'

interface UpdateCardProps {
  update: ChannelUpdate
  channel?: BroadcastChannel
  isOwner?: boolean
  onDelete?: (updateId: string) => void
  onPin?: (updateId: string, pinned: boolean) => void
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

const typeIcons: Record<string, React.ReactNode> = {
  announcement: <Megaphone className="w-3.5 h-3.5" />,
  image: <Image className="w-3.5 h-3.5" />,
  video: <Video className="w-3.5 h-3.5" />,
  audio: <Headphones className="w-3.5 h-3.5" />,
  poll: <BarChart3 className="w-3.5 h-3.5" />,
  event: <Calendar className="w-3.5 h-3.5" />,
  commerce: <ShoppingBag className="w-3.5 h-3.5" />,
  alert: <AlertTriangle className="w-3.5 h-3.5" />,
  digest: <BookOpen className="w-3.5 h-3.5" />,
}

const avatarColors = [
  'from-stone-700 to-stone-900',
  'from-zinc-600 to-zinc-800',
  'from-neutral-600 to-neutral-800',
  'from-stone-600 to-stone-800',
]

function pickColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

const UpdateCard: React.FC<UpdateCardProps> = ({ update, channel, isOwner, onDelete, onPin }) => {
  const [expanded, setExpanded] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLParagraphElement>(null)
  const [isClamped, setIsClamped] = useState(false)

  const isUrgent = update.update_type === 'alert'

  useEffect(() => {
    if (bodyRef.current) {
      setIsClamped(bodyRef.current.scrollHeight > bodyRef.current.clientHeight)
    }
  }, [update.body])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    if (overflowOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [overflowOpen])

  const channelIcon = channel?.avatar_media_id
    ? `/v1/media/${channel.avatar_media_id}/serve`
    : null
  const gradient = channel ? pickColor(channel.name) : avatarColors[0]

  return (
    <div
      className={`bg-white border border-brand-divider rounded-2xl transition-all ${
        isUrgent ? 'border-l-4 border-l-amber-500' : ''
      } ${update.is_pinned ? 'ring-1 ring-brand-divider' : ''}`}
    >
      {/* Pinned indicator */}
      {update.is_pinned && (
        <div className="flex items-center gap-1 text-brand-text/50 text-[10px] font-bold uppercase tracking-widest px-4 pt-3 pb-0">
          <Pin className="w-3 h-3" />
          Pinned
        </div>
      )}

      {/* Urgent badge */}
      {isUrgent && (
        <div className="flex items-center gap-1 text-amber-600 text-[10px] font-bold uppercase tracking-widest px-4 pt-3 pb-0">
          <AlertTriangle className="w-3 h-3" />
          Urgent
        </div>
      )}

      <div className="p-4">
        {/* Header: channel icon + name + time + overflow */}
        <div className="flex items-center gap-2.5 mb-3">
          {channel && (
            <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
              {channelIcon ? (
                <img src={channelIcon} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-[10px]`}>
                  {channel.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {channel && (
              <span className="text-xs font-bold text-brand-text">{channel.name}</span>
            )}
          </div>
          <span className="text-[11px] text-brand-text/40 font-medium flex-shrink-0">
            {timeAgo(update.published_at ?? update.created_at)}
          </span>

          {/* Owner overflow menu */}
          {isOwner && (
            <div className="relative" ref={overflowRef}>
              <button
                onClick={() => setOverflowOpen(!overflowOpen)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-text/40 hover:bg-brand-secondary/50 transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {overflowOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-brand-divider rounded-xl shadow-lg z-50 py-1">
                  <button className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 transition-colors w-full text-left">
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      onPin?.(update.id, !update.is_pinned)
                      setOverflowOpen(false)
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 transition-colors w-full text-left"
                  >
                    <Pin className="w-3.5 h-3.5" />
                    {update.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <div className="border-t border-brand-divider my-1" />
                  <button
                    onClick={() => {
                      onDelete?.(update.id)
                      setOverflowOpen(false)
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text/60 hover:bg-brand-secondary/50 transition-colors w-full text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        {update.title && (
          <h3 className="text-sm font-bold text-brand-text mb-1.5">{update.title}</h3>
        )}

        {/* Body with expandable "Read more" */}
        <p
          ref={bodyRef}
          className={`text-sm text-brand-text/80 leading-relaxed ${expanded ? '' : 'line-clamp-4'}`}
        >
          {update.body}
        </p>
        {isClamped && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs font-semibold text-brand-text mt-1 hover:underline"
          >
            Read more
          </button>
        )}

        {/* Media preview */}
        {update.media_ids.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {update.media_ids.slice(0, 4).map((mediaId) => (
              <div key={mediaId} className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-brand-secondary">
                <img
                  src={`/v1/media/${mediaId}/serve`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {update.media_ids.length > 4 && (
              <div className="w-24 h-24 rounded-xl flex-shrink-0 bg-brand-secondary flex items-center justify-center">
                <span className="text-xs font-bold text-brand-text/60">+{update.media_ids.length - 4}</span>
              </div>
            )}
          </div>
        )}

        {/* Reactions row */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-brand-divider">
          <button className="flex items-center gap-1.5 text-brand-text/50 hover:text-brand-text transition-colors">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px] font-semibold">{formatCount(update.reaction_count)}</span>
          </button>
          <button className="flex items-center gap-1.5 text-brand-text/50 hover:text-brand-text transition-colors">
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px] font-semibold">{formatCount(update.comment_count)}</span>
          </button>
          <button className="flex items-center gap-1.5 text-brand-text/50 hover:text-brand-text transition-colors">
            <Share2 className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">Echo</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default UpdateCard

'use client'

import React from 'react'
import { Eye, Heart, MessageCircle, Pin, Megaphone, Image, Video, Headphones, BarChart3, Calendar, ShoppingBag, AlertTriangle, BookOpen } from 'lucide-react'
import type { ChannelUpdate } from '@/types/channels'

interface ChannelUpdateCardProps {
  update: ChannelUpdate
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}

const typeIcons: Record<string, React.ReactNode> = {
  announcement: <Megaphone className="w-3 h-3" />,
  image: <Image className="w-3 h-3" />,
  video: <Video className="w-3 h-3" />,
  audio: <Headphones className="w-3 h-3" />,
  poll: <BarChart3 className="w-3 h-3" />,
  event: <Calendar className="w-3 h-3" />,
  commerce: <ShoppingBag className="w-3 h-3" />,
  alert: <AlertTriangle className="w-3 h-3" />,
  digest: <BookOpen className="w-3 h-3" />,
}

const ChannelUpdateCard: React.FC<ChannelUpdateCardProps> = ({ update }) => {
  const icon = typeIcons[update.update_type] ?? typeIcons.announcement

  return (
    <div className="bg-brand-card border border-brand-divider rounded-2xl p-4 hover:bg-brand-accent/5 transition-all">
      {/* Pinned indicator */}
      {update.is_pinned && (
        <div className="flex items-center gap-1 text-brand-accent text-[10px] font-bold uppercase tracking-widest mb-2">
          <Pin className="w-3 h-3" />
          Pinned
        </div>
      )}

      {/* Type badge + time */}
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-secondary text-brand-text/60 text-[10px] font-semibold rounded-full capitalize">
          {icon} {update.update_type}
        </span>
        <span className="text-[11px] text-brand-text/40 font-medium">
          {timeAgo(update.published_at ?? update.created_at)}
        </span>
      </div>

      {/* Title */}
      {update.title && (
        <h3 className="text-sm font-bold text-brand-text mb-1">{update.title}</h3>
      )}

      {/* Body */}
      <p className="text-sm text-brand-text/80 leading-relaxed line-clamp-4">{update.body}</p>

      {/* Media preview */}
      {update.media_ids.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {update.media_ids.slice(0, 4).map((mediaId) => (
            <div key={mediaId} className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-brand-secondary">
              <img
                src={`/v1/media/${mediaId}/serve`}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ))}
          {update.media_ids.length > 4 && (
            <div className="w-20 h-20 rounded-xl flex-shrink-0 bg-brand-secondary flex items-center justify-center">
              <span className="text-xs font-bold text-brand-text/60">+{update.media_ids.length - 4}</span>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-brand-divider">
        <div className="flex items-center gap-1 text-brand-text/50">
          <Eye className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">{formatCount(update.view_count)}</span>
        </div>
        <div className="flex items-center gap-1 text-brand-text/50">
          <Heart className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">{formatCount(update.reaction_count)}</span>
        </div>
        <div className="flex items-center gap-1 text-brand-text/50">
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">{formatCount(update.comment_count)}</span>
        </div>
      </div>
    </div>
  )
}

export default ChannelUpdateCard

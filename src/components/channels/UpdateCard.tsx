'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Pin, Megaphone, Image as ImageIcon, Video, Headphones, BarChart3,
  Calendar, ShoppingBag, AlertTriangle, BookOpen,
  MessageCircle, Share2, Repeat2, MoreHorizontal, Trash2, Pencil,
  Heart, Bookmark, Eye, Copy, Flag, BellOff, ExternalLink,
  MapPin, Monitor, Clock, CheckCircle, Users, ChevronLeft, ChevronRight,
  X, Play,
} from 'lucide-react'
import type { ChannelUpdate, BroadcastChannel } from '@/types/channels'

/* ===== Props ===== */
interface UpdateCardProps {
  update: ChannelUpdate
  channel?: BroadcastChannel
  channelId?: string
  isOwner?: boolean
  onDelete?: (updateId: string) => void
  onPin?: (updateId: string, pinned: boolean) => void
  onEdit?: (update: ChannelUpdate) => void
  onLike?: (channelId: string, updateId: string) => void
  onUnlike?: (channelId: string, updateId: string) => void
  onStash?: (channelId: string, updateId: string) => void
  onUnstash?: (channelId: string, updateId: string) => void
  onRepost?: (channelId: string, updateId: string, echoType: string) => void
  onUnrepost?: (channelId: string, updateId: string) => void
  onView?: (channelId: string, updateId: string) => void
}

/* ===== Helpers ===== */
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
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatEventDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const typeIcons: Record<string, { icon: React.ReactNode; label: string; emoji: string }> = {
  announcement: { icon: <Megaphone className="w-3 h-3" />, label: 'Announcement', emoji: '📢' },
  image: { icon: <ImageIcon className="w-3 h-3" />, label: 'Photo', emoji: '📸' },
  video: { icon: <Video className="w-3 h-3" />, label: 'Video', emoji: '🎬' },
  audio: { icon: <Headphones className="w-3 h-3" />, label: 'Audio', emoji: '🎧' },
  poll: { icon: <BarChart3 className="w-3 h-3" />, label: 'Poll', emoji: '📊' },
  event: { icon: <Calendar className="w-3 h-3" />, label: 'Event', emoji: '📅' },
  commerce: { icon: <ShoppingBag className="w-3 h-3" />, label: 'Commerce', emoji: '🛍' },
  alert: { icon: <AlertTriangle className="w-3 h-3" />, label: 'Urgent', emoji: '⚠️' },
  digest: { icon: <BookOpen className="w-3 h-3" />, label: 'Digest', emoji: '📖' },
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

/* ===== Photo Gallery ===== */
function PhotoGallery({ mediaIds }: { mediaIds: string[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const count = mediaIds.length

  const gridClass =
    count === 1 ? 'grid-cols-1' :
    count === 2 ? 'grid-cols-2' :
    count === 3 ? 'grid-cols-2' :
    'grid-cols-2'

  return (
    <>
      <div className={`grid ${gridClass} gap-1.5 mt-3 rounded-xl overflow-hidden`}>
        {mediaIds.slice(0, 4).map((id, i) => (
          <div
            key={id}
            className={`relative cursor-pointer overflow-hidden bg-brand-secondary ${
              count === 1 ? 'h-64' : count === 3 && i === 0 ? 'row-span-2 h-full' : 'h-36'
            }`}
            onClick={() => setLightboxIdx(i)}
          >
            <img src={`/v1/media/${id}/serve`} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
            {i === 3 && count > 4 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-bold text-lg">+{count - 4}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightboxIdx(null)}>
            <X className="w-6 h-6" />
          </button>
          {lightboxIdx > 0 && (
            <button className="absolute left-4 text-white/70 hover:text-white" onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1) }}>
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}
          {lightboxIdx < mediaIds.length - 1 && (
            <button className="absolute right-4 text-white/70 hover:text-white" onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }}>
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
          <img
            src={`/v1/media/${mediaIds[lightboxIdx]}/serve`} alt=""
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          <p className="absolute bottom-4 text-white/50 text-xs">{lightboxIdx + 1} / {mediaIds.length}</p>
        </div>
      )}
    </>
  )
}

/* ===== Video Player ===== */
function VideoPreview({ mediaId }: { mediaId: string }) {
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  return (
    <div className="relative mt-3 rounded-xl overflow-hidden bg-black">
      {!playing ? (
        <div className="relative h-52 cursor-pointer" onClick={() => { setPlaying(true); setTimeout(() => videoRef.current?.play(), 100) }}>
          <img src={`/v1/media/${mediaId}/serve`} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="w-6 h-6 text-brand-text ml-1" />
            </div>
          </div>
        </div>
      ) : (
        <video ref={videoRef} src={`/v1/media/${mediaId}/serve`} controls autoPlay className="w-full max-h-[400px]" />
      )}
    </div>
  )
}

/* ===== Poll Display ===== */
function PollDisplay({ update }: { update: ChannelUpdate }) {
  const [voted, setVoted] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const meta = (update.metadata || {}) as Record<string, unknown>
  const options = (meta.poll_options as string[]) || []
  const totalVotes = update.reaction_count || 0

  const handleVote = (idx: number) => {
    if (voted) return
    setSelectedIdx(idx)
    setVoted(true)
  }

  return (
    <div className="mt-3 space-y-2">
      {options.map((opt, i) => {
        const votes = voted ? Math.floor(Math.random() * 20) : 0
        const pct = voted && totalVotes > 0 ? Math.round((votes / Math.max(totalVotes, 1)) * 100) : 0
        return (
          <button
            key={i} onClick={() => handleVote(i)}
            className={`w-full relative rounded-xl border px-4 py-2.5 text-left text-sm transition-all ${
              voted
                ? selectedIdx === i ? 'border-brand-text/30 bg-brand-text/5' : 'border-brand-divider'
                : 'border-brand-divider hover:border-brand-text/30 cursor-pointer'
            }`}
          >
            {voted && (
              <div className="absolute inset-0 rounded-xl bg-brand-text/5 origin-left transition-all" style={{ width: `${pct}%` }} />
            )}
            <div className="relative flex items-center justify-between">
              <span className="text-brand-text font-medium">{opt}</span>
              {voted && <span className="text-xs font-mono text-brand-text/50">{pct}%</span>}
              {voted && selectedIdx === i && <CheckCircle className="w-4 h-4 text-brand-text ml-2" />}
            </div>
          </button>
        )
      })}
      <p className="text-[11px] text-brand-text/40">
        {voted ? `${totalVotes} total votes` : 'Click to vote'}
        {meta.poll_duration && meta.poll_duration !== 'none' ? ` · Ends in ${String(meta.poll_duration)}` : null}
        {meta.poll_anonymous ? ' · Anonymous' : null}
      </p>
    </div>
  )
}

/* ===== Event Display ===== */
function EventDisplay({ update }: { update: ChannelUpdate }) {
  const [rsvp, setRsvp] = useState<string | null>(null)
  const meta = (update.metadata || {}) as Record<string, unknown>
  const startDate = meta.event_start as string
  const locationType = meta.event_location_type as string
  const address = meta.event_address as string
  const link = meta.event_link as string
  const isPast = startDate && new Date(startDate) < new Date()

  return (
    <div className="mt-3 bg-brand-bg rounded-xl p-4 space-y-3">
      {isPast && (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-text/10 text-brand-text/50">Event ended</span>
      )}
      {startDate && (
        <div className="flex items-center gap-2 text-xs text-brand-text/60">
          <Calendar className="w-3.5 h-3.5" />
          {formatEventDate(startDate)}
        </div>
      )}
      {(address || link) && (
        <div className="flex items-center gap-2 text-xs text-brand-text/60">
          {locationType === 'online' ? <Monitor className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
          {address || (link ? 'Online event' : '')}
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-brand-text underline flex items-center gap-0.5">
              Join <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
      {!isPast && meta.event_rsvp !== false && (
        <div className="flex items-center gap-2 pt-2 border-t border-brand-divider/50">
          {['Going', 'Maybe', 'Not Going'].map(opt => (
            <button
              key={opt} onClick={() => setRsvp(opt)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                rsvp === opt ? 'bg-brand-text text-brand-bg' : 'border border-brand-divider text-brand-text/60 hover:bg-brand-secondary/50'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ===== Urgent Banner ===== */
function UrgentBanner({ update }: { update: ChannelUpdate }) {
  const meta = (update.metadata || {}) as Record<string, unknown>
  const severity = (meta.severity as string) || 'info'
  const actionLabel = meta.action_label as string
  const actionUrl = meta.action_url as string
  const expiry = meta.expiry as string
  const isExpired = expiry && new Date(expiry) < new Date()

  const severityStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    critical: 'bg-red-50 border-red-200 text-red-700',
  }

  return (
    <div className={`mt-3 rounded-xl border p-4 ${severityStyles[severity as keyof typeof severityStyles] || severityStyles.info}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2">
        <AlertTriangle className="w-3 h-3" />
        {severity} alert
        {isExpired && <span className="text-brand-text/40 normal-case ml-2">Expired</span>}
      </div>
      {actionLabel && actionUrl && (
        <a href={actionUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-lg bg-white/80 text-xs font-bold hover:bg-white transition-colors">
          {actionLabel} <ExternalLink className="w-3 h-3" />
        </a>
      )}
      {expiry && !isExpired && (
        <p className="text-[10px] mt-2 opacity-70">
          <Clock className="w-3 h-3 inline mr-1" />
          Expires {new Date(expiry).toLocaleString()}
        </p>
      )}
    </div>
  )
}

/* ===== MAIN CARD ===== */
const UpdateCard: React.FC<UpdateCardProps> = ({ update, channel, channelId: propChannelId, isOwner, onDelete, onPin, onEdit, onLike, onUnlike, onStash, onUnstash, onRepost, onUnrepost, onView }) => {
  const channelId = propChannelId || channel?.id || ''
  const [expanded, setExpanded] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [sparked, setSparked] = useState(false)
  const [stashed, setStashed] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showEchoMenu, setShowEchoMenu] = useState(false)
  const [echoed, setEchoed] = useState(false)
  const [echoCount, setEchoCount] = useState(update.forward_count ?? 0)
  const prevForwardCount = useRef(update.forward_count ?? 0)
  const [sparkCount, setSparkCount] = useState(update.reaction_count)
  const prevReactionCount = useRef(update.reaction_count)
  const overflowRef = useRef<HTMLDivElement>(null)

  // Sync sparkCount when server data changes (e.g. from 15s refetch)
  useEffect(() => {
    if (update.reaction_count !== prevReactionCount.current) {
      setSparkCount(update.reaction_count)
      prevReactionCount.current = update.reaction_count
    }
  }, [update.reaction_count])
  useEffect(() => {
    const fc = update.forward_count ?? 0
    if (fc !== prevForwardCount.current) {
      setEchoCount(fc)
      prevForwardCount.current = fc
    }
  }, [update.forward_count])
  const echoRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLParagraphElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [isClamped, setIsClamped] = useState(false)
  const [viewed, setViewed] = useState(false)

  const isUrgent = update.update_type === 'alert'
  const typeInfo = typeIcons[update.update_type] || typeIcons.announcement

  useEffect(() => {
    if (bodyRef.current) setIsClamped(bodyRef.current.scrollHeight > bodyRef.current.clientHeight)
  }, [update.body])

  // Close menus on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) setOverflowOpen(false)
      if (echoRef.current && !echoRef.current.contains(e.target as Node)) setShowEchoMenu(false)
    }
    if (overflowOpen || showEchoMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [overflowOpen, showEchoMenu])

  // View tracking: count view after 1s in viewport (fire once)
  useEffect(() => {
    if (viewed || !cardRef.current) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !timer) {
        timer = setTimeout(() => {
          setViewed(true)
          onView?.(channelId, update.id)
          obs.disconnect()
        }, 1000)
      } else if (!entry.isIntersecting && timer) {
        clearTimeout(timer)
        timer = null
      }
    }, { threshold: 0.5 })
    obs.observe(cardRef.current)
    return () => {
      if (timer) clearTimeout(timer)
      obs.disconnect()
    }
  }, [viewed]) // eslint-disable-line react-hooks/exhaustive-deps

  const channelIcon = channel?.avatar_media_id ? `/v1/media/${channel.avatar_media_id}/serve` : null
  const gradient = channel ? pickColor(channel.name) : avatarColors[0]

  const handleLike = () => {
    if (sparked) {
      setSparked(false)
      setSparkCount(c => Math.max(0, c - 1))
      onUnlike?.(channelId, update.id)
    } else {
      setSparked(true)
      setSparkCount(c => c + 1)
      onLike?.(channelId, update.id)
    }
  }

  const handleStash = () => {
    if (stashed) {
      setStashed(false)
      onUnstash?.(channelId, update.id)
    } else {
      setStashed(true)
      onStash?.(channelId, update.id)
    }
  }

  const handleRepost = (action: 'feed' | 'copy' | 'external') => {
    setShowEchoMenu(false)
    switch (action) {
      case 'feed':
        if (echoed) {
          setEchoed(false)
          setEchoCount(c => Math.max(0, c - 1))
          onUnrepost?.(channelId, update.id)
        } else {
          setEchoed(true)
          setEchoCount(c => c + 1)
          onRepost?.(channelId, update.id, 'feed')
        }
        break
      case 'copy':
        navigator.clipboard.writeText(`${window.location.origin}/updates/${update.id}`)
        break
      case 'external':
        if (navigator.share) navigator.share({ url: `${window.location.origin}/updates/${update.id}` })
        else navigator.clipboard.writeText(`${window.location.origin}/updates/${update.id}`)
        break
    }
  }

  return (
    <div ref={cardRef} className={`bg-brand-card border border-brand-divider rounded-2xl transition-all ${
      isUrgent ? 'border-l-4 border-l-amber-500' : ''
    } ${update.is_pinned ? 'ring-1 ring-brand-text/10' : ''}`}>

      {/* Pinned / Urgent indicators */}
      {update.is_pinned && (
        <div className="flex items-center gap-1 text-brand-text/50 text-[10px] font-bold uppercase tracking-widest px-4 pt-3 pb-0">
          <Pin className="w-3 h-3" /> Pinned
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          {channel && (
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
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
            <div className="flex items-center gap-1.5">
              {channel && <span className="text-xs font-bold text-brand-text">{channel.name}</span>}
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-brand-text/5 text-brand-text/40">
                {typeInfo.emoji} {typeInfo.label}
              </span>
            </div>
          </div>
          <span className="text-[11px] text-brand-text/40 font-medium shrink-0">
            {timeAgo(update.published_at ?? update.created_at)}
          </span>

          {/* Overflow menu */}
          <div className="relative" ref={overflowRef}>
            <button onClick={() => setOverflowOpen(!overflowOpen)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-text/40 hover:bg-brand-secondary/50 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {overflowOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-brand-card border border-brand-divider rounded-xl shadow-lg z-50 py-1">
                {isOwner && (
                  <>
                    <button onClick={() => { onEdit?.(update); setOverflowOpen(false) }} className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    {onPin && (
                      <button onClick={() => { onPin(update.id, !update.is_pinned); setOverflowOpen(false) }}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                        <Pin className="w-3.5 h-3.5" /> {update.is_pinned ? 'Unpin' : 'Pin to top'}
                      </button>
                    )}
                    <button className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                      <MessageCircle className="w-3.5 h-3.5" /> Disable comments
                    </button>
                    <div className="border-t border-brand-divider my-1" />
                    {onDelete && (
                      <button onClick={() => { onDelete(update.id); setOverflowOpen(false) }}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 w-full text-left">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  </>
                )}
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); setOverflowOpen(false) }}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                  <Copy className="w-3.5 h-3.5" /> Copy link
                </button>
                {!isOwner && (
                  <>
                    <button className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                      <Flag className="w-3.5 h-3.5" /> Report
                    </button>
                    <button className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                      <BellOff className="w-3.5 h-3.5" /> Tune (hide)
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        {update.title && (
          <h3 className="text-[15px] font-bold text-brand-text mb-1.5 leading-snug">{update.title}</h3>
        )}

        {/* Body with expand */}
        {update.body && update.update_type !== 'poll' && (
          <>
            <p ref={bodyRef} className={`text-sm text-brand-text/75 leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}>
              {update.body}
            </p>
            {isClamped && !expanded && (
              <button onClick={() => setExpanded(true)} className="text-xs font-semibold text-brand-text mt-1 hover:underline">
                ...Show more
              </button>
            )}
          </>
        )}

        {/* Type-specific content */}
        {update.update_type === 'image' && (update.media_ids ?? []).length > 0 && (
          <PhotoGallery mediaIds={update.media_ids} />
        )}

        {update.update_type === 'video' && (update.media_ids ?? []).length > 0 && (
          <VideoPreview mediaId={update.media_ids[0]} />
        )}

        {update.update_type === 'poll' && (
          <PollDisplay update={update} />
        )}

        {update.update_type === 'event' && (
          <EventDisplay update={update} />
        )}

        {update.update_type === 'alert' && (
          <UrgentBanner update={update} />
        )}

        {/* Announcement/other media */}
        {update.update_type === 'announcement' && (update.media_ids ?? []).length > 0 && (
          <PhotoGallery mediaIds={update.media_ids} />
        )}

        {/* Engagement bar */}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-brand-divider flex-wrap">
          {/* Like */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors select-none ${
              sparked ? 'text-red-500 bg-red-50' : 'text-brand-text/45 hover:text-red-500 hover:bg-red-50/50'
            }`}>
            <Heart className={`w-3.5 h-3.5 ${sparked ? 'fill-red-500' : ''}`} />
            <span className="font-mono text-[11px] font-semibold">{formatCount(sparkCount)}</span>
          </button>

          {/* Comments toggle */}
          <button onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
              showComments ? 'text-brand-text bg-brand-text/5' : 'text-brand-text/45 hover:text-brand-text hover:bg-brand-secondary/50'
            }`}>
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px] font-semibold">{formatCount(update.comment_count)}</span>
          </button>

          {/* Echo dropdown */}
          {channel?.forward_allowed !== false && (
            <div className="relative" ref={echoRef}>
              <button onClick={() => setShowEchoMenu(!showEchoMenu)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                  echoed ? 'text-green-600 bg-green-50' : 'text-brand-text/45 hover:text-green-600 hover:bg-green-50/50'
                }`}>
                <Repeat2 className="w-3.5 h-3.5" />
                {echoCount > 0 && <span className="font-mono text-[11px] font-semibold">{formatCount(echoCount)}</span>}
              </button>
              {showEchoMenu && (
                <div className="absolute bottom-full mb-1 left-0 w-48 bg-brand-card border border-brand-divider rounded-xl shadow-lg z-50 py-1">
                  <button onClick={() => handleRepost('feed')} className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                    <Repeat2 className="w-3.5 h-3.5" /> {echoed ? 'Undo echo' : 'Echo to feed'}
                  </button>
                  <button onClick={() => handleRepost('copy')} className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                    <Copy className="w-3.5 h-3.5" /> Copy link
                  </button>
                  <button onClick={() => handleRepost('external')} className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                    <ExternalLink className="w-3.5 h-3.5" /> Share externally
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bookmark */}
          <button onClick={handleStash}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
              stashed ? 'text-blue-500 bg-blue-50' : 'text-brand-text/45 hover:text-blue-500 hover:bg-blue-50/50'
            }`}>
            <Bookmark className={`w-3.5 h-3.5 ${stashed ? 'fill-blue-500' : ''}`} />
          </button>

          {/* View count */}
          <span className="ml-auto flex items-center gap-1 text-[11px] text-brand-text/30 font-mono">
            <Eye className="w-3 h-3" />
            {formatCount(update.view_count)}
          </span>
        </div>

        {/* Comment section (lazy loaded) */}
        {showComments && (
          <div className="mt-3 pt-3 border-t border-brand-divider">
            <CommentSectionLazy updateId={update.id} channelId={channelId} isOwner={isOwner} />
          </div>
        )}
      </div>
    </div>
  )
}

/* Lazy comment section — dynamic import to avoid circular deps */
function CommentSectionLazy({ updateId, channelId, isOwner }: { updateId: string; channelId: string; isOwner?: boolean }) {
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null)
  useEffect(() => {
    import('./CommentSection').then(m => setComp(() => m.default)).catch(() => {})
  }, [])
  if (!Comp) return <div className="py-4 text-center text-xs text-brand-text/30">Loading comments...</div>
  return <Comp updateId={updateId} channelId={channelId} isOwner={isOwner} isOpen={true} />
}

export default UpdateCard

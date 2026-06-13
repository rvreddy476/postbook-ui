'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Pin, Megaphone, Heart, MessageCircle, Bookmark, Eye,
  MoreHorizontal, Trash2, Copy, Flag, Star,
  ChevronLeft, ChevronRight, X, Play, Repeat2, ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import type { CommunityPostV2 } from '@/hooks/useCommunityPosts'
import { ROLE_BADGE_CONFIG, isAtLeast } from '@/lib/communityRoles'

interface CommunityPostCardProps {
  post: CommunityPostV2
  communityId: string
  viewerRole?: string
  isAuthor?: boolean
  onSpark?: (postId: string) => void
  onStash?: (postId: string) => void
  onView?: (postId: string) => void
  onDelete?: (postId: string) => void
  onPin?: (postId: string) => void
  onFeature?: (postId: string, featured: boolean) => void
  onToggleComments?: (postId: string) => void
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

const avatarColors = [
  'from-amber-200 to-orange-300', 'from-blue-200 to-cyan-300',
  'from-emerald-200 to-teal-300', 'from-purple-200 to-pink-300',
  'from-rose-200 to-red-300', 'from-indigo-200 to-blue-300',
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
  const gridClass = count === 1 ? 'grid-cols-1' : 'grid-cols-2'

  return (
    <>
      <div className={`grid ${gridClass} gap-1.5 mt-3 rounded-xl overflow-hidden`}>
        {mediaIds.slice(0, 4).map((id, i) => (
          <div key={id} className={`relative cursor-pointer overflow-hidden bg-brand-secondary ${
            count === 1 ? 'h-64' : count === 3 && i === 0 ? 'row-span-2 h-full' : 'h-36'
          }`} onClick={() => setLightboxIdx(i)}>
            <img src={`/v1/media/${id}/serve`} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
            {i === 3 && count > 4 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-bold text-lg">+{count - 4}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightboxIdx(null)}><X className="w-6 h-6" /></button>
          {lightboxIdx > 0 && (
            <button className="absolute left-4 text-white/70 hover:text-white" onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1) }}><ChevronLeft className="w-8 h-8" /></button>
          )}
          {lightboxIdx < mediaIds.length - 1 && (
            <button className="absolute right-4 text-white/70 hover:text-white" onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }}><ChevronRight className="w-8 h-8" /></button>
          )}
          <img src={`/v1/media/${mediaIds[lightboxIdx]}/serve`} alt="" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
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
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg"><Play className="w-6 h-6 text-brand-text ml-1" /></div>
          </div>
        </div>
      ) : (
        <video ref={videoRef} src={`/v1/media/${mediaId}/serve`} controls autoPlay className="w-full max-h-[400px]" />
      )}
    </div>
  )
}

/* ===== MAIN CARD ===== */
const CommunityPostCard: React.FC<CommunityPostCardProps> = ({
  post, communityId, viewerRole, isAuthor,
  onSpark, onStash, onView, onDelete, onPin, onFeature, onToggleComments,
}) => {
  const [expanded, setExpanded] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [sparked, setSparked] = useState(false)
  const [stashed, setStashed] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [sparkCount, setSparkCount] = useState(post.spark_count)
  const prevSparkCount = useRef(post.spark_count)
  const [showEchoMenu, setShowEchoMenu] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)
  const echoRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [isClamped, setIsClamped] = useState(false)
  const [viewed, setViewed] = useState(false)

  const authorName = (post as any).author_name ?? 'Member'
  const authorAvatar = (post as any).author_avatar_url as string | undefined
  const authorRole = (post as any).author_role as string | undefined
  const authorInitial = authorName[0]?.toUpperCase() ?? '?'
  const gradient = pickColor(post.author_id)
  const isMod = isAtLeast(viewerRole, 'moderator')
  const isAdmin = isAtLeast(viewerRole, 'admin')

  useEffect(() => {
    if (post.spark_count !== prevSparkCount.current) {
      setSparkCount(post.spark_count)
      prevSparkCount.current = post.spark_count
    }
  }, [post.spark_count])

  useEffect(() => {
    if (bodyRef.current) setIsClamped(bodyRef.current.scrollHeight > bodyRef.current.clientHeight)
  }, [post.body])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) setOverflowOpen(false)
      if (echoRef.current && !echoRef.current.contains(e.target as Node)) setShowEchoMenu(false)
    }
    if (overflowOpen || showEchoMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [overflowOpen, showEchoMenu])

  // View tracking
  useEffect(() => {
    if (viewed || !cardRef.current) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !timer) {
        timer = setTimeout(() => { setViewed(true); onView?.(post.id); obs.disconnect() }, 1000)
      } else if (!entry.isIntersecting && timer) { clearTimeout(timer); timer = null }
    }, { threshold: 0.5 })
    obs.observe(cardRef.current)
    return () => { if (timer) clearTimeout(timer); obs.disconnect() }
  }, [viewed]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSpark = () => {
    if (sparked) { setSparked(false); setSparkCount(c => Math.max(0, c - 1)) }
    else { setSparked(true); setSparkCount(c => c + 1) }
    onSpark?.(post.id)
  }

  const handleStash = () => { setStashed(!stashed); onStash?.(post.id) }

  const handleEcho = (action: 'feed' | 'copy' | 'external') => {
    setShowEchoMenu(false)
    if (action === 'copy') { navigator.clipboard.writeText(`${window.location.origin}/communities/${communityId}`); return }
    if (action === 'external') {
      if (navigator.share) navigator.share({ url: `${window.location.origin}/communities/${communityId}` })
      else navigator.clipboard.writeText(`${window.location.origin}/communities/${communityId}`)
    }
  }

  const mediaIds = (post.attachments ?? []).filter((a): a is string => typeof a === 'string' && a.length > 0)
  const contentType = post.content_type || 'text'
  const roleBadge = authorRole && ROLE_BADGE_CONFIG[authorRole]

  return (
    <div ref={cardRef} className={`bg-brand-card border border-brand-divider rounded-2xl transition-all ${post.is_pinned ? 'ring-1 ring-brand-text/10' : ''}`}>
      {/* Pinned */}
      {post.is_pinned && (
        <div className="flex items-center gap-1 text-brand-text/50 text-[10px] font-bold uppercase tracking-widest px-4 pt-3 pb-0">
          <Pin className="w-3 h-3" /> Pinned
        </div>
      )}

      <div className="p-4">
        {/* Announcement badge */}
        {post.is_announcement && (
          <div className="flex items-center gap-1 text-amber-600 text-[10px] font-bold uppercase tracking-wider mb-2">
            <Megaphone className="w-3 h-3" /> Announcement
          </div>
        )}

        {/* Featured badge */}
        {post.is_featured && (
          <div className="flex items-center gap-1 text-violet-600 text-[10px] font-bold uppercase tracking-wider mb-2">
            <Star className="w-3 h-3" /> Featured
          </div>
        )}

        {/* Q&A Accepted badge */}
        {post.content_type === 'qa_question' && post.is_answered && (
          <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold uppercase tracking-wider mb-2">
            <CheckCircle2 className="w-3 h-3" /> Accepted Answer
          </div>
        )}

        {/* Author header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
            {authorAvatar ? (
              <img src={authorAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-sm font-bold text-white`}>
                {authorInitial}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-bold text-brand-text">{authorName}</span>
            {roleBadge && (
              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full uppercase ${roleBadge.color}`}>
                {roleBadge.label}
              </span>
            )}
            <span className="text-[11px] text-brand-text/40 font-medium">{timeAgo(post.created_at)}</span>
          </div>

          {/* Space name chip */}
          {(post as any).space_name && (
            <span className="text-[10px] font-semibold text-brand-text/40 bg-brand-bg px-2 py-0.5 rounded-full">
              {(post as any).space_name}
            </span>
          )}

          {/* Overflow menu */}
          <div className="relative" ref={overflowRef}>
            <button onClick={() => setOverflowOpen(!overflowOpen)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-text/40 hover:bg-brand-secondary/50 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {overflowOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-brand-card border border-brand-divider rounded-xl shadow-lg z-50 py-1">
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/communities/${communityId}`); setOverflowOpen(false) }}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                  <Copy className="w-3.5 h-3.5" /> Copy link
                </button>
                {isMod && onPin && (
                  <button onClick={() => { onPin(post.id); setOverflowOpen(false) }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                    <Pin className="w-3.5 h-3.5" /> {post.is_pinned ? 'Unpin' : 'Pin to top'}
                  </button>
                )}
                {isAdmin && onFeature && (
                  <button onClick={() => { onFeature(post.id, !post.is_featured); setOverflowOpen(false) }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                    <Star className="w-3.5 h-3.5" /> {post.is_featured ? 'Unfeature' : 'Feature'}
                  </button>
                )}
                {(isMod || isAuthor) && onDelete && (
                  <>
                    <div className="border-t border-brand-divider my-1" />
                    <button onClick={() => { onDelete(post.id); setOverflowOpen(false) }}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 w-full text-left">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </>
                )}
                {!isAuthor && !isMod && (
                  <button className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                    <Flag className="w-3.5 h-3.5" /> Report
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title (Q&A posts) */}
        {post.title && (
          <h3 className="text-[15px] font-bold text-brand-text mb-1.5 leading-snug">{post.title}</h3>
        )}

        {/* Body */}
        {post.body && (
          <>
            <div
              ref={bodyRef}
              className={`text-sm text-brand-text/80 leading-relaxed overflow-hidden break-words ${expanded ? '' : 'line-clamp-4'} [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-divider [&_blockquote]:pl-4 [&_code]:bg-brand-text/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_pre]:bg-brand-text/5 [&_pre]:p-3 [&_pre]:rounded-xl [&_a]:text-blue-500 [&_a]:underline`}
              dangerouslySetInnerHTML={{ __html: post.body }}
            />
            {isClamped && !expanded && (
              <button onClick={() => setExpanded(true)} className="text-xs font-semibold text-brand-text mt-1 hover:underline">
                ...Show more
              </button>
            )}
          </>
        )}

        {/* Media */}
        {contentType !== 'video' && mediaIds.length > 0 && <PhotoGallery mediaIds={mediaIds} />}
        {contentType === 'video' && mediaIds.length > 0 && <VideoPreview mediaId={mediaIds[0]} />}

        {/* Pending approval */}
        {post.status === 'pending_approval' && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <span className="text-xs font-semibold text-amber-700">Pending approval</span>
          </div>
        )}

        {/* Engagement bar */}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-brand-divider flex-wrap">
          {/* Spark */}
          <button onClick={handleSpark}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors select-none ${
              sparked ? 'text-red-500 bg-red-50' : 'text-brand-text/45 hover:text-red-500 hover:bg-red-50/50'
            }`}>
            <Heart className={`w-3.5 h-3.5 ${sparked ? 'fill-red-500' : ''}`} />
            <span className="font-mono text-[11px] font-semibold">{formatCount(sparkCount)}</span>
          </button>

          {/* Comments */}
          <button onClick={() => { setShowComments(!showComments); onToggleComments?.(post.id) }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
              showComments ? 'text-brand-text bg-brand-text/5' : 'text-brand-text/45 hover:text-brand-text hover:bg-brand-secondary/50'
            }`}>
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px] font-semibold">{formatCount(post.comment_count)}</span>
          </button>

          {/* Echo */}
          <div className="relative" ref={echoRef}>
            <button onClick={() => setShowEchoMenu(!showEchoMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors text-brand-text/45 hover:text-green-600 hover:bg-green-50/50">
              <Repeat2 className="w-3.5 h-3.5" />
              {post.echo_count > 0 && <span className="font-mono text-[11px] font-semibold">{formatCount(post.echo_count)}</span>}
            </button>
            {showEchoMenu && (
              <div className="absolute bottom-full mb-1 left-0 w-48 bg-brand-card border border-brand-divider rounded-xl shadow-lg z-50 py-1">
                <button onClick={() => handleEcho('copy')} className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                  <Copy className="w-3.5 h-3.5" /> Copy link
                </button>
                <button onClick={() => handleEcho('external')} className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                  <ExternalLink className="w-3.5 h-3.5" /> Share externally
                </button>
              </div>
            )}
          </div>

          {/* Stash */}
          <button onClick={handleStash}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
              stashed ? 'text-blue-500 bg-blue-50' : 'text-brand-text/45 hover:text-blue-500 hover:bg-blue-50/50'
            }`}>
            <Bookmark className={`w-3.5 h-3.5 ${stashed ? 'fill-blue-500' : ''}`} />
          </button>

          {/* View count */}
          <span className="ml-auto flex items-center gap-1 text-[11px] text-brand-text/30 font-mono">
            <Eye className="w-3 h-3" /> {formatCount(post.view_count)}
          </span>
        </div>

        {/* Inline comments section */}
        {showComments && (
          <div className="mt-3 pt-3 border-t border-brand-divider">
            <CommunityCommentSectionLazy postId={post.id} communityId={communityId} spaceId={post.space_id} viewerRole={viewerRole} />
          </div>
        )}
      </div>
    </div>
  )
}

function CommunityCommentSectionLazy({ postId, communityId, spaceId, viewerRole }: { postId: string; communityId: string; spaceId: string; viewerRole?: string }) {
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null)
  useEffect(() => {
    import('./CommunityPostCommentSection').then(m => setComp(() => m.default)).catch(() => {})
  }, [])
  if (!Comp) return <div className="py-4 text-center text-xs text-brand-text/30">Loading comments...</div>
  return <Comp postId={postId} communityId={communityId} spaceId={spaceId} viewerRole={viewerRole} />
}

export default CommunityPostCard

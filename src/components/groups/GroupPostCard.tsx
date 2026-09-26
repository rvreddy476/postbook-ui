'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Pin, Megaphone, MessageCircle, Bookmark, Eye,
  MoreHorizontal, Trash2, Copy, Flag,
  ChevronLeft, ChevronRight, X, Play, Repeat2, ExternalLink, UserRound,
} from 'lucide-react'
import type { GroupPostV2 } from '@/types/groups'
import { viewerEngaged } from './patchGroupFeed'
import GroupPostMeta from './GroupPostMeta'
import GroupReactionControl, { GroupReactionSummary } from './GroupReactionControl'
import './group-post-card.css'
import { useAuthUser } from '@/store/auth'
import { canRevealGroupAuthor } from './anonymousIdentity'
import { useAuthorReveal } from './useAuthorReveal'

/* ===== Props ===== */
interface GroupPostCardProps {
  post: GroupPostV2
  groupId: string
  isAdmin?: boolean
  viewerRole?: string
  isAuthor?: boolean
  onStash?: (groupId: string, postId: string) => void
  onUnstash?: (groupId: string, postId: string) => void
  onView?: (groupId: string, postId: string) => void
  onDelete?: (postId: string) => void
  onRepost?: (groupId: string, postId: string, echoType: string) => void
  onUnrepost?: (groupId: string, postId: string) => void
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
  'from-amber-200 to-orange-300',
  'from-blue-200 to-cyan-300',
  'from-emerald-200 to-teal-300',
  'from-purple-200 to-pink-300',
  'from-rose-200 to-red-300',
  'from-indigo-200 to-blue-300',
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

      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
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

/* ===== MAIN CARD ===== */
const GroupPostCard: React.FC<GroupPostCardProps> = ({
  post, groupId, isAdmin, isAuthor, viewerRole,
  onStash, onUnstash, onView, onDelete, onRepost, onUnrepost,
}) => {
  const [expanded, setExpanded] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showEchoMenu, setShowEchoMenu] = useState(false)
  const echoRef = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [isClamped, setIsClamped] = useState(false)
  const [viewed, setViewed] = useState(false)

  const anonymous = post.is_anonymous === true
  const viewer = useAuthUser()
  const mayReveal = canRevealGroupAuthor(anonymous, viewerRole)
  const reveal = useAuthorReveal(groupId, post.id, viewer?.id, mayReveal)
  const authorName = anonymous ? 'Anonymous member' : post.author_name || 'Member'
  const authorInitial = authorName[0]?.toUpperCase() ?? '?'
  const gradient = pickColor(post.author_id)

  /*
    Engagement state is read from the post, never mirrored into component
    state. The feed carries the viewer's own flags, so a reaction survives a
    reload and is right in a second tab; the optimistic flip is written into
    the cached feed page by patchGroupFeed, which is what the caller's
    handlers do. Local `useState(false)` here is what used to make your own
    spark vanish the moment the feed refetched.

    viewerEngaged reads `=== true`, never `?? true`: Go marshals an unreacted
    post as `false` and omits the field entirely for an anonymous viewer, and
    both have to read as false.
  */
  const echoed = viewerEngaged(post, 'echo')
  const stashed = viewerEngaged(post, 'stash')
  const echoCount = post.echo_count

  // Detect body clamping
  useEffect(() => {
    if (bodyRef.current) setIsClamped(bodyRef.current.scrollHeight > bodyRef.current.clientHeight)
  }, [post.body])

  // Close overflow / echo menu on outside click
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
          onView?.(groupId, post.id)
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

  const handleStash = () => {
    if (stashed) onUnstash?.(groupId, post.id)
    else onStash?.(groupId, post.id)
  }

  /*
    There is no per-post route yet — /groups/{g}/posts/{p} 404s — so a shared
    link points at the group. Handing out a URL that does not resolve is worse
    than handing out a coarser one that does.
  */
  const shareUrl = () => `${window.location.origin}/groups/${groupId}`

  const handleRepost = (action: 'feed' | 'copy' | 'external') => {
    setShowEchoMenu(false)
    switch (action) {
      case 'feed':
        if (echoed) onUnrepost?.(groupId, post.id)
        else onRepost?.(groupId, post.id, 'feed')
        break
      case 'copy':
        navigator.clipboard.writeText(shareUrl())
        break
      case 'external':
        if (navigator.share) navigator.share({ url: shareUrl() })
        else navigator.clipboard.writeText(shareUrl())
        break
    }
  }

  const mediaIds = (post.attachments ?? []).filter((a): a is string => typeof a === 'string' && a.length > 0)
  const contentType = post.content_type || 'text'

  return (
    <div ref={cardRef} className={`bg-brand-card border border-brand-divider rounded-2xl transition-all ${
      post.is_pinned ? 'ring-1 ring-brand-text/10' : ''
    }`}>
      {/* Pinned indicator */}
      {post.is_pinned && (
        <div className="flex items-center gap-1 text-brand-text/50 text-[10px] font-bold tracking-widest px-4 pt-3 pb-0">
          <Pin className="w-3 h-3" /> Pinned
        </div>
      )}

      <div className="p-4">
        {/* Announcement badge */}
        {post.is_announcement && (
          <div className="flex items-center gap-1 text-warning text-[10px] font-bold tracking-wider mb-2">
            <Megaphone className="w-3 h-3" /> Announcement
          </div>
        )}

        {/* Author header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
            {anonymous ? (
              <div className="group-post-anonymous-avatar"><UserRound size={20} aria-hidden="true" /></div>
            ) : post.author_avatar_url ? (
              <img src={post.author_avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-linear-to-br ${gradient} flex items-center justify-center text-sm font-bold text-white`}>
                {authorInitial}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-brand-text">{authorName}</span>
            <span className="text-[11px] text-brand-text/40 font-medium ml-2">{timeAgo(post.created_at)}</span>
          </div>

          {/* Overflow menu */}
          <div className="relative" ref={overflowRef}>
            <button onClick={() => setOverflowOpen(!overflowOpen)}
              aria-label="Post options" aria-expanded={overflowOpen}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-text/40 hover:bg-brand-secondary/50 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {overflowOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 max-w-[80vw] bg-brand-card border border-brand-divider rounded-xl shadow-lg z-50 py-1">
                {mayReveal && viewer?.id && (
                  <button type="button" disabled={reveal.busy} onClick={() => { setOverflowOpen(false); void reveal.reveal() }}
                    className="flex items-start gap-2 px-3 py-3 text-xs text-brand-text hover:bg-brand-secondary w-full text-left disabled:opacity-50">
                    <Eye className="w-4 h-4 shrink-0" />
                    <span><span className="block font-semibold">Reveal author</span><span className="block mt-1 text-brand-highlight">Only admins can see this. Every reveal is recorded.</span></span>
                  </button>
                )}
                {/*
                  No pin control. The server route writes post-service's
                  `posts` table while this feed reads `group_posts.is_pinned`,
                  so pinning returns 200 and changes nothing visible. A menu
                  item that looks operable and silently does nothing is worse
                  than no menu item; it comes back once the route is fixed.
                */}
                {(isAdmin || isAuthor) && onDelete && (
                  <>
                    <div className="border-t border-brand-divider my-1" />
                    <button onClick={() => { onDelete(post.id); setOverflowOpen(false) }}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-danger/10 w-full text-left">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </>
                )}
                <button onClick={() => { navigator.clipboard.writeText(shareUrl()); setOverflowOpen(false) }}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                  <Copy className="w-3.5 h-3.5" /> Copy link
                </button>
                {!isAdmin && !isAuthor && (
                  <button className="flex items-center gap-2 px-3 py-2 text-xs text-brand-text hover:bg-brand-secondary/50 w-full text-left">
                    <Flag className="w-3.5 h-3.5" /> Report
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {mayReveal && (reveal.busy || reveal.error || reveal.profile) && (
          <div className="my-3 rounded-xl border border-brand-divider bg-brand-secondary p-3 text-sm" aria-live="polite">
            {reveal.busy ? <p>Revealing author…</p> : reveal.error ? <p role="alert">{reveal.error}</p> : reveal.profile ? (
              <div className="flex items-center gap-3">
                {reveal.profile.avatar ? <img src={reveal.profile.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <UserRound className="h-9 w-9 rounded-full bg-brand-card p-2" />}
                <div className="min-w-0 flex-1"><p className="text-xs text-brand-highlight">Revealed to you · recorded</p><p className="font-semibold break-words">{reveal.profile.name}</p></div>
                <button type="button" onClick={reveal.hide} aria-label="Hide revealed author" className="p-2"><X size={16}/></button>
              </div>
            ) : null}
          </div>
        )}

        {/* Title */}
        {post.title && (
          <h3 className="text-[15px] font-bold text-brand-text mb-1.5 leading-snug">{post.title}</h3>
        )}

        {/* Body with expand */}
        {post.body && (
          <>
            {/*
              Text, not HTML.

              This was dangerouslySetInnerHTML={{ __html: post.body }}, and
              group-service has no sanitizer anywhere — no bluemonday, no
              escaping on the write path — so whatever a member typed was
              stored raw and injected into every other member's page. One
              <img src=x onerror=…> in a group post ran for the whole group.

              It was not even rendering the rich-text field: body_html is a
              separate column the create path never populates. body is plain
              text, so rendering it as text loses nothing and closes it.
              The prose child selectors went with it — they only styled
              injected HTML, and leaving them would imply this still renders
              markup.
            */}
            <div
              ref={bodyRef}
              className={`text-sm text-brand-text/80 leading-relaxed overflow-hidden wrap-break-word whitespace-pre-wrap ${expanded ? '' : 'line-clamp-4'}`}
            >
              {post.body}
            </div>
            {isClamped && !expanded && (
              <button onClick={() => setExpanded(true)} className="text-xs font-semibold text-brand-text mt-1 hover:underline">
                ...Show more
              </button>
            )}
          </>
        )}

        {/*
          Place, mood, activity and tags, read back off type_payload.
          The composer collected these and the hook dropped them on submit,
          under a success toast; rendering them here is what makes the fix
          visible rather than merely present. Renders null when a post
          carries none, so every existing post is unaffected.
        */}
        <GroupPostMeta post={post} />

        {/* Media: photos (content_type "post" is the default for text+photo posts) */}
        {contentType !== 'video' && mediaIds.length > 0 && (
          <PhotoGallery mediaIds={mediaIds} />
        )}

        {/* Media: video */}
        {contentType === 'video' && mediaIds.length > 0 && (
          <VideoPreview mediaId={mediaIds[0]} />
        )}

        {/* Pending approval banner */}
        {post.status === 'pending_approval' && isAdmin && (
          <div className="mt-3 bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-warning">Pending approval</span>
          </div>
        )}

        <GroupReactionSummary post={post} />
        {/* Engagement bar */}
        <div className="group-post-actions mt-3 pt-3 border-t border-brand-divider">
          <GroupReactionControl post={post} groupId={groupId} />

          {/* Comments toggle */}
          <button onClick={() => setShowComments(!showComments)}
            aria-label="Comments" aria-expanded={showComments}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
              showComments ? 'text-brand-text bg-brand-text/5' : 'text-brand-text/45 hover:text-brand-text hover:bg-brand-secondary/50'
            }`}>
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px] font-semibold">{formatCount(post.comment_count)}</span>
          </button>

          {/* Echo dropdown */}
          <div className="relative" ref={echoRef}>
            <button onClick={() => setShowEchoMenu(!showEchoMenu)}
              aria-label="Share post" aria-expanded={showEchoMenu}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                echoed ? 'text-success bg-success/10' : 'text-brand-text/45 hover:text-success hover:bg-success/10'
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

          {/* Bookmark/Stash */}
          <button onClick={handleStash}
            aria-label={stashed ? 'Remove from saved posts' : 'Save post'} aria-pressed={stashed}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
              stashed ? 'text-primary-ink bg-primary-tint' : 'text-brand-text/45 hover:text-primary-ink hover:bg-primary-tint/60'
            }`}>
            <Bookmark className={`w-3.5 h-3.5 ${stashed ? 'fill-current' : ''}`} />
          </button>

          {/* View count */}
          <span aria-label={`${post.view_count} views`} className="flex items-center gap-1 text-[11px] text-brand-text/50 font-mono">
            <Eye className="w-3 h-3" />
            {formatCount(post.view_count)}
          </span>
        </div>

        {/* Comment section (lazy loaded) */}
        {showComments && (
          <div className="mt-3 pt-3 border-t border-brand-divider">
            <GroupCommentSectionLazy key={`${viewer?.id}:${post.id}`} postId={post.id} groupId={groupId} isAdmin={isAdmin} anonymousAuthorAlias={anonymous ? post.author_id : undefined} />
          </div>
        )}
      </div>
    </div>
  )
}

/* Lazy comment section */
function GroupCommentSectionLazy({ postId, groupId, isAdmin, anonymousAuthorAlias }: { postId: string; groupId: string; isAdmin?: boolean; anonymousAuthorAlias?: string }) {
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null)
  useEffect(() => {
    import('./GroupPostCommentSection').then(m => setComp(() => m.default)).catch(() => {})
  }, [])
  if (!Comp) return <div className="py-4 text-center text-xs text-brand-text/30">Loading comments...</div>
  return <Comp postId={postId} groupId={groupId} isAdmin={isAdmin} anonymousAuthorAlias={anonymousAuthorAlias} />
}

export default GroupPostCard

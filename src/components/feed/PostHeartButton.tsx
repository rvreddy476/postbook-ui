'use client'
import { useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import type { PostDetail } from '@/types/profile'
import { useFeedReaction } from '@/hooks/useFeedReaction'
import { compactCount, countWord } from '@/components/feed/cardSummary'
import { heartRequest, heartView, postActionErrorText } from '@/components/feed/postHeart'

/*
  The heart on a post (founder, 24 Oct 2026): tap to like, tap again to
  unlike, with the like count. No reaction picker on posts; comments keep
  theirs. "pillar" is the round button on a reel's action column, "row" the
  card's Like button (its count sits on the card's summary line).
*/
export interface PostHeartButtonProps {
  post: Pick<PostDetail, 'id' | 'viewer_reaction' | 'counts'>
  variant?: 'row' | 'pillar'
  className?: string
}

export default function PostHeartButton({ post, variant = 'row', className = '' }: PostHeartButtonProps) {
  const mutation = useFeedReaction(post.id)
  const [pending, setPending] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const saving = useRef(false)
  const view = heartView(post.viewer_reaction, post.counts?.likes, pending)
  const busy = mutation.busy || pending !== null

  const toggle = async () => {
    if (busy || saving.current) return
    saving.current = true
    const was = heartView(post.viewer_reaction, post.counts?.likes).liked
    setError(null)
    setPending(!was)
    try {
      await mutation.mutateAsync(heartRequest(was))
    } catch (err) {
      const code = (err as { response?: { data?: { error?: { code?: unknown } } } })?.response?.data?.error?.code
      setError(postActionErrorText(code) ?? 'Could not save your like. Please try again.')
    } finally {
      saving.current = false
      setPending(null)
    }
  }

  const label = view.liked ? 'Unlike' : 'Like'
  const heart = <Heart className={`${variant === 'pillar' ? 'w-5 h-5' : 'w-[18px] h-[18px]'} ${view.liked ? 'fill-current text-danger' : ''}`} aria-hidden="true" />

  return (
    <div className={`relative ${className}`}>
      {variant === 'pillar' ? (
        <button type="button" onClick={toggle} disabled={busy} aria-pressed={view.liked} aria-busy={pending !== null}
          aria-label={`${label} · ${countWord(view.count, 'like', 'likes')}`}
          className="flex flex-col items-center gap-1 text-brand-text disabled:cursor-pointer">
          <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-lg bg-brand-card/90 backdrop-blur-xs hover:bg-brand-card border border-brand-divider shadow-black/5 transition-all">{heart}</span>
          <span className="text-xs font-bold tabular-nums text-brand-text/80 drop-shadow-md">{compactCount(view.count)}</span>
        </button>
      ) : (
        <button type="button" onClick={toggle} disabled={busy} aria-pressed={view.liked} aria-busy={pending !== null}
          aria-label={label}
          className={`flex w-full min-w-0 min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition-colors duration-200 hover:bg-brand-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-pointer ${view.liked ? 'text-danger' : 'text-brand-text/65'}`}>
          {heart}
          <span>{view.liked ? 'Liked' : 'Like'}</span>
        </button>
      )}
      {error && (
        <p role="alert" className={`absolute z-40 ${variant === 'pillar' ? 'right-full top-0 mr-2' : 'left-0 top-full mt-1'} w-max max-w-64 rounded-lg border border-brand-divider bg-brand-card px-3 py-2 text-xs text-brand-text shadow-lg`}>
          {error}
        </p>
      )}
    </div>
  )
}

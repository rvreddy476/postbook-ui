'use client'

/*
  The chat's shared posts as a vertical swipe list (CONTRACT §1.4, §9),
  opened over the messenger from a shared reel or the settings tab. It
  walks the server's shared list (newest first, paged forward with its
  cursor) when that list holds the tapped post, else the ids the thread
  passed in. Posts are read as the viewer through POST /v1/posts/batch, so
  anything the viewer may not see is "This post isn't available" and
  nothing more. Reels play in the reels player (only the current one);
  other posts show the chat's post card with its permalink.
*/

import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type TouchEvent, type WheelEvent } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, ExternalLink, Loader2, Volume2, VolumeX, X } from 'lucide-react'

import { ReelVideo, type ReelVideoHandle } from '@/features/reels/components/ReelVideo'
import { fetchPostsBatch } from '@/features/reels/data/reelFeedApi'
import { usePlayerPrefs } from '@/features/reels/hooks/usePlayerPrefs'
import { indexBatch, type PostBatchData } from '@/features/reels/liked'
import { toReelItem, type FeedReelPost } from '@/features/reels/model'
import { fetchSharedPosts } from '@/services/chatParityApi'

import { PostMessageCard } from '../PostMessageCard'
import { POST_UNAVAILABLE_TEXT, postCardView } from '../postCards'
import {
  appendIds,
  canStep,
  idsToHydrate,
  initialViewerList,
  shouldLoadMore,
  startIndexOf,
  stepIndex,
  swipeStep,
  viewerEntry,
  wheelStep,
  type ViewerList,
} from './sharedViewer'

export interface SharedReelsViewerProps {
  conversationId: string
  startPostId: string
  postIds?: string[]
  onClose(): void
}

const NO_DOUBLE_TAP = () => undefined

export default function SharedReelsViewer({ conversationId, startPostId, postIds, onClose }: SharedReelsViewerProps): JSX.Element {
  const { prefs, update: updatePrefs } = usePlayerPrefs()
  const playerRef = useRef<ReelVideoHandle>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  /* ── the list ──────────────────────────────────────────── */
  const [list, setList] = useState<ViewerList | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [index, setIndex] = useState(0)
  const givenRef = useRef(postIds)
  givenRef.current = postIds

  useEffect(() => {
    let live = true
    setList(null)
    fetchSharedPosts(conversationId)
      .catch(() => null)
      .then((page) => {
        if (!live) return
        const next = initialViewerList(page ? page.items.map((i) => i.postId) : null, givenRef.current, startPostId)
        setList(next)
        setCursor(next.pageable ? page?.nextCursor ?? null : null)
        setIndex(startIndexOf(next.ids, startPostId))
      })
    return () => { live = false }
  }, [conversationId, startPostId])

  const ids = useMemo(() => list?.ids ?? [], [list])
  const length = ids.length

  const pageable = list?.pageable ?? false
  const loadingMoreRef = useRef(false)
  useEffect(() => {
    if (!shouldLoadMore(index, length, { pageable, cursor, loading: loadingMoreRef.current })) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    fetchSharedPosts(conversationId, cursor)
      .then((page) => {
        if (page) setList((l) => (l ? { ...l, ids: appendIds(l.ids, page.items.map((i) => i.postId)) } : l))
        setCursor(page?.nextCursor ?? null)
      })
      // A failed page ends the list here rather than retrying in a loop.
      .catch(() => setCursor(null))
      .finally(() => {
        loadingMoreRef.current = false
        setLoadingMore(false)
      })
  }, [conversationId, cursor, index, length, pageable])

  /* ── hydration (POST /v1/posts/batch, as the viewer) ───── */
  const [rows, setRows] = useState<Map<string, FeedReelPost>>(() => new Map())
  const [asked, setAsked] = useState<Set<string>>(() => new Set())
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  const inflightRef = useRef<Set<string>>(new Set())
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    if (length === 0) return
    const done = new Set<string>([...asked, ...inflightRef.current, ...failed])
    const need = idsToHydrate(ids, index, done)
    if (need.length === 0) return
    for (const id of need) inflightRef.current.add(id)
    fetchPostsBatch(need)
      .then((batch) => {
        const found = indexBatch(batch as PostBatchData)
        setRows((m) => {
          const next = new Map(m)
          for (const [id, row] of found) next.set(id, row)
          return next
        })
        setAsked((s) => new Set([...s, ...need]))
      })
      .catch(() => setFailed((s) => new Set([...s, ...need])))
      .finally(() => { for (const id of need) inflightRef.current.delete(id) })
    // asked/failed are read through `done`; re-running on them would only find nothing new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, index, length, retryTick])

  const retry = (id: string) => {
    setFailed((s) => {
      const next = new Set(s)
      next.delete(id)
      return next
    })
    setRetryTick((t) => t + 1)
  }

  /* ── navigation ────────────────────────────────────────── */
  const go = useCallback((delta: number) => setIndex((i) => stepIndex(i, delta, length)), [length])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        go(-1)
      } else if (e.key === ' ' && !(e.target instanceof HTMLElement && e.target.closest('button, a'))) {
        e.preventDefault()
        playerRef.current?.togglePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  const wheelAcc = useRef(0)
  const touchStart = useRef<number | null>(null)
  const onWheel = (e: WheelEvent) => {
    const r = wheelStep(wheelAcc.current, e.deltaY)
    wheelAcc.current = r.acc
    if (r.step) go(r.step)
  }
  const onTouchStart = (e: TouchEvent) => {
    const t = e.target
    touchStart.current = t instanceof HTMLElement && t.closest('button, a, [role="slider"]') ? null : e.touches[0]?.clientY ?? null
  }
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (start === null) return
    const step = swipeStep((e.changedTouches[0]?.clientY ?? start) - start)
    if (step) go(step)
  }

  const onEnded = useCallback(() => {
    if (prefs.onEnd === 'next') go(1)
  }, [go, prefs.onEnd])

  /* ── the current slot ──────────────────────────────────── */
  const currentId = ids[index] ?? null
  const entry = currentId ? viewerEntry(currentId, rows, asked, failed) : null
  const reel = entry?.kind === 'row' ? toReelItem(entry.row) : null

  let body: JSX.Element
  if (!list || !entry || entry.kind === 'loading') {
    body = <Loader2 className="h-6 w-6 animate-spin opacity-70" aria-label="Loading" />
  } else if (entry.kind === 'error') {
    body = (
      <div className="text-center text-[13px]">
        <p className="opacity-80">Couldn't load this post.</p>
        <button type="button" onClick={() => currentId && retry(currentId)} className="mt-2 rounded-full border border-current px-3 py-1 text-[12px] font-semibold">
          Try again
        </button>
      </div>
    )
  } else if (entry.kind === 'unavailable') {
    body = <p className="px-6 text-center text-[13px] opacity-80">{POST_UNAVAILABLE_TEXT}</p>
  } else if (reel) {
    body = (
      <div className="relative h-full w-full">
        <ReelVideo
          key={reel.id}
          ref={playerRef}
          reel={reel}
          active
          position={index}
          prefs={prefs}
          onPrefsChange={updatePrefs}
          onEnded={onEnded}
          onDoubleTap={NO_DOUBLE_TAP}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgb(var(--reel-stage)/0.75)] to-transparent px-3 pb-8 pt-10">
          <p className="truncate text-[13px] font-semibold">{reel.authorName || (reel.authorUsername ? `@${reel.authorUsername}` : '')}</p>
          {reel.caption || reel.title ? <p className="mt-0.5 line-clamp-2 text-[12px] opacity-90">{reel.title || reel.caption}</p> : null}
          <Link
            href={`/post/${encodeURIComponent(reel.id)}`}
            className="pointer-events-auto mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold underline-offset-2 hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Open post
          </Link>
        </div>
      </div>
    )
  } else {
    body = <PostMessageCard view={postCardView(entry.row.id, { status: 'success', posts: rows })} />
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shared posts"
      className="fixed inset-0 z-[1100] flex items-center justify-center overscroll-contain bg-[rgb(var(--reel-stage))] text-[rgb(var(--reel-on-stage))]"
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-between">
        <button
          type="button"
          onClick={() => updatePrefs({ sound: !prefs.sound })}
          aria-label={prefs.sound ? 'Mute' : 'Turn sound on'}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--reel-on-stage)/0.12)] transition-colors hover:bg-[rgb(var(--reel-on-stage)/0.22)]"
        >
          {prefs.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        {length > 1 ? (
          <span className="text-[12px] tabular-nums opacity-70" aria-live="polite">
            {index + 1} / {length}
            {cursor || loadingMore ? '+' : ''}
          </span>
        ) : null}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--reel-on-stage)/0.12)] transition-colors hover:bg-[rgb(var(--reel-on-stage)/0.22)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex aspect-[9/16] h-[calc(100dvh-72px)] max-w-[calc(100vw-80px)] items-center justify-center overflow-hidden rounded-xl">
        {body}
      </div>

      <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={!canStep(index, -1, length)}
          aria-label="Previous post"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--reel-on-stage)/0.12)] transition-colors hover:bg-[rgb(var(--reel-on-stage)/0.22)] disabled:opacity-30"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={!canStep(index, 1, length)}
          aria-label="Next post"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--reel-on-stage)/0.12)] transition-colors hover:bg-[rgb(var(--reel-on-stage)/0.22)] disabled:opacity-30"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

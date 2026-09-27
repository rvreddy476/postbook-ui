'use client'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Heart, Plus } from 'lucide-react'
import type { CommentItem } from '@/types/profile'
import { QUICK_REACTIONS, reactionLabel, reactionTotal, topReactions } from './reactionMath'
import EmojiPickerPopover from './EmojiPickerPopover'
import './comments.css'

export interface CommentReactionsProps {
  item: Pick<CommentItem, 'viewer_reaction' | 'reactions' | 'reaction_count' | 'like_count'>
  /** null removes the viewer's reaction. The promise settles when the server has answered. */
  onChange: (emoji: string | null) => Promise<unknown> | void
  disabled?: boolean
}

const HOLD_MS = 400
const LEAVE_MS = 200
const DEFAULT_EMOJI = '❤️'

/**
 * Per-comment emoji reactions. At rest: the viewer's emoji (or an outline
 * heart), the total, and the top three emoji as stacked chips. Hover or a
 * 400 ms press opens a bar with six quick reactions and a "+" that opens the
 * full picker. Presentation only: counts come from the cached CommentItem.
 */
export default function CommentReactions({ item, onChange, disabled = false }: CommentReactionsProps) {
  const current = item.viewer_reaction ?? null
  const total = reactionTotal(item)
  const top = topReactions(item.reactions, 3)
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const busy = disabled || pending
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const start = useRef({ x: 0, y: 0 })
  const saving = useRef(false)
  const id = useId()

  const clearHold = () => { if (hold.current) clearTimeout(hold.current); hold.current = null }
  const clearLeave = () => { if (leave.current) clearTimeout(leave.current); leave.current = null }
  useEffect(() => () => { clearHold(); clearLeave() }, [])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  const choose = useCallback(async (emoji: string | null) => {
    if (busy || saving.current) return
    saving.current = true
    setOpen(false)
    setPickerOpen(false)
    setPending(true)
    try { await onChange(emoji) } catch { /* the caller rolls back and reports */ }
    finally { saving.current = false; setPending(false) }
  }, [busy, onChange])

  const openBar = (focusFirst: boolean) => {
    clearLeave()
    setOpen(true)
    if (focusFirst) requestAnimationFrame(() => bar.current?.querySelector<HTMLButtonElement>('button')?.focus())
  }
  const closeBar = (refocus = false) => { setOpen(false); if (refocus) trigger.current?.focus() }

  const label = current ? `Remove your ${reactionLabel(current)} reaction` : 'React to this comment'
  const summary = top.length ? `Top reactions: ${top.map(entry => `${reactionLabel(entry.emoji)} ${entry.count}`).join(', ')}` : undefined

  return (
    <div ref={root} className="comment-reactions"
      onPointerEnter={event => { if (event.pointerType === 'mouse' && !busy) { clearLeave(); setOpen(true) } }}
      onPointerLeave={event => { clearHold(); if (event.pointerType === 'mouse') leave.current = setTimeout(() => setOpen(false), LEAVE_MS) }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false) }}
      onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); closeBar(true) } }}>
      <button ref={trigger} type="button" className="comment-reactions-trigger" disabled={busy}
        aria-pressed={!!current} aria-busy={pending} aria-haspopup="true" aria-expanded={open} aria-controls={id}
        aria-label={label} title={current ? `${reactionLabel(current)} · click to remove` : 'React · hold or hover for more'}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openBar(true) }
          else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openBar(true) }
        }}
        onPointerDown={event => {
          held.current = false
          if (event.pointerType === 'mouse') return
          start.current = { x: event.clientX, y: event.clientY }
          clearHold()
          hold.current = setTimeout(() => { held.current = true; openBar(false) }, HOLD_MS)
        }}
        onPointerMove={event => { if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 10) clearHold() }}
        onPointerUp={clearHold} onPointerCancel={() => { clearHold(); held.current = true }}
        onContextMenu={event => event.preventDefault()}
        onClick={event => {
          if (held.current) { held.current = false; return }
          if (event.detail === 0) return // keyboard activation is handled in onKeyDown
          void choose(current ? null : DEFAULT_EMOJI)
        }}>
        {current
          ? <span className="comment-reaction-emoji" aria-hidden="true">{current}</span>
          : <Heart size={14} aria-hidden="true" />}
        <span className="comment-reaction-count" aria-label={`${total} reactions`}>{total}</span>
        {top.length > 0 && (
          <span className="comment-reaction-chips" aria-label={summary} title={summary}>
            {top.map(entry => <span key={entry.emoji} aria-hidden="true">{entry.emoji}</span>)}
          </span>
        )}
      </button>

      {open && (
        <div id={id} ref={bar} className="comment-reaction-bar" role="toolbar" aria-label="Choose a reaction"
          onKeyDown={event => {
            const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
            const next = event.key === 'ArrowRight' ? (index + 1) % buttons.length
              : event.key === 'ArrowLeft' ? (index + buttons.length - 1) % buttons.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1
            if (next >= 0) { event.preventDefault(); buttons[next]?.focus() }
          }}>
          {QUICK_REACTIONS.map(option => (
            <button key={option.emoji} type="button" disabled={busy} aria-label={option.label} aria-pressed={current === option.emoji} title={option.label}
              onClick={() => { void choose(current === option.emoji ? null : option.emoji); trigger.current?.focus() }}>
              <span aria-hidden="true">{option.emoji}</span>
            </button>
          ))}
          <button type="button" className="comment-reaction-more" disabled={busy} aria-label="More emoji" title="More emoji"
            onClick={() => { setOpen(false); setPickerOpen(true) }}>
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {pickerOpen && (
        <EmojiPickerPopover anchorRef={trigger} perLine={8}
          onSelect={native => { void choose(current === native ? null : native); trigger.current?.focus() }}
          onClose={() => setPickerOpen(false)} />
      )}
    </div>
  )
}

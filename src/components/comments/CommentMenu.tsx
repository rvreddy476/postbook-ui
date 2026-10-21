'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Flag, Heart, MoreVertical, Pencil, Pin, PinOff, Trash2, type LucideIcon } from 'lucide-react'

export type CommentMenuAction = 'pin' | 'unpin' | 'heart' | 'unheart' | 'edit' | 'delete' | 'report'

export interface CommentMenuItem {
  action: CommentMenuAction
  label: string
  danger?: boolean
}

export interface CommentMenuContext {
  /** The viewer wrote this comment. */
  isOwn: boolean
  /** The viewer wrote the post the comment sits on. */
  isPostAuthor: boolean
  isReply: boolean
  /** Inside the 15-minute edit window. */
  canEdit: boolean
  pinned: boolean
  hearted: boolean
  /** The surface passed the creator tools (heart and pin requests). */
  creatorTools: boolean
  /** Signed in at all; a signed-out viewer gets no menu. */
  signedIn: boolean
  /** An optimistic row the server has not acknowledged yet. */
  pending?: boolean
}

/**
 * The rows of a comment's ⋮ menu, in order:
 *  - Pin / Unpin: the post's author, top-level comments (the server refuses
 *    to pin a reply), when the surface carries the creator tools.
 *  - Love / Remove love: the post's author on someone else's comment.
 *  - Edit: own comment inside the edit window.
 *  - Delete: own comment only — the server answers NOT_COMMENT_AUTHOR to
 *    anyone else, the post's author included.
 *  - Report: anyone signed in, on a comment that is not their own.
 */
export function commentMenuItems(ctx: CommentMenuContext): CommentMenuItem[] {
  if (!ctx.signedIn || ctx.pending) return []
  const items: CommentMenuItem[] = []
  const creator = ctx.creatorTools && ctx.isPostAuthor
  if (creator && !ctx.isReply) items.push(ctx.pinned ? { action: 'unpin', label: 'Unpin comment' } : { action: 'pin', label: 'Pin comment' })
  if (creator && !ctx.isOwn) items.push(ctx.hearted ? { action: 'unheart', label: 'Remove love' } : { action: 'heart', label: 'Love this comment' })
  if (ctx.isOwn && ctx.canEdit) items.push({ action: 'edit', label: 'Edit' })
  if (ctx.isOwn) items.push({ action: 'delete', label: 'Delete', danger: true })
  if (!ctx.isOwn) items.push({ action: 'report', label: 'Report', danger: true })
  return items
}

const ICONS: Record<CommentMenuAction, LucideIcon> = {
  pin: Pin, unpin: PinOff, heart: Heart, unheart: Heart, edit: Pencil, delete: Trash2, report: Flag,
}

interface CommentMenuProps {
  items: CommentMenuItem[]
  onSelect: (action: CommentMenuAction) => void
  disabled?: boolean
  /** "comment" or "reply", for the trigger's label. */
  noun?: string
}

/**
 * The ⋮ button and its menu. Keyboard: Enter, Space or ArrowDown opens on the
 * first row, ArrowUp on the last; arrows, Home and End move; Escape closes and
 * returns focus to the button; Tab closes. An outside press closes it.
 */
export default function CommentMenu({ items, onSelect, disabled, noun = 'comment' }: CommentMenuProps) {
  const [open, setOpen] = useState(false)
  const [upward, setUpward] = useState(false)
  const [initial, setInitial] = useState<'first' | 'last'>('first')
  const wrap = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const rows = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    const target = initial === 'last' ? rows?.[rows.length - 1] : rows?.[0]
    target?.focus({ preventScroll: true })
    const onDown = (event: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open, initial])

  if (items.length === 0) return null

  const show = (from: 'first' | 'last') => {
    const rect = trigger.current?.getBoundingClientRect()
    const list = trigger.current?.closest('[data-comments-list]')?.getBoundingClientRect()
    const floor = Math.min(window.innerHeight, list?.bottom ?? window.innerHeight)
    setUpward(!!rect && rect.bottom + 48 * items.length + 16 > floor)
    setInitial(from)
    setOpen(true)
  }

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (open) return
    if (event.key === 'ArrowDown') { event.preventDefault(); show('first') }
    else if (event.key === 'ArrowUp') { event.preventDefault(); show('last') }
  }

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const rows = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    const index = rows.indexOf(document.activeElement as HTMLButtonElement)
    let next: number
    if (event.key === 'ArrowDown') next = (index + 1) % rows.length
    else if (event.key === 'ArrowUp') next = (index - 1 + rows.length) % rows.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = rows.length - 1
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return }
    else if (event.key === 'Tab') { setOpen(false); return }
    else return
    event.preventDefault()
    rows[next]?.focus()
  }

  return (
    <div ref={wrap} className="relative ml-auto" data-comment-menu>
      <button ref={trigger} type="button" disabled={disabled}
        aria-label={`More actions for this ${noun}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : show('first'))} onKeyDown={onTriggerKey}
        className="flex h-6 w-6 items-center justify-center rounded-full text-brand-text/60 transition hover:bg-brand-secondary hover:text-brand-text focus-visible:outline-2 focus-visible:outline-brand-accent disabled:opacity-40">
        <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div ref={menu} id={menuId} role="menu" aria-label={`${noun[0].toUpperCase()}${noun.slice(1)} actions`} onKeyDown={onMenuKey}
          className={`absolute right-0 z-30 min-w-[176px] overflow-hidden rounded-xl border border-brand-divider bg-brand-card py-1 shadow-lg ${upward ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {items.map(item => {
            const Icon = ICONS[item.action]
            return (
              <button key={item.action} type="button" role="menuitem" tabIndex={-1} data-comment-menu-item={item.action}
                onClick={() => { close(true); onSelect(item.action) }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition hover:bg-brand-secondary focus:bg-brand-secondary focus:outline-hidden ${item.danger ? 'text-danger' : 'text-brand-text'}`}>
                <Icon className={`h-3.5 w-3.5 ${item.action === 'unheart' ? 'fill-current' : ''}`} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

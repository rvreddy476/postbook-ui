'use client'

import { useEffect, useRef, useState } from 'react'
import { Archive, ArchiveRestore, BellOff, CheckCheck, MoreHorizontal, Pin, PinOff, Bell, Trash2 } from 'lucide-react'

import type { InboxRow } from '@/lib/chat/contract'
import { rowName, rowPreview, shortAgo, showOnlineDot, streakBadge, unreadPillText } from '@/lib/chat/inbox'
import { InboxAvatar } from './InboxAvatar'

export type RowAction = 'pin' | 'mute' | 'archive' | 'delete' | 'read'

/*
  One conversation in Messages: photo avatar with an online dot, name,
  preview (with "Seen" on my own last message), time, unread pill, mute and
  pin glyphs, streak. Hover shows a ⋯ button; right-click opens the same menu:
  Pin, Mute, Archive, Delete chat, Mark read.
*/
export function InboxRowItem({
  row,
  myId,
  active,
  sentRequestWaiting,
  archived,
  onOpen,
  onAction,
}: {
  row: InboxRow
  myId: string
  active: boolean
  sentRequestWaiting?: boolean
  /** Shown in the Archived list: the menu offers Unarchive. */
  archived?: boolean
  onOpen: (row: InboxRow) => void
  onAction: (row: InboxRow, action: RowAction) => void
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const name = rowName(row, myId)
  const preview = rowPreview(row, myId, { sentRequestWaiting })
  const pill = unreadPillText(row.unreadCount)
  const streak = streakBadge(row.streak)
  const avatar = row.isGroup ? row.avatarUrl : row.peer?.avatarUrl ?? null

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', key)
    }
  }, [menu])

  const openMenuAt = (x: number, y: number) => {
    const w = 200
    const h = 232
    setMenu({ x: Math.min(x, window.innerWidth - w - 8), y: Math.min(y, window.innerHeight - h - 8) })
  }

  const items: { action: RowAction; label: string; icon: typeof Pin; danger?: boolean; hidden?: boolean }[] = [
    { action: 'pin', label: row.isPinned ? 'Unpin' : 'Pin', icon: row.isPinned ? PinOff : Pin },
    { action: 'mute', label: row.isMuted ? 'Unmute' : 'Mute', icon: row.isMuted ? Bell : BellOff },
    { action: 'read', label: 'Mark as read', icon: CheckCheck, hidden: row.unreadCount === 0 },
    { action: 'archive', label: archived ? 'Unarchive' : 'Archive', icon: archived ? ArchiveRestore : Archive },
    { action: 'delete', label: 'Delete chat', icon: Trash2, danger: true },
  ]

  return (
    <div className="group/row relative">
      <button
        type="button"
        onClick={() => onOpen(row)}
        onContextMenu={(e) => {
          e.preventDefault()
          openMenuAt(e.clientX, e.clientY)
        }}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
          active ? 'bg-primary-ink/5' : 'hover:bg-brand-secondary'
        }`}
      >
        <InboxAvatar name={name} src={avatar} size={48} online={!row.isGroup && showOnlineDot(row.peer)} group={row.isGroup} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={`truncate text-[14px] ${pill ? 'font-bold' : 'font-semibold'} text-brand-text`}>{name}</span>
            {row.isMuted && <BellOff className="h-3.5 w-3.5 shrink-0 text-brand-text/40" aria-label="Muted" />}
            {row.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 rotate-45 text-brand-text/40" aria-label="Pinned" />}
            {streak && (
              <span
                title={streak.title}
                className={`shrink-0 text-[12px] font-semibold tabular-nums ${streak.atRisk ? 'text-warning' : 'text-brand-text/70'}`}
              >
                {streak.text}
              </span>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[12px] leading-tight">
            <span className={`truncate ${pill ? 'font-semibold text-brand-text' : 'text-brand-text/60'}`}>{preview.text}</span>
            {preview.status && <span className="shrink-0 text-brand-text/50">· {preview.status}</span>}
            {row.lastMessageAt && <span className="shrink-0 text-brand-text/40">· {shortAgo(row.lastMessageAt)}</span>}
          </span>
        </span>
        {pill && (
          <span
            className={`flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
              row.isMuted ? 'bg-brand-text/20 text-brand-text' : 'bg-primary-ink text-white'
            }`}
            aria-label={`${pill} unread`}
          >
            {pill}
          </span>
        )}
      </button>
      <button
        type="button"
        aria-label={`More for ${name}`}
        onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          openMenuAt(r.left - 160, r.bottom + 4)
        }}
        className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-brand-card text-brand-text/60 shadow-xs hover:text-brand-text group-hover/row:flex focus-visible:flex"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-1200 w-[200px] overflow-hidden rounded-xl border border-brand-divider bg-brand-card py-1 shadow-xl"
          style={{ left: menu.x, top: menu.y }}
        >
          {items.filter((i) => !i.hidden).map((i) => (
            <button
              key={i.action}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null)
                onAction(row, i.action)
              }}
              className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-brand-secondary ${
                i.danger ? 'text-danger' : 'text-brand-text'
              }`}
            >
              <i.icon className="h-4 w-4" strokeWidth={1.75} />
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

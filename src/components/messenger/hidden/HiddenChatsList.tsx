'use client'

import { Eye, Lock, Loader2 } from 'lucide-react'

import type { InboxRow } from '@/lib/chat/contract'
import { InboxRowItem } from '../inbox/InboxRowItem'

/*
  The hidden list, shown in place of the normal one after a correct secret
  key: a lock icon in the header and ordinary rows. Lock drops the tokens.
*/
export function HiddenChatsList({ rows, myId, activeId, onOpen, onLock }: {
  rows: InboxRow[] | null
  myId: string
  activeId: string | null
  onOpen: (row: InboxRow) => void
  onLock: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-3 pb-2 pt-1">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-text">
          <Lock className="h-3.5 w-3.5 text-brand-text/60" strokeWidth={2} aria-hidden />
          Hidden chats
        </h2>
        <button type="button" onClick={onLock} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-primary-ink hover:bg-brand-secondary">
          <Lock className="h-3.5 w-3.5" strokeWidth={2} />
          Lock
        </button>
      </div>
      {rows === null ? (
        <div className="flex justify-center py-10 text-brand-text/40"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="px-3 py-10 text-center text-[13px] text-brand-text/60">No hidden chats. Hide a chat from its menu to keep it here.</p>
      ) : (
        <div className="space-y-0.5">
          {rows.map((row) => (
            <InboxRowItem key={row.id} row={row} myId={myId} hidden active={activeId === row.id} onOpen={onOpen} onAction={() => undefined} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Over an opened hidden chat: it is hidden, Unhide puts it back, Lock closes everything. */
export function HiddenChatBanner({ busy, onUnhide, onLock }: { busy: boolean; onUnhide: () => void; onLock: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-brand-divider bg-brand-card px-4 py-2">
      <Lock className="h-3.5 w-3.5 shrink-0 text-brand-text/60" strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-brand-text/70">Hidden chat</span>
      <button type="button" onClick={onUnhide} disabled={busy} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-primary-ink hover:bg-brand-secondary disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" strokeWidth={2} />}
        Unhide
      </button>
      <button type="button" onClick={onLock} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-brand-text/70 hover:bg-brand-secondary hover:text-brand-text">
        <Lock className="h-3.5 w-3.5" strokeWidth={2} />
        Lock
      </button>
    </div>
  )
}

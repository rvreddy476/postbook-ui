'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { chatSearch } from '@/services/chatParityApi'
import { searchUsers } from '@/services/userService'
import { CHAT_SEARCH_MIN_CHARS, type ChatPeer, type ChatSearchResult, type InboxRow } from '@/lib/chat/contract'
import { filterRows, rowName, shortAgo, showOnlineDot } from '@/lib/chat/inbox'
import { InboxAvatar } from './InboxAvatar'

/*
  Search in Messages: People · Chats · Messages from GET /v1/chat/search
  (CONTRACT §6). Until that route exists the box still works: chats are
  filtered on the client and people come from the people search.
*/

export function InboxSearch({
  query,
  rows,
  myId,
  onOpenPerson,
  onOpenRow,
}: {
  query: string
  rows: InboxRow[]
  myId: string
  onOpenPerson: (p: ChatPeer) => void
  onOpenRow: (row: InboxRow, messageId?: string) => void
}) {
  const q = query.trim()
  const [result, setResult] = useState<ChatSearchResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (q.length < CHAT_SEARCH_MIN_CHARS) {
      setResult(null)
      return
    }
    let cancelled = false
    setLoading(true)
    const t = window.setTimeout(async () => {
      let res: ChatSearchResult | null = null
      try {
        res = await chatSearch(q, myId)
      } catch {
        res = null
      }
      if (!res) {
        const people = await searchUsers(q, 8)
        res = {
          people: people
            .filter((u) => u.id && u.id !== myId)
            .map((u) => ({ userId: u.id, displayName: u.name, username: u.username ?? null, avatarUrl: u.avatar || null, isOnline: u.isOnline ?? null, lastActiveAt: null })),
          conversations: filterRows(rows, q, myId),
          messages: [],
        }
      }
      if (!cancelled) {
        setResult(res)
        setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [q, myId, rows])

  if (q.length < CHAT_SEARCH_MIN_CHARS) {
    const local = filterRows(rows, q, myId)
    return <Section title="Chats">{local.map((r) => <ChatHit key={r.id} row={r} myId={myId} onOpen={() => onOpenRow(r)} />)}</Section>
  }
  if (loading && !result) {
    return (
      <div className="flex justify-center py-10 text-brand-text/40">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }
  if (!result) return null
  const empty = result.people.length === 0 && result.conversations.length === 0 && result.messages.length === 0
  if (empty) return <p className="px-4 py-10 text-center text-[13px] text-brand-text/60">Nothing matches &ldquo;{q}&rdquo;.</p>

  const rowById = new Map(rows.map((r) => [r.id, r]))
  return (
    <div className="space-y-3">
      {result.people.length > 0 && (
        <Section title="People">
          {result.people.map((p) => (
            <button key={p.userId} type="button" onClick={() => onOpenPerson(p)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-brand-secondary">
              <InboxAvatar name={p.displayName} src={p.avatarUrl} size={40} online={showOnlineDot(p)} />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-brand-text">{p.displayName}</span>
                {p.username && <span className="block truncate text-[12px] text-brand-text/50">@{p.username}</span>}
              </span>
            </button>
          ))}
        </Section>
      )}
      {result.conversations.length > 0 && (
        <Section title="Chats">
          {result.conversations.map((r) => <ChatHit key={r.id} row={rowById.get(r.id) ?? r} myId={myId} onOpen={() => onOpenRow(rowById.get(r.id) ?? r)} />)}
        </Section>
      )}
      {result.messages.length > 0 && (
        <Section title="Messages">
          {result.messages.map((m) => {
            const row = rowById.get(m.conversationId)
            const name = row ? rowName(row, myId) : 'Chat'
            return (
              <button
                key={`${m.conversationId}:${m.messageId}`}
                type="button"
                disabled={!row}
                onClick={() => row && onOpenRow(row, m.messageId)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-brand-secondary disabled:opacity-60"
              >
                <InboxAvatar name={name} src={row ? (row.isGroup ? row.avatarUrl : row.peer?.avatarUrl) : null} size={40} group={row?.isGroup} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-semibold text-brand-text">{name}</span>
                    <span className="shrink-0 text-[11px] text-brand-text/40">{shortAgo(m.at)}</span>
                  </span>
                  <span className="block truncate text-[12px] text-brand-text/60">{m.snippet}</span>
                </span>
              </button>
            )
          })}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-text/50">{title}</h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  )
}

function ChatHit({ row, myId, onOpen }: { row: InboxRow; myId: string; onOpen: () => void }) {
  const name = rowName(row, myId)
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-brand-secondary">
      <InboxAvatar name={name} src={row.isGroup ? row.avatarUrl : row.peer?.avatarUrl} size={40} online={!row.isGroup && showOnlineDot(row.peer)} group={row.isGroup} />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold text-brand-text">{name}</span>
        {row.peer?.username && <span className="block truncate text-[12px] text-brand-text/50">@{row.peer.username}</span>}
      </span>
    </button>
  )
}

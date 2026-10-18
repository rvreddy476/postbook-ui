'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Send, Trash2, X } from 'lucide-react'

import { deleteMyNote, fetchNotes, putMyNote } from '@/services/chatParityApi'
import { getOrCreateDirectConversation, sendMessage } from '@/services/messageService'
import { conversationIdOf } from '../sendPost'
import { NOTE_MAX_GRAPHEMES, graphemeCount, type ChatNote, type NoteAudience, type OtherNote } from '@/lib/chat/contract'
import { InboxAvatar } from './InboxAvatar'

/*
  Notes (CONTRACT §5): a 24-hour line of text above the inbox. My own note
  first ("Your note"), then the notes of people I chat with or follow. The
  whole row is hidden when GET /v1/chat/notes is not on the server yet.
*/

export const NOTE_AUDIENCE_LABELS: Record<NoteAudience, string> = {
  everyone: 'Everyone who can message you',
  friends: 'Friends',
  only_me: 'Only me',
}

export const NOTES_KEY = ['chat-notes'] as const

export function NotesRow({
  myName,
  myAvatar,
  onOpenPerson,
}: {
  myName: string
  myAvatar: string | null
  onOpenPerson: (user: { id: string; name: string; avatar: string }) => void
}) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: NOTES_KEY, queryFn: fetchNotes, staleTime: 60_000, retry: false })
  const [editing, setEditing] = useState(false)
  const [replying, setReplying] = useState<OtherNote | null>(null)

  if (isLoading || data === null || data === undefined) return null
  const mine = data.mine

  return (
    <div className="px-2 pb-1">
      <div className="flex gap-3 overflow-x-auto px-1 pb-2 pt-6 scrollbar-hide" role="list" aria-label="Notes">
        <NoteBubbleTile
          label="Your note"
          name={myName}
          avatar={myAvatar}
          text={mine?.text ?? null}
          placeholder="Add a note"
          onClick={() => setEditing(true)}
          own
        />
        {data.others.map((o) => (
          <NoteBubbleTile
            key={o.note.id}
            label={o.user.displayName.split(' ')[0]}
            name={o.user.displayName}
            avatar={o.user.avatarUrl}
            online={o.user.isOnline === true}
            text={o.note.text}
            onClick={() => setReplying(o)}
          />
        ))}
      </div>

      {editing && (
        <NoteEditor
          current={mine}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            void qc.invalidateQueries({ queryKey: NOTES_KEY })
          }}
        />
      )}
      {replying && (
        <NoteReply
          note={replying}
          onClose={() => setReplying(null)}
          onOpenChat={() => {
            onOpenPerson({ id: replying.user.userId, name: replying.user.displayName, avatar: replying.user.avatarUrl ?? '' })
            setReplying(null)
          }}
        />
      )}
    </div>
  )
}

function NoteBubbleTile({
  label,
  name,
  avatar,
  text,
  placeholder,
  online,
  own,
  onClick,
}: {
  label: string
  name: string
  avatar: string | null
  text: string | null
  placeholder?: string
  online?: boolean
  own?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" role="listitem" onClick={onClick} className="relative flex w-[68px] shrink-0 flex-col items-center gap-1 text-center">
      <span
        className={`absolute -top-5 left-1/2 z-10 max-w-[84px] -translate-x-1/2 truncate rounded-2xl border border-brand-divider bg-brand-card px-2 py-1 text-[11px] leading-tight shadow-xs ${
          text ? 'text-brand-text' : 'text-brand-text/50'
        }`}
      >
        {text ?? placeholder}
      </span>
      <span className="relative">
        <InboxAvatar name={name} src={avatar} size={56} online={online} />
        {own && !text && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-brand-bg bg-primary-ink text-white">
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </span>
        )}
      </span>
      <span className="w-full truncate text-[11px] text-brand-text/60">{label}</span>
    </button>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-1100 flex items-end justify-center bg-brand-text/30 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-2xl border border-brand-divider bg-brand-card p-4 shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-brand-text">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-brand-text/50 hover:bg-brand-secondary hover:text-brand-text">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function NoteEditor({ current, onClose, onSaved }: { current: ChatNote | null; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState(current?.text ?? '')
  const [audience, setAudience] = useState<NoteAudience>(current?.audience ?? 'everyone')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => { ref.current?.focus() }, [])
  const count = graphemeCount(text.trim())
  const tooLong = count > NOTE_MAX_GRAPHEMES

  const save = async () => {
    if (!text.trim() || tooLong || busy) return
    setBusy(true)
    setError(null)
    try {
      await putMyNote(text.trim(), audience)
      onSaved()
    } catch (err) {
      setError((err as Error)?.message || "Couldn't share your note.")
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    setBusy(true)
    try {
      await deleteMyNote()
      onSaved()
    } catch {
      setError("Couldn't delete your note.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Your note" onClose={onClose}>
      <p className="mb-2 text-[12px] text-brand-text/60">Write a short note. It disappears after 24 hours.</p>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="What's on your mind?"
        className="w-full resize-none rounded-xl bg-brand-secondary px-3 py-2 text-[14px] text-brand-text outline-hidden placeholder:text-brand-text/40"
      />
      <div className={`mt-1 text-right text-[11px] tabular-nums ${tooLong ? 'text-danger' : 'text-brand-text/40'}`}>
        {count}/{NOTE_MAX_GRAPHEMES}
      </div>
      <label className="mt-2 block text-[12px] font-semibold text-brand-text/70" htmlFor="note-audience">Who can see it</label>
      <select
        id="note-audience"
        value={audience}
        onChange={(e) => setAudience(e.target.value as NoteAudience)}
        className="mt-1 w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 py-2 text-[13px] text-brand-text"
      >
        {(Object.keys(NOTE_AUDIENCE_LABELS) as NoteAudience[]).map((a) => (
          <option key={a} value={a}>{NOTE_AUDIENCE_LABELS[a]}</option>
        ))}
      </select>
      {error && <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p>}
      <div className="mt-4 flex items-center justify-between gap-2">
        {current ? (
          <button type="button" onClick={remove} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-danger hover:bg-danger/10 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Delete note
          </button>
        ) : <span />}
        <button
          type="button"
          onClick={save}
          disabled={!text.trim() || tooLong || busy}
          className="flex items-center gap-1.5 rounded-lg bg-primary-ink px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Share
        </button>
      </div>
    </Sheet>
  )
}

/** Reply to someone's note: the message carries reply_note_id (CONTRACT §2.1). */
function NoteReply({ note, onClose, onOpenChat }: { note: OtherNote; onClose: () => void; onOpenChat: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const send = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const conversationId = conversationIdOf(await getOrCreateDirectConversation(note.user.userId))
      if (!conversationId) throw new Error('no conversation')
      await sendMessage(conversationId, text.trim(), undefined, { reply_note_id: note.note.id })
      onOpenChat()
    } catch {
      setError(`Couldn't send to ${note.user.displayName.split(' ')[0]}.`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet title={note.user.displayName} onClose={onClose}>
      <div className="mb-3 rounded-2xl bg-brand-secondary px-3 py-2 text-[14px] text-brand-text">{note.note.text}</div>
      <form onSubmit={(e) => { e.preventDefault(); void send() }} className="flex items-center gap-2 rounded-full bg-brand-secondary pl-4 pr-1.5">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply to their note"
          className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-brand-text outline-hidden placeholder:text-brand-text/40"
        />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Send reply" className={`flex h-8 w-8 items-center justify-center rounded-full ${text.trim() ? 'bg-send text-white' : 'text-brand-text/30'}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p>}
      <button type="button" onClick={onOpenChat} className="mt-3 text-[12px] font-semibold text-primary-ink hover:underline">Open chat</button>
    </Sheet>
  )
}

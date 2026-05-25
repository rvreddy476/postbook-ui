'use client'

// LiveChatOverlay — viewer + broadcaster shared chat panel for the
// live-v2 stream page. Replays the last 50 messages on mount, then
// auto-tails via the ws-gateway subscribe_live_stream pub/sub
// subscription (wired by useLiveChatList).
//
// Designed for a side-rail layout on the broadcaster studio and a
// bottom-stack layout on the viewer page; the consumer chooses
// width + height via className.

import { useEffect, useRef, useState } from 'react'
import { useLiveChatList, useSendLiveChat } from '@/hooks/useLiveV2'
import { useBatchProfiles } from '@/hooks/useProfile'

interface Props {
  streamId: string
  className?: string
}

const MAX_SEND_CHARS = 500
const SEND_THROTTLE_MS = 1500

export default function LiveChatOverlay({ streamId, className = '' }: Props) {
  const { data: messages, isLoading } = useLiveChatList(streamId)
  const send = useSendLiveChat(streamId)
  const [draft, setDraft] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const lastSentAt = useRef<number>(0)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom when new messages arrive — chat-style.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages?.length])

  // Hydrate the unique user_ids referenced in the chat with display
  // names + avatars. Bounded to the visible set so the call stays cheap.
  const userIDs = Array.from(new Set((messages ?? []).map((m) => m.user_id)))
  const { data: profiles } = useBatchProfiles(userIDs)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    const now = Date.now()
    if (now - lastSentAt.current < SEND_THROTTLE_MS) {
      setErrorMsg('Slow down a moment.')
      return
    }
    lastSentAt.current = now
    setErrorMsg(null)
    try {
      await send.mutateAsync({ text })
      setDraft('')
    } catch (err) {
      const ax = err as { response?: { status?: number; data?: { error?: { message?: string } } } }
      if (ax.response?.status === 429) {
        setErrorMsg("You're sending too quickly. Wait a minute.")
        return
      }
      setErrorMsg(ax.response?.data?.error?.message ?? 'Send failed.')
    }
  }

  return (
    <div className={`flex flex-col rounded-2xl border bg-white ${className}`}>
      <div className="px-3 py-2 border-b text-sm font-medium">Live chat</div>
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 text-sm"
      >
        {isLoading && <p className="text-xs text-gray-400">Loading…</p>}
        {!isLoading && (messages?.length ?? 0) === 0 && (
          <p className="text-xs text-gray-400">No messages yet. Say hi 👋</p>
        )}
        {messages?.map((m) => {
          const author = profiles?.get(m.user_id)
          const name =
            author?.display_name ??
            author?.first_name ??
            `user ${m.user_id.slice(0, 6)}`
          return (
            <div key={m.id} className="leading-snug">
              <span className="font-medium text-gray-900">{name}: </span>
              <span className="text-gray-700">{m.text}</span>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSend} className="border-t p-2 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_SEND_CHARS))}
          placeholder="Type a message…"
          className="flex-1 border rounded px-3 py-1.5 text-sm"
          maxLength={MAX_SEND_CHARS}
        />
        <button
          type="submit"
          disabled={send.isPending || !draft.trim()}
          className="bg-rose-600 text-white text-sm px-3 py-1.5 rounded disabled:bg-gray-300"
        >
          Send
        </button>
      </form>
      {errorMsg && (
        <div className="text-xs text-rose-700 px-3 pb-2">{errorMsg}</div>
      )}
    </div>
  )
}

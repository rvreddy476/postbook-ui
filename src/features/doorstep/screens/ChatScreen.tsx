"use client"

/*
  /doorstep/bookings/[id]/chat — chat with the professional, open from
  acceptance until 2 h after completion (MessagePage.open). No phone numbers
  are exchanged; this is the only channel. Polled every 5 s while open, and
  refreshed by the booking's realtime topic.
*/

import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, MessageCircle, Send } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import { markMessageRead, sendMessage, toDoorstepError } from "../api/client"
import { ErrorState, Skel, StateBlock } from "../components/parts"
import { useLiveBooking } from "../hooks/live"
import { keys, useBooking, useMessages } from "../hooks/queries"
import { chatMayOpen } from "../model/booking"
import { refusalLine } from "../model/refusals"
import { formatWhen } from "../model/slots"

const CHAT_POLL_MS = 5_000

export function ChatScreen({ bookingId }: { bookingId: string }) {
  const qc = useQueryClient()
  const booking = useBooking(bookingId)
  const may = Boolean(booking.data && chatMayOpen(booking.data.status))
  const messages = useMessages(bookingId, may, CHAT_POLL_MS)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const readRef = useRef(new Set<string>())

  const onChange = useCallback(() => void qc.invalidateQueries({ queryKey: keys.messages(bookingId) }), [bookingId, qc])
  useLiveBooking(bookingId, may, { onChange, onFix: () => undefined })

  const items = messages.data?.items ?? []
  const ordered = [...items].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

  // Mark the professional's unread messages read, once each.
  useEffect(() => {
    for (const m of items) {
      if (m.senderKind === "pro" && !m.readAt && !readRef.current.has(m.id)) {
        readRef.current.add(m.id)
        void markMessageRead(bookingId, m.id).catch(() => readRef.current.delete(m.id))
      }
    }
  }, [items, bookingId])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [ordered.length])

  const send = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    try {
      await sendMessage(bookingId, body)
      setDraft("")
      void qc.invalidateQueries({ queryKey: keys.messages(bookingId) })
    } catch (e) {
      setError(refusalLine(toDoorstepError(e)))
    } finally {
      setSending(false)
    }
  }

  const open = messages.data?.open ?? false
  const name = booking.data?.professional?.firstName ?? "your professional"

  return (
    <>
      <div className="ds-head">
        <div className="ds-row">
          <Link href={`/doorstep/bookings/${encodeURIComponent(bookingId)}`} className="ds-back" aria-label="Back to the booking">
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <h1 className="ds-title">Chat with {name}</h1>
        </div>
      </div>
      {booking.isLoading || messages.isLoading ? (
        <Skel h={240} />
      ) : booking.isError ? (
        <ErrorState error={booking.error} what="This booking" />
      ) : !may ? (
        <StateBlock icon={<MessageCircle size={22} />} title="Chat isn't open" text="Chat opens when a professional accepts your booking and closes 2 hours after the visit." />
      ) : messages.isError ? (
        <ErrorState error={messages.error} what="Messages" onRetry={() => void messages.refetch()} />
      ) : (
        <section className="ds-card" aria-label="Messages">
          <div className="ds-chat" ref={listRef} aria-live="polite">
            {ordered.length ? (
              ordered.map((m) => (
                <div key={m.id} className={m.senderKind === "customer" ? "ds-msg is-mine" : m.senderKind === "system" ? "ds-msg is-system" : "ds-msg"}>
                  {m.body}
                  <span className="ds-meta" style={{ display: "block" }}>
                    {formatWhen(m.createdAt)}
                  </span>
                </div>
              ))
            ) : (
              <p className="ds-note">No messages yet. Say hello, or share directions.</p>
            )}
          </div>
          {open ? (
            <form
              className="ds-compose"
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
            >
              <input className="ds-input ds-grow" value={draft} maxLength={1000} onChange={(e) => setDraft(e.target.value)} placeholder="Message" aria-label="Message" />
              <button type="submit" className="ds-btn ds-btn--primary" disabled={!draft.trim() || sending} aria-label="Send">
                <Send size={14} aria-hidden="true" />
              </button>
            </form>
          ) : (
            <p className="ds-note">Chat is closed for this booking.</p>
          )}
          {error ? (
            <p className="ds-alert" role="alert">
              {error}
            </p>
          ) : null}
          <p className="ds-note">Give the start and end codes in person, never in chat. Doorstep never asks for payment details here.</p>
        </section>
      )}
    </>
  )
}

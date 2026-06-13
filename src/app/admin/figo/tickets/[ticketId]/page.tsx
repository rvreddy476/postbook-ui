"use client"

// FiGo admin ticket detail.
//
// Single ticket with its message thread + admin actions: change status,
// append a message (party-only endpoint accepts admin via X-Scopes).

import { useParams } from "next/navigation"
import { useState } from "react"
import { Loader2 } from "lucide-react"

import {
  useFoodSetTicketStatus,
  useFoodTicket,
} from "@/hooks/useFoodAdmin"
import type { TicketStatus } from "@/types/food"
import api from "@/lib/api"

import { EmptyState, errorMessage } from "../../../mopedu/_shared"

const VERDICTS: Array<{ key: TicketStatus; label: string; tone: string }> = [
  { key: "in_progress", label: "In progress", tone: "bg-blue-600 hover:bg-blue-700" },
  { key: "resolved", label: "Resolve", tone: "bg-emerald-600 hover:bg-emerald-700" },
  { key: "closed", label: "Close", tone: "bg-slate-600 hover:bg-slate-700" },
]

export default function FoodTicketDetailPage() {
  const params = useParams<{ ticketId: string }>()
  const ticketId = params?.ticketId
  const q = useFoodTicket(ticketId)
  const update = useFoodSetTicketStatus()
  const [reply, setReply] = useState("")
  const [posting, setPosting] = useState(false)
  const [postErr, setPostErr] = useState<string | null>(null)

  async function appendMessage() {
    if (!ticketId || !reply.trim()) return
    setPosting(true)
    setPostErr(null)
    try {
      await api.post(
        `/v1/food/support/tickets/${ticketId}/messages`,
        { body: reply.trim() },
        { headers: { "X-Scopes": "admin" } },
      )
      setReply("")
      await q.refetch()
    } catch (e) {
      setPostErr(errorMessage(e))
    } finally {
      setPosting(false)
    }
  }

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading ticket…
      </div>
    )
  }
  if (q.error) {
    return <p className="p-4 text-sm text-rose-700">{errorMessage(q.error)}</p>
  }
  if (!q.data) {
    return <EmptyState title="Not found" body="Ticket does not exist." />
  }
  const { ticket, messages } = q.data

  return (
    <div className="space-y-4">
      <header className="rounded-md border border-slate-200 bg-white p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          {ticket.category}
        </div>
        <h2 className="text-lg font-semibold text-slate-900">{ticket.subject}</h2>
        {ticket.detail ? (
          <p className="mt-1 text-sm text-slate-700">{ticket.detail}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Status: <strong>{ticket.status}</strong></span>
          <span>Customer: <code className="font-mono">{ticket.customer_id.slice(0, 8)}…</code></span>
          {ticket.order_id ? (
            <span>Order: <code className="font-mono">{ticket.order_id.slice(0, 8)}…</code></span>
          ) : null}
          <span>Opened: {new Date(ticket.created_at).toLocaleString()}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {VERDICTS.filter((v) => v.key !== ticket.status).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() =>
                ticketId && update.mutate({ ticketId, status: v.key })
              }
              disabled={update.isPending}
              className={[
                "rounded px-3 py-1 text-xs font-medium text-white",
                v.tone,
                update.isPending ? "cursor-wait opacity-60" : "",
              ].join(" ")}
            >
              {v.label}
            </button>
          ))}
        </div>
      </header>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Conversation</h3>
        <div className="space-y-2">
          {messages.length === 0 ? (
            <EmptyState title="No messages yet" body="Be the first to respond." />
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={[
                  "rounded-md border p-3 text-sm",
                  m.is_admin
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-white",
                ].join(" ")}
              >
                <div className="text-xs text-slate-500">
                  {m.is_admin ? "Admin" : "Customer"} ·{" "}
                  {new Date(m.created_at).toLocaleString()}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">
                  {m.body}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
        <label className="text-sm font-medium text-slate-700">Reply</label>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={3}
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="Message the customer…"
        />
        <div className="flex items-center justify-between">
          {postErr ? (
            <p className="text-xs text-rose-700">{postErr}</p>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={appendMessage}
            disabled={posting || !reply.trim()}
            className={[
              "rounded bg-amber-600 px-3 py-1 text-sm font-medium text-white transition",
              posting || !reply.trim()
                ? "cursor-not-allowed opacity-60"
                : "hover:bg-amber-700",
            ].join(" ")}
          >
            {posting ? "Sending…" : "Send"}
          </button>
        </div>
      </section>
    </div>
  )
}

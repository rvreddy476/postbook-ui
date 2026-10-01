"use client"

import { useEffect, useRef, useState } from "react"
import { MoreHorizontal } from "lucide-react"

import type { LiveChatMessage } from "../model"
import type { MessageAction, MessageActionKey } from "../chat"

/**
 * One chat line. The "more" button exists only when the reader has at
 * least one action on this message (messageActions decides; viewers see
 * Report only, never host tools).
 */
export function ChatMessageRow({
  message,
  name,
  roleTag,
  actions,
  onAction,
}: {
  message: LiveChatMessage
  name: string
  roleTag?: string
  actions: MessageAction[]
  onAction: (key: MessageActionKey, message: LiveChatMessage) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="live-chat__row" ref={ref} data-message-id={message.id}>
      <div className="live-chat__text">
        <span className="live-chat__name">{name}</span>
        {roleTag && <span className="live-chat__role">{roleTag}</span>}
        <span>{message.text}</span>
      </div>
      {actions.length > 0 && (
        <>
          <button
            type="button"
            className="live-chat__more"
            aria-label="Message options"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
          {open && (
            <div className="live-menu" role="menu">
              {actions.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  role="menuitem"
                  data-action={a.key}
                  className={`live-menu__row${a.destructive ? " live-menu__row--danger" : ""}`}
                  onClick={() => { setOpen(false); onAction(a.key, message) }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"

import Avatar from "@/components/ui/Avatar"
import { useAuthUser } from "@/store/auth"

import type { Note } from "../model"
import { Composer } from "./Composer"
import { useEchoActions } from "./EchoActions"

/**
 * The box at the top of the timeline (or under a note, for a reply). It
 * opens only after GET /v1/notes/me/eligibility says yes; a refusal shows
 * its reason ("Posting on Echo needs Momentum Premium") instead.
 */
export function InlineComposer({ replyTo }: { replyTo?: Note }) {
  const actions = useEchoActions()
  const user = useAuthUser()
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const name = user?.name || user?.username || ""
  const purpose = replyTo ? "reply" : "note"

  const start = async () => {
    if (checking) return
    setChecking(true)
    try {
      if (await actions.ensureCanCompose(purpose)) setOpen(true)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex gap-3 border-b border-border px-4 py-3" data-inline-composer={purpose}>
      <Avatar src={user?.avatar || null} name={name || "?"} className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        {open ? (
          <Composer
            purpose={replyTo ? { kind: "reply", to: replyTo } : { kind: "note" }}
            autoFocus
            onPosted={() => setOpen(false)}
            onPremiumRequired={() => {
              setOpen(false)
              actions.showPremiumRequired()
            }}
          />
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={checking}
            className="w-full rounded-xl px-1 py-3 text-left text-base text-muted-foreground hover:text-brand-text disabled:opacity-60"
          >
            {replyTo ? "Post your reply" : "What's happening?"}
          </button>
        )}
      </div>
    </div>
  )
}

'use client'

import React, { useState } from 'react'
import { useCreateBroadcastChannel } from '@/hooks/useBroadcastChannels'
import { channelHandleAvailable, deriveUniqueHandle } from '@/lib/handles'
import { Hash, Loader2, X } from 'lucide-react'

interface NewChannelSheetProps {
  onClose: () => void
  /** Called with the new channel's id so the messenger can open it. */
  onCreated: (channelId: string) => void
}

/**
 * Create a channel without leaving the messenger.
 *
 * The Channels list had no way to start one: creating a channel meant a trip
 * to /channels/create, leaving this screen, which is exactly the thing the
 * founder objected to. That page has since been removed from the web
 * altogether, so this is now the only way to create a channel here.
 *
 * It asks for a name and, optionally, a description. Nothing else.
 *
 * No handle field: a person is asked for a handle ONCE, when they create
 * their account. A channel's handle only ever appears in a URL, so it is
 * derived from the name and a collision is resolved silently — see
 * lib/handles. No category field either; it is on the Settings tab, which
 * opens the moment the channel exists, along with avatar, banner and the
 * rest.
 */
export default function NewChannelSheet({ onClose, onCreated }: NewChannelSheetProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useCreateBroadcastChannel()

  const canSubmit = name.trim().length >= 2 && !create.isPending

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      const handle = await deriveUniqueHandle(name.trim(), channelHandleAvailable)
      const channel = await create.mutateAsync({
        name: name.trim(),
        handle,
        description: description.trim(),
        // channel_type is DELIBERATELY not sent.
        //
        // Channels are in an invite-only pilot, and the pilot refuses any
        // publicly visible type outright — this asked for 'public' and was
        // answered 403 every time, which surfaced as "Could not create that
        // channel". Omitting it takes the pilot's own default, private, which
        // is the only thing it will create. Visibility is changeable in the
        // channel's settings once the pilot opens.
        // Channels are broadcast: readers react, they do not reply.
        // Subscribers may comment. This was 'disabled' on the reasoning that a
        // channel is broadcast and readers only react — the founder's call is
        // that a channel post carries comment, save and repost like any other,
        // so the people who subscribed can reply. Still not open to strangers.
        comment_mode: 'subscribers_only',
        reaction_mode: 'enabled',
        forward_allowed: true,
      })
      if (channel?.id) onCreated(channel.id)
      else setError('The channel was created but returned no id.')
    } catch (err) {
      /*
        The server's own words, not a flat string.

        This was `catch {}` with "Could not create that channel", which hid a
        403 saying the account was not on the pilot allowlist — a reason that
        is actionable and that no amount of retrying would have revealed.
      */
      const body = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      setError(body?.message || (err instanceof Error && err.message) || 'Could not create that channel.')
    }
  }

  return (
    <form onSubmit={submit} className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-brand-divider px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-tint text-primary-ink">
          <Hash className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold -tracking-[0.014em] text-brand-text">
            New channel
          </h2>
          <p className="text-xs text-brand-text/55">Broadcast to people who subscribe</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-text/50 transition-colors hover:bg-brand-secondary hover:text-brand-text"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-text/50">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder="Product Design"
            autoFocus
            className="mt-1.5 w-full rounded-xl border border-brand-divider bg-brand-bg px-3.5 py-2.5 text-sm text-brand-text outline-hidden transition-colors placeholder:text-brand-text/35 focus:border-primary-outline"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-text/50">
            Description
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 280))}
            rows={3}
            placeholder="What will you post here?"
            className="mt-1.5 w-full resize-none rounded-xl border border-brand-divider bg-brand-bg px-3.5 py-2.5 text-sm text-brand-text outline-hidden transition-colors placeholder:text-brand-text/35 focus:border-primary-outline"
          />
        </label>

        {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-brand-divider px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-brand-text/60 transition-colors hover:bg-brand-secondary hover:text-brand-text"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-2 rounded-xl bg-primary-ink px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover active:scale-95 disabled:opacity-40 disabled:active:scale-100"
        >
          {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Create channel
        </button>
      </footer>
    </form>
  )
}

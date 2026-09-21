'use client'

import React, { useMemo, useState } from 'react'
import {
  useCreateBroadcastChannel,
  useCheckHandleAvailability,
} from '@/hooks/useBroadcastChannels'
import { Check, Hash, Loader2, X } from 'lucide-react'

interface NewChannelSheetProps {
  onClose: () => void
  /** Called with the new channel's id so the messenger can open it. */
  onCreated: (channelId: string) => void
}

const CATEGORIES = [
  'Technology', 'Music', 'Art', 'Gaming', 'Education',
  'Business', 'Lifestyle', 'News', 'Sports', 'Other',
]

/**
 * Create a channel without leaving the messenger.
 *
 * The Channels list had no way to start one: /channels/create exists as a
 * full page, but reaching it meant leaving this screen, which is exactly
 * the thing the founder objected to.
 *
 * This asks for the four fields the API actually requires and nothing more.
 * Avatar, banner, paid access and the rest are on the channel's own
 * Settings tab, which opens the moment the channel exists.
 */
export default function NewChannelSheet({ onClose, onCreated }: NewChannelSheetProps) {
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useCreateBroadcastChannel()
  const { data: available, isFetching: checking } = useCheckHandleAvailability(handle)

  // Lowercase, letters, digits and underscore — what a handle can be.
  const onHandleChange = (raw: string) =>
    setHandle(raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30))

  const handleIssue = useMemo(() => {
    if (!handle) return null
    if (handle.length < 3) return 'At least 3 characters'
    if (available === false) return 'Already taken'
    return null
  }, [handle, available])

  const canSubmit =
    name.trim().length >= 2 && handle.length >= 3 && !handleIssue && !create.isPending

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      const channel = await create.mutateAsync({
        name: name.trim(),
        handle,
        description: description.trim(),
        channel_type: 'public',
        category: category || undefined,
        // Channels are broadcast: readers react, they do not reply.
        comment_mode: 'disabled',
        reaction_mode: 'enabled',
        forward_allowed: true,
      })
      if (channel?.id) onCreated(channel.id)
      else setError('The channel was created but returned no id.')
    } catch {
      setError('Could not create that channel.')
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
            Handle
          </span>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-brand-text/35">
              @
            </span>
            <input
              value={handle}
              onChange={(e) => onHandleChange(e.target.value)}
              placeholder="product-design"
              className="w-full rounded-xl border border-brand-divider bg-brand-bg py-2.5 pl-7 pr-10 text-sm text-brand-text outline-hidden transition-colors placeholder:text-brand-text/35 focus:border-primary-outline"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
              {checking && handle.length >= 3 ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand-text/30" />
              ) : available === true ? (
                <Check className="h-4 w-4 text-success" />
              ) : null}
            </span>
          </div>
          {handleIssue && (
            <span className="mt-1.5 block text-xs font-medium text-danger">{handleIssue}</span>
          )}
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-text/50">
            Category
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-brand-divider bg-brand-bg px-3.5 py-2.5 text-sm text-brand-text outline-hidden transition-colors focus:border-primary-outline"
          >
            <option value="">No category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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

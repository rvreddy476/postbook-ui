'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useCreateGroup } from '@/hooks/useGroups'
import { deriveUniqueHandle, groupHandleAvailable } from '@/lib/handles'
import { AlertCircle, Loader2, Users, X } from 'lucide-react'

/**
 * Create a group: a name, a description, done.
 *
 * This was three steps — details, then pick members, then review — and the
 * second was a gate: you could not create a group without adding at least one
 * person to it. That is backwards. A group is a place, and a place can exist
 * before anyone is in it. Being asked for its members, its privacy, its
 * avatar and its cover before it exists is a lot of decisions demanded of
 * someone who has not yet seen the thing they are deciding about.
 *
 * Everything those steps collected is editable inside the group afterwards,
 * where each choice has something to attach to. So this asks for the two
 * things that cannot be defaulted, creates the group, and opens it.
 *
 * The defaults are the conservative ones: private, invite-only. A group open
 * to the world by default would be a privacy decision taken on the creator's
 * behalf, silently, which is not a default anyone should be given.
 */

interface CreateGroupPanelProps {
  onClose: () => void
  /** Both call sites use this to open the new group. */
  onCreated: (groupId: string) => void
}

const NAME_MIN = 3
const NAME_MAX = 60
const DESCRIPTION_MAX = 300

export default function CreateGroupPanel({ onClose, onCreated }: CreateGroupPanelProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const createGroup = useCreateGroup()

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, creating])

  const canCreate = name.trim().length >= NAME_MIN && !creating

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true)
    setError(null)
    try {
      // No handle field: a person is asked for a handle once, when they make
      // their account. A group's only ever appears in a URL, so it is derived
      // from the name and collisions resolve silently.
      const handle = await deriveUniqueHandle(name.trim(), groupHandleAvailable)

      const newGroup = await createGroup.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        handle,
        privacy_level: 'private',
        join_mode: 'invite_only',
      })

      onCreated(newGroup.id)
    } catch (err: unknown) {
      /*
        The server's own words. A flat "Failed to create group" hid a 404 for
        days — the gateway was gating /v1/groups behind a dormant-product flag
        — and no amount of retrying would have revealed it.
      */
      const body = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      setError(
        body?.message ||
          (err instanceof Error && err.message) ||
          'Could not create the group. Please try again.',
      )
    } finally {
      setCreating(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      onClick={(e) => { if (e.target === e.currentTarget && !creating) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Create group"
    >
      <div className="animate-in fade-in zoom-in-95 w-full max-w-md overflow-hidden rounded-2xl bg-brand-card shadow-2xl duration-200">
        <div className="flex items-center gap-3 border-b border-brand-divider px-5 py-4">
          <span className="bg-primary-grad flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white">
            <Users className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold -tracking-[0.018em] text-brand-text">
              New group
            </h2>
            <p className="text-[12px] text-brand-text/60">
              Add people and settings once it exists
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-text/50 transition-colors hover:bg-brand-secondary hover:text-brand-text disabled:opacity-40"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label htmlFor="group-name" className="mb-1.5 block text-[13px] font-medium text-brand-text">
              Group name
            </label>
            <input
              id="group-name"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="What is this group called?"
              className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-3.5 py-2.5 text-[15px] text-brand-text outline-hidden transition-colors placeholder:text-brand-text/35 focus:border-brand-accent focus:bg-brand-card"
            />
          </div>

          <div>
            <label htmlFor="group-description" className="mb-1.5 block text-[13px] font-medium text-brand-text">
              Description <span className="font-normal text-brand-text/45">· optional</span>
            </label>
            <textarea
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
              placeholder="What is it for?"
              rows={3}
              className="w-full resize-none rounded-xl border border-brand-divider bg-brand-secondary px-3.5 py-2.5 text-[15px] text-brand-text outline-hidden transition-colors placeholder:text-brand-text/35 focus:border-brand-accent focus:bg-brand-card"
            />
            <div className="mt-1 text-right text-[11px] text-brand-text/40">
              {description.length} / {DESCRIPTION_MAX}
            </div>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-[12px] text-danger">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="font-medium">{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-brand-divider px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-full px-4 py-2.5 text-[13px] font-semibold text-brand-text/60 transition-colors hover:text-brand-text disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            className="bg-primary-grad flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
            {creating ? 'Creating…' : 'Create group'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

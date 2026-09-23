'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useCreateGroup, useAddPeopleToGroup } from '@/hooks/useGroups'
import { useFriends } from '@/hooks/useConnections'
import { useMyProfile } from '@/hooks/useEditProfile'
import { deriveUniqueHandle, groupHandleAvailable } from '@/lib/handles'
import { useIdempotencyKey } from '@/lib/idempotency'
import Avatar from '@/components/ui/Avatar'
import { useGlobalToast } from '@/contexts/ToastContext'
import {
  addPeopleSummary,
  createBlock,
  filterCandidates,
  toggleSelected,
  DESCRIPTION_MAX,
  MAX_PEOPLE,
  NAME_MAX,
  type Candidate,
} from './groupComposition'
import { AlertCircle, Check, Loader2, Search, Users, X } from 'lucide-react'

/**
 * Create a group: a name, the people in it, done.
 *
 * This was three steps once — details, then members, then review — and was cut
 * to one on the instruction to keep creation simple. That cut went one field
 * too far: it also removed the member step, and a group with nobody in it is
 * not a group, it is a note to self. So the people are back, inline, as part
 * of the one screen rather than a step of their own, and at least one is
 * required.
 *
 * What stays cut is everything that can be decided later with the group in
 * front of you: privacy, avatar, cover, category, rules. Those defaults are
 * the conservative ones — private, invite-only — because a group open to the
 * world by default would be a privacy decision taken on the creator's behalf,
 * silently.
 *
 * The people come from connections, which on this product means someone whose
 * message request you accepted. Adding them is two different things depending
 * on their own privacy setting — added straight in, or sent an invitation —
 * and the dialog reports which actually happened rather than assuming.
 */

interface CreateGroupPanelProps {
  onClose: () => void
  /** Both call sites use this to open the new group. */
  onCreated: (groupId: string) => void
}

export default function CreateGroupPanel({ onClose, onCreated }: CreateGroupPanelProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const createGroup = useCreateGroup()
  const addPeople = useAddPeopleToGroup()
  const toast = useGlobalToast()

  const { data: me } = useMyProfile()
  // 100 rather than the default 20: this is a picker, and a connection missing
  // from it looks like the person is gone rather than paged out.
  const { data: friends, isLoading: loadingFriends } = useFriends(me?.id, 100)

  const candidates: Candidate[] = useMemo(() => friends?.items ?? [], [friends])
  const visible = useMemo(() => filterCandidates(candidates, query), [candidates, query])

  /*
    One key for as long as this dialog is open. This panel mounts on open and
    unmounts on close, so that is one key per intent: typing in the fields does
    not change it, and pressing "Create group" again after a lost response
    returns the group already created instead of making a second one.
  */
  const idempotency = useIdempotencyKey()

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

  const block = createBlock(name, selected.length)
  const canCreate = block.ok && !creating

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
        idempotency_key: idempotency.current(),
      })

      /*
        The group exists now. If adding people fails from here the group must
        NOT be lost — it is already created, and throwing the user back to an
        empty dialog would leave them with an orphan group they cannot see and
        a second press would make another. So this failure is reported against
        the group that exists, and they land in it.
      */
      try {
        const result = await addPeople.mutateAsync({ groupId: newGroup.id, userIds: selected })
        const summary = addPeopleSummary(result)
        if (summary) {
          /*
            Said out loud, because "added" and "invited" are different states
            and the creator cannot tell them apart by looking. Someone added is
            in the group; someone invited is not, until they accept. A silent
            success would leave a creator who picked three people staring at a
            group of one and concluding it is broken.

            Nobody is named, including among the skipped — group-service
            withholds those names so a block cannot be read off the response,
            and repeating one here would undo that.
          */
          toast({
            type: result.added + result.invited === 0 ? 'warning' : 'success',
            title: name.trim(),
            description: summary,
          })
        }
      } catch {
        /*
          The group EXISTS at this point. Failing the whole create here would
          leave an orphan the user cannot see, and a second press would make
          another one — so this is reported and stepped over rather than
          thrown. The member list inside the group is the authority on who is
          actually in it.
        */
        toast({
          type: 'warning',
          title: name.trim(),
          description: 'The group was created, but the people could not be added. Add them from inside the group.',
        })
      }

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
              {selected.length === 0
                ? 'Name it and pick who is in it'
                : `${selected.length} ${selected.length === 1 ? 'person' : 'people'} selected`}
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

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor="group-people" className="block text-[13px] font-medium text-brand-text">
                Add people
              </label>
              <span className="text-[11px] text-brand-text/45">
                {selected.length > 0 ? `${selected.length} of ${MAX_PEOPLE}` : 'at least one'}
              </span>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/35" strokeWidth={1.9} />
              <input
                id="group-people"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your connections"
                className="w-full rounded-xl border border-brand-divider bg-brand-secondary py-2.5 pl-9 pr-3.5 text-[14px] text-brand-text outline-hidden transition-colors placeholder:text-brand-text/35 focus:border-brand-accent focus:bg-brand-card"
              />
            </div>

            <div className="mt-2 max-h-52 overflow-y-auto overscroll-contain rounded-xl border border-brand-divider">
              {loadingFriends ? (
                <p className="px-3 py-6 text-center text-[13px] text-brand-text/45">Loading…</p>
              ) : visible.length === 0 ? (
                <p className="px-3 py-6 text-center text-[13px] text-brand-text/45">
                  {candidates.length === 0
                    ? 'You have no connections yet. A connection forms when someone accepts your message request.'
                    : `Nobody matches "${query.trim()}".`}
                </p>
              ) : (
                <ul>
                  {visible.map((p) => {
                    const on = selected.includes(p.user_id)
                    return (
                      <li key={p.user_id}>
                        <button
                          type="button"
                          onClick={() => setSelected((cur) => toggleSelected(cur, p.user_id))}
                          aria-pressed={on}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                            on ? 'bg-primary-tint' : 'hover:bg-brand-secondary'
                          }`}
                        >
                          <Avatar
                            src={p.avatar_media_id ? `/v1/media/${p.avatar_media_id}/serve` : null}
                            name={p.display_name}
                            className="h-8 w-8"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-brand-text">
                              {p.display_name}
                            </span>
                            {p.username && (
                              <span className="block truncate text-[11px] text-brand-text/45">
                                @{p.username}
                              </span>
                            )}
                          </span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                              on
                                ? 'border-primary-ink bg-primary-ink text-white'
                                : 'border-brand-divider'
                            }`}
                          >
                            {on && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
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
          {/* A disabled button with no explanation is what people report as
              "the button does nothing". */}
          {!block.ok && !creating && (
            <span className="mr-auto text-[12px] text-brand-text/50">{block.reason}</span>
          )}
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

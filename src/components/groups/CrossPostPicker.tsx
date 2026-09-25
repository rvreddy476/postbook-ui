'use client'

import React, { useMemo, useState } from 'react'
import { Check, Loader2, Plus, X } from 'lucide-react'

import { useMyGroups } from '@/hooks/useGroups'
import {
  MAX_ADDITIONAL_GROUPS,
  canAddAnotherGroup,
  crossPostCapReason,
} from './groupComposer'

/** A space the post will also go to. The name is carried so the summary that
 *  reports refusals can name it without a second lookup. */
export interface CrossPostChoice {
  id: string
  name: string
}

interface CrossPostPickerProps {
  /** The group being posted to. Never offered as a target — the server treats
   *  it as one target either way, so picking it would silently spend a slot. */
  groupId: string
  selected: CrossPostChoice[]
  onChange: (next: CrossPostChoice[]) => void
  disabled?: boolean
}

/**
 * "+ Add groups" — the same body to a handful of other spaces.
 *
 * Its own component, mounted only in group mode, because `useMyGroups` has no
 * `enabled` switch: calling it from the composer itself would fetch
 * /v1/groups/my every time anyone opened the ordinary post composer.
 *
 * The cap is enforced here rather than being learned from a 400. Note it is
 * FOUR: group-service counts the group you are already in as one of its five
 * targets (see MAX_ADDITIONAL_GROUPS).
 */
const CrossPostPicker: React.FC<CrossPostPickerProps> = ({
  groupId,
  selected,
  onChange,
  disabled,
}) => {
  const [open, setOpen] = useState(false)
  const { data: myGroups, isLoading } = useMyGroups()

  const options = useMemo(
    () => (myGroups ?? []).filter((g) => g.id !== groupId && g.status !== 'archived' && !g.is_archived),
    [myGroups, groupId],
  )

  const isSelected = (id: string) => selected.some((s) => s.id === id)
  const atCap = !canAddAnotherGroup(selected.length)

  // `||`, never `??`: Go marshals an unset name as "", so a nullish fallback
  // would put a nameless chip in the composer and a nameless line in the
  // summary that reports which spaces refused the post.
  const label = (name: string | undefined) => name?.trim() || 'Untitled space'

  const toggle = (id: string, name: string) => {
    if (isSelected(id)) {
      onChange(selected.filter((s) => s.id !== id))
      return
    }
    if (atCap) return
    onChange([...selected, { id, name }])
  }

  return (
    <div className="px-6 pt-3">
      <div className="rounded-[18px] border border-brand-divider bg-brand-secondary px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={disabled}
            aria-expanded={open}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-primary-ink transition-colors hover:text-primary-hover disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add groups
          </button>
          {selected.length > 0 && (
            <span className="text-[11px] tabular-nums text-brand-text/50">
              {selected.length} of {MAX_ADDITIONAL_GROUPS}
            </span>
          )}
        </div>

        {/* What is already picked stays visible with the picker closed: a
            cross-post that the author has forgotten about is the thing they
            would least like to discover afterwards. */}
        {selected.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selected.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded-full border border-brand-divider bg-brand-card px-2.5 py-1 text-[11px] font-medium text-brand-text"
              >
                {s.name}
                <button
                  type="button"
                  onClick={() => toggle(s.id, s.name)}
                  aria-label={`Remove ${s.name}`}
                  className="text-brand-text/40 hover:text-brand-text"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {open && (
          <div className="mt-3 max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center gap-2 py-3 text-[12px] text-brand-text/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your spaces…
              </div>
            ) : options.length === 0 ? (
              <p className="py-3 text-[12px] text-brand-text/50">
                You are not in any other space yet.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {options.map((g) => {
                  const picked = isSelected(g.id)
                  const blocked = !picked && atCap
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => toggle(g.id, label(g.name))}
                        disabled={blocked || disabled}
                        aria-pressed={picked}
                        title={blocked ? crossPostCapReason() : undefined}
                        className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] transition-colors disabled:opacity-35 ${
                          picked
                            ? 'bg-primary-ink/10 text-primary-ink'
                            : 'text-brand-text hover:bg-brand-card'
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                            picked ? 'border-primary-ink bg-primary-ink/20' : 'border-brand-divider'
                          }`}
                        >
                          {picked && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{label(g.name)}</span>
                        {/*
                          A private space is named as such, because whether the
                          post lands there depends on a membership the author
                          may have lost — and the server answers that with a
                          deliberately vague "not available".
                        */}
                        {g.privacy_level === 'private' && (
                          <span className="shrink-0 text-[10px] uppercase tracking-wider text-brand-text/40">
                            Private
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {atCap && (
              <p className="mt-2 text-[11px] text-brand-text/50">{crossPostCapReason()}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CrossPostPicker

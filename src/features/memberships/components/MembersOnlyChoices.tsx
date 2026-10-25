"use client"

/*
  The "Members only" choice, shared by the upload studio (long videos and
  reels), the Creator Hub edit sheet and the post composer: Everyone, or a
  level — the lowest level that unlocks it; members of dearer levels see it
  too. Hosts draw it only when the creator has at least one active level
  (useGateLevels), and send it as tier_required_id with the write itself:
  the create, the draft, or the post PATCH (model.ts gateCreateField /
  gatePatchField), so a members-only post is never public for a moment.
*/

import { Check, Globe, Lock } from "lucide-react"

import { gateOptionLabel, perMonth, type Tier } from "../model"

export interface MembersOnlyChoicesProps {
  /** Active levels, cheapest first. */
  levels: readonly Tier[]
  /** The chosen level id; null is Everyone. */
  value: string | null
  onChange: (tierId: string | null) => void
  disabled?: boolean
}

export const MEMBERS_ONLY_HINT = "Non-members see the title, the cover and a lock. Members-only posts never appear in public recommendations."

export function MembersOnlyChoices({ levels, value, onChange, disabled = false }: MembersOnlyChoicesProps) {
  // A gate on a level that is no longer offered still shows, so saving does not silently drop it.
  const known = value === null || levels.some((l) => l.id === value)
  const options: { id: string | null; title: string; detail: string }[] = [
    { id: null, title: "Everyone", detail: "Anyone who can see your posts" },
    ...levels.map((l) => ({ id: l.id, title: gateOptionLabel(l, levels), detail: `Members from ${perMonth(l.pricePaise)}` })),
    ...(known ? [] : [{ id: value, title: "A level you no longer offer", detail: "Pick another level, or Everyone" }]),
  ]
  return (
    <div role="radiogroup" aria-label="Who can see this" data-membership="members-only" className="space-y-1.5">
      {options.map((o) => {
        const checked = o.id === value
        const Icon = o.id === null ? Globe : Lock
        return (
          <button
            key={o.id ?? "everyone"}
            type="button"
            role="radio"
            aria-checked={checked}
            data-gate={o.id ?? "everyone"}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50 ${checked ? "border-primary bg-primary-tint" : "border-brand-divider hover:bg-brand-secondary"}`}
          >
            <Icon className="h-4 w-4 shrink-0 text-brand-text" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-brand-text">{o.title}</span>
              <span className="block text-xs text-muted-foreground">{o.detail}</span>
            </span>
            {checked ? <Check className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" /> : null}
          </button>
        )
      })}
      <p className="px-1 pt-1 text-xs text-muted-foreground">{MEMBERS_ONLY_HINT}</p>
    </div>
  )
}

/** The short label for a summary row: "Everyone" or the level. */
export function membersOnlySummary(levels: readonly Tier[], value: string | null): string {
  if (!value) return "Everyone"
  const t = levels.find((l) => l.id === value)
  return t ? `Members only · ${gateOptionLabel(t, levels)}` : "Members only"
}

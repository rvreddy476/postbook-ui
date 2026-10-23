"use client"

/*
  The profile's Action button on the channel's Branding page: a button
  beside Follow and Message on the profile and the channel. Saved on its
  own (PATCH /v1/channels/me {action}, null removes it) so a refusal —
  not eligible yet, an unsafe link — never holds back the rest of Branding.
*/

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Loader2 } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"
import { useUpdateChannel } from "@/hooks/useChannels"

import { actionPatchValue, actionProblemFromError, decodeAction, draftFromAction, draftProblem, type ActionDraft, type ActionProblem } from "../model"
import { ActionEditor } from "./ActionEditor"

export function ProfileActionCard({ saved: savedRaw }: { saved: unknown }) {
  const toast = useGlobalToast()
  const update = useUpdateChannel()
  const saved = useMemo(() => decodeAction(savedRaw), [savedRaw])
  const base = useMemo(() => draftFromAction(saved), [saved])
  const [draft, setDraft] = useState<ActionDraft | null>(base)
  const [problem, setProblem] = useState<ActionProblem | null>(null)
  // A fresh saved button (first load, a save, a refetch) replaces the draft, unless it holds unsaved edits.
  const baseRef = useRef(base)
  useEffect(() => {
    setDraft((cur) => (actionPatchValue(baseRef.current, cur) === undefined ? base : cur))
    baseRef.current = base
  }, [base])

  const value = actionPatchValue(base, draft)
  const changed = value !== undefined
  const issue = changed ? draftProblem(draft) : null

  const save = () => {
    if (!changed || issue || update.isPending) return
    setProblem(null)
    update.mutate(
      { action: value },
      {
        onSuccess: () => toast({ type: "success", title: value === null ? "Action button removed" : "Action button saved" }),
        onError: (err) => {
          const p = actionProblemFromError(err)
          setProblem(p)
          toast({ type: "error", title: "Could not save the action button", description: p?.message ?? "Try again." })
        },
      },
    )
  }

  return (
    <div className="space-y-3" data-profile-action-card="">
      <ActionEditor
        value={draft}
        onChange={(next) => {
          setProblem(null)
          setDraft(next)
        }}
        savedStatus={saved && saved.status !== "active" ? saved.status : null}
        serverProblem={problem}
        disabled={update.isPending}
        idPrefix="branding-action"
        surface="profile"
        showErrors={changed}
      />
      {changed ? (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setProblem(null)
              setDraft(base)
            }}
            disabled={update.isPending}
            className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-secondary disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!!issue || update.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-ink px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            {draft ? "Save action button" : "Remove action button"}
          </button>
        </div>
      ) : null}
    </div>
  )
}

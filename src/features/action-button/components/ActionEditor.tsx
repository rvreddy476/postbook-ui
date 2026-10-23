"use client"

/*
  "Add action button": a label from the fixed list and a link, or nothing.
  One editor for the upload studio (long videos and reels), the post
  composer, the Creator Hub edit sheet and the channel's Branding page.
  The link is checked as it is typed against the server's own rules
  (model.checkActionUrl), so a shortener or a group invite is refused here,
  not by a failed publish. A saved button the author owns that is blocked
  or under review says so in plain words; a refusal from the server
  (ACTION_NOT_ELIGIBLE and the rest) is passed in and shown under it.
*/

import { AlertCircle, AlertTriangle, MousePointerClick, Trash2 } from "lucide-react"

import { useActionLabels } from "../hooks"
import { checkActionUrl, MAX_ACTION_URL_LENGTH, missingSentences, statusExplanation, type ActionDraft, type ActionLabelOption, type ActionProblem, type ActionStatus } from "../model"

export interface ActionEditorProps {
  value: ActionDraft | null
  onChange: (next: ActionDraft | null) => void
  /** The saved button's status, when the author's copy says it is not live. */
  savedStatus?: ActionStatus | null
  /** The server's last refusal of the button, shown until the button changes. */
  serverProblem?: ActionProblem | null
  disabled?: boolean
  /** Distinct ids when two editors share a page. */
  idPrefix?: string
  /** Where the button shows, for the hint: "post", "video", "reel" or "profile". */
  surface?: "post" | "video" | "reel" | "profile"
  /** Tests pass the list; the app reads GET /v1/posts/action-labels. */
  labels?: readonly ActionLabelOption[]
  /** Say an empty link is missing (after a publish attempt); otherwise only a typed link is judged. */
  showErrors?: boolean
}

const SURFACE_HINT: Record<NonNullable<ActionEditorProps["surface"]>, string> = {
  post: "A button under your post that opens a website, like Apply now or Book now.",
  video: "A button under your video that opens a website, like Apply now or Book now.",
  reel: "A button above your reel's caption that opens a website, like Apply now or Book now.",
  profile: "A button next to Follow and Message that opens a website, like Book now or Shop now.",
}

export function ActionEditor(props: ActionEditorProps) {
  const fetched = useActionLabels()
  return <ActionEditorView {...props} labels={props.labels ?? fetched} />
}

/** The editor without its label query, for hosts and tests that already hold the list. */
export function ActionEditorView({ value, onChange, savedStatus = null, serverProblem = null, disabled = false, idPrefix = "action", surface = "post", labels = [], showErrors = false }: ActionEditorProps) {
  const status = savedStatus ? statusExplanation(savedStatus) : null
  const check = value && (value.url.trim() || showErrors) ? checkActionUrl(value.url) : null
  const urlProblem = check && !check.ok ? check.message : null
  const labelId = `${idPrefix}-label`
  const urlId = `${idPrefix}-url`
  const problemId = `${idPrefix}-url-problem`

  return (
    <div data-action-editor="" className="space-y-2.5">
      {status ? (
        <div role="status" data-action-status={savedStatus ?? undefined} className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-brand-text">{status.title}</span>
            <span className="block text-xs text-muted-foreground">{status.detail}</span>
          </span>
        </div>
      ) : null}

      {value === null ? (
        <div>
          <button
            type="button"
            data-action-add=""
            disabled={disabled}
            onClick={() => onChange({ label: labels[0]?.value ?? "", url: "" })}
            className="inline-flex items-center gap-2 rounded-full border border-brand-divider px-3.5 py-2 text-sm font-semibold text-brand-text transition hover:bg-brand-secondary disabled:opacity-50"
          >
            <MousePointerClick className="h-4 w-4" aria-hidden="true" />
            Add action button
          </button>
          <p className="mt-1.5 text-xs text-muted-foreground">{SURFACE_HINT[surface]}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div>
            <label htmlFor={labelId} className="mb-1 block text-xs font-semibold text-brand-text">
              Button says
            </label>
            <select
              id={labelId}
              value={value.label}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, label: e.target.value })}
              className="h-10 w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 text-sm text-brand-text outline-hidden focus:border-primary-outline"
            >
              {labels.some((l) => l.value === value.label) ? null : <option value={value.label}>{value.label ? "A label you can't use any more" : "Choose a label"}</option>}
              {labels.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={urlId} className="mb-1 block text-xs font-semibold text-brand-text">
              Link
            </label>
            <input
              id={urlId}
              type="url"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              value={value.url}
              disabled={disabled}
              maxLength={MAX_ACTION_URL_LENGTH + 20}
              placeholder="https://"
              aria-invalid={urlProblem !== null}
              aria-describedby={urlProblem ? problemId : undefined}
              onChange={(e) => onChange({ ...value, url: e.target.value })}
              className="h-10 w-full rounded-xl border border-brand-divider bg-brand-secondary px-3 text-sm text-brand-text outline-hidden placeholder:text-muted-foreground focus:border-primary-outline"
            />
            {urlProblem ? (
              <p id={problemId} role="alert" data-action-url-problem="" className="mt-1 flex items-start gap-1.5 text-xs text-danger">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {urlProblem}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {check && check.ok ? `Viewers see it as “${labels.find((l) => l.value === value.label)?.label ?? "Your button"} · ${check.domain}” and open it through VChat's leaving page.` : "Short links and WhatsApp or Telegram group invites can't be used."}
              </p>
            )}
          </div>
          <button
            type="button"
            data-action-remove=""
            disabled={disabled}
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-brand-secondary hover:text-brand-text disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Remove action button
          </button>
        </div>
      )}

      {serverProblem ? <ActionProblemNote problem={serverProblem} /> : null}
    </div>
  )
}

/** A refusal from the server; ACTION_NOT_ELIGIBLE lists what is missing, one line each. */
export function ActionProblemNote({ problem }: { problem: ActionProblem }) {
  const missing = problem.code === "ACTION_NOT_ELIGIBLE" ? missingSentences(problem.missing) : []
  return (
    <div role="alert" data-action-problem={problem.code} className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-xs text-danger">
      {missing.length > 0 ? (
        <>
          <p className="font-semibold">You can&apos;t add an action button yet:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>{problem.message}</p>
      )}
    </div>
  )
}

/** The one-line summary for a collapsed row: "Apply now · epfindia.gov.in", or the call to add one. */
export function actionSummary(value: ActionDraft | null, labels: readonly ActionLabelOption[]): string {
  if (!value) return "Add a button that opens a website"
  const label = labels.find((l) => l.value === value.label)?.label ?? "Action button"
  const check = checkActionUrl(value.url)
  return check.ok ? `${label} · ${check.domain}` : label
}

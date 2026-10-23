"use client"

import { useId, useState } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, CheckCircle2, ShieldAlert, X } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { useRequestCopyrightReview } from "../api"
import {
  REQUEST_REVIEW_LABEL,
  REVIEW_NOTE_MAX,
  REVIEW_NOTE_PLACEHOLDER,
  copyrightReviewCopy,
  reviewNoteLength,
  reviewNoteProblem,
  reviewRequestErrorMessage,
  type CopyrightReview,
} from "../model"

import "../copyright.css"

/*
  The author's copyright title review on one video: the state's sentence,
  "Review requested <date>" once asked, and "Request review" while it is
  pending and not yet asked. Rendered on Creator Hub library rows
  (variant "row"), the edit sheet and the video's insights page.
*/

export interface CopyrightReviewNoticeProps {
  postId: string
  review: CopyrightReview
  variant?: "panel" | "row"
  /** Render the request dialog's form open, without a portal (tests). */
  defaultOpen?: boolean
}

export function CopyrightReviewNotice({ postId, review, variant = "panel", defaultOpen = false }: CopyrightReviewNoticeProps) {
  const copy = copyrightReviewCopy(review)
  const [open, setOpen] = useState(defaultOpen)
  const Icon = copy.tone === "success" ? CheckCircle2 : copy.tone === "danger" ? ShieldAlert : AlertTriangle
  return (
    <div
      className={`cr-notice${variant === "row" ? " cr-notice--row" : ""}`}
      data-tone={copy.tone}
      data-copyright-review={review.state}
      role={copy.tone === "success" ? "status" : "note"}
    >
      <Icon className="cr-notice__icon" aria-hidden="true" />
      <div className="cr-notice__text">
        <p>{copy.message}</p>
        {copy.requested ? (
          <p className="cr-notice__sub" data-review-requested>
            {copy.requested}
          </p>
        ) : null}
      </div>
      {copy.canRequest ? (
        <button type="button" className="hub-btn hub-btn-sm cr-notice__action" onClick={() => setOpen(true)} data-request-review>
          {REQUEST_REVIEW_LABEL}
        </button>
      ) : null}
      {open && copy.canRequest ? (
        defaultOpen ? (
          <RequestReviewForm postId={postId} matchedTitle={review.matchedTitle} onClose={() => setOpen(false)} />
        ) : (
          <RequestReviewDialog postId={postId} matchedTitle={review.matchedTitle} onClose={() => setOpen(false)} />
        )
      ) : null}
    </div>
  )
}

interface RequestReviewProps {
  postId: string
  matchedTitle: string
  onClose: () => void
}

/** The dialog: the form in a portal over a backdrop. */
export function RequestReviewDialog(props: RequestReviewProps) {
  if (typeof document === "undefined") return null
  return createPortal(
    <>
      <div className="hub-sheet-backdrop" onClick={props.onClose} role="presentation" />
      <RequestReviewForm {...props} />
    </>,
    document.body,
  )
}

/** The note (1–1,000 characters) and Send; POST /v1/posts/:id/copyright-review/request. */
export function RequestReviewForm({ postId, matchedTitle, onClose }: RequestReviewProps) {
  const toast = useGlobalToast()
  const titleId = useId()
  const noteId = useId()
  const [note, setNote] = useState("")
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRequestCopyrightReview()
  const problem = reviewNoteProblem(note)
  const length = reviewNoteLength(note)

  const send = () => {
    setTouched(true)
    if (problem || request.isPending) return
    setError(null)
    request.mutate(
      { postId, note },
      {
        onSuccess: () => {
          toast({ type: "success", title: "Review requested", description: "Our team will read your note when they check the video." })
          onClose()
        },
        onError: (err) => setError(reviewRequestErrorMessage(err)),
      },
    )
  }

  return (
    <div className="hub hub-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} data-request-review-dialog>
      <div className="hub-sheet-head">
        <div>
          <div className="hub-sheet-title" id={titleId}>
            {REQUEST_REVIEW_LABEL}
          </div>
          {matchedTitle ? <div className="hub-hint">It matched “{matchedTitle}”.</div> : null}
        </div>
        <button type="button" className="hub-icon-btn" aria-label="Close" onClick={onClose}>
          <X />
        </button>
      </div>
      <div className="hub-dialog-body">
        <label className="hub-label" htmlFor={noteId}>
          Why can you use it?
        </label>
        <textarea
          id={noteId}
          className="hub-textarea"
          value={note}
          placeholder={REVIEW_NOTE_PLACEHOLDER}
          maxLength={REVIEW_NOTE_MAX * 2}
          aria-invalid={touched && problem ? true : undefined}
          aria-describedby={`${noteId}-count`}
          onChange={(e) => {
            setError(null)
            setNote(e.target.value)
          }}
        />
        <div className="hub-row" style={{ justifyContent: "space-between" }}>
          <span className={`hub-hint${touched && problem ? " is-error" : ""}`}>{touched && problem ? problem : "Say how you have the rights: you made it, or you have a licence."}</span>
          <span id={`${noteId}-count`} className="hub-hint cr-count" data-over={length > REVIEW_NOTE_MAX || undefined}>
            {length.toLocaleString("en-IN")} / {REVIEW_NOTE_MAX.toLocaleString("en-IN")}
          </span>
        </div>
        {error ? (
          <div className="hub-error" role="alert">
            {error}
          </div>
        ) : null}
      </div>
      <div className="hub-sheet-foot">
        <button type="button" className="hub-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="hub-btn hub-btn-primary" disabled={request.isPending || (touched && !!problem)} onClick={send}>
          {request.isPending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  )
}

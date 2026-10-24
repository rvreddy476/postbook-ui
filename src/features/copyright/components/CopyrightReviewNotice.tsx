"use client"

import { useId, useState } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, CheckCircle2, ShieldAlert, X } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { useRequestCopyrightReview } from "../api"
import {
  APPEAL_SENT_COPY,
  ASK_FOR_REVIEW_LABEL,
  REQUEST_REVIEW_LABEL,
  REVIEW_NOTE_MAX,
  REVIEW_NOTE_PLACEHOLDER,
  REVIEW_REQUESTED_LABEL,
  copyrightReviewCopy,
  reviewFormNoteProblem,
  reviewNoteLength,
  reviewRequestErrorMessage,
  type CopyrightReview,
} from "../model"

import "../copyright.css"

/*
  The author's copyright title review on one video: the state's sentence,
  "Review requested <date>" once asked, "Request review" while it is
  pending and not yet asked, and "Ask for a review" (the block's one
  appeal, optional note) while it is blocked and the appeal is unused.
  Rendered on Creator Hub library rows (variant "row"), the edit sheet and
  the video's insights page.
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
  // A sent appeal reads "A reviewer will look at it…" until the refetch lands.
  const [appealSent, setAppealSent] = useState(false)
  const Icon = copy.tone === "success" ? CheckCircle2 : copy.tone === "danger" ? ShieldAlert : AlertTriangle
  const appeal = copy.canAppeal && !appealSent
  const offered = copy.canRequest || appeal
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
        {appealSent && copy.canAppeal ? (
          <p className="cr-notice__sub" data-review-requested>
            {REVIEW_REQUESTED_LABEL}. {APPEAL_SENT_COPY}
          </p>
        ) : copy.requested ? (
          <p className="cr-notice__sub" data-review-requested>
            {copy.requested}
          </p>
        ) : null}
      </div>
      {offered ? (
        <button
          type="button"
          className="hub-btn hub-btn-sm cr-notice__action"
          onClick={() => setOpen(true)}
          {...(appeal ? { "data-ask-for-review": true } : { "data-request-review": true })}
        >
          {appeal ? ASK_FOR_REVIEW_LABEL : REQUEST_REVIEW_LABEL}
        </button>
      ) : null}
      {open && offered ? (
        defaultOpen ? (
          <RequestReviewForm postId={postId} matchedTitle={review.matchedTitle} appeal={appeal} onClose={() => setOpen(false)} onAppealSent={() => setAppealSent(true)} />
        ) : (
          <RequestReviewDialog postId={postId} matchedTitle={review.matchedTitle} appeal={appeal} onClose={() => setOpen(false)} onAppealSent={() => setAppealSent(true)} />
        )
      ) : null}
    </div>
  )
}

interface RequestReviewProps {
  postId: string
  matchedTitle: string
  /** The block's one appeal: "Ask for a review", the note optional. */
  appeal?: boolean
  onClose: () => void
  onAppealSent?: () => void
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

/**
  The note and Send; POST /v1/posts/:id/copyright-review/request.
  A request needs 1–1,000 characters; an appeal's note is optional (up to 1,000).
*/
export function RequestReviewForm({ postId, matchedTitle, appeal = false, onClose, onAppealSent }: RequestReviewProps) {
  const toast = useGlobalToast()
  const titleId = useId()
  const noteId = useId()
  const [note, setNote] = useState("")
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRequestCopyrightReview()
  const problem = reviewFormNoteProblem(note, appeal)
  const length = reviewNoteLength(note)
  const title = appeal ? ASK_FOR_REVIEW_LABEL : REQUEST_REVIEW_LABEL
  const hint = appeal
    ? "A reviewer looks at the block again. You can ask once."
    : "Say how you have the rights: you made it, or you have a licence."

  const send = () => {
    setTouched(true)
    if (problem || request.isPending) return
    setError(null)
    request.mutate(
      { postId, note, appeal },
      {
        onSuccess: () => {
          if (appeal) {
            toast({ type: "success", title: REVIEW_REQUESTED_LABEL, description: APPEAL_SENT_COPY })
            onAppealSent?.()
          } else {
            toast({ type: "success", title: REVIEW_REQUESTED_LABEL, description: "Our team will read your note when they check the video." })
          }
          onClose()
        },
        onError: (err) => setError(reviewRequestErrorMessage(err)),
      },
    )
  }

  return (
    <div
      className="hub hub-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-request-review-dialog
      {...(appeal ? { "data-appeal": true } : {})}
    >
      <div className="hub-sheet-head">
        <div>
          <div className="hub-sheet-title" id={titleId}>
            {title}
          </div>
          {matchedTitle ? <div className="hub-hint">It matched “{matchedTitle}”.</div> : null}
        </div>
        <button type="button" className="hub-icon-btn" aria-label="Close" onClick={onClose}>
          <X />
        </button>
      </div>
      <div className="hub-dialog-body">
        <label className="hub-label" htmlFor={noteId}>
          {appeal ? "Add a note (optional)" : "Why can you use it?"}
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
          <span className={`hub-hint${touched && problem ? " is-error" : ""}`}>{touched && problem ? problem : hint}</span>
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

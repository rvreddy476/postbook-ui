"use client"

/*
  Kind messages (mechanic M13) and hide from people I know (M16).
  Presentational only, so the tests can render them; the screens and the
  messenger glue (KindChat) read the server and wire the actions.

    KindNudge:          "this might come across as unkind" over the composer,
                        with Edit and Send anyway — a note, never a block;
    KindBubbleText:     a received message's text, blurred behind "Tap to read"
                        while the check says unkind;
    BotheredPrompt:     "Did this bother you?" under such a bubble, then thanks
                        and the way to report;
    SparkNote:          a spark comment, collapsed when the filter tucked it away;
    CommentFilterForm:  the settings switch and the hidden-words editor;
    HideKnownSetting:   the settings switch and the "hidden from N" line.
*/

import { useState, type ReactNode } from "react"
import { EyeOff, Flag, HeartHandshake, MessageCircleWarning, Plus, X } from "lucide-react"

import type { HideKnown } from "../model/hideKnown"
import { HIDE_KNOWN_HELP, HIDE_KNOWN_LABEL, hideKnownLine } from "../model/hideKnown"
import {
  BLURRED_LABEL,
  BOTHERED_QUESTION,
  BOTHERED_THANKS,
  FILTER_UNKIND_HELP,
  FILTER_UNKIND_LABEL,
  KIND_NUDGE_BODY,
  KIND_NUDGE_TITLE,
  kindReasonLines,
  MAX_HIDDEN_WORDS,
  MAX_WORD_LEN,
  NOTE_HIDDEN_TITLE,
  noteHiddenLine,
  TAP_TO_READ,
  type BotheredState,
  type NoteHidden,
  type ReceivedView,
} from "../model/kindMessages"
import { Button, Notice, Toggle } from "./kit"

/* ── the composer ────────────────────────────────────────────────── */

export function KindNudge({ reasons, onEdit, onSendAnyway }: { reasons: readonly string[]; onEdit: () => void; onSendAnyway: () => void }) {
  const lines = kindReasonLines(reasons)
  return (
    <section className="pulse-kind-nudge" role="status" aria-labelledby="pulse-kind-nudge-title">
      <p id="pulse-kind-nudge-title" className="pulse-kind-nudge__title">
        <MessageCircleWarning size={16} aria-hidden="true" />
        {KIND_NUDGE_TITLE}
      </p>
      <p className="pulse-kind-nudge__body">{KIND_NUDGE_BODY}</p>
      {lines.length ? (
        <ul className="pulse-kind-nudge__reasons">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
      <div className="pulse-kind-nudge__actions">
        <Button variant="quiet" onClick={onSendAnyway}>
          Send anyway
        </Button>
        <Button variant="primary" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </section>
  )
}

/* ── a received message ──────────────────────────────────────────── */

/** The text as it is, or — unkind and not opened — blurred under "Tap to read". */
export function KindBubbleText({ view, text, onReveal }: { view: ReceivedView; text: ReactNode; onReveal: () => void }) {
  if (view !== "blurred") return <>{text}</>
  return (
    <span className="pulse-kind-blur">
      <span className="pulse-kind-blur__text" aria-hidden="true">
        {text}
      </span>
      <button
        type="button"
        className="pulse-kind-blur__reveal"
        aria-label={BLURRED_LABEL}
        onClick={(e) => {
          // The bubble's own tap opens the message actions; this one only reveals.
          e.stopPropagation()
          onReveal()
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <EyeOff size={14} aria-hidden="true" />
        {TAP_TO_READ}
      </button>
    </span>
  )
}

export function BotheredPrompt({
  state,
  name,
  canReport,
  onAnswer,
  onReport,
}: {
  state: BotheredState
  name: string
  canReport: boolean
  onAnswer: (bothered: boolean) => void
  onReport: () => void
}) {
  if (state.kind === "dismissed") return null
  if (state.kind === "thanks") {
    return (
      <div className="pulse-kind-ask" role="status">
        <HeartHandshake size={14} aria-hidden="true" />
        <p className="pulse-kind-ask__text">{BOTHERED_THANKS}</p>
        {state.offerReport && canReport ? (
          <Button variant="quiet" icon={Flag} onClick={onReport}>
            {`Report ${name}`}
          </Button>
        ) : null}
      </div>
    )
  }
  const sending = state.kind === "sending"
  return (
    <div className="pulse-kind-ask" role="group" aria-label={BOTHERED_QUESTION}>
      <p className="pulse-kind-ask__text">{BOTHERED_QUESTION}</p>
      <Button variant="quiet" busy={sending && state.answer} disabled={sending} onClick={() => onAnswer(true)}>
        Yes
      </Button>
      <Button variant="quiet" busy={sending && !state.answer} disabled={sending} onClick={() => onAnswer(false)}>
        No
      </Button>
      {state.kind === "asking" && state.error ? (
        <p className="pulse-kind-ask__error" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  )
}

/* ── spark comments ──────────────────────────────────────────────── */

/**
  A spark's comment. Tucked away by the viewer's filter, it starts collapsed
  with why; a tap opens it. The note is always the sender's own words.
*/
export function SparkNote({ note, hidden, className, defaultOpen = false }: { note: string; hidden: NoteHidden; className: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!note) return null
  if (!hidden) return <p className={className}>“{note}”</p>
  if (!open) {
    return (
      <button type="button" className="pulse-note-hidden" aria-expanded={false} onClick={() => setOpen(true)}>
        <span className="pulse-note-hidden__title">
          <EyeOff size={12} aria-hidden="true" />
          {NOTE_HIDDEN_TITLE}
        </span>
        <span className="pulse-note-hidden__why">{noteHiddenLine(hidden)}</span>
      </button>
    )
  }
  return (
    <div>
      <p className={className}>“{note}”</p>
      <p className="pulse-note-shown__why">{noteHiddenLine(hidden)}</p>
    </div>
  )
}

/* ── settings ────────────────────────────────────────────────────── */

export const WORD_INPUT_ID = "pulse-hidden-word"

export function CommentFilterForm({
  filterUnkind,
  words,
  draft,
  error,
  toggleBusy,
  saveBusy,
  dirty,
  onToggle,
  onDraft,
  onAdd,
  onRemove,
  onSave,
}: {
  filterUnkind: boolean
  /** The words on screen, saved or not. */
  words: readonly string[]
  /** The word being typed. */
  draft: string
  error: string
  toggleBusy: boolean
  saveBusy: boolean
  /** The words differ from what the server holds. */
  dirty: boolean
  onToggle: (on: boolean) => void
  onDraft: (value: string) => void
  onAdd: () => void
  onRemove: (word: string) => void
  onSave: () => void
}) {
  const full = words.length >= MAX_HIDDEN_WORDS
  return (
    <div className="pulse-stack">
      <Toggle id="pulse-filter-unkind" label={FILTER_UNKIND_LABEL} help={FILTER_UNKIND_HELP} checked={filterUnkind} disabled={toggleBusy} onChange={onToggle} />
      <form
        className="pulse-stack"
        onSubmit={(e) => {
          e.preventDefault()
          onAdd()
        }}
      >
        <div className="pulse-field">
          <label htmlFor={WORD_INPUT_ID} className="pulse-field__label">
            Words to hide
          </label>
          <p className="pulse-field__help">
            A comment using one of these stays closed until you tap it. Up to {MAX_HIDDEN_WORDS} words. {words.length}/{MAX_HIDDEN_WORDS}
          </p>
          <div className="pulse-words__add">
            <input id={WORD_INPUT_ID} className="pulse-input" type="text" maxLength={MAX_WORD_LEN} value={draft} disabled={full || saveBusy} onChange={(e) => onDraft(e.target.value)} />
            <Button type="submit" icon={Plus} disabled={full || saveBusy || !draft.trim()}>
              Add
            </Button>
          </div>
        </div>
      </form>
      {words.length ? (
        <ul className="pulse-words" aria-label="Hidden words">
          {words.map((w) => (
            <li key={w} className="pulse-word">
              <span>{w}</span>
              <button type="button" className="pulse-word__remove" aria-label={`Remove ${w}`} disabled={saveBusy} onClick={() => onRemove(w)}>
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pulse-text pulse-text--muted">No hidden words yet.</p>
      )}
      {error ? (
        <p className="pulse-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {dirty ? (
        <div className="pulse-row">
          <Button variant="primary" busy={saveBusy} onClick={onSave}>
            Save words
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function HideKnownSetting({ state, busy, error, onChange }: { state: HideKnown; busy: boolean; error: string; onChange: (on: boolean) => void }) {
  const line = hideKnownLine(state)
  return (
    <div className="pulse-stack">
      <Toggle id="pulse-hide-known" label={HIDE_KNOWN_LABEL} help={HIDE_KNOWN_HELP} checked={state.enabled} disabled={busy} onChange={onChange} />
      {line ? <p className="pulse-text pulse-text--muted">{line}</p> : null}
      {error ? <Notice tone="warning">{error}</Notice> : null}
    </div>
  )
}

"use client"

/*
  First move (mechanic M5), the presentational parts: the settings editor,
  what a match says about who starts, the opening questions to answer, and
  the free extra time. The screens own the state and the requests.
*/

import { Clock, MessageCircle, Plus, Reply, Send, X } from "lucide-react"

import { counterLine, charCount, OPENING_ANSWER_MAX, questionsChanged, questionsProblem, type FirstMoveSettings, type FirstMoveState, type OpeningQuestion } from "../model/firstMove"
import { chatHref, extendLimitLine, type ExtendLimit } from "../model/matches"
import { Button, Field, LinkButton, Notice, Toggle } from "./kit"

export const FIRST_MOVE_TITLE = "First move"
export const FIRST_MOVE_TOGGLE_LABEL = "I'll say hello first"
export const FIRST_MOVE_TOGGLE_HELP = "In new matches, the first message is yours to send. Until you write, they can answer one of your questions below or give you more time."
export const questionsHelp = (max: number) => `Up to ${max} short ${max === 1 ? "question" : "questions"} your matches can answer to open the chat. No phone numbers, emails or links.`

/* ── settings ────────────────────────────────────────────────────── */

export function FirstMoveEditor({
  settings,
  drafts,
  toggleBusy = false,
  saveBusy = false,
  error = "",
  onToggle,
  onDraft,
  onAdd,
  onRemove,
  onSave,
}: {
  settings: FirstMoveSettings
  drafts: string[]
  toggleBusy?: boolean
  saveBusy?: boolean
  /** The server's refusal, already in our words. */
  error?: string
  onToggle: (enabled: boolean) => void
  onDraft: (index: number, text: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
  onSave: () => void
}) {
  const problem = questionsProblem(drafts, settings.maxQuestions, settings.maxLength)
  const changed = questionsChanged(settings.questions, drafts)
  const full = drafts.length >= settings.maxQuestions
  return (
    <div className="pulse-stack">
      <Toggle id="pulse-first-move" label={FIRST_MOVE_TOGGLE_LABEL} help={FIRST_MOVE_TOGGLE_HELP} checked={settings.enabled} disabled={toggleBusy} onChange={onToggle} />
      <div className="pulse-stack">
        <p className="pulse-field__label">Opening questions</p>
        <p className="pulse-field__help">{questionsHelp(settings.maxQuestions)}</p>
        {drafts.length === 0 ? <p className="pulse-text pulse-text--muted">No questions yet.</p> : null}
        {drafts.map((text, i) => {
          const over = charCount(text.trim()) > settings.maxLength
          return (
            <div key={i} className="pulse-row pulse-fm-question">
              <Field id={`pulse-fm-q-${i}`} label={`Question ${i + 1}`} help={counterLine(text, settings.maxLength)} error={over ? `Keep it to ${settings.maxLength} characters.` : undefined}>
                <input id={`pulse-fm-q-${i}`} className="pulse-input" type="text" value={text} disabled={saveBusy} onChange={(e) => onDraft(i, e.target.value)} />
              </Field>
              <Button variant="quiet" icon={X} aria-label={`Remove question ${i + 1}`} disabled={saveBusy} onClick={() => onRemove(i)}>
                Remove
              </Button>
            </div>
          )
        })}
        {problem && !drafts.some((d) => charCount(d.trim()) > settings.maxLength) ? (
          <p className="pulse-field__error" role="alert">
            {problem}
          </p>
        ) : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="pulse-row">
          <Button icon={Plus} disabled={full || saveBusy} onClick={onAdd}>
            Add a question
          </Button>
          <Button variant="primary" busy={saveBusy} disabled={!changed || !!problem} onClick={onSave}>
            Save questions
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── on a match ──────────────────────────────────────────────────── */

const leftSuffix = (left: string) => (left ? ` ${left} left.` : "")

/** Who starts this match, and how long is left. Nothing for a normal match. */
export function FirstMoveStatus({ state, name }: { state: FirstMoveState; name: string }) {
  switch (state.kind) {
    case "yours":
      return (
        <Notice tone="info">
          <Clock size={14} aria-hidden="true" /> You start this one: {name} is waiting for your hello.{leftSuffix(state.left)}
        </Notice>
      )
    case "waiting":
      return (
        <Notice tone="info">
          <Clock size={14} aria-hidden="true" /> {name} starts this one.{" "}
          {state.questions.length > 0 ? "While you wait, you can answer one of their questions to open the chat." : "The chat opens when they say hello."}
          {leftSuffix(state.left)}
        </Notice>
      )
    case "expired":
      return <Notice tone="warning">This match ran out of time before anyone said hello.</Notice>
    default:
      return null
  }
}

export interface AnswerDraft {
  /** The question being answered; "" when no form is open. */
  openId: string
  text: string
  error: string
}

export const NO_ANSWER: AnswerDraft = { openId: "", text: "", error: "" }

/** The first mover's questions, each with its own Answer form; one form open at a time. */
export function OpeningQuestionList({
  questions,
  draft,
  busy = false,
  onOpen,
  onText,
  onSend,
  onCancel,
}: {
  questions: OpeningQuestion[]
  draft: AnswerDraft
  busy?: boolean
  onOpen: (questionId: string) => void
  onText: (text: string) => void
  onSend: () => void
  onCancel: () => void
}) {
  if (questions.length === 0) return null
  const over = charCount(draft.text.trim()) > OPENING_ANSWER_MAX
  return (
    <ul className="pulse-plain">
      {questions.map((q) => {
        const open = draft.openId === q.id
        return (
          <li key={q.id} className="pulse-plain__block pulse-stack">
            <p className="pulse-text">“{q.text}”</p>
            {open ? (
              <>
                <Field id={`pulse-answer-${q.id}`} label="Your answer" help={counterLine(draft.text, OPENING_ANSWER_MAX)} error={draft.error || (over ? `Keep your answer to ${OPENING_ANSWER_MAX} characters.` : undefined)}>
                  <textarea id={`pulse-answer-${q.id}`} className="pulse-input" rows={3} value={draft.text} disabled={busy} onChange={(e) => onText(e.target.value)} />
                </Field>
                <div className="pulse-row">
                  <Button variant="quiet" disabled={busy} onClick={onCancel}>
                    Cancel
                  </Button>
                  <Button variant="primary" icon={Send} busy={busy} disabled={!draft.text.trim() || over} onClick={onSend}>
                    Send answer
                  </Button>
                </div>
              </>
            ) : (
              <div className="pulse-row">
                <Button icon={Reply} disabled={busy} onClick={() => onOpen(q.id)}>
                  Answer
                </Button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** After an accepted answer: it is the first message, and the chat is open. */
export function AnswerSent({ conversationId }: { conversationId: string }) {
  return (
    <>
      <Notice tone="success">Your answer is the first message in your chat.</Notice>
      <div className="pulse-row">
        <LinkButton href={chatHref(conversationId)} variant="primary" icon={MessageCircle}>
          Open chat
        </LinkButton>
      </div>
    </>
  )
}

export const FREE_EXTEND_LABEL = "Give them 24 more hours"

/** The free extra time is used: the rule, and the local time it comes back. */
export function ExtendLimitNotice({ limit, now }: { limit: ExtendLimit; now?: Date }) {
  return <Notice tone="muted">{extendLimitLine(limit, now)}</Notice>
}

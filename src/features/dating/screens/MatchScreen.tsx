"use client"

/*
  /dating/matches/[id] — one match: the person, the countdown to the first
  message, chat, more time, unmatch, report, block.

  First move (M5): while a match waits for its first message under the rule,
  the server adds `first_move`. The person who starts gets the chat; the
  person waiting does NOT (chat-service refuses their first message), so they
  see the opening questions to answer and, once a day, free extra time.

  Calls after an exchange (M9): the server adds `can_call` while the mechanic
  is on. True draws Video call and Voice call (the app's call overlay takes
  over from there); false, one line saying when calls open; absent, nothing.

  After-date check-in (M14): while GET /date-checkins answers, a "We met"
  entry opens the sheet; ?checkin=1 (the notification's deep link) opens it
  at once. A 404 hides both.
*/

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Clock, MessageCircle, Timer, UserX } from "lucide-react"

import { Dialog } from "@/components/ui/dialog"
import { useGlobalToast } from "@/contexts/ToastContext"
import { initiateCall, subscribeToCallState } from "@/services/callService"
import type { User } from "@/types"

import { CheckinDone, CheckinEntry, CheckinForm } from "../components/DateCheckin"
import { AnswerSent, ExtendLimitNotice, FirstMoveStatus, FREE_EXTEND_LABEL, NO_ANSWER, OpeningQuestionList, type AnswerDraft } from "../components/FirstMove"
import { ErrorState, Guard } from "../components/Guard"
import { Button, Confirm, LinkButton, Loading, Notice, PageHead, Panel, StatePanel } from "../components/kit"
import { MatchCalls } from "../components/MatchExtras"
import { ReportDialog, SafetyActions } from "../components/SafetyActions"
import { useAnswerOpening, useCloseMatch, useDateCheckins, useDateFeedback, useExtendMatch, useMatch } from "../hooks/discovery"
import { useMyPremium } from "../hooks/premium"
import { checkinBody, checkinDone, checkinRefusal, chooseMet, EMPTY_CHECKIN, type CheckinDone as Done, type CheckinForm as CheckinAnswers } from "../model/dateCheckin"
import { datingErrorCopy } from "../model/errors"
import { answerRefusalRefetches, firstMoveState, openingAnswerCopy, openingAnswerProblem, type FirstMoveState, type OpeningAnswerResult } from "../model/firstMove"
import { callView, chatHref, countdown, extendedLine, isOpen, matchHref, toExtendLimit, type Countdown, type ExtendLimit, type Match } from "../model/matches"
import { personHref, type Person } from "../model/people"
import { DATING_BASE } from "../model/profile"
import { errorStatus, toDatingError } from "../model/wire"
import { PersonRow } from "./HomeScreen"

const MATCHES = `${DATING_BASE}/matches`

export function CountdownNotice({ value }: { value: Countdown }) {
  if (value.kind === "none") return null
  return (
    <Notice tone={value.kind === "expired" ? "warning" : "info"}>
      <Clock size={14} aria-hidden="true" /> {value.text}
    </Notice>
  )
}

/** Re-reads the clock once a minute while a countdown is running. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [running])
  return now
}

/**
  Which controls a match shows, decided from the server's view alone:
    chat          — a normal match, or the viewer starts; never while they wait;
    freeExtend    — the free 24 hours: only the person waiting, only while `can_extend`, pass or not;
    premiumExtend — a pass holder's 7 days, the old path: anyone not waiting, while the countdown runs.
  Once an opening answer is accepted the chat is open and nothing else shows.
*/
export interface MatchControls {
  chat: boolean
  freeExtend: boolean
  premiumExtend: boolean
}

export function matchControls(input: { open: boolean; state: FirstMoveState; left: Countdown; hasExtendFeature: boolean; answered: boolean }): MatchControls {
  const { open, state, left, hasExtendFeature, answered } = input
  if (!open) return { chat: false, freeExtend: false, premiumExtend: false }
  if (answered) return { chat: true, freeExtend: false, premiumExtend: false }
  if (state.kind === "waiting") return { chat: false, freeExtend: state.canExtend, premiumExtend: false }
  if (state.kind === "expired") return { chat: false, freeExtend: false, premiumExtend: false }
  return { chat: true, freeExtend: false, premiumExtend: left.kind === "running" && hasExtendFeature }
}

/** The person waiting: their questions to answer, the free extra time, and the limit once it's used. */
export function WaitingPanel({
  state,
  draft,
  answering,
  freeExtend,
  extending,
  limit,
  onOpen,
  onText,
  onSend,
  onCancel,
  onExtend,
}: {
  state: Extract<FirstMoveState, { kind: "waiting" }>
  draft: AnswerDraft
  answering: boolean
  freeExtend: boolean
  extending: boolean
  limit: ExtendLimit | null
  onOpen: (questionId: string) => void
  onText: (text: string) => void
  onSend: () => void
  onCancel: () => void
  onExtend: () => void
}) {
  return (
    <>
      {state.questions.length > 0 ? (
        <Panel title="Their questions" sub="Answer one and it becomes the first message in your chat.">
          <OpeningQuestionList questions={state.questions} draft={draft} busy={answering} onOpen={onOpen} onText={onText} onSend={onSend} onCancel={onCancel} />
        </Panel>
      ) : null}
      {freeExtend && !limit ? (
        <div className="pulse-row">
          <Button icon={Timer} busy={extending} onClick={onExtend}>
            {FREE_EXTEND_LABEL}
          </Button>
        </div>
      ) : null}
      {limit ? <ExtendLimitNotice limit={limit} /> : null}
    </>
  )
}

/**
  Who the call overlay rings and shows: the match's own id and first name.
  No avatar: a dating photo route needs the bearer token, which the overlay's
  plain image can't send, so it draws its initial instead.
*/
export function callContact(person: Pick<Person, "userId" | "firstName">): User {
  return { id: person.userId, name: person.firstName || "Your match", avatar: "" }
}

/** True while any call is ringing or on, so a second one isn't started from here. */
function useCallInProgress(): boolean {
  const [busy, setBusy] = useState(false)
  useEffect(() => subscribeToCallState((info) => setBusy(info !== null)), [])
  return busy
}

/**
  After-date check-in (M14): the sheet, opened by the deep link
  (?checkin=1) or by "We met". Shown only while GET /date-checkins answers
  (any failure, 404 MECHANIC_NOT_ENABLED included, hides it); a 404 on the
  answer hides it for this page too. They didn't feel safe: support, and the
  report flow with the other person as the target.
*/
function CheckinSheet({ match, name, open, onClose, onOff }: { match: Match; name: string; open: boolean; onClose: () => void; onOff: () => void }) {
  const checkins = useDateCheckins()
  const send = useDateFeedback()
  const [form, setForm] = useState<CheckinAnswers>(EMPTY_CHECKIN)
  const [error, setError] = useState("")
  const [done, setDone] = useState<Done | null>(null)
  const [reporting, setReporting] = useState(false)
  // The match's person, or the ask's when the match no longer carries them.
  const asked = checkins.data?.find((c) => c.matchId === match.id)
  const targetId = match.person?.userId || asked?.person.userId || ""
  const first = match.person?.firstName || asked?.person.firstName || ""
  const shown = first || name

  const close = () => {
    setForm(EMPTY_CHECKIN)
    setError("")
    setDone(null)
    onClose()
  }

  const submit = () => {
    const body = checkinBody(form)
    if (!body) {
      setError("Choose whether you met.")
      return
    }
    setError("")
    send.mutate(
      { matchId: match.id, body },
      {
        onSuccess: (result) => setDone(checkinDone(result)),
        onError: (e) => {
          const refusal = checkinRefusal(e)
          if (refusal === "off") {
            close()
            onOff()
          } else if (refusal === "limit") {
            setDone({ kind: "thanks", line: datingErrorCopy(e) })
          } else {
            setError(datingErrorCopy(e))
          }
        },
      },
    )
  }

  return (
    <>
      <Dialog open={open && !reporting} onClose={close} title={first ? `How did it go with ${first}?` : "How did your date go?"}>
        {done ? (
          <CheckinDone
            report={done.kind === "report"}
            line={done.kind === "thanks" ? done.line : ""}
            name={shown}
            canReport={!!targetId}
            onReport={() => setReporting(true)}
            onClose={close}
          />
        ) : (
          <CheckinForm
            name={shown}
            form={form}
            error={error}
            busy={send.isPending}
            onMet={(met) => {
              setForm((f) => chooseMet(f, met))
              setError("")
            }}
            onAgain={(again) => setForm((f) => ({ ...f, again }))}
            onSafe={(feltSafe) => setForm((f) => ({ ...f, feltSafe }))}
            onSubmit={submit}
            onCancel={close}
          />
        )}
      </Dialog>
      {targetId ? (
        <ReportDialog
          open={reporting}
          userId={targetId}
          name={shown}
          onClose={() => {
            setReporting(false)
            close()
          }}
        />
      ) : null}
    </>
  )
}

function MatchBody({ match, askCheckin = false }: { match: Match; askCheckin?: boolean }) {
  const router = useRouter()
  const toast = useGlobalToast()
  const close = useCloseMatch()
  const extend = useExtendMatch()
  const answer = useAnswerOpening()
  const me = useMyPremium()
  const [confirming, setConfirming] = useState(false)
  const [draft, setDraft] = useState<AnswerDraft>(NO_ANSWER)
  const [sent, setSent] = useState<OpeningAnswerResult | null>(null)
  const [limit, setLimit] = useState<ExtendLimit | null>(null)
  const now = useNow(!match.firstMessageAt && !!(match.expiresAt || match.firstMove?.deadline))
  const left = countdown(match, now)
  const state = firstMoveState(match, now)
  const name = match.person?.firstName || "your match"
  const open = isOpen(match)
  const controls = matchControls({ open, state, left, hasExtendFeature: me.data?.features.includes("match_extend") ?? false, answered: sent !== null })
  const calling = useCallInProgress()
  const calls = callView(match.canCall, open && !!match.person && state.kind !== "expired" && left.kind !== "expired")
  const person = match.person
  const contact = useMemo(() => (person ? callContact(person) : null), [person])
  // M14: on only while the server answers GET /date-checkins, and until an answer comes back 404.
  const checkins = useDateCheckins()
  const [checkinOff, setCheckinOff] = useState(false)
  const [sheet, setSheet] = useState(askCheckin)
  const checkinOn = checkins.isSuccess && !checkinOff
  const closeSheet = () => {
    setSheet(false)
    // Drop ?checkin=1, so a reload doesn't ask again.
    if (askCheckin) router.replace(matchHref(match.id))
  }

  const onExtend = () =>
    extend.mutate(match.id, {
      onSuccess: (r) => {
        setLimit(null)
        toast({ type: "success", title: extendedLine(r) })
      },
      onError: (e) => {
        const reached = toExtendLimit(toDatingError(e))
        if (reached) setLimit(reached)
        else toast({ type: "error", title: datingErrorCopy(e) })
      },
    })

  const onSend = () => {
    const problem = openingAnswerProblem(draft.text)
    if (problem) {
      setDraft((d) => ({ ...d, error: problem }))
      return
    }
    answer.mutate(
      { matchId: match.id, questionId: draft.openId, answer: draft.text },
      {
        onSuccess: (r) => {
          setDraft(NO_ANSWER)
          setSent({ sent: r.sent, conversationId: r.conversationId || match.conversationId })
          toast({ type: "success", title: "Answer sent" })
        },
        onError: (e) => {
          const copy = openingAnswerCopy(e)
          // The match on screen is out of date (the hook reads it again): close the form and say why.
          if (answerRefusalRefetches(toDatingError(e))) {
            setDraft(NO_ANSWER)
            toast({ type: "error", title: copy })
          } else {
            setDraft((d) => ({ ...d, error: copy }))
          }
        },
      },
    )
  }

  // A normal match keeps the plain countdown; a first-move match says who starts instead.
  const statusLine = !open ? (
    <Notice tone="muted">This match has ended.</Notice>
  ) : sent ? null : state.kind === "none" ? (
    <CountdownNotice value={left} />
  ) : (
    <FirstMoveStatus state={state} name={name} />
  )

  return (
    <>
      <ul className="pulse-list">
        <PersonRow person={match.person} href={match.person ? personHref(match.person.userId) : undefined} />
      </ul>
      {statusLine}
      {open && sent ? <AnswerSent conversationId={sent.conversationId} /> : null}
      {open && !sent && state.kind === "waiting" ? (
        <WaitingPanel
          state={state}
          draft={draft}
          answering={answer.isPending}
          freeExtend={controls.freeExtend}
          extending={extend.isPending}
          limit={limit}
          onOpen={(questionId) => setDraft({ openId: questionId, text: "", error: "" })}
          onText={(text) => setDraft((d) => ({ ...d, text, error: "" }))}
          onSend={onSend}
          onCancel={() => setDraft(NO_ANSWER)}
          onExtend={onExtend}
        />
      ) : null}
      {!sent && (controls.chat || controls.premiumExtend) ? (
        <div className="pulse-row">
          {controls.chat ? (
            <LinkButton href={chatHref(match.conversationId)} variant="primary" icon={MessageCircle}>
              {state.kind === "yours" ? "Say hello" : "Open chat"}
            </LinkButton>
          ) : null}
          {controls.premiumExtend ? (
            <Button busy={extend.isPending} onClick={onExtend}>
              Add more time
            </Button>
          ) : null}
        </div>
      ) : null}
      {contact ? <MatchCalls view={calls} name={name} busy={calling} onCall={(kind) => initiateCall(contact, kind)} /> : null}
      {checkinOn ? (
        <>
          <CheckinEntry onOpen={() => setSheet(true)} />
          <CheckinSheet match={match} name={name} open={sheet} onClose={closeSheet} onOff={() => setCheckinOff(true)} />
        </>
      ) : null}
      <Panel title="Safety" sub="Reports are confidential.">
        <div className="pulse-row">
          {open ? (
            <Button variant="quiet" icon={UserX} onClick={() => setConfirming(true)}>
              Unmatch
            </Button>
          ) : null}
          {match.person ? <SafetyActions userId={match.person.userId} name={name} onGone={() => router.replace(MATCHES)} /> : null}
        </div>
      </Panel>
      <Confirm
        open={confirming}
        title={`Unmatch ${name}?`}
        body={<p>The match and its chat close for both of you. This can&apos;t be undone.</p>}
        confirmLabel="Unmatch"
        danger
        busy={close.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          close.mutate(match.id, {
            onSuccess: () => {
              setConfirming(false)
              toast({ type: "success", title: "Unmatched" })
              router.replace(MATCHES)
            },
            onError: (e) => {
              setConfirming(false)
              toast({ type: "error", title: datingErrorCopy(e) })
            },
          })
        }
      />
    </>
  )
}

function MatchLoader({ id, askCheckin }: { id: string; askCheckin: boolean }) {
  const match = useMatch(id)
  if (match.isPending) return <Loading />
  if (match.isError && errorStatus(match.error) !== 404) return <ErrorState error={match.error} onRetry={() => void match.refetch()} />
  if (match.isError || !match.data) {
    return (
      <StatePanel icon={UserX} title="This match isn't available" body="It may have ended, or the other person has left Pulse.">
        <LinkButton href={MATCHES} variant="primary">
          Back to matches
        </LinkButton>
      </StatePanel>
    )
  }
  return <MatchBody match={match.data} askCheckin={askCheckin} />
}

/** `checkin`: opened from a check-in notification or card (?checkin=1), so the after-date sheet opens at once (M14). */
export function MatchScreen({ id, checkin = false }: { id: string; checkin?: boolean }) {
  return (
    <Guard need="ready">
      <div className="pulse-page pulse-page--narrow">
        <PageHead title="Match" back={{ href: MATCHES, label: "Matches" }} />
        <MatchLoader id={id} askCheckin={checkin} />
      </div>
    </Guard>
  )
}

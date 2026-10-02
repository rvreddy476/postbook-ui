"use client"

/*
  /dating/matches/[id] — one match: the person, the countdown to the first
  message, chat, more time, unmatch, report, block.

  First move (M5): while a match waits for its first message under the rule,
  the server adds `first_move`. The person who starts gets the chat; the
  person waiting does NOT (chat-service refuses their first message), so they
  see the opening questions to answer and, once a day, free extra time.
*/

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Clock, MessageCircle, Timer, UserX } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { AnswerSent, ExtendLimitNotice, FirstMoveStatus, FREE_EXTEND_LABEL, NO_ANSWER, OpeningQuestionList, type AnswerDraft } from "../components/FirstMove"
import { ErrorState, Guard } from "../components/Guard"
import { Button, Confirm, LinkButton, Loading, Notice, PageHead, Panel, StatePanel } from "../components/kit"
import { SafetyActions } from "../components/SafetyActions"
import { useAnswerOpening, useCloseMatch, useExtendMatch, useMatch } from "../hooks/discovery"
import { useMyPremium } from "../hooks/premium"
import { datingErrorCopy } from "../model/errors"
import { answerRefusalRefetches, firstMoveState, openingAnswerCopy, openingAnswerProblem, type FirstMoveState, type OpeningAnswerResult } from "../model/firstMove"
import { chatHref, countdown, extendedLine, isOpen, toExtendLimit, type Countdown, type ExtendLimit, type Match } from "../model/matches"
import { personHref } from "../model/people"
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

function MatchBody({ match }: { match: Match }) {
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

function MatchLoader({ id }: { id: string }) {
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
  return <MatchBody match={match.data} />
}

export function MatchScreen({ id }: { id: string }) {
  return (
    <Guard need="ready">
      <div className="pulse-page pulse-page--narrow">
        <PageHead title="Match" back={{ href: MATCHES, label: "Matches" }} />
        <MatchLoader id={id} />
      </div>
    </Guard>
  )
}

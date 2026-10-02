"use client"

/* /dating/matches/[id] — one match: the person, the countdown to the first message, chat, unmatch, report, block. */

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Clock, MessageCircle, UserX } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { ErrorState, Guard } from "../components/Guard"
import { Button, Confirm, LinkButton, Loading, Notice, PageHead, Panel, StatePanel } from "../components/kit"
import { SafetyActions } from "../components/SafetyActions"
import { useCloseMatch, useExtendMatch, useMatch } from "../hooks/discovery"
import { useMyPremium } from "../hooks/premium"
import { datingErrorCopy } from "../model/errors"
import { chatHref, countdown, isOpen, type Countdown, type Match } from "../model/matches"
import { personHref } from "../model/people"
import { DATING_BASE } from "../model/profile"
import { errorStatus } from "../model/wire"
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

function MatchBody({ match }: { match: Match }) {
  const router = useRouter()
  const toast = useGlobalToast()
  const close = useCloseMatch()
  const extend = useExtendMatch()
  const me = useMyPremium()
  const [confirming, setConfirming] = useState(false)
  const now = useNow(!match.firstMessageAt && !!match.expiresAt)
  const left = countdown(match, now)
  const name = match.person?.firstName || "your match"
  const open = isOpen(match)
  const canExtend = open && left.kind === "running" && (me.data?.features.includes("match_extend") ?? false)

  return (
    <>
      <ul className="pulse-list">
        <PersonRow person={match.person} href={match.person ? personHref(match.person.userId) : undefined} />
      </ul>
      {open ? <CountdownNotice value={left} /> : <Notice tone="muted">This match has ended.</Notice>}
      {open ? (
        <div className="pulse-row">
          <LinkButton href={chatHref(match.conversationId)} variant="primary" icon={MessageCircle}>
            Open chat
          </LinkButton>
          {canExtend ? (
            <Button
              busy={extend.isPending}
              onClick={() =>
                extend.mutate(match.id, {
                  onSuccess: (r) => toast({ type: "success", title: r.extraDays > 0 ? `${r.extraDays} more days added` : "More time added" }),
                  onError: (e) => toast({ type: "error", title: datingErrorCopy(e) }),
                })
              }
            >
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

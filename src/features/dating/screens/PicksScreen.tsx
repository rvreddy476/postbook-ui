"use client"

/*
  /dating/picks — mechanic M7. A few people chosen for the viewer each day,
  apart from the deck, the same all day and made again at local midnight.

  Decided by the server, never by this client:
    - flag off (404 MECHANIC_NOT_ENABLED): a note, and the tab goes for the
      rest of the session;
    - which people, how many (up to ten) and when new ones arrive
      (`meta.resets_at`, in the viewer's own zone);
    - every spark and pass here goes with `source: "picks"`, so it spends
      no deck card. A card leaves only after the server accepts.
*/

import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { CalendarClock, Gem } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { ErrorState, Guard } from "../components/Guard"
import { LinkButton, Loading, PageHead, Panel, StatePanel } from "../components/kit"
import { PICKS_SOURCE, PickOpen, PicksGrid, type PickAction } from "../components/PicksGrid"
import { SafetyActions } from "../components/SafetyActions"
import { usePass, usePicks, useSpark } from "../hooks/discovery"
import { KEYS, useProfileOptions } from "../hooks/profile"
import { datingErrorCopy, isMechanicOff } from "../model/errors"
import type { Person } from "../model/people"
import { picksLeft, picksResetLine } from "../model/picks"
import { DATING_BASE } from "../model/profile"
import { resetLine, type DeckCard } from "../model/pulse"
import { toSparkLimit, verdictFor, type SparkLimit } from "../model/sparks"
import { toDatingError } from "../model/wire"
import { Celebration, OutOfSparks } from "./HomeScreen"
import { Gallery, PersonDetails } from "./PersonScreen"

export const PICKS_TITLE = "Today's picks"

/** While the server's picks flag is off. */
export function PicksOff() {
  return (
    <StatePanel icon={Gem} title="Picks aren't on yet" body="For now, everyone we suggest for you is in your deck.">
      <LinkButton href={DATING_BASE} variant="primary">
        Back to the deck
      </LinkButton>
    </StatePanel>
  )
}

/** Nothing left to show: all of today's picks answered, or none made today. */
export function PicksEmpty({ answered, resetsAt }: { answered: boolean; resetsAt: string }) {
  const when = resetLine(resetsAt)
  const next = when ? `New picks arrive ${when}.` : "New picks arrive tomorrow."
  return (
    <StatePanel
      icon={CalendarClock}
      title={answered ? "You've answered today's picks" : "No picks for today"}
      body={answered ? next : `We couldn't find anyone to pick for you today. ${next}`}
    >
      <LinkButton href={DATING_BASE} variant="primary">
        Open the deck
      </LinkButton>
    </StatePanel>
  )
}

function PicksBody() {
  const router = useRouter()
  const toast = useGlobalToast()
  const qc = useQueryClient()
  const picks = usePicks()
  // Labels for interests and basics on an opened pick; a failed read just leaves them out.
  const options = useProfileOptions()
  const spark = useSpark()
  const pass = usePass()
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set())
  const [acting, setActing] = useState("")
  const [pending, setPending] = useState<PickAction | null>(null)
  const [openId, setOpenId] = useState("")
  const [limit, setLimit] = useState<SparkLimit | null>(null)
  const [celebrate, setCelebrate] = useState<{ matchId: string; person: Person } | null>(null)

  // New picks at local midnight: ask again once `resets_at` has passed.
  const resetsAt = picks.data?.resetsAt ?? ""
  const refetch = picks.refetch
  useEffect(() => {
    if (!resetsAt) return
    const wait = Date.parse(resetsAt) - Date.now()
    if (!(wait > 0) || wait > 26 * 3_600_000) return
    const timer = setTimeout(() => {
      setGone(new Set())
      setOpenId("")
      void refetch()
    }, wait + 1_000)
    return () => clearTimeout(timer)
  }, [resetsAt, refetch])

  const head = <PageHead title={PICKS_TITLE} sub={picks.data ? picksResetLine(picks.data.resetsAt) : "A few people chosen for you each day."} />
  if (picks.isPending) {
    return (
      <>
        {head}
        <Loading label="Choosing today's picks" />
      </>
    )
  }
  if (picks.isError) {
    return (
      <>
        <PageHead title={PICKS_TITLE} />
        {isMechanicOff(picks.error) ? <PicksOff /> : <ErrorState error={picks.error} onRetry={() => void picks.refetch()} />}
      </>
    )
  }

  const remove = (id: string) => setGone((s) => new Set(s).add(id))
  const cards = picksLeft(picks.data, gone)
  const open = openId ? cards.find((c) => c.candidateId === openId) : undefined

  const act = async (action: PickAction, card: DeckCard) => {
    if (acting) return
    setActing(card.candidateId)
    setPending(action)
    try {
      if (action === "spark") {
        const outcome = await spark.mutateAsync({ toUserId: card.person.userId, source: PICKS_SOURCE })
        if (outcome.matched) setCelebrate({ matchId: outcome.matchId, person: card.person })
        else toast({ type: "success", title: "Spark sent" })
      } else {
        await pass.mutateAsync({ candidateId: card.candidateId, source: PICKS_SOURCE })
      }
      remove(card.candidateId)
      setOpenId("")
      // The server takes an answered pick out of every later read.
      void qc.invalidateQueries({ queryKey: KEYS.picks })
    } catch (error) {
      const e = toDatingError(error)
      const verdict = verdictFor(e)
      if (verdict === "drop") {
        remove(card.candidateId)
        setOpenId("")
        toast({ type: "info", title: datingErrorCopy(error) })
      } else if (verdict === "limit") {
        setLimit(toSparkLimit(e))
      } else if (verdict === "onboarding") {
        router.replace(DATING_BASE)
      } else {
        toast({ type: "error", title: datingErrorCopy(error) })
      }
    } finally {
      setActing("")
      setPending(null)
    }
  }

  const actions = { acting, pending, onSpark: (c: DeckCard) => void act("spark", c), onPass: (c: DeckCard) => void act("pass", c) }

  return (
    <>
      {head}
      {limit ? <OutOfSparks limit={limit} onClose={() => setLimit(null)} /> : null}
      {open ? (
        <PickOpen
          card={open}
          {...actions}
          onBack={() => setOpenId("")}
          details={
            <>
              <Gallery person={open.person} />
              <PersonDetails person={open.person} options={options.data ?? null} />
            </>
          }
          safety={
            <Panel title="Safety" sub="Reports are confidential.">
              <SafetyActions
                userId={open.person.userId}
                name={open.person.firstName || "this person"}
                onGone={() => {
                  remove(open.candidateId)
                  setOpenId("")
                }}
              />
            </Panel>
          }
        />
      ) : cards.length === 0 ? (
        <PicksEmpty answered={gone.size > 0} resetsAt={picks.data.resetsAt} />
      ) : (
        <PicksGrid
          cards={cards}
          {...actions}
          onOpen={(c) => {
            setOpenId(c.candidateId)
            window.scrollTo?.({ top: 0 })
          }}
        />
      )}
      {celebrate ? <Celebration matchId={celebrate.matchId} person={celebrate.person} onClose={() => setCelebrate(null)} /> : null}
    </>
  )
}

export function PicksScreen() {
  return (
    <Guard need="ready">
      <div className="pulse-page">
        <PicksBody />
      </div>
    </Guard>
  )
}

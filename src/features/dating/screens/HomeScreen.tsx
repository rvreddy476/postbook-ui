"use client"

/* Home: the deck, incoming sparks, matches. One section per route; the tabs are in the frame. */

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { BadgeCheck, CalendarClock, Hourglass, Layers, MessagesSquare, Sparkles, Users } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { DatingPhoto } from "../components/DatingPhoto"
import { ErrorState } from "../components/Guard"
import { Button, Field, LinkButton, Loading, PageHead, StatePanel } from "../components/kit"
import { MatchCelebration } from "../components/MatchCelebration"
import { SwipeDeck } from "../components/SwipeDeck"
import { useAcceptSpark, useDeck, useDeclineSpark, useIncomingSparks, useMatch, useMatches, usePass, useSpark, useStash } from "../hooks/discovery"
import { datingErrorCopy } from "../model/errors"
import { SPARK_NOTE_MAX } from "../model/labels"
import { countdown, isOpen, matchHref, type Match } from "../model/matches"
import { metaLine, nameLine, personHref, type Person } from "../model/people"
import { DATING_BASE } from "../model/profile"
import { deckEmptyKind, resetLine, type Deck, type DeckCard, type DeckEmptyKind, type SwipeAction } from "../model/pulse"
import { noteProblem, sparkLimitLine, toSparkLimit, verdictFor, type IncomingSpark, type SparkLimit } from "../model/sparks"
import { toDatingError } from "../model/wire"

export type HomeSection = "deck" | "sparks" | "matches"

/* ── the celebration, with the match's conversation ──────────────── */

function Celebration({ matchId, person, onClose }: { matchId: string; person: Person | null; onClose: () => void }) {
  // The conversation is allocated right after the match forms; read it so "Say hello" can name it.
  const match = useMatch(matchId)
  return <MatchCelebration person={person ?? match.data?.person ?? null} conversationId={match.data?.conversationId ?? ""} onClose={onClose} />
}

/* ── deck ────────────────────────────────────────────────────────── */

export function DeckEmpty({ kind, deck, onLookAgain }: { kind: DeckEmptyKind; deck: Pick<Deck, "resetsAt">; onLookAgain?: () => void }) {
  if (kind === "out_for_today") {
    const when = resetLine(deck.resetsAt)
    return (
      <StatePanel
        icon={CalendarClock}
        title="You're out of cards for today"
        body={when ? `You've seen today's cards. New ones arrive ${when}.` : "You've seen today's cards. New ones arrive tomorrow."}
      >
        <LinkButton href={`${DATING_BASE}/sparks`}>See your sparks</LinkButton>
      </StatePanel>
    )
  }
  if (kind === "gathering") {
    return <StatePanel icon={Users} title="We're still gathering people near you" body="Pulse is opening area by area. Check back soon." />
  }
  return (
    <StatePanel icon={Layers} title="That's everyone for now" body="Widen your preferences, or look again in a while.">
      {onLookAgain ? (
        <Button variant="primary" onClick={onLookAgain}>
          Look again
        </Button>
      ) : null}
      <LinkButton href={`${DATING_BASE}/onboarding/preferences`}>Preferences</LinkButton>
    </StatePanel>
  )
}

export function OutOfSparks({ limit, onClose }: { limit: SparkLimit; onClose: () => void }) {
  const when = resetLine(limit.resetsAt)
  return (
    <StatePanel icon={Hourglass} tone="warning" title="You're out of sparks for now" body={`${sparkLimitLine(limit)}${when ? ` More arrive ${when}.` : " Try again later."}`}>
      <Button onClick={onClose}>Keep browsing</Button>
    </StatePanel>
  )
}

function DeckSection() {
  const router = useRouter()
  const toast = useGlobalToast()
  const deck = useDeck()
  const spark = useSpark()
  const pass = usePass()
  const stash = useStash()
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set())
  const [pending, setPending] = useState<SwipeAction | null>(null)
  const [limit, setLimit] = useState<SparkLimit | null>(null)
  const [note, setNote] = useState("")
  const [celebrate, setCelebrate] = useState<{ matchId: string; person: Person } | null>(null)

  const cards = (deck.data?.cards ?? []).filter((c) => !gone.has(c.candidateId))
  const emptied = !!deck.data && cards.length === 0 && gone.size > 0
  const refetch = deck.refetch

  // The last card left: ask again, so the empty state is the server's (and so is "out for today").
  useEffect(() => {
    if (!emptied) return
    let cancelled = false
    void refetch().then(() => {
      if (!cancelled) setGone(new Set())
    })
    return () => {
      cancelled = true
    }
  }, [emptied, refetch])

  const remove = useCallback((id: string) => setGone((s) => new Set(s).add(id)), [])

  const onAction = async (action: SwipeAction, card: DeckCard) => {
    if (action === "open") {
      router.push(personHref(card.person.userId))
      return
    }
    if (action === "super_spark") return
    if (action === "spark") {
      const problem = noteProblem(note)
      if (problem) {
        toast({ type: "error", title: problem })
        return
      }
    }
    setPending(action)
    try {
      if (action === "spark") {
        const outcome = await spark.mutateAsync({ toUserId: card.person.userId, note })
        setNote("")
        remove(card.candidateId)
        if (outcome.matched) setCelebrate({ matchId: outcome.matchId, person: card.person })
      } else if (action === "pass") {
        await pass.mutateAsync(card.candidateId)
        remove(card.candidateId)
      } else {
        await stash.mutateAsync(card.candidateId)
        remove(card.candidateId)
        toast({ type: "success", title: "Saved for later" })
      }
    } catch (error) {
      // Refused: the card was never removed, so it simply settles back.
      const e = toDatingError(error)
      const verdict = verdictFor(e)
      if (verdict === "drop") {
        remove(card.candidateId)
        toast({ type: "info", title: datingErrorCopy(error) })
      } else if (verdict === "limit") {
        setLimit(toSparkLimit(e))
      } else if (verdict === "onboarding") {
        router.replace(DATING_BASE)
      } else {
        toast({ type: "error", title: datingErrorCopy(error) })
      }
    } finally {
      setPending(null)
    }
  }

  if (deck.isPending || (emptied && deck.isFetching)) return <Loading label="Finding people" />
  if (deck.isError) return <ErrorState error={deck.error} onRetry={() => void deck.refetch()} />

  const emptyKind = deckEmptyKind(deck.data, cards.length)
  return (
    <>
      {limit ? <OutOfSparks limit={limit} onClose={() => setLimit(null)} /> : null}
      {emptyKind ? (
        <DeckEmpty kind={emptyKind} deck={deck.data} onLookAgain={() => void deck.refetch()} />
      ) : (
        <>
          <SwipeDeck cards={cards} pending={pending} onAction={onAction} />
          <div className="pulse-deck__note">
            <Field id="pulse-spark-note" label="Add a note to your spark (optional)" help="No phone numbers, emails or links.">
              <input id="pulse-spark-note" className="pulse-input" type="text" maxLength={SPARK_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </>
      )}
      {celebrate ? <Celebration matchId={celebrate.matchId} person={celebrate.person} onClose={() => setCelebrate(null)} /> : null}
    </>
  )
}

/* ── a person row, shared by sparks and matches ──────────────────── */

export function PersonRow({ person, href, note, meta, children }: { person: Person | null; href?: string; note?: string; meta?: string; children?: React.ReactNode }) {
  const name = person ? nameLine(person) : "Someone who has left Pulse"
  const facts = person ? metaLine(person) : []
  const body = (
    <>
      <DatingPhoto path={person?.photoUrl ?? ""} alt="" className="pulse-rowcard__photo" />
      <div className="pulse-rowcard__text">
        <p className="pulse-rowcard__name">
          {name}
          {person?.verified ? (
            <span className="pulse-verified" title="Verified">
              <BadgeCheck size={14} aria-hidden="true" />
              <span className="pulse-sr">Verified</span>
            </span>
          ) : null}
        </p>
        {facts.length ? <p className="pulse-rowcard__meta">{facts.join(" · ")}</p> : null}
        {meta ? <p className="pulse-rowcard__meta">{meta}</p> : null}
        {note ? <p className="pulse-rowcard__note">“{note}”</p> : null}
      </div>
    </>
  )
  return (
    <li className="pulse-rowcard">
      {href ? (
        <Link href={href} className="pulse-rowcard__main">
          {body}
        </Link>
      ) : (
        <div className="pulse-rowcard__main">{body}</div>
      )}
      {children ? <div className="pulse-rowcard__actions">{children}</div> : null}
    </li>
  )
}

/* ── sparks ──────────────────────────────────────────────────────── */

function SparksSection() {
  const toast = useGlobalToast()
  const sparks = useIncomingSparks()
  const accept = useAcceptSpark()
  const decline = useDeclineSpark()
  const [acting, setActing] = useState("")
  const [celebrate, setCelebrate] = useState<{ matchId: string; person: Person | null } | null>(null)

  if (sparks.isPending) return <Loading />
  if (sparks.isError) return <ErrorState error={sparks.error} onRetry={() => void sparks.refetch()} />

  const onAccept = (s: IncomingSpark) => {
    setActing(s.id)
    accept.mutate(s.id, {
      onSuccess: (outcome) => {
        if (outcome.matched) setCelebrate({ matchId: outcome.matchId, person: s.person })
        else toast({ type: "success", title: "Spark returned" })
      },
      onError: (e) => toast({ type: "error", title: datingErrorCopy(e) }),
      onSettled: () => setActing(""),
    })
  }
  const onDecline = (s: IncomingSpark) => {
    setActing(s.id)
    decline.mutate(s.id, {
      onError: (e) => toast({ type: "error", title: datingErrorCopy(e) }),
      onSettled: () => setActing(""),
    })
  }

  return (
    <>
      {sparks.data.length === 0 ? (
        <StatePanel icon={Sparkles} title="No sparks waiting" body="When someone sparks you, they'll show up here.">
          <LinkButton href={DATING_BASE} variant="primary">
            Open the deck
          </LinkButton>
        </StatePanel>
      ) : (
        <ul className="pulse-list">
          {sparks.data.map((s) => (
            <PersonRow key={s.id} person={s.person} href={s.person ? personHref(s.person.userId) : undefined} note={s.note}>
              <Button variant="quiet" disabled={acting === s.id} onClick={() => onDecline(s)}>
                Decline
              </Button>
              <Button variant="primary" icon={Sparkles} busy={acting === s.id && accept.isPending} disabled={acting === s.id} onClick={() => onAccept(s)}>
                Spark back
              </Button>
            </PersonRow>
          ))}
        </ul>
      )}
      {celebrate ? <Celebration matchId={celebrate.matchId} person={celebrate.person} onClose={() => setCelebrate(null)} /> : null}
    </>
  )
}

/* ── matches ─────────────────────────────────────────────────────── */

export function MatchList({ matches, nowMs }: { matches: Match[]; nowMs?: number }) {
  return (
    <ul className="pulse-list">
      {matches.map((m) => {
        const c = countdown(m, nowMs)
        return <PersonRow key={m.id} person={m.person} href={matchHref(m.id)} meta={c.kind === "none" ? "" : c.text} />
      })}
    </ul>
  )
}

function MatchesSection() {
  const matches = useMatches()
  if (matches.isPending) return <Loading />
  if (matches.isError) return <ErrorState error={matches.error} onRetry={() => void matches.refetch()} />
  const open = matches.data.filter(isOpen)
  if (open.length === 0) {
    return (
      <StatePanel icon={MessagesSquare} title="No matches yet" body="When you and someone else both spark, you'll find them here.">
        <LinkButton href={DATING_BASE} variant="primary">
          Open the deck
        </LinkButton>
      </StatePanel>
    )
  }
  return <MatchList matches={open} />
}

const TITLES: Record<HomeSection, { title: string; sub: string }> = {
  deck: { title: "Deck", sub: "Adults only. Spark the people you'd like to meet." },
  matches: { title: "Matches", sub: "People who sparked you back." },
  sparks: { title: "Sparks", sub: "People who'd like to meet you." },
}

export function HomeScreen({ section }: { section: HomeSection }) {
  const head = TITLES[section]
  return (
    <div className="pulse-page pulse-page--narrow">
      <PageHead title={head.title} sub={head.sub} />
      {section === "deck" ? <DeckSection /> : section === "sparks" ? <SparksSection /> : <MatchesSection />}
    </div>
  )
}

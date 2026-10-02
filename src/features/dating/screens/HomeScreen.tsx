"use client"

/* Home: the deck, who liked you, matches. One section per route; the tabs are in the frame. */

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { BadgeCheck, CalendarClock, Crown, Hourglass, Layers, MessagesSquare, Sparkles, Star, Undo2, Users } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { DatingPhoto } from "../components/DatingPhoto"
import { ErrorState } from "../components/Guard"
import { Button, Field, LinkButton, Loading, PageHead, StatePanel } from "../components/kit"
import { LikedYouGrid, PREMIUM_HREF } from "../components/LikedYouGrid"
import { MatchCelebration } from "../components/MatchCelebration"
import { SwipeDeck } from "../components/SwipeDeck"
import { useAcceptSpark, useAllowances, useDeck, useDeclineSpark, useLikedYou, useMatch, useMatches, usePass, useRewind, useSessionFlag, useSpark, useStash } from "../hooks/discovery"
import { leftToday, moreArrive, NO_ALLOWANCES, rewindLimitLine, rewindRefusal, showRewind, superSparkLimitLine, superSparkNote, toUsageLimit, type LastDeckAction, type UsageLimit } from "../model/allowances"
import { datingErrorCopy } from "../model/errors"
import { SPARK_NOTE_MAX } from "../model/labels"
import { isLikedYouLocked, likedYouHeadline, type LikedYouCard } from "../model/likedYou"
import { countdown, isOpen, matchHref, type Match } from "../model/matches"
import { metaLine, nameLine, personHref, type Person } from "../model/people"
import { SUPER_SPARK_PACKS_ANCHOR } from "../model/premium"
import { DATING_BASE } from "../model/profile"
import { deckEmptyKind, resetLine, type Deck, type DeckCard, type DeckEmptyKind, type SwipeAction } from "../model/pulse"
import { noteProblem, sparkLimitLine, toSparkLimit, verdictFor, type SparkLimit } from "../model/sparks"
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
        <LinkButton href={`${DATING_BASE}/sparks`}>See who liked you</LinkButton>
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
  return (
    <StatePanel icon={Hourglass} tone="warning" title="You're out of sparks for now" body={`${sparkLimitLine(limit)}${moreArrive(limit.resetsAt)}`}>
      <Button onClick={onClose}>Keep browsing</Button>
    </StatePanel>
  )
}

export function OutOfSuperSparks({ limit, onClose }: { limit: UsageLimit; onClose: () => void }) {
  return (
    <StatePanel icon={Star} tone="warning" title="You're out of Super Sparks for now" body={`${superSparkLimitLine(limit)}${moreArrive(limit.resetsAt)} A pack keeps extra ones until you use them.`}>
      <LinkButton href={`${DATING_BASE}/premium#${SUPER_SPARK_PACKS_ANCHOR}`} variant="primary" icon={Star}>
        Get a Super Spark pack
      </LinkButton>
      <Button onClick={onClose}>Keep browsing</Button>
    </StatePanel>
  )
}

export function OutOfRewinds({ limit, onClose }: { limit: UsageLimit; onClose: () => void }) {
  return (
    <StatePanel icon={Undo2} tone="warning" title="No undos left for now" body={`${rewindLimitLine(limit)}${moreArrive(limit.resetsAt)} With a pass, you can undo as often as you need.`}>
      <LinkButton href={`${DATING_BASE}/premium`} variant="primary" icon={Crown}>
        See passes
      </LinkButton>
      <Button onClick={onClose}>Keep browsing</Button>
    </StatePanel>
  )
}

/** A limit refusal with no usable details still gets its state, just without numbers. */
const usageLimitOf = (e: ReturnType<typeof toDatingError>): UsageLimit => toUsageLimit(e) ?? { limit: 0, windowHours: 0, resetsAt: "" }

function DeckSection() {
  const router = useRouter()
  const toast = useGlobalToast()
  const deck = useDeck()
  const allowances = useAllowances()
  const spark = useSpark()
  const pass = usePass()
  const stash = useStash()
  const rewind = useRewind()
  const [rewindOff, hideRewind] = useSessionFlag("rewind-off")
  const [superOff, hideSuperSpark] = useSessionFlag("super-spark-off")
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set())
  // Cards a rewind gave back, drawn on top of the deck.
  const [restored, setRestored] = useState<DeckCard[]>([])
  const [last, setLast] = useState<LastDeckAction>(null)
  const [pending, setPending] = useState<SwipeAction | null>(null)
  const [limit, setLimit] = useState<SparkLimit | null>(null)
  const [superLimit, setSuperLimit] = useState<UsageLimit | null>(null)
  const [rewindLimit, setRewindLimit] = useState<UsageLimit | null>(null)
  const [note, setNote] = useState("")
  const [celebrate, setCelebrate] = useState<{ matchId: string; person: Person } | null>(null)

  // A mechanic is on only when the allowances read lists it; no read yet, or a failed one, means off.
  const a = allowances.data ?? NO_ALLOWANCES
  const superSparkEnabled = a.superSpark !== null && !superOff
  const rewindAvailable = a.rewind !== null && !rewindOff
  const canRewind = showRewind({ rewind: a.rewind, off: rewindOff, last })

  const restoredIds = new Set(restored.map((c) => c.candidateId))
  const cards = [...restored, ...(deck.data?.cards ?? []).filter((c) => !restoredIds.has(c.candidateId))].filter((c) => !gone.has(c.candidateId))
  const emptied = !!deck.data && cards.length === 0 && gone.size > 0
  const refetch = deck.refetch

  // The last card left: ask again, so the empty state is the server's (and so is "out for today").
  useEffect(() => {
    if (!emptied) return
    let cancelled = false
    void refetch().then(() => {
      if (cancelled) return
      setGone(new Set())
      setRestored([])
    })
    return () => {
      cancelled = true
    }
  }, [emptied, refetch])

  const remove = useCallback((id: string) => setGone((s) => new Set(s).add(id)), [])

  const doRewind = async () => {
    if (pending !== null) return
    setPending("rewind")
    try {
      const result = await rewind.mutateAsync()
      // One step only: the control goes until the next pass.
      setLast(null)
      setRewindLimit(null)
      const back = result.card
      const id = back?.candidateId || result.candidateId
      setGone((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
      // With the card, it goes straight back on top; without it the hook reads the deck again.
      if (back) setRestored((list) => [back, ...list.filter((c) => c.candidateId !== back.candidateId)])
    } catch (error) {
      const e = toDatingError(error)
      const refusal = rewindRefusal(e)
      if (refusal === "out") {
        setRewindLimit(usageLimitOf(e))
      } else if (refusal === "off") {
        hideRewind()
        setLast(null)
      } else if (refusal === "nothing" || refusal === "gone") {
        setLast(null)
        toast({ type: "info", title: datingErrorCopy(error) })
      } else {
        toast({ type: "error", title: datingErrorCopy(error) })
      }
    } finally {
      setPending(null)
    }
  }

  const onAction = async (action: SwipeAction, card: DeckCard) => {
    if (action === "open") {
      router.push(personHref(card.person.userId))
      return
    }
    if (action === "rewind") {
      await doRewind()
      return
    }
    const sparking = action === "spark" || action === "super_spark"
    if (sparking) {
      const problem = noteProblem(note)
      if (problem) {
        toast({ type: "error", title: problem })
        return
      }
    }
    setPending(action)
    try {
      if (sparking) {
        const outcome = await spark.mutateAsync({ toUserId: card.person.userId, note, superSpark: action === "super_spark" })
        setNote("")
        remove(card.candidateId)
        setLast("other")
        if (outcome.matched) setCelebrate({ matchId: outcome.matchId, person: card.person })
        else if (action === "super_spark") toast({ type: "success", title: "Super Spark sent" })
      } else if (action === "pass") {
        await pass.mutateAsync(card.candidateId)
        remove(card.candidateId)
        setLast("pass")
        setRewindLimit(null)
      } else {
        await stash.mutateAsync(card.candidateId)
        remove(card.candidateId)
        setLast("other")
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
      } else if (verdict === "super_limit") {
        setSuperLimit(usageLimitOf(e))
      } else if (verdict === "onboarding") {
        router.replace(DATING_BASE)
      } else {
        // The server turned Super Spark off since the allowances read: no control for the rest of the session.
        if (action === "super_spark" && e.code === "MECHANIC_NOT_ENABLED") hideSuperSpark()
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
      {superLimit ? <OutOfSuperSparks limit={superLimit} onClose={() => setSuperLimit(null)} /> : null}
      {rewindLimit ? <OutOfRewinds limit={rewindLimit} onClose={() => setRewindLimit(null)} /> : null}
      {emptyKind ? (
        <>
          <DeckEmpty kind={emptyKind} deck={deck.data} onLookAgain={() => void deck.refetch()} />
          {canRewind ? (
            <div className="pulse-deck__undo">
              <Button icon={Undo2} busy={pending === "rewind"} onClick={() => void doRewind()} title={a.rewind ? leftToday(a.rewind) : undefined}>
                Undo last pass
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <SwipeDeck
            cards={cards}
            pending={pending}
            onAction={onAction}
            superSparkEnabled={superSparkEnabled}
            superSparkNote={a.superSpark ? superSparkNote(a.superSpark) : ""}
            rewindAvailable={rewindAvailable}
            canRewind={canRewind}
            rewindNote={a.rewind ? leftToday(a.rewind) : ""}
          />
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

export function PersonRow({
  person,
  href,
  note,
  meta,
  marker,
  highlight = false,
  children,
}: {
  person: Person | null
  href?: string
  note?: string
  meta?: string
  /** Drawn under the name, e.g. the Super Spark marker. */
  marker?: ReactNode
  highlight?: boolean
  children?: ReactNode
}) {
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
        {marker}
        {facts.length ? <p className="pulse-rowcard__meta">{facts.join(" · ")}</p> : null}
        {meta ? <p className="pulse-rowcard__meta">{meta}</p> : null}
        {note ? <p className="pulse-rowcard__note">“{note}”</p> : null}
      </div>
    </>
  )
  return (
    <li className={highlight ? "pulse-rowcard pulse-rowcard--super" : "pulse-rowcard"}>
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

/* ── liked you (mechanic M4) ─────────────────────────────────────── */

export function NoSparksYet() {
  return (
    <StatePanel icon={Sparkles} title="No sparks waiting" body="When someone sparks you, they'll show up here.">
      <LinkButton href={DATING_BASE} variant="primary">
        Open the deck
      </LinkButton>
    </StatePanel>
  )
}

/**
  The people who sparked you, as a grid. Locked, the server sends only the
  count and blurred cards, and every tile leads to a pass. If an accept comes
  back 403 LIKED_YOU_LOCKED, the hook has already switched the grid to locked
  and asked again; this only says why.
*/
function LikedYouSection() {
  const router = useRouter()
  const toast = useGlobalToast()
  const likes = useLikedYou()
  const accept = useAcceptSpark()
  const decline = useDeclineSpark()
  const [acting, setActing] = useState("")
  const [celebrate, setCelebrate] = useState<{ matchId: string; person: Person | null } | null>(null)

  const head = <PageHead title="Liked you" sub={likes.data ? likedYouHeadline(likes.data.total) : "People who'd like to meet you."} />
  if (likes.isPending || likes.isError) {
    return (
      <>
        {head}
        {likes.isPending ? <Loading /> : <ErrorState error={likes.error} onRetry={() => void likes.refetch()} />}
      </>
    )
  }

  const onOpen = (card: LikedYouCard) => {
    if (card.person) router.push(personHref(card.person.userId))
  }
  const onUpsell = () => router.push(PREMIUM_HREF)
  const onAccept = (card: LikedYouCard) => {
    setActing(card.sparkId)
    accept.mutate(card.sparkId, {
      onSuccess: (outcome) => {
        if (outcome.matched) setCelebrate({ matchId: outcome.matchId, person: card.person })
        else toast({ type: "success", title: "Spark returned" })
      },
      onError: (e) => toast({ type: isLikedYouLocked(e) ? "info" : "error", title: datingErrorCopy(e) }),
      onSettled: () => setActing(""),
    })
  }
  const onDecline = (card: LikedYouCard) => {
    setActing(card.sparkId)
    decline.mutate(card.sparkId, {
      onError: (e) => toast({ type: "error", title: datingErrorCopy(e) }),
      onSettled: () => setActing(""),
    })
  }

  return (
    <>
      {head}
      {likes.data.cards.length === 0 ? (
        <NoSparksYet />
      ) : (
        <LikedYouGrid data={likes.data} acting={acting} accepting={accept.isPending} onOpen={onOpen} onUpsell={onUpsell} onAccept={onAccept} onDecline={onDecline} />
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

const TITLES: Record<Exclude<HomeSection, "sparks">, { title: string; sub: string }> = {
  deck: { title: "Deck", sub: "Adults only. Spark the people you'd like to meet." },
  matches: { title: "Matches", sub: "People who sparked you back." },
}

export function HomeScreen({ section }: { section: HomeSection }) {
  // Liked you is a grid: the wide page, and its own header with the count.
  if (section === "sparks") {
    return (
      <div className="pulse-page">
        <LikedYouSection />
      </div>
    )
  }
  const head = TITLES[section]
  return (
    <div className="pulse-page pulse-page--narrow">
      <PageHead title={head.title} sub={head.sub} />
      {section === "deck" ? <DeckSection /> : <MatchesSection />}
    </div>
  )
}

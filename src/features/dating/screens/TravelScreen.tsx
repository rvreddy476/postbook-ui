"use client"

/*
  /dating/travel — mechanic M8. Opened from the deck and from Settings.

  Decided by the server, never by this client:
    - flag off (404 MECHANIC_NOT_ENABLED): a note, nothing is sent;
    - who may travel (`available`, or a 403 TRAVEL_REQUIRES_PASS since the
      page loaded): otherwise an upsell, with "End trip" for a trip still on
      record;
    - the cities and the longest trip.
  Starting or ending a trip refreshes the deck and the picks (the hooks do it).
*/

import { useEffect, useState } from "react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { ErrorState, Guard } from "../components/Guard"
import { Loading, Notice, PageHead } from "../components/kit"
import { TravelActive, TravelFormPanel, TravelLocked, TravelOff } from "../components/Travel"
import { useEndTravel, useStartTravel, useTravel } from "../hooks/discovery"
import { datingErrorCopy, isMechanicOff, isTravelRequiresPass } from "../model/errors"
import { DATING_BASE } from "../model/profile"
import { defaultDays, travelProblem, travelView, type TravelForm } from "../model/travel"

function TravelBody() {
  const toast = useGlobalToast()
  const travel = useTravel()
  const start = useStartTravel()
  const end = useEndTravel()
  /** null: nothing edited, so the form starts from the trip on record. */
  const [form, setForm] = useState<TravelForm | null>(null)
  const [lockedByServer, setLockedByServer] = useState(false)
  const [error, setError] = useState("")

  // A fresh read is the server's word on `available`; it replaces a lock set by a 403.
  const updatedAt = travel.dataUpdatedAt
  useEffect(() => {
    setLockedByServer(false)
  }, [updatedAt])

  if (travel.isPending) return <Loading />
  if (travel.isError) return isMechanicOff(travel.error) ? <TravelOff /> : <ErrorState error={travel.error} onRetry={() => void travel.refetch()} />

  const state = travel.data
  const view = travelView(state, lockedByServer)
  const current: TravelForm = form ?? { city: state.active?.city.code ?? "", days: defaultDays(state.maxDays) }

  const onEnd = () =>
    end.mutate(undefined, {
      onSuccess: () => {
        setForm(null)
        setError("")
        toast({ type: "success", title: "Trip ended. Your deck is back home." })
      },
      onError: (e) => toast({ type: "error", title: datingErrorCopy(e) }),
    })

  const onStart = () => {
    const problem = travelProblem(current, state)
    if (problem) {
      setError(problem)
      return
    }
    setError("")
    start.mutate(current, {
      onSuccess: (next) => {
        setForm(null)
        toast({ type: "success", title: next.active ? `You're browsing ${next.active.city.label}` : "Trip saved" })
      },
      onError: (e) => {
        if (isTravelRequiresPass(e)) setLockedByServer(true)
        setError(datingErrorCopy(e))
      },
    })
  }

  const edit = (next: TravelForm) => {
    setForm(next)
    setError("")
  }

  if (view === "locked") {
    return (
      <>
        {error ? <Notice tone="warning">{error}</Notice> : null}
        <TravelLocked trip={state.active} ending={end.isPending} onEnd={onEnd} />
      </>
    )
  }
  return (
    <>
      {view === "active" && state.active ? <TravelActive trip={state.active} ending={end.isPending} onEnd={onEnd} /> : null}
      <TravelFormPanel state={state} form={current} busy={start.isPending} error={error} changing={view === "active"} onChange={edit} onStart={onStart} />
    </>
  )
}

export function TravelScreen() {
  return (
    <Guard need="ready">
      <div className="pulse-page pulse-page--narrow">
        <PageHead title="Travel" sub="Meet people in another city before you get there." back={{ href: DATING_BASE, label: "Deck" }} />
        <TravelBody />
      </div>
    </Guard>
  )
}

"use client"

/*
  /doorstep/s/[id]/pros?option=&qty=&addon=…&female=1&address=&mode=asap&date=&sort=

  B1: the step after options + address. GET /services/{id}/professionals for
  exactly these choices at this address, scheduled (next free times, or a
  chosen day) or as soon as possible (on-duty professionals with an ETA),
  sorted by price, rating or soonest.

  Pick a professional and a time (or "now") → POST /quotes with their
  pro_id → /doorstep/checkout with the quote and the pick. ASAP with nobody
  shows the scheduled alternatives straight away; every choice stays in the
  URL, so switching mode, day or sort, or going back to change the options,
  never loses one.
*/

import { useQueryClient } from "@tanstack/react-query"
import { ReceiptText } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useRef, useState } from "react"

import { createQuote, toDoorstepError } from "../api/client"
import { useNow } from "../components/HoldCountdown"
import { DuesBanner, ErrorState, Skel, StateBlock } from "../components/parts"
import { BookingHeading } from "../components/BookingJourney"
import { ProfessionalBooking } from "../components/ProfessionalBooking"
import { keys, useAddresses, useOutstanding, useService, useServiceProfessionals } from "../hooks/queries"
import { checkoutHref, listViewFromParams, prosHref, selectionOnly, unitWord, type ListView, type ProPick, type ProListQuery } from "../model/professionals"
import { refusalLine } from "../model/refusals"
import { chosenAddonIds, chosenOption, effectiveFemalePref, quoteBody, selectionFromParams, selectionParams, selectionProblems } from "../model/selection"
import type { ProfessionalCard } from "../model/wire"
import { useCurrentLocation } from "@/features/maps/CurrentLocation"
import { sameCurrentPin } from "@/features/maps/useCurrentAddress"

export function ProfessionalsScreen({ serviceId }: { serviceId: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const qc = useQueryClient()
  const now = useNow(60_000)
  const page = useService(serviceId)
  const addresses = useAddresses()
  const { point } = useCurrentLocation()
  const outstanding = useOutstanding()
  const [busy, setBusy] = useState(false)
  const quoteInFlight = useRef(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  const service = page.data?.service
  const sel = useMemo(() => (service ? selectionFromParams(service, params) : null), [service, params])
  const view = listViewFromParams(params)
  const addressId = params.get("address") ?? ""
  const address = (addresses.data ?? []).find((a) => a.id === addressId && point && sameCurrentPin(a.lat, a.lng, point)) ?? null
  const problems = service && sel ? selectionProblems(service, sel) : []
  const female = Boolean(service && sel && effectiveFemalePref(service.category.genderRule, sel.requireFemalePro))

  const query: ProListQuery = {
    serviceId,
    optionId: sel?.optionId ?? "",
    quantity: sel?.quantity ?? 1,
    addonIds: service && sel ? chosenAddonIds(service, sel) : [],
    addressId,
    mode: view.mode,
    date: view.date,
    sort: view.sort,
    requireFemalePro: female,
  }
  const pros = useServiceProfessionals(query, Boolean(service && service.assignmentMode !== "automatic" && sel && address && !problems.length))

  const backToSheet = `/doorstep/s/${encodeURIComponent(serviceId)}?${selectionOnly(new URLSearchParams(params.toString())).toString()}`
  if (service?.assignmentMode === "automatic") return <StateBlock icon={<ReceiptText size={22} />} title="We’ll find your professional" text="Choose your service and appointment time. We’ll assign an eligible available professional at the fixed service price." action={<Link href={backToSheet} className="ds-btn ds-btn--primary">Choose date & time</Link>} />

  if (page.isLoading || addresses.isLoading) {
    return (
      <Shell back={backToSheet}>
        <div className="ds-stack">
          <Skel h={80} />
          <Skel h={140} />
          <Skel h={140} />
        </div>
      </Shell>
    )
  }
  if (page.isError || !service || !sel) return <Shell back={backToSheet}><ErrorState error={page.error} what="This service" onRetry={() => void page.refetch()} /></Shell>
  if (addresses.isError) return <Shell back={backToSheet}><ErrorState error={addresses.error} what="Your address" onRetry={() => void addresses.refetch()} /></Shell>
  if (!address || problems.length) {
    return (
      <Shell back={backToSheet}>
        <StateBlock
          icon={<ReceiptText size={22} />}
          title={!address ? "Your location changed" : "Finish your choices"}
          text={!address ? "Go back to use your current location and refresh nearby professionals." : problems[0].message}
          action={
            <Link href={backToSheet} className="ds-btn ds-btn--primary ds-btn--sm">
              Back to {service.name}
            </Link>
          }
        />
      </Shell>
    )
  }

  const opt = chosenOption(service, sel)
  const addonNames = service.addonGroups.flatMap((g) => g.addons).filter((a) => chosenAddonIds(service, sel).includes(a.id)).map((a) => a.name)
  const dues = (outstanding.data?.totalPaise ?? 0) > 0
  const setView = (v: ListView) => {
    setRefusal(null)
    router.replace(prosHref(serviceId, selectionParams(service, sel), address.id, v), { scroll: false })
  }

  const onPick = async (pick: ProPick, card: ProfessionalCard) => {
    if (quoteInFlight.current || busy || dues || outstanding.isLoading || outstanding.isError) return
    const body = quoteBody(service, sel, { lat: address.lat, lng: address.lng }, pick.proId)
    if (!body) return
    quoteInFlight.current = true
    setBusy(true)
    setRefusal(null)
    try {
      const quote = await createQuote(body)
      router.push(checkoutHref({ quoteId: quote.id, addressId: address.id, female, pick, name: card.firstName }))
    } catch (error) {
      const e = toDoorstepError(error)
      setRefusal(refusalLine(e))
      quoteInFlight.current = false
      setBusy(false)
      if (e.code === "DOORSTEP_PRICE_UNAVAILABLE" || e.code === "DOORSTEP_SLOT_TAKEN" || e.code === "DOORSTEP_SLOT_UNAVAILABLE") void qc.invalidateQueries({ queryKey: keys.allPros })
      if (e.code === "DOORSTEP_OUTSTANDING_DUE") void qc.invalidateQueries({ queryKey: keys.outstanding })
    }
  }

  const optionLabel = opt ? `${opt.name}${sel.quantity > 1 || opt.unit !== "per_job" ? ` × ${sel.quantity}${opt.unit !== "per_job" ? ` (${unitWord(opt.unit)})` : ""}` : ""}` : ""
  return <ProfessionalBooking
    service={service} optionLabel={optionLabel} addonNames={addonNames} address={address}
    female={female} backHref={backToSheet} contextKey={JSON.stringify(query)} view={view} now={now}
    list={pros.data} loading={pros.isLoading} refreshing={pros.isFetching} error={pros.error}
    busy={busy} refusal={refusal}
    blocked={dues ? "Pay your dues to book again." : outstanding.isLoading ? "Checking outstanding payments…" : outstanding.isError ? "We couldn’t check your outstanding payments. Please refresh before continuing." : null}
    notice={<><DuesBanner outstanding={outstanding.data} />{outstanding.isError && <button type="button" className="ds-btn ds-btn--outline ds-btn--sm" disabled={outstanding.isFetching} onClick={() => void outstanding.refetch()}>Retry payment check</button>}</>}
    onViewChange={setView} onRetry={() => { void pros.refetch(); if (outstanding.isError) void outstanding.refetch() }}
    onContinue={(pick, card) => void onPick(pick, card)}
  />
}

function Shell({ back, children }: { back: string; children: React.ReactNode }) {
  return <><BookingHeading active={1} title="Your professional. Your time." description="Compare prices and choose an appointment that works for you." back={back} backLabel="Back to service options" />{children}</>
}

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
import { ArrowLeft, MapPin, ReceiptText } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { createQuote, toDoorstepError } from "../api/client"
import { useNow } from "../components/HoldCountdown"
import { DuesBanner, ErrorState, Skel, StateBlock } from "../components/parts"
import { ListControls, ProList } from "../components/ProfessionalPicker"
import { keys, useAddresses, useOutstanding, useService, useServiceProfessionals } from "../hooks/queries"
import { addressLine } from "../model/address"
import { checkoutHref, listViewFromParams, prosHref, selectionOnly, unitWord, type ListView, type ProPick, type ProListQuery } from "../model/professionals"
import { refusalLine } from "../model/refusals"
import { chosenAddonIds, chosenOption, effectiveFemalePref, quoteBody, selectionFromParams, selectionParams, selectionProblems } from "../model/selection"
import type { ProfessionalCard } from "../model/wire"

export function ProfessionalsScreen({ serviceId }: { serviceId: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const qc = useQueryClient()
  const now = useNow(60_000)
  const page = useService(serviceId)
  const addresses = useAddresses()
  const outstanding = useOutstanding()
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  const service = page.data?.service
  const sel = useMemo(() => (service ? selectionFromParams(service, params) : null), [service, params])
  const view = listViewFromParams(params)
  const addressId = params.get("address") ?? ""
  const address = (addresses.data ?? []).find((a) => a.id === addressId) ?? null
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
  const pros = useServiceProfessionals(query, Boolean(service && sel && address && !problems.length))

  const backToSheet = `/doorstep/s/${encodeURIComponent(serviceId)}?${selectionOnly(new URLSearchParams(params.toString())).toString()}`

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
  if (!address || problems.length) {
    return (
      <Shell back={backToSheet}>
        <StateBlock
          icon={<ReceiptText size={22} />}
          title={!address ? "Choose your address" : "Finish your choices"}
          text={!address ? "That address is no longer saved. Go back and choose one." : problems[0].message}
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
    if (busy || dues) return
    const body = quoteBody(service, sel, { lat: address.lat, lng: address.lng }, pick.proId)
    if (!body) return
    setBusy(true)
    setRefusal(null)
    try {
      const quote = await createQuote(body)
      router.push(checkoutHref({ quoteId: quote.id, addressId: address.id, female, pick, name: card.firstName }))
    } catch (error) {
      const e = toDoorstepError(error)
      setRefusal(refusalLine(e))
      setBusy(false)
      if (e.code === "DOORSTEP_PRICE_UNAVAILABLE" || e.code === "DOORSTEP_SLOT_TAKEN" || e.code === "DOORSTEP_SLOT_UNAVAILABLE") void qc.invalidateQueries({ queryKey: keys.allPros })
      if (e.code === "DOORSTEP_OUTSTANDING_DUE") void qc.invalidateQueries({ queryKey: keys.outstanding })
    }
  }

  return (
    <Shell back={backToSheet}>
      <DuesBanner outstanding={outstanding.data} />
      <div className="ds-grid2">
        <div className="ds-stack">
          <section className="ds-card" aria-label="Find a professional">
            <ListControls view={view} onChange={setView} now={now} />
            {view.mode === "asap" ? (
              <p className="ds-note">As soon as possible: professionals on duty near you right now. Your professional is held for a few minutes while you pay, then has 3 minutes to accept.</p>
            ) : null}
          </section>
          {refusal ? (
            <p className="ds-alert" role="alert">
              {refusal}
            </p>
          ) : null}
          {dues ? <p className="ds-note">Pay your dues to book again.</p> : null}
          <ProList
            list={pros.data}
            loading={pros.isLoading}
            error={pros.error}
            onRetry={() => void pros.refetch()}
            busy={busy || dues}
            onPick={(p, c) => void onPick(p, c)}
            onSwitchToScheduled={() => setView({ ...view, mode: "scheduled", date: null })}
            emptyText={view.date ? "Nobody near you is free on this day. Try another day." : "Nobody near you offers this yet. Check again later."}
          />
        </div>

        <aside className="ds-card ds-sticky" aria-label="Your choices">
          <div className="ds-row">
            <h2 className="ds-h2 ds-grow">{service.name}</h2>
            <Link href={backToSheet} className="ds-link" style={{ fontSize: 12 }}>
              Change
            </Link>
          </div>
          <p className="ds-meta" style={{ margin: 0 }}>
            {opt ? `${opt.name}${sel.quantity > 1 || opt.unit !== "per_job" ? ` × ${sel.quantity}${opt.unit !== "per_job" ? ` (${unitWord(opt.unit)})` : ""}` : ""}` : ""}
            {addonNames.length ? ` · ${addonNames.join(", ")}` : ""}
          </p>
          <p className="ds-row" style={{ margin: 0, alignItems: "flex-start" }}>
            <MapPin size={14} aria-hidden="true" style={{ marginTop: 2, flex: "none" }} />
            <span>
              <strong>{address.label}</strong>
              <span className="ds-meta" style={{ display: "block" }}>
                {addressLine(address)}
              </span>
            </span>
          </p>
          {female ? <p className="ds-note">Women professionals only, as you asked.</p> : null}
          <p className="ds-note">Prices are each professional&apos;s own, checked by our team, and include GST. You pay online after you pick; no cash.</p>
        </aside>
      </div>
    </Shell>
  )
}

function Shell({ back, children }: { back: string; children: React.ReactNode }) {
  return (
    <>
      <div className="ds-head">
        <div className="ds-row">
          <Link href={back} className="ds-back" aria-label="Back to your choices">
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <h1 className="ds-title">Choose a professional</h1>
        </div>
      </div>
      {children}
    </>
  )
}

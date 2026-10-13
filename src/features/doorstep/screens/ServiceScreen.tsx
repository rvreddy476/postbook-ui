"use client"

import { ArrowLeft, ArrowRight, Check, Clock, Minus, Plus, ShieldCheck, ShoppingBag, Zap } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { AddressBar } from "../components/AddressBar"
import { DuesBanner, ErrorState, FromPrice, Skel } from "../components/parts"
import { StorefrontArtwork } from "../components/StorefrontArtwork"
import { BookingSteps } from "../components/BookingJourney"
import { useOutstanding, useService } from "../hooks/queries"
import { fromPriceLabel, prosHref, quantityLabel } from "../model/professionals"
import { selectionAddonNames, selectionHasApprovedPrice } from "../model/storefront"
import {
  chosenOption, femaleToggleVisible, formatDuration, genderRuleNote, groupHint, groupMax,
  isPickOne, previewDurationMinutes, selectionFromParams, selectionParams, selectionProblems,
  selectOption, setQuantity, toggleAddon, type Selection,
} from "../model/selection"
import type { Address, ListMode, ServiceDetail } from "../model/wire"
import { useCurrentAddress } from "@/features/maps/useCurrentAddress"
import { createQuote, toDoorstepError } from "../api/client"
import { quoteBody } from "../model/selection"

export function ServiceScreen({ serviceId }: { serviceId: string }) {
  const page = useService(serviceId)
  const outstanding = useOutstanding()
  return <>
    <DuesBanner outstanding={outstanding.data} />
    {page.isLoading ? <div className="dsc-home-loading"><Skel h={220} /><Skel h={260} /></div> : page.isError || !page.data ? <ErrorState error={page.error} what="This service" onRetry={() => void page.refetch()} /> :
      <ServiceEditor key={page.data.service.id} service={page.data.service} hasDues={(outstanding.data?.totalPaise ?? 0) > 0} />}
  </>
}

function ServiceEditor({ service, hasDues }: { service: ServiceDetail; hasDues: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const paramText = params.toString()
  const currentAddress = useCurrentAddress("doorstep")
  const chosen = currentAddress.data as Address | undefined
  const [selection, setSelection] = useState<Selection>(() => selectionFromParams(service, params))
  const [quoting, setQuoting] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const automatic = service.assignmentMode === "automatic"
  useEffect(() => {
    setSelection(selectionFromParams(service, new URLSearchParams(paramText)))
  }, [service.id, paramText]) // Restore the URL choices when returning from professional selection.
  const option = chosenOption(service, selection)
  const problems = selectionProblems(service, selection)
  const duration = previewDurationMinutes(service, selection)
  const rule = service.category.genderRule
  const blocked = hasDues ? "Please clear your outstanding dues before booking." : !chosen ?
    currentAddress.isError ? "We couldn’t identify your service address. Please retry below." : "Finding your service address…" : problems[0]?.message ?? null
  const go = async (mode: ListMode) => {
    if (!chosen || blocked || quoting) return
    if (automatic) {
      const body = quoteBody(service, selection, chosen, "")
      if (!body) return
      setQuoting(true); setQuoteError(null)
      try {
        const quote = await createQuote(body)
        const query = new URLSearchParams({ quote: quote.id, address: chosen.id })
        if (selection.requireFemalePro) query.set("female", "1")
        router.push(`/doorstep/checkout?${query}`)
      } catch (error) { setQuoteError(toDoorstepError(error).message); setQuoting(false) }
      return
    }
    router.push(prosHref(service.id, selectionParams(service, selection), chosen.id, { mode, date: null, sort: "price" }))
  }
  return <>
    <BookingSteps active={0} automatic={automatic} />
    <div className="dsc-breadcrumb"><Link href={`/doorstep/c/${encodeURIComponent(service.category.slug)}`}><ArrowLeft size={15} aria-hidden />{service.category.name}</Link><span aria-hidden>/</span><span>{service.name}</span></div>
    <section className="dsc-service-hero"><div><p className="dsc-eyebrow">Home comfort, taken care of</p><h1>{service.name}</h1><p>{service.description}</p><div className="dsc-service-points"><span><Check size={17} aria-hidden />Clear inclusions</span>{duration > 0 && <span><Clock size={17} aria-hidden />About {formatDuration(duration)}</span>}</div></div><StorefrontArtwork slug={service.slug} categorySlug={service.category.slug} family={service.category.family} imageUrl={service.imageUrl} /></section>
    <div className="dsc-service-layout dsc-service-layout--selection">
      <div className="dsc-service-main">
        <section className="dsc-option-section" aria-labelledby="ds-options"><div className="dsc-option-heading"><h2 id="ds-options">Choose your service option</h2><p>Select one option. You can add extras below.</p></div>
          <div className="dsc-options" role="radiogroup" aria-labelledby="ds-options">{service.options.map(o => <label key={o.id} className={selection.optionId === o.id ? "dsc-option is-selected" : "dsc-option"}>
            <input type="radio" name="doorstep-service-option" value={o.id} checked={selection.optionId === o.id} onChange={() => setSelection(selectOption(service, selection, o.id))} />
            <span className="dsc-option__body"><strong>{o.name}</strong>{o.description && <span>{o.description}</span>}<span className="dsc-service-meta"><FromPrice paise={o.fromPricePaise} unit={o.unit} fixed={automatic} />{o.durationMinutes > 0 && <span><Clock size={14} aria-hidden />{formatDuration(o.durationMinutes)}{o.unit === "per_month" ? " first visit" : ""}</span>}</span></span>
            <span className="dsc-option__check" aria-hidden><Check size={16} /></span>
          </label>)}</div>
          {option && option.maxQuantity > 1 && <div className="dsc-quantity-row"><span>{quantityLabel(option.unit)}</span><div className="ds-qty"><button type="button" aria-label="Fewer" disabled={selection.quantity <= 1} onClick={() => setSelection(setQuantity(service, selection, selection.quantity - 1))}><Minus size={16} aria-hidden /></button><span aria-live="polite">{selection.quantity}</span><button type="button" aria-label="More" disabled={selection.quantity >= option.maxQuantity} onClick={() => setSelection(setQuantity(service, selection, selection.quantity + 1))}><Plus size={16} aria-hidden /></button></div></div>}
        </section>
        {service.addonGroups.map(group => { const picked = selection.addons[group.id] ?? []; const full = !isPickOne(group) && picked.length >= groupMax(group)
          return <section className="dsc-addon-section" key={group.id} aria-labelledby={`ds-g-${group.id}`}><div className="dsc-option-heading"><h2 id={`ds-g-${group.id}`}>{group.name}</h2><p>{groupHint(group)}</p></div><div role={isPickOne(group) ? "radiogroup" : "group"} aria-labelledby={`ds-g-${group.id}`}>{group.addons.map(addon => { const on = picked.includes(addon.id); const price = fromPriceLabel(addon.fromPricePaise, undefined, automatic)
            return <label key={addon.id} className="dsc-addon"><input type={isPickOne(group) ? "radio" : "checkbox"} name={`addon-${group.id}`} checked={on} disabled={!on && full} onChange={() => setSelection(toggleAddon(group, selection, addon.id))} /><span><strong>{addon.name}</strong>{addon.description && <small>{addon.description}</small>}{addon.extraDurationMinutes > 0 && <small>+ {formatDuration(addon.extraDurationMinutes)}</small>}</span>{price && <span className="dsc-addon__price">{price}</span>}</label>
          })}</div></section>
        })}
        {(service.inclusions.length > 0 || service.exclusions.length > 0) && <section className="dsc-inclusions" aria-label="Service inclusions"><h2>What’s included</h2>{service.inclusions.length > 0 && <ul>{service.inclusions.map(text => <li key={text}><Check size={17} aria-hidden />{text}</li>)}</ul>}{service.exclusions.length > 0 && <details><summary>Not included <Plus size={16} aria-hidden /></summary><ul>{service.exclusions.map(text => <li key={text}>{text}</li>)}</ul></details>}</section>}
        {(femaleToggleVisible(rule) || genderRuleNote(rule)) && <section className="dsc-preferences" aria-label="Professional preference">{femaleToggleVisible(rule) ? <label className="ds-switch"><input type="checkbox" checked={selection.requireFemalePro} onChange={e => setSelection({ ...selection, requireFemalePro: e.target.checked })} /><span>Prefer a woman professional<small>Only matching professionals will be shown.</small></span></label> : <p>{genderRuleNote(rule)}</p>}</section>}
        <section className="dsc-questions"><h2>Good to know</h2><details><summary>How is my price confirmed?<Plus size={16} aria-hidden /></summary><p>{automatic ? "Doorstep sets one service price. Review your exact total before requesting an appointment; it does not change based on the assigned professional." : "Compare each professional’s approved price for your selection before booking."} Any additional work requires your approval.</p></details><details><summary>Can I choose a convenient time?<Plus size={16} aria-hidden /></summary><p>{automatic ? "Choose an available appointment. We’ll send your request to eligible professionals and notify you when one accepts." : "Choose from the professional’s available appointments after selecting your service."}</p></details><details><summary>Where can I get help with a booking?<Plus size={16} aria-hidden /></summary><p>Open <Link className="dsc-link" href="/doorstep/bookings">My bookings</Link> to track a service or contact support about it.</p></details></section>
      </div>
      <aside className="dsc-summary dsc-summary--selection" aria-label="Your service plan"><div className="dsc-summary__heading"><h2>Your service plan</h2><ShoppingBag size={21} aria-hidden /></div><ServicePlan service={service} selection={selection} /><AddressBar />
        <button type="button" className="ds-btn ds-btn--primary ds-btn--block" disabled={Boolean(blocked) || quoting} onClick={() => void go("scheduled")}>{quoting ? "Preparing your booking…" : automatic ? "Choose date & time" : "Choose professional & time"}<ArrowRight size={17} aria-hidden /></button>{!automatic && <button type="button" className="ds-btn ds-btn--outline ds-btn--block" disabled={Boolean(blocked)} onClick={() => void go("asap")}><Zap size={16} aria-hidden />Check availability now</button>}
        {quoteError && <p className="ds-alert" role="alert">{quoteError}</p>}
        {blocked && <p className="dsc-selection-message" role={currentAddress.isError ? "alert" : "status"}>{blocked}</p>}
        <div className="dsc-summary__foot"><ShieldCheck size={18} aria-hidden /><p>{automatic ? "One fixed price. We’ll assign an available professional. Pay only after acceptance." : "Review the professional, price and time before confirming."}</p></div>
      </aside>
    </div>
    <div className="dsc-mobile-booking"><div><strong>{option?.name ?? "Choose an option"}</strong><span>{option ? fromPriceLabel(option.fromPricePaise, option.unit, automatic) ?? "Check availability" : "Select an option above"}</span></div><button className="ds-btn ds-btn--primary" disabled={Boolean(blocked) || quoting} onClick={() => void go("scheduled")}>{quoting ? "Please wait…" : "Continue"}<ArrowRight size={16} aria-hidden /></button></div>
  </>
}

/** A selection summary, not a cart total: different minimum prices may belong to different professionals. */
export function ServicePlan({ service, selection }: { service: ServiceDetail; selection: Selection }) {
  const option = chosenOption(service, selection)
  const addonNames = selectionAddonNames(service, selection)
  const automatic = service.assignmentMode === "automatic"
  return <div className="dsc-plan"><strong>{service.name}</strong>{option && <><p>{option.name}{selection.quantity > 1 ? ` × ${selection.quantity}` : ""}</p><span>{fromPriceLabel(option.fromPricePaise, option.unit, automatic) ?? "Price not available yet"}</span></>}{addonNames.length > 0 && <ul>{addonNames.map(name => <li key={name}>{name}</li>)}</ul>}<small>{automatic ? "Review the fixed total, including selected extras, in the next step." : selectionHasApprovedPrice(service, selection) ? "Final price is confirmed after you choose your professional." : "You can check for professionals, or explore another service."}</small></div>
}

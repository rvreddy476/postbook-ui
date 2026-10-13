"use client"

import Link from "next/link"
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Check, ChevronDown, Clock3, Headphones, LockKeyhole, MapPin, ReceiptText, Search, Star, UserRound, Zap } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { GoogleLocation } from "@/features/maps/GoogleLocation"
import { addressLine } from "../model/address"
import { formatPaise } from "../model/money"
import { cardView, cityDates, listOutcome, offeredMode, pickFor, type ListView, type ProPick } from "../model/professionals"
import { DEFAULT_PRO_FILTERS, filterProfessionals, hasProfessionalFilters, professionalChoice, resolveProfessionalChoice, type ProfessionalChoice, type ProfessionalFilters } from "../model/professionalBrowse"
import { dayParts, formatSlot } from "../model/slots"
import type { Address, ListMode, ProfessionalCard, ProfessionalList, ServiceDetail } from "../model/wire"
import { BookingSteps } from "./BookingJourney"
import { categoryIcon, ErrorState, MediaImg, Skel, StateBlock } from "./parts"
import "../professional-booking.css"

export interface ProfessionalBookingProps {
  service: ServiceDetail
  optionLabel: string
  addonNames: string[]
  address: Address
  female: boolean
  backHref: string
  contextKey: string
  view: ListView
  now: number
  list: ProfessionalList | undefined
  loading: boolean
  refreshing: boolean
  error: unknown
  busy: boolean
  blocked: string | null
  refusal: string | null
  notice?: ReactNode
  onViewChange: (view: ListView) => void
  onRetry: () => void
  onContinue: (pick: ProPick, card: ProfessionalCard) => void
}

export function ProfessionalBooking(props: ProfessionalBookingProps) {
  const { service, optionLabel, addonNames, address, female, backHref, contextKey, view, now, list, loading, refreshing, error, busy, blocked, refusal, notice, onViewChange, onRetry, onContinue } = props
  const [filters, setFilters] = useState<ProfessionalFilters>(DEFAULT_PRO_FILTERS)
  const [choice, setChoice] = useState<ProfessionalChoice | null>(null)
  const [selectionMessage, setSelectionMessage] = useState("")
  const outcome = list ? listOutcome(list) : null
  const mode = outcome ? offeredMode(outcome) : view.mode
  const allCards = outcome?.kind === "cards" ? outcome.cards : outcome?.kind === "asap_none" ? outcome.alternatives : []
  const cards = filterProfessionals(allCards, mode, filters, now, list?.timezone)
  const selected = resolveProfessionalChoice(list, choice, contextKey, now)
  const stale = choice !== null && !selected && !loading && !error
  const disabled = busy || refreshing || loading || Boolean(error) || Boolean(blocked)
  const canContinue = !disabled && Boolean(selected)
  const changeView = (next: ListView) => { setChoice(null); setSelectionMessage(""); onViewChange(next) }
  const changeFilters = (next: ProfessionalFilters) => { setChoice(null); setSelectionMessage(""); setFilters(next) }
  const choose = (pick: ProPick, card: ProfessionalCard) => { setChoice(professionalChoice(pick, card, contextKey)); setSelectionMessage("") }
  const continueBooking = () => {
    if (!canContinue) return
    const current = resolveProfessionalChoice(list, choice, contextKey, Date.now())
    if (!current) { setChoice(null); setSelectionMessage("That time or price has changed. Please choose again."); onRetry(); return }
    onContinue(current.pick, current.card)
  }
  const ServiceIcon = categoryIcon(service.category.slug, service.category.family)
  const appointment = selected ? selected.pick.asap ? `Arrives in about ${selected.pick.etaMinutes} min` : formatSlot(selected.pick.slotStart, list?.timezone) : null
  const continueButton = <button type="button" className="ds-btn ds-btn--primary ds-btn--block" disabled={!canContinue} onClick={continueBooking}>{busy ? "Preparing your booking…" : "Next: Review & pay"}{!busy && <ArrowRight size={17} aria-hidden />}</button>

  return <div className="dsc-pro-booking" data-doorstep-booking="professional-dashboard-20261009">
    <div className="dsc-pro-booking__main">
      <BookingSteps active={1} />
      <Link className="dsc-pro-back" href={backHref}><ArrowLeft size={14} aria-hidden />Back to service</Link>
      <div className="dsc-pro-heading"><div><h1>Choose your professional</h1><p>Compare professionals and pick a time that works for you.</p></div><span><CalendarDays size={18} aria-hidden />Times in IST</span></div>
      {notice}
      <ProfessionalDateControls view={view} now={now} disabled={busy} onChange={changeView} />
      <div className="dsc-pro-filters" aria-label="Professional filters">
        <button type="button" className={!hasProfessionalFilters(filters) ? "is-active" : ""} aria-pressed={!hasProfessionalFilters(filters)} disabled={busy} onClick={() => changeFilters(DEFAULT_PRO_FILTERS)}>All</button>
        <FilterSelect label="Time slot" value={filters.time} disabled={busy || mode === "asap"} onChange={value => changeFilters({ ...filters, time: value as ProfessionalFilters["time"] })}><option value="any">Any time</option><option value="morning">Morning · before 12</option><option value="afternoon">Afternoon · 12–5</option><option value="evening">Evening · after 5</option></FilterSelect>
        <FilterSelect label="Price" value={filters.maxPricePaise === null ? "any" : String(filters.maxPricePaise)} disabled={busy} onChange={value => changeFilters({ ...filters, maxPricePaise: value === "any" ? null : Number(value) })}><option value="any">Any price</option><option value="50000">Up to ₹500</option><option value="100000">Up to ₹1,000</option><option value="250000">Up to ₹2,500</option><option value="500000">Up to ₹5,000</option></FilterSelect>
        <FilterSelect label="Rating" value={filters.minRating === null ? "any" : String(filters.minRating)} disabled={busy} onChange={value => changeFilters({ ...filters, minRating: value === "any" ? null : Number(value) })}><option value="any">Any rating</option><option value="4">4.0 & above</option><option value="4.5">4.5 & above</option></FilterSelect>
        <FilterSelect className="dsc-pro-sort" label="Sort by" value={view.sort} disabled={busy} onChange={sort => changeView({ ...view, sort: sort as ListView["sort"] })}><option value="price">Lowest price</option><option value="rating">Highest rated</option><option value="soonest">Soonest available</option></FilterSelect>
      </div>
      {refusal && <p className="ds-alert" role="alert">{refusal}</p>}
      {blocked && <p className="ds-alert" role="alert">{blocked}</p>}
      {selectionMessage || stale ? <p className="ds-warnbox" role="status">{selectionMessage || "Availability or price has changed. Please select a professional and time again."}</p> : null}
      {loading ? <div className="ds-stack" aria-label="Loading professionals"><Skel h={160} /><Skel h={160} /><Skel h={160} /></div> : error || !list ? <ErrorState error={error} what="Professionals" onRetry={onRetry} /> : <>
        {outcome?.kind === "asap_none" && <div className="dsc-pro-alternatives" role="status"><Clock3 size={18} aria-hidden /><div><strong>No professional is available right now.</strong><p>{allCards.length ? "You can choose one of the upcoming appointments below." : "Try a scheduled appointment instead."}</p></div><button type="button" disabled={busy} onClick={() => changeView({ ...view, mode: "scheduled", date: null })}>Choose a day</button></div>}
        <div className="dsc-pro-results" role="status"><span>{cards.length} professional{cards.length === 1 ? "" : "s"}{hasProfessionalFilters(filters) ? " match your filters" : " available"}</span><span>{refreshing ? "Updating availability…" : "Prices include GST"}</span></div>
        {cards.length ? <ul className="dsc-professional-list" aria-label="Professionals">{cards.map(card => <ProfessionalBookingCard key={card.proId} card={card} mode={mode} zone={list.timezone} oneDate={list.date !== null && outcome?.kind === "cards"} serviceName={service.name} selected={selected?.card.proId === card.proId ? selected.pick : null} disabled={disabled} onSelect={pick => choose(pick, card)} />)}</ul> : <StateBlock icon={<Search size={25} />} title={hasProfessionalFilters(filters) ? "No matches for these filters" : "No available professionals"} text={hasProfessionalFilters(filters) ? "Try a different time, price or rating." : "Try another day or check back for new availability."} action={hasProfessionalFilters(filters) ? <button type="button" className="ds-btn ds-btn--outline" onClick={() => changeFilters(DEFAULT_PRO_FILTERS)}>Clear filters</button> : <button type="button" className="ds-btn ds-btn--outline" onClick={onRetry}>Refresh availability</button>} />}
      </>}
      <div className="dsc-booking-reassurance"><span><ReceiptText size={22} aria-hidden /></span><div><strong>Know your price before you book</strong><p>Review your service, appointment and total before payment.</p></div><span className="dsc-booking-reassurance__detail"><CalendarDays size={18} aria-hidden />Manage in My bookings</span></div>
    </div>

    <aside className="dsc-pro-summary" aria-label="Your service and appointment">
      <section><div className="dsc-pro-summary__heading"><h2>Your service</h2><Link href={backHref}>Edit</Link></div><div className="dsc-pro-summary__service"><span><ServiceIcon size={34} strokeWidth={1.5} aria-hidden /></span><div><strong>{service.name}</strong><p>{optionLabel}</p></div></div>{addonNames.length > 0 && <p className="dsc-pro-summary__addons">{addonNames.join(" · ")}</p>}{female && <p className="dsc-pro-summary__addons">Woman professional requested</p>}</section>
      <section><div className="dsc-pro-summary__heading"><h2>Service location</h2><Link href={backHref}>Review</Link></div><div className="dsc-pro-location"><MapPin size={18} aria-hidden /><div><strong>{address.label}</strong><p>{addressLine(address)}</p></div></div><details className="dsc-pro-map"><summary>View location on map <ChevronDown size={15} aria-hidden /></summary><GoogleLocation point={{ lat: address.lat, lng: address.lng }} label="Your service location" intro="View your service location on Google Maps." /></details></section>
      <section className="dsc-pro-summary__appointment" aria-live="polite"><div className="dsc-pro-summary__heading"><h2>Your appointment</h2>{selected && <Check size={17} aria-hidden />}</div>{selected ? <><strong>{selected.card.firstName}</strong><p>{appointment}</p><div className="dsc-pro-summary__total"><span>Total incl. GST</span><strong>{formatPaise(selected.card.price.totalPaise)}</strong></div></> : <p>Select a professional and an available time to continue.</p>}</section>
      <section className="dsc-pro-benefits"><h2>Booking made simple</h2><p><ReceiptText size={18} aria-hidden />Clear, itemised pricing</p><p><CalendarDays size={18} aria-hidden />Choose a time that suits you</p><p><BadgeCheck size={18} aria-hidden />Manage your booking in one place</p></section>
      <Link href="/grievance" className="dsc-pro-help"><Headphones size={23} aria-hidden /><span><strong>Need help?</strong><small>Contact support</small></span><ArrowRight size={16} aria-hidden /></Link>
      <div className="dsc-pro-summary__continue">{continueButton}<p><LockKeyhole size={13} aria-hidden />You won’t be charged yet</p></div>
    </aside>
    <div className="dsc-pro-mobile-continue"><div><small>{selected ? selected.card.firstName : "Choose a professional & time"}</small><strong>{selected ? formatPaise(selected.card.price.totalPaise) : "Your appointment"}</strong></div>{continueButton}</div>
  </div>
}

function FilterSelect({ label, value, onChange, children, disabled, className = "" }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; disabled: boolean; className?: string }) {
  return <label className={`dsc-pro-filter ${className}`}><span>{label}</span><select aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>{children}</select><ChevronDown size={14} aria-hidden /></label>
}

export function ProfessionalDateControls({ view, now, disabled, onChange }: { view: ListView; now: number; disabled: boolean; onChange: (view: ListView) => void }) {
  const dates = cityDates(now, 7)
  const requestedDate = useRef(view.date)
  useEffect(() => { requestedDate.current = view.date }, [view.date])
  const chooseDate = (date: string) => {
    if (!dates.includes(date) || requestedDate.current === date) return
    requestedDate.current = date
    onChange({ ...view, date })
  }
  return <div className="dsc-pro-date-controls"><div className="dsc-pro-mode" role="group" aria-label="Appointment type"><button type="button" disabled={disabled} aria-pressed={view.mode === "scheduled"} onClick={() => onChange({ ...view, mode: "scheduled" })}><CalendarDays size={15} aria-hidden />Schedule a visit</button><button type="button" disabled={disabled} aria-pressed={view.mode === "asap"} onClick={() => onChange({ ...view, mode: "asap", date: null })}><Zap size={15} aria-hidden />As soon as possible</button></div>
    {view.mode === "scheduled" && <div className="dsc-pro-dates" role="group" aria-label="Appointment date"><button type="button" disabled={disabled} aria-pressed={view.date === null} onClick={() => onChange({ ...view, date: null })}><Clock3 size={17} aria-hidden /><span>Next available</span></button>{dates.map(date => { const day = dayParts(date); return <button type="button" key={date} disabled={disabled} aria-pressed={view.date === date} aria-label={`${day.weekday} ${day.day} ${day.month}`} onClick={() => onChange({ ...view, date })}><strong>{day.weekday}</strong><span>{day.day} {day.month}</span></button> })}<label className="dsc-pro-calendar"><CalendarDays size={18} aria-hidden /><span>Pick a date</span><input type="date" aria-label="Choose appointment date" value={view.date ?? ""} min={dates[0]} max={dates[dates.length - 1]} disabled={disabled} onInput={event => chooseDate(event.currentTarget.value)} onChange={event => chooseDate(event.target.value)} onBlur={event => chooseDate(event.target.value)} /></label></div>}
  </div>
}

export function ProfessionalBookingCard({ card, mode, zone, oneDate, serviceName, selected, disabled, onSelect }: { card: ProfessionalCard; mode: ListMode; zone: string; oneDate: boolean; serviceName: string; selected: ProPick | null; disabled: boolean; onSelect: (pick: ProPick) => void }) {
  const view = cardView(card, mode, { zone, oneDate })
  const firstTime = useRef<HTMLButtonElement>(null)
  const select = (how: { asap: true } | { slotStart: string }) => { const pick = pickFor(card, how); if (pick && !disabled) onSelect(pick) }
  return <li className={`dsc-professional${selected ? " is-selected" : ""}`}>
    <div className="dsc-professional__identity">{card.photoMediaId ? <MediaImg mediaId={card.photoMediaId} alt={card.firstName} className="dsc-professional__avatar" /> : <span className="dsc-professional__avatar" aria-hidden><UserRound size={28} /></span>}<div><h2>{card.firstName}</h2><p className="dsc-professional__rating"><Star size={14} aria-hidden />{card.ratingAvg !== null && card.ratingCount > 0 ? <><strong>{card.ratingAvg.toFixed(1)}</strong><span>({card.ratingCount} review{card.ratingCount === 1 ? "" : "s"})</span></> : <span>New professional</span>}</p><p><BadgeCheck size={13} aria-hidden />{card.jobsCompleted} completed job{card.jobsCompleted === 1 ? "" : "s"}</p><p><MapPin size={13} aria-hidden />{view.distance}</p><span className="dsc-professional__tag">{serviceName}</span></div></div>
    <div className="dsc-professional__times"><p>{mode === "asap" ? "Estimated arrival" : "Available appointments"}</p>{mode === "asap" ? <strong className="dsc-professional__eta"><Zap size={16} aria-hidden />{view.eta}</strong> : <ul aria-label={`${card.firstName}'s available times`}>{view.times.map((time, index) => <li key={time.start}><button ref={index === 0 ? firstTime : undefined} type="button" disabled={disabled} aria-pressed={Boolean(selected && !selected.asap && selected.slotStart === time.start)} onClick={() => select({ slotStart: time.start })}>{time.label}</button></li>)}</ul>}</div>
    <div className="dsc-professional__price"><strong>{view.price}</strong><small>Total incl. GST</small><button type="button" disabled={disabled || (mode === "scheduled" && !view.times.length)} className={`ds-btn ds-btn--sm ${selected ? "ds-btn--primary" : "ds-btn--outline"}`} aria-pressed={Boolean(selected)} onClick={() => mode === "asap" ? select({ asap: true }) : firstTime.current?.focus()}>{selected ? <><Check size={15} aria-hidden />Selected</> : mode === "asap" ? "Select" : "Choose time"}</button></div>
    <details className="dsc-professional__details"><summary>Price details <ChevronDown size={13} aria-hidden /></summary><ul>{view.lines.map(line => <li key={line}>{line}</li>)}</ul></details>
  </li>
}

"use client"

/*
  Travel mode (mechanic M8). Presentational only; the screen reads the
  state, sends the trip and decides `locked` from the server (`available`,
  or a 403 TRAVEL_REQUIRES_PASS since the page loaded).

    off:    the server's flag is off (404) — a note, nothing to send;
    locked: an upsell to a pass; a trip still on record can be ended;
    active: where and until when, End trip, and a form to change the trip;
    ready:  the form.
*/

import Link from "next/link"
import { Crown, Lock, MapPin, Plane, PlaneLanding, PlaneTakeoff } from "lucide-react"

import { DATING_BASE } from "../model/profile"
import { dayChoices, daysLabel, tripBanner, tripUntil, type TravelForm, type TravelState, type TravelTrip } from "../model/travel"
import { Button, Field, LinkButton, Notice, Panel, StatePanel } from "./kit"
import { PREMIUM_HREF } from "./LikedYouGrid"

export const TRAVEL_HREF = `${DATING_BASE}/travel`
export const TRAVEL_UPSELL_TITLE = "Browse another city with a pass"

/** While the server's travel flag is off. */
export function TravelOff() {
  return (
    <StatePanel icon={MapPin} title="Travel isn't on yet" body="For now, your deck shows people near where you are.">
      <LinkButton href={DATING_BASE} variant="primary">
        Back to the deck
      </LinkButton>
    </StatePanel>
  )
}

/** No pass: the way to one. A trip still on record has stopped applying, and can be ended. */
export function TravelLocked({ trip, ending = false, onEnd }: { trip: TravelTrip | null; ending?: boolean; onEnd: () => void }) {
  return (
    <div className="pulse-stack">
      <section className="pulse-upsell" aria-labelledby="pulse-travel-upsell-title">
        <span className="pulse-upsell__icon" aria-hidden="true">
          <Lock size={18} />
        </span>
        <div className="pulse-upsell__text">
          <h2 id="pulse-travel-upsell-title" className="pulse-upsell__title">
            {TRAVEL_UPSELL_TITLE}
          </h2>
          <p className="pulse-upsell__body">Pick a city and see the people there for up to a week, before you arrive. Your real location stays private.</p>
        </div>
        <LinkButton href={PREMIUM_HREF} variant="primary" icon={Crown}>
          See passes
        </LinkButton>
      </section>
      {trip ? (
        <Panel title={`Your trip to ${trip.city.label} is on hold`} sub="It applies again while you have a pass, until it ends.">
          <Button icon={PlaneLanding} busy={ending} onClick={onEnd}>
            End trip
          </Button>
        </Panel>
      ) : null}
    </div>
  )
}

/** The trip in effect. */
export function TravelActive({ trip, ending = false, onEnd }: { trip: TravelTrip; ending?: boolean; onEnd: () => void }) {
  const until = tripUntil(trip.endsAt)
  return (
    <Panel title={`You're browsing ${trip.city.label}`} sub={until ? `Your deck and picks show people there until ${until}.` : "Your deck and picks show people there."}>
      <div className="pulse-row">
        <LinkButton href={DATING_BASE} variant="primary">
          Open the deck
        </LinkButton>
        <Button icon={PlaneLanding} busy={ending} onClick={onEnd}>
          End trip
        </Button>
      </div>
    </Panel>
  )
}

/** Choose a city and how long; the cities and the longest trip are the server's. */
export function TravelFormPanel({
  state,
  form,
  busy = false,
  error = "",
  changing = false,
  onChange,
  onStart,
}: {
  state: Pick<TravelState, "cities" | "maxDays">
  form: TravelForm
  busy?: boolean
  error?: string
  /** A trip is on: this replaces it. */
  changing?: boolean
  onChange: (form: TravelForm) => void
  onStart: () => void
}) {
  return (
    <Panel title={changing ? "Change your trip" : "Plan a trip"} sub={`Up to ${daysLabel(state.maxDays)}. Starting a trip ${changing ? "replaces the one you're on" : "moves your deck to that city"}.`}>
      <form
        className="pulse-form"
        onSubmit={(e) => {
          e.preventDefault()
          onStart()
        }}
      >
        <Field id="pulse-travel-city" label="City">
          <select id="pulse-travel-city" className="pulse-input" value={form.city} onChange={(e) => onChange({ ...form, city: e.target.value })}>
            <option value="">Choose a city</option>
            {state.cities.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="pulse-travel-days" label="How long">
          <select id="pulse-travel-days" className="pulse-input" value={String(form.days)} onChange={(e) => onChange({ ...form, days: Number(e.target.value) || 1 })}>
            {dayChoices(state.maxDays).map((d) => (
              <option key={d} value={String(d)}>
                {daysLabel(d)}
              </option>
            ))}
          </select>
        </Field>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button type="submit" variant="primary" icon={PlaneTakeoff} busy={busy}>
          Start trip
        </Button>
      </form>
    </Panel>
  )
}

/** On the deck while a trip is in effect. */
export function TripBanner({ trip }: { trip: TravelTrip }) {
  return (
    <div className="pulse-notice pulse-tone--info pulse-trip" role="status">
      <Plane size={16} aria-hidden="true" />
      <span className="pulse-trip__text">{tripBanner(trip)}</span>
      <Link href={TRAVEL_HREF} className="pulse-trip__link">
        Manage
      </Link>
    </div>
  )
}

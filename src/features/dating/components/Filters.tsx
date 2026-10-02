"use client"

/*
  Filters (mechanic M6). Presentational only; the screen holds the form,
  saves it, and decides `locked` from the server (`pass_filters.active`, or a
  403 FILTERS_REQUIRE_PASS since the page loaded).

  For everyone: the age range, how far to look (a bucket, never a figure)
  and what people are looking for. With a pass: verified only, height,
  languages and the lifestyle basics. Locked, those controls stay visible
  but switched off under an upsell; filters saved earlier can still be
  cleared.
*/

import { Crown, Eraser, Lock, SlidersHorizontal } from "lucide-react"

import { INTENT_OPTIONS, PREFERENCE_LIMITS } from "../model/labels"
import { heightChoices, LIFESTYLE_FIELDS, LIFESTYLE_TITLES, toggleCode, type ProfileOptions } from "../model/options"
import { DATING_BASE, type AboutProblem, type FiltersForm } from "../model/profile"
import { Button, Choices, Field, LinkButton, Notice, Panel, StatePanel, Toggle } from "./kit"
import { PREMIUM_HREF } from "./LikedYouGrid"

export const FILTERS_HREF = `${DATING_BASE}/filters`
export const FILTERS_UPSELL_TITLE = "Narrow your deck with a pass"

/** Over the locked pass section. */
export function FiltersUpsell() {
  return (
    <section className="pulse-upsell" aria-labelledby="pulse-filters-upsell-title">
      <span className="pulse-upsell__icon" aria-hidden="true">
        <Lock size={18} />
      </span>
      <div className="pulse-upsell__text">
        <h3 id="pulse-filters-upsell-title" className="pulse-upsell__title">
          {FILTERS_UPSELL_TITLE}
        </h3>
        <p className="pulse-upsell__body">Choose by height, languages and lifestyle, or see verified people only. Age, distance and what people are looking for stay free.</p>
      </div>
      <LinkButton href={PREMIUM_HREF} variant="primary" icon={Crown}>
        See passes
      </LinkButton>
    </section>
  )
}

/** While the server's filters flag is off. */
export function FiltersOff() {
  return (
    <StatePanel icon={SlidersHorizontal} title="Filters aren't on yet" body="For now, your preferences decide who's in your deck.">
      <LinkButton href={`${DATING_BASE}/onboarding/preferences`} variant="primary">
        Preferences
      </LinkButton>
    </StatePanel>
  )
}

const ANY = "Any"

export function FiltersPanel({
  options,
  form,
  locked,
  savedPass,
  busy,
  clearing,
  error,
  fieldError,
  onChange,
  onSave,
  onClear,
}: {
  options: ProfileOptions
  form: FiltersForm
  /** No pass: the pass section is switched off. */
  locked: boolean
  /** Pass filters are saved on the server (they can be cleared, pass or not). */
  savedPass: boolean
  busy: boolean
  clearing: boolean
  error: string
  fieldError: AboutProblem | null
  onChange: (next: FiltersForm) => void
  onSave: () => void
  onClear: () => void
}) {
  const L = PREFERENCE_LIMITS
  const errorFor = (...fields: string[]) => (fieldError && fields.includes(fieldError.field) ? fieldError.message : undefined)
  const set = <K extends keyof FiltersForm>(key: K, value: FiltersForm[K]) => onChange({ ...form, [key]: value })
  const heights = heightChoices(options)

  return (
    <form
      className="pulse-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSave()
      }}
    >
      <Panel title="For everyone">
        <div className="pulse-form__pair">
          <Field id="pulse-filter-min-age" label="Youngest age" error={errorFor("min_age")}>
            <input id="pulse-filter-min-age" className="pulse-input" type="number" inputMode="numeric" min={L.minAge} max={L.maxAge} value={form.minAge} onChange={(e) => set("minAge", Number(e.target.value))} />
          </Field>
          <Field id="pulse-filter-max-age" label="Oldest age" error={errorFor("max_age")}>
            <input id="pulse-filter-max-age" className="pulse-input" type="number" inputMode="numeric" min={L.minAge} max={L.maxAge} value={form.maxAge} onChange={(e) => set("maxAge", Number(e.target.value))} />
          </Field>
        </div>
        <Choices
          name="distance-bucket"
          legend="How far to look"
          help="Nobody is ever shown an exact distance."
          options={options.distanceBuckets}
          value={form.distanceBucket}
          onChange={(v) => set("distanceBucket", v)}
          error={errorFor("distance_bucket")}
        />
        <Choices name="filter-intent" legend="Looking for (optional, pick any)" options={INTENT_OPTIONS} value={form.intentFilter} multiple onChange={(v) => set("intentFilter", toggleCode(form.intentFilter, v))} />
      </Panel>

      <Panel title="With a pass" sub={locked ? undefined : "Your pass is active, so these shape your deck."}>
        {locked ? <FiltersUpsell /> : null}
        {locked && savedPass ? (
          <div className="pulse-stack">
            <Notice tone="muted">You set some of these earlier. They&apos;re kept, but they don&apos;t change your deck until you have a pass.</Notice>
            <div>
              <Button icon={Eraser} busy={clearing} disabled={busy} onClick={onClear}>
                Clear pass filters
              </Button>
            </div>
          </div>
        ) : null}
        <fieldset className="pulse-filters__pass" disabled={locked || undefined} aria-describedby={locked ? "pulse-filters-upsell-title" : undefined}>
          <legend className="pulse-sr">Filters that come with a pass</legend>
          <Toggle id="pulse-filter-verified" label="Verified people only" help="Only people who passed the face check." checked={form.verifiedOnly} disabled={locked} onChange={(v) => set("verifiedOnly", v)} />
          <div className="pulse-form__pair">
            <Field id="pulse-filter-min-height" label="Shortest" error={errorFor("min_height_cm")}>
              <select id="pulse-filter-min-height" className="pulse-input" value={form.minHeightCm ? String(form.minHeightCm) : ""} onChange={(e) => set("minHeightCm", Number(e.target.value) || 0)}>
                <option value="">{ANY}</option>
                {heights.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="pulse-filter-max-height" label="Tallest" error={errorFor("max_height_cm")}>
              <select id="pulse-filter-max-height" className="pulse-input" value={form.maxHeightCm ? String(form.maxHeightCm) : ""} onChange={(e) => set("maxHeightCm", Number(e.target.value) || 0)}>
                <option value="">{ANY}</option>
                {heights.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Choices name="filter-languages" legend="Speaks any of" options={options.languages} value={form.languages} multiple onChange={(v) => set("languages", toggleCode(form.languages, v))} error={errorFor("languages")} />
          {LIFESTYLE_FIELDS.map((field) => (
            <Choices
              key={field}
              name={`filter-${field}`}
              legend={`${LIFESTYLE_TITLES[field]} (pick any)`}
              options={options[field]}
              value={form[field]}
              multiple
              onChange={(v) => set(field, toggleCode(form[field], v))}
              error={errorFor(field)}
            />
          ))}
        </fieldset>
      </Panel>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button variant="primary" type="submit" icon={SlidersHorizontal} busy={busy && !clearing} disabled={clearing}>
        Save filters
      </Button>
    </form>
  )
}

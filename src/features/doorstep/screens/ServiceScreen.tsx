"use client"

/*
  /doorstep/s/[id] — one service: options (each with its unit and the
  lowest approved professional price), quantity (hours or months where the
  unit says so), add-ons (with each group's min/max), duration, what's
  included, and "require a woman professional" where the category allows it.

  B1: professionals set their own prices, so nothing is totalled here.
  Continue → the professionals list for exactly these choices at the chosen
  address (/doorstep/s/[id]/pros, scheduled or as soon as possible). The
  choices travel in the URL, and coming back here with them restores them.
*/

import { ArrowLeft, Check, Clock, Minus, Plus, X, Zap } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { AddressBar } from "../components/AddressBar"
import { DuesBanner, ErrorState, FromPrice, Skel } from "../components/parts"
import { useChosenAddress, useOutstanding, useService } from "../hooks/queries"
import { fromPriceLabel, prosHref, quantityLabel, unitWord } from "../model/professionals"
import {
  chosenOption,
  femaleToggleVisible,
  formatDuration,
  genderRuleNote,
  groupHint,
  groupMax,
  isPickOne,
  previewDurationMinutes,
  selectionFromParams,
  selectionParams,
  selectionProblems,
  selectOption,
  setQuantity,
  toggleAddon,
  type Selection,
} from "../model/selection"
import type { ListMode } from "../model/wire"

export function ServiceScreen({ serviceId }: { serviceId: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const page = useService(serviceId)
  const outstanding = useOutstanding()
  const { chosen } = useChosenAddress()
  const [sel, setSel] = useState<Selection | null>(null)

  const service = page.data?.service
  useEffect(() => {
    if (service && !sel) setSel(selectionFromParams(service, params))
  }, [service, sel, params])

  if (page.isLoading || (service && !sel)) {
    return (
      <div className="ds-grid2">
        <div className="ds-stack">
          <Skel h={24} w="40%" />
          <Skel h={140} />
          <Skel h={120} />
        </div>
        <Skel h={200} />
      </div>
    )
  }
  if (page.isError || !service || !sel) return <ErrorState error={page.error} what="This service" onRetry={() => void page.refetch()} />

  const opt = chosenOption(service, sel)
  const problems = selectionProblems(service, sel)
  const duration = previewDurationMinutes(service, sel)
  const rule = service.category.genderRule
  const dues = (outstanding.data?.totalPaise ?? 0) > 0
  const blocked = dues ? "Pay your dues to book again." : !chosen ? "Add your address first." : problems[0]?.message ?? null

  const go = (mode: ListMode) => {
    if (!chosen || blocked) return
    router.push(prosHref(service.id, selectionParams(service, sel), chosen.id, { mode, date: null, sort: "price" }))
  }

  return (
    <>
      <div className="ds-head">
        <div className="ds-row">
          <Link href={`/doorstep/c/${encodeURIComponent(service.category.slug)}`} className="ds-back" aria-label={`Back to ${service.category.name}`}>
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div className="ds-grow">
            <h1 className="ds-title">{service.name}</h1>
            <p className="ds-sub">
              {service.category.name}
              {service.description ? ` · ${service.description}` : ""}
            </p>
          </div>
        </div>
      </div>

      <DuesBanner outstanding={outstanding.data} />
      <AddressBar />

      <div className="ds-grid2">
        <div className="ds-stack">
          <section className="ds-card" aria-labelledby="ds-options">
            <h2 id="ds-options" className="ds-h2">
              Choose an option
            </h2>
            <div className="ds-stack" role="radiogroup" aria-labelledby="ds-options" style={{ gap: 8 }}>
              {service.options.map((o) => (
                <label key={o.id} className={sel.optionId === o.id ? "ds-choice is-on" : "ds-choice"}>
                  <input type="radio" name="option" checked={sel.optionId === o.id} onChange={() => setSel(selectOption(service, sel, o.id))} />
                  <span className="ds-grow">
                    <strong>{o.name}</strong>
                    {o.description ? <span className="ds-meta" style={{ display: "block" }}>{o.description}</span> : null}
                    <span className="ds-meta" style={{ display: "block" }}>
                      {[unitWord(o.unit) ? `Priced ${unitWord(o.unit)}` : "", o.durationMinutes ? `${formatDuration(o.durationMinutes)}${o.unit === "per_month" ? " first visit" : ""}` : "", o.maxQuantity > 1 ? `up to ${o.maxQuantity}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <FromPrice paise={o.fromPricePaise} mrp={o.mrpPaise} />
                </label>
              ))}
            </div>
            {opt && opt.maxQuantity > 1 ? (
              <div className="ds-row">
                <span className="ds-grow">{quantityLabel(opt.unit)}</span>
                <div className="ds-qty">
                  <button type="button" aria-label="Fewer" disabled={sel.quantity <= 1} onClick={() => setSel(setQuantity(service, sel, sel.quantity - 1))}>
                    <Minus size={14} aria-hidden="true" />
                  </button>
                  <span aria-live="polite">{sel.quantity}</span>
                  <button type="button" aria-label="More" disabled={sel.quantity >= opt.maxQuantity} onClick={() => setSel(setQuantity(service, sel, sel.quantity + 1))}>
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {service.addonGroups.map((g) => {
            const picked = sel.addons[g.id] ?? []
            const missing = problems.some((p) => p.groupId === g.id)
            const full = !isPickOne(g) && picked.length >= groupMax(g)
            return (
              <section key={g.id} className={missing ? "ds-card ds-group is-missing" : "ds-card ds-group"} aria-labelledby={`ds-g-${g.id}`}>
                <div className="ds-group__head">
                  <h2 id={`ds-g-${g.id}`} className="ds-h2">
                    {g.name}
                  </h2>
                  <span className="ds-meta ds-group__hint">{groupHint(g)}</span>
                </div>
                <div className="ds-stack" role={isPickOne(g) ? "radiogroup" : "group"} aria-labelledby={`ds-g-${g.id}`} style={{ gap: 8 }}>
                  {g.addons.map((a) => {
                    const on = picked.includes(a.id)
                    const off = !on && full
                    const from = fromPriceLabel(a.fromPricePaise)
                    return (
                      <label key={a.id} className={on ? "ds-choice is-on" : off ? "ds-choice is-off" : "ds-choice"}>
                        <input type={isPickOne(g) ? "radio" : "checkbox"} name={`g-${g.id}`} checked={on} disabled={off} onChange={() => setSel(toggleAddon(g, sel, a.id))} />
                        <span className="ds-grow">
                          {a.name}
                          {a.extraDurationMinutes ? <span className="ds-meta"> · +{formatDuration(a.extraDurationMinutes)}</span> : null}
                        </span>
                        {from ? <span className="ds-meta">+ {from.toLowerCase()}</span> : null}
                      </label>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {service.inclusions.length || service.exclusions.length ? (
            <section className="ds-card" aria-label="What's included">
              {service.inclusions.length ? (
                <>
                  <h2 className="ds-h2">What&apos;s included</h2>
                  <ul className="ds-list-plain" style={{ listStyle: "none", paddingLeft: 0 }}>
                    {service.inclusions.map((x) => (
                      <li key={x} className="ds-row" style={{ alignItems: "flex-start" }}>
                        <Check size={14} aria-hidden="true" style={{ marginTop: 2, flex: "none" }} />
                        {x}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {service.exclusions.length ? (
                <>
                  <h2 className="ds-h2">Not included</h2>
                  <ul className="ds-list-plain" style={{ listStyle: "none", paddingLeft: 0 }}>
                    {service.exclusions.map((x) => (
                      <li key={x} className="ds-row" style={{ alignItems: "flex-start" }}>
                        <X size={14} aria-hidden="true" style={{ marginTop: 2, flex: "none" }} />
                        {x}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : null}

          <section className="ds-card" aria-label="Professional">
            {femaleToggleVisible(rule) ? (
              <label className="ds-switch">
                <input type="checkbox" checked={sel.requireFemalePro} onChange={(e) => setSel({ ...sel, requireFemalePro: e.target.checked })} />
                <span className="ds-grow">
                  Require a woman professional
                  <span className="ds-meta" style={{ display: "block" }}>
                    Fewer professionals may be available.
                  </span>
                </span>
              </label>
            ) : (
              <p className="ds-note">{genderRuleNote(rule)}</p>
            )}
            <p className="ds-note">Every professional is ID-verified, and each price is checked by our team before you see it. Extras found during the visit are charged only with your approval in the app.</p>
          </section>
        </div>

        <aside className="ds-card ds-sticky" aria-label="Next step">
          <h2 className="ds-h2">Pick your professional</h2>
          <p className="ds-note">Each professional sets their own price. Next you&apos;ll see their prices for exactly this choice, with ratings, distance and free times. Prices include GST.</p>
          {duration ? (
            <span className="ds-meta ds-row" style={{ gap: 4 }}>
              <Clock size={12} aria-hidden="true" />
              About {formatDuration(duration)}
            </span>
          ) : null}
          <button type="button" className="ds-btn ds-btn--primary ds-btn--block" disabled={Boolean(blocked)} onClick={() => go("scheduled")}>
            See professionals
          </button>
          <button type="button" className="ds-btn ds-btn--outline ds-btn--block" disabled={Boolean(blocked)} onClick={() => go("asap")}>
            <Zap size={14} aria-hidden="true" /> As soon as possible
          </button>
          {blocked ? <p className="ds-note">{blocked}</p> : null}
        </aside>
      </div>
    </>
  )
}

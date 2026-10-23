"use client"

/*
  The creator's membership levels (/monetization/tiers): list, add, edit,
  turn off / on, and the eligibility card. The form says the server's rules
  before the request (model.ts validateTierForm); a refusal the server still
  gives (TIER_LIMIT, MEMBERSHIPS_NOT_ELIGIBLE …) is said as a sentence. An
  edit PATCHes only the fields that changed.
*/

import { useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, Loader2, Pencil, Plus, Power, Users } from "lucide-react"

import { useAuthUser } from "@/store/auth"

import { useCreateLevel, useEligibility, useMyLevels, usePatchLevel, useSetLevelActive } from "../hooks"
import {
  emptyTierForm,
  hasErrors,
  isMembershipsOff,
  MAX_ACTIVE_LEVELS,
  MAX_NAME_LENGTH,
  MAX_PERKS,
  MISSING_COPY,
  membershipErrorMessage,
  perMonth,
  tierFormFrom,
  tierPatch,
  toMembershipError,
  validateTierForm,
  type MissingItem,
  type Tier,
  type TierForm,
  type TierFormErrors,
} from "../model"

const card = "rounded-2xl border border-brand-divider bg-brand-card p-5"
const primary = "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
const ghost = "inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-divider px-3 py-1.5 text-sm font-semibold text-brand-text transition hover:bg-brand-secondary disabled:opacity-50"
const input = "w-full rounded-xl border border-brand-divider bg-brand-bg px-3 py-2.5 text-sm text-brand-text placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary-outline"

const NAV = [
  { href: "/monetization", label: "Dashboard" },
  { href: "/monetization/tiers", label: "Memberships" },
  { href: "/monetization/payouts", label: "Payouts" },
]

export function LevelsScreen() {
  const me = useAuthUser()
  const levels = useMyLevels()
  const eligibility = useEligibility(me?.id)
  const [editing, setEditing] = useState<Tier | "new" | null>(null)
  const all = levels.data ?? []
  const active = all.filter((t) => t.isActive)
  const inactive = all.filter((t) => !t.isActive)
  const off = isMembershipsOff(levels.error) || isMembershipsOff(eligibility.error)
  const notEligible = eligibility.data ? !eligibility.data.eligible : false
  // The FIRST level needs eligibility; a creator who already has levels can keep editing them.
  const canAdd = !off && active.length < MAX_ACTIVE_LEVELS && !(notEligible && all.length === 0)

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-brand-text">Memberships</h1>
          <p className="mt-1 text-sm text-muted-foreground">Up to {MAX_ACTIVE_LEVELS} levels, ₹29 to ₹2,999 a month, GST included. Members pay by reminder each month; nothing renews by itself.</p>
        </header>
        <nav aria-label="Creator tools" className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={n.href === "/monetization/tiers" ? "page" : undefined}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${n.href === "/monetization/tiers" ? "bg-brand-text text-brand-bg" : "bg-brand-card text-brand-text hover:bg-brand-secondary"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {off ? (
          <div role="status" className={`${card} mb-4 flex gap-3`}>
            <AlertCircle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-brand-text">Memberships aren&apos;t available yet. Your levels will show here when they are.</p>
          </div>
        ) : null}

        {!off && eligibility.data && !eligibility.data.eligible ? <EligibilityCard missing={eligibility.data.missing} hasLevels={all.length > 0} /> : null}

        {editing ? (
          <LevelEditor
            key={editing === "new" ? "new" : editing.id}
            original={editing === "new" ? null : editing}
            activeCount={active.length}
            onDone={() => setEditing(null)}
          />
        ) : !off ? (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button type="button" className={primary} onClick={() => setEditing("new")} disabled={!canAdd} data-membership="add-level">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add a level
            </button>
            {active.length >= MAX_ACTIVE_LEVELS ? <span className="text-sm text-muted-foreground">You have {MAX_ACTIVE_LEVELS} active levels. Turn one off to add another.</span> : null}
          </div>
        ) : null}

        {levels.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your levels…
          </p>
        ) : levels.isError && !off ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {membershipErrorMessage(levels.error, "Your levels couldn't load.")}{" "}
            <button type="button" className="font-semibold text-primary-ink underline underline-offset-2" onClick={() => void levels.refetch()}>
              Try again
            </button>
          </p>
        ) : all.length === 0 && !off ? (
          <p className="text-sm text-muted-foreground">No levels yet. Add one so fans can join.</p>
        ) : null}

        {active.length > 0 ? (
          <section aria-labelledby="levels-active" className="mb-6">
            <h2 id="levels-active" className="mb-3 text-sm font-semibold text-muted-foreground">
              Active · {active.length} of {MAX_ACTIVE_LEVELS}
            </h2>
            <div className="space-y-3">
              {active.map((t) => (
                <LevelRow key={t.id} tier={t} activeCount={active.length} onEdit={() => setEditing(t)} />
              ))}
            </div>
          </section>
        ) : null}
        {inactive.length > 0 ? (
          <section aria-labelledby="levels-off">
            <h2 id="levels-off" className="mb-3 text-sm font-semibold text-muted-foreground">
              Turned off
            </h2>
            <div className="space-y-3">
              {inactive.map((t) => (
                <LevelRow key={t.id} tier={t} activeCount={active.length} onEdit={() => setEditing(t)} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

/** The eligibility items still missing, in plain words, each with where to fix it. */
export function EligibilityCard({ missing, hasLevels }: { missing: readonly MissingItem[]; hasLevels: boolean }) {
  return (
    <section data-membership="eligibility" aria-labelledby="eligibility-title" className={`${card} mb-6`}>
      <h2 id="eligibility-title" className="text-base font-semibold text-brand-text">
        {hasLevels ? "Your memberships need attention" : "Before you can offer memberships"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{hasLevels ? "Fix these to keep offering memberships." : "You need all four. Still to do:"}</p>
      <ul className="mt-3 space-y-2">
        {missing.map((m) => {
          const c = MISSING_COPY[m]
          return (
            <li key={m} data-missing={m} className="flex gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-brand-text">{c.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {c.hint}
                  {c.href ? (
                    <>
                      {" "}
                      <Link href={c.href} className="font-semibold text-primary-ink underline underline-offset-2">
                        Open
                      </Link>
                    </>
                  ) : null}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function LevelRow({ tier, activeCount, onEdit }: { tier: Tier; activeCount: number; onEdit: () => void }) {
  const toggle = useSetLevelActive()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const turnOn = !tier.isActive
  const blockedOn = turnOn && activeCount >= MAX_ACTIVE_LEVELS

  const flip = () => {
    setError(null)
    toggle.mutate(
      { id: tier.id, on: turnOn },
      {
        onSuccess: () => setConfirming(false),
        onError: (e) => setError(membershipErrorMessage(e, turnOn ? "The level couldn't be turned on." : "The level couldn't be turned off.")),
      },
    )
  }

  return (
    <article data-level={tier.id} className={`${card} ${tier.isActive ? "" : "opacity-80"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-brand-text">{tier.name}</h3>
          <p className="text-sm text-muted-foreground">{perMonth(tier.pricePaise)}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden="true" /> {tier.subscriberCount === 1 ? "1 member" : `${tier.subscriberCount} members`}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={ghost} onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
          </button>
          <button type="button" className={ghost} onClick={() => (turnOn ? flip() : setConfirming(true))} disabled={toggle.isPending || blockedOn} title={blockedOn ? "Turn another level off first" : undefined}>
            <Power className="h-3.5 w-3.5" aria-hidden="true" /> {turnOn ? "Turn on" : "Turn off"}
          </button>
        </div>
      </div>
      {tier.perks.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {tier.perks.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm text-brand-text">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span className="min-w-0 break-words">{p}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {confirming ? (
        <div role="alertdialog" aria-label={`Turn off ${tier.name}`} className="mt-4 rounded-xl bg-brand-secondary p-3">
          <p className="text-sm text-brand-text">Nobody new can join {tier.name}. Current members keep access until their paid month ends.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={ghost} onClick={() => setConfirming(false)}>
              Keep it
            </button>
            <button type="button" className={primary} onClick={flip} disabled={toggle.isPending}>
              Turn off
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </article>
  )
}

function LevelEditor({ original, activeCount, onDone }: { original: Tier | null; activeCount: number; onDone: () => void }) {
  const create = useCreateLevel()
  const patch = usePatchLevel()
  const [form, setForm] = useState<TierForm>(() => (original ? tierFormFrom(original) : emptyTierForm()))
  const [shown, setShown] = useState<TierFormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const creating = original === null
  const busy = create.isPending || patch.isPending
  const set = (k: keyof TierForm, v: string) => {
    setServerError(null)
    setForm((f) => ({ ...f, [k]: v }))
  }

  const refusal = (e: unknown) => {
    const err = toMembershipError(e)
    if (err.code === "MEMBERSHIPS_NOT_ELIGIBLE" && err.missing.length > 0) {
      return `You can't offer memberships yet. Still to do: ${err.missing.map((m) => MISSING_COPY[m].title.toLowerCase()).join(", ")}.`
    }
    return membershipErrorMessage(e, "The level couldn't be saved. Try again.")
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const errors = validateTierForm(form, { activeCount, creating: creating })
    setShown(errors)
    if (hasErrors(errors)) return
    if (creating) {
      create.mutate(form, { onSuccess: onDone, onError: (err) => setServerError(refusal(err)) })
      return
    }
    const changes = tierPatch(original, form)
    if (Object.keys(changes).length === 0) {
      onDone()
      return
    }
    patch.mutate({ id: original.id, patch: changes }, { onSuccess: onDone, onError: (err) => setServerError(refusal(err)) })
  }

  const fieldError = (msg?: string, id?: string) =>
    msg ? (
      <p id={id} className="mt-1 text-sm text-danger">
        {msg}
      </p>
    ) : null

  return (
    <form onSubmit={submit} noValidate data-membership="level-editor" className={`${card} mb-6 space-y-4`}>
      <h2 className="text-base font-semibold text-brand-text">{creating ? "Add a level" : `Edit ${original.name}`}</h2>
      <div>
        <label htmlFor="level-name" className="mb-1 block text-sm font-semibold text-brand-text">
          Name
        </label>
        <input id="level-name" className={input} value={form.name} maxLength={MAX_NAME_LENGTH + 20} onChange={(e) => set("name", e.target.value)} placeholder="Supporter" aria-invalid={!!shown.name} aria-describedby={shown.name ? "level-name-error" : undefined} />
        {fieldError(shown.name, "level-name-error")}
      </div>
      <div>
        <label htmlFor="level-price" className="mb-1 block text-sm font-semibold text-brand-text">
          Price a month (₹)
        </label>
        <input id="level-price" className={input} inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="99" aria-invalid={!!shown.price} aria-describedby={shown.price ? "level-price-error" : "level-price-hint"} />
        {shown.price ? fieldError(shown.price, "level-price-error") : (
          <p id="level-price-hint" className="mt-1 text-xs text-muted-foreground">
            ₹29 to ₹2,999, GST included.{original && original.subscriberCount > 0 ? " A new price applies from each member's next renewal." : ""}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="level-perks" className="mb-1 block text-sm font-semibold text-brand-text">
          Perks
        </label>
        <textarea id="level-perks" className={`${input} resize-y`} rows={4} value={form.perks} onChange={(e) => set("perks", e.target.value)} placeholder={"Members-only videos\nEarly access"} aria-invalid={!!shown.perks} aria-describedby={shown.perks ? "level-perks-error" : "level-perks-hint"} />
        {shown.perks ? fieldError(shown.perks, "level-perks-error") : (
          <p id="level-perks-hint" className="mt-1 text-xs text-muted-foreground">
            One per line, up to {MAX_PERKS}.
          </p>
        )}
      </div>
      {shown.form ? fieldError(shown.form) : null}
      {serverError ? (
        <p role="alert" className="text-sm text-danger">
          {serverError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="button" className={ghost} onClick={onDone} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className={primary} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {creating ? "Add level" : "Save"}
        </button>
      </div>
    </form>
  )
}

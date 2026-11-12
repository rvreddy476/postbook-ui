"use client"

import Link from "next/link"
import { BadgeCheck, CheckCircle2, Clock, Crown, Loader2, XCircle } from "lucide-react"

import { usePremiumPlans, useMyPremium, usePremiumPurchase } from "./hooks"
import {
  canBuy,
  isPremiumOff,
  NO_AUTO_RENEW,
  paidWords,
  planLength,
  planPrice,
  planTitle,
  PREMIUM_PERKS,
  PREMIUM_WORDS,
  premiumErrorMessage,
  purchaseBusy,
  statusWords,
  type PremiumPlan,
  type PremiumStatus,
  type PurchasePhase,
} from "./model"

/*
  /premium — buy a Momentum Premium pass. Signed in only (the middleware
  gates every route not listed as public; AppShell keeps its sign-in gate).

  The status comes from GET /premium/me, so a buyer who closed the tab
  mid-payment sees the server's answer when they come back. While
  PREMIUM_ENABLED is off every premium route answers 503
  PREMIUM_NOT_ENABLED and the page says "Premium is not available yet".
  Styling is Tailwind token classes only (src/ui/theme.css).
*/

const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-primary-ink px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
const BTN_QUIET = "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-secondary"

export function PremiumScreen() {
  const plans = usePremiumPlans()
  const me = useMyPremium()
  const purchase = usePremiumPurchase()

  const off = isPremiumOff(plans.error) || isPremiumOff(me.error) || purchase.state.phase === "unavailable"

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-10" data-premium-page>
      <header className="mb-6 flex items-center gap-3 lg:mb-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-tint text-primary-ink">
          <Crown className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Momentum Premium</h1>
          <p className="text-sm text-muted-foreground">Passes for a set number of days. Pay once; nothing renews by itself.</p>
        </div>
      </header>
      <PremiumBody
        off={off}
        loading={plans.isLoading || me.isLoading}
        plans={plans.data ?? null}
        plansError={plans.error}
        status={me.data ?? null}
        statusError={me.error}
        purchase={purchase.state}
        onBuy={(p) => void purchase.buy(p)}
        onCheckAgain={purchase.checkAgain}
        onRetry={purchase.retryLast}
        onReset={purchase.reset}
      />
    </div>
  )
}

export interface PremiumBodyProps {
  off: boolean
  loading: boolean
  plans: PremiumPlan[] | null
  plansError: unknown
  status: PremiumStatus | null
  statusError: unknown
  purchase: PurchasePhase
  onBuy: (plan: PremiumPlan) => void
  onCheckAgain: () => void
  onRetry: () => void
  onReset: () => void
}

/** The page below the header; props only, so tests render every state. */
export function PremiumBody(props: PremiumBodyProps) {
  const { off, loading, plans, plansError, status, statusError, purchase } = props
  if (off) {
    return (
      <section className="rounded-2xl border border-border bg-brand-card p-6 text-center" data-premium-off>
        <h2 className="text-lg font-semibold text-brand-text">{PREMIUM_WORDS.notEnabled}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{PREMIUM_WORDS.notEnabledDetail}</p>
      </section>
    )
  }
  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground" role="status" aria-label="Loading">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <div className="space-y-6">
        <PurchaseBanner {...props} />
        <section aria-labelledby="premium-passes">
          <h2 id="premium-passes" className="mb-3 text-lg font-semibold text-brand-text">
            Choose a pass
          </h2>
          {plansError ? (
            <p role="alert" className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              {premiumErrorMessage(plansError)}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {(plans ?? []).map((plan) => (
                <PlanCard key={plan.code} plan={plan} busy={purchaseBusy(purchase)} pending={"plan" in purchase && purchase.plan === plan.code && purchaseBusy(purchase)} onBuy={() => props.onBuy(plan)} />
              ))}
            </div>
          )}
          <p className="mt-3 text-sm text-muted-foreground" data-premium-no-auto-renew>
            {NO_AUTO_RENEW}
          </p>
        </section>
      </div>
      <aside className="space-y-6">
        <StatusCard status={status} error={statusError} />
        <section className="rounded-2xl border border-border bg-brand-card p-5" aria-labelledby="premium-perks">
          <h2 id="premium-perks" className="mb-3 text-base font-semibold text-brand-text">
            What Premium gives you
          </h2>
          <ul className="space-y-2">
            {PREMIUM_PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-sm text-brand-text">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Reading, liking, reposting and replying on Echo stay free.</p>
        </section>
      </aside>
    </div>
  )
}

function PlanCard({ plan, busy, pending, onBuy }: { plan: PremiumPlan; busy: boolean; pending: boolean; onBuy: () => void }) {
  const buyable = canBuy(plan)
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-brand-card p-5" data-premium-plan={plan.code}>
      <p className="text-sm font-medium text-muted-foreground">{planLength(plan)}</p>
      <h3 className="mt-1 text-base font-semibold text-brand-text">{planTitle(plan)}</h3>
      <p className={buyable ? "mt-3 text-3xl font-bold text-brand-text" : "mt-3 text-base font-medium text-muted-foreground"} data-premium-price>
        {planPrice(plan)}
      </p>
      <div className="mt-5 flex-1" />
      <button type="button" className={BTN_PRIMARY} disabled={!buyable || busy} onClick={onBuy}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {buyable ? `Buy ${planLength(plan)}` : "Not available"}
      </button>
    </article>
  )
}

function StatusCard({ status, error }: { status: PremiumStatus | null; error: unknown }) {
  if (error) {
    return (
      <section className="rounded-2xl border border-border bg-brand-card p-5" data-premium-status="error">
        <p role="alert" className="text-sm text-danger">
          {premiumErrorMessage(error)}
        </p>
      </section>
    )
  }
  if (!status) return null
  const w = statusWords(status)
  const Icon = w.tone === "active" ? BadgeCheck : w.tone === "grace" ? Clock : Crown
  const tint = w.tone === "active" ? "text-success" : w.tone === "grace" ? "text-warning" : "text-muted-foreground"
  return (
    <section className="rounded-2xl border border-border bg-brand-card p-5" data-premium-status={w.tone}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tint}`} aria-hidden />
        <div>
          <h2 className="text-base font-semibold text-brand-text">{w.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{w.detail}</p>
        </div>
      </div>
    </section>
  )
}

/** The purchase's own state, above the passes. Nothing shows while idle. */
export function PurchaseBanner({ purchase, onCheckAgain, onRetry, onReset }: Pick<PremiumBodyProps, "purchase" | "onCheckAgain" | "onRetry" | "onReset">) {
  const box = "rounded-2xl border p-5"
  switch (purchase.phase) {
    case "idle":
    case "unavailable":
      return null
    case "starting":
    case "dialog":
      return (
        <div className={`${box} border-border bg-brand-card`} role="status" data-premium-purchase={purchase.phase}>
          <p className="flex items-center gap-2 text-sm text-brand-text">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {purchase.phase === "starting" ? "Opening checkout…" : "Complete the payment in the Razorpay window."}
          </p>
        </div>
      )
    case "confirming":
      return (
        <div className={`${box} border-border bg-brand-card`} role="status" data-premium-purchase="confirming">
          <p className="flex items-center gap-2 text-sm text-brand-text">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Confirming your payment…
          </p>
        </div>
      )
    case "paid":
      return (
        <div className={`${box} border-success/30 bg-success/15`} role="status" data-premium-purchase="paid">
          <p className="flex items-center gap-2 text-base font-semibold text-brand-text">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
            {paidWords(purchase.endsAt)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/echo" className={BTN_PRIMARY}>
              Post on Echo
            </Link>
            <button type="button" className={BTN_QUIET} onClick={onReset}>
              Done
            </button>
          </div>
        </div>
      )
    case "still_confirming":
      return (
        <div className={`${box} border-warning/30 bg-warning/10`} role="status" data-premium-purchase="still_confirming">
          <p className="text-sm text-brand-text">{PREMIUM_WORDS.stillConfirming}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} onClick={onCheckAgain}>
              Check again
            </button>
            <button type="button" className={BTN_QUIET} onClick={onReset}>
              Close
            </button>
          </div>
        </div>
      )
    case "dismissed":
    case "failed":
    case "error": {
      const message = purchase.phase === "dismissed" ? PREMIUM_WORDS.dismissed : purchase.message
      return (
        <div className={`${box} border-danger/30 bg-danger/5`} role="alert" data-premium-purchase={purchase.phase}>
          <p className="flex items-start gap-2 text-sm text-brand-text">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
            {message}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} onClick={onRetry}>
              Try again
            </button>
            <button type="button" className={BTN_QUIET} onClick={onReset}>
              Close
            </button>
          </div>
        </div>
      )
    }
  }
}

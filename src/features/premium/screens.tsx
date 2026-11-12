"use client"

import Link from "next/link"
import { BadgeCheck, CheckCircle2, Clock, Crown, Download, Loader2, XCircle } from "lucide-react"

import { useDownloadPremiumInvoice, usePaidInvoice, usePremiumInvoices, usePremiumPlans, useMyPremium, usePremiumPurchase, type InvoiceTarget } from "./hooks"
import {
  canBuy,
  checkoutLines,
  INVOICE_WORDS,
  invoiceAmount,
  invoiceDate,
  invoiceErrorMessage,
  invoiceKindLabel,
  reversedInvoice,
  isPremiumOff,
  NO_AUTO_RENEW,
  paidWords,
  planBreakdown,
  planLength,
  planPrice,
  planTitle,
  PREMIUM_PERKS,
  PREMIUM_WORDS,
  premiumErrorMessage,
  purchaseBusy,
  receiptLines,
  rupees,
  statusWords,
  type PremiumInvoice,
  type PremiumPlan,
  type PremiumStatus,
  type PurchasePhase,
  type ReceiptLine,
} from "./model"

/*
  /premium — buy a Momentum Premium pass. Signed in only (the middleware
  gates every route not listed as public; AppShell keeps its sign-in gate).

  The status comes from GET /premium/me, so a buyer who closed the tab
  mid-payment sees the server's answer when they come back. While
  PREMIUM_ENABLED is off every premium route answers 503
  PREMIUM_NOT_ENABLED and the page says "Premium is not available yet".

  Prices exclude GST: each card shows the price "+ GST" and the server's
  breakdown; Buy opens the server's checkout and shows price, GST and total
  again before Pay opens Razorpay; the success view shows what was paid
  and, once the server has issued it, a Download invoice button.
  Every number is the server's — nothing here computes tax.

  Invoices: the buyer's tax invoices and credit notes (GET /premium/invoices),
  newest first, each downloadable. Documents are fetched through the API
  client with the bearer token and saved from a blob; no bare links.
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
  const invoices = usePremiumInvoices(!off)
  const paidState = purchase.state.phase === "paid" ? purchase.state : null
  const paidInvoice = usePaidInvoice(paidState ? purchase.passId : null, paidState?.invoiceId ?? null)
  const download = useDownloadPremiumInvoice()
  const downloadState: InvoiceDownloadState = {
    pendingId: download.isPending ? (download.variables?.id ?? null) : null,
    failedId: download.isError ? (download.variables?.id ?? null) : null,
    message: download.isError ? invoiceErrorMessage(download.error) : null,
  }

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
        onPay={() => void purchase.pay()}
        onCheckAgain={purchase.checkAgain}
        onRetry={purchase.retryLast}
        onReset={purchase.reset}
        invoices={invoices.data ?? null}
        paidInvoice={paidState ? paidInvoice : undefined}
        download={downloadState}
        onDownload={(target) => download.mutate(target)}
      />
    </div>
  )
}

/** Which document is downloading, which one failed and why. */
export interface InvoiceDownloadState {
  pendingId: string | null
  failedId: string | null
  message: string | null
}

export const idleDownload: InvoiceDownloadState = { pendingId: null, failedId: null, message: null }

/** The success view's invoice: its id once issued, and whether the short wait for it is over. */
export interface PaidInvoice {
  invoiceId: string | null
  gaveUp: boolean
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
  onPay: () => void
  onCheckAgain: () => void
  onRetry: () => void
  onReset: () => void
  /** The buyer's documents, newest first; null while loading or on error (the section hides). */
  invoices?: PremiumInvoice[] | null
  paidInvoice?: PaidInvoice
  download?: InvoiceDownloadState
  onDownload?: (target: InvoiceTarget) => void
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
        <InvoicesSection invoices={props.invoices ?? null} download={props.download ?? idleDownload} onDownload={props.onDownload} />
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
  const breakdown = planBreakdown(plan)
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-brand-card p-5" data-premium-plan={plan.code}>
      <p className="text-sm font-medium text-muted-foreground">{planLength(plan)}</p>
      <h3 className="mt-1 text-base font-semibold text-brand-text">{planTitle(plan)}</h3>
      {buyable ? (
        <>
          <p className="mt-3 flex items-baseline gap-2" data-premium-price>
            <span className="text-3xl font-bold text-brand-text">{planPrice(plan)}</span>
            <span className="text-sm font-medium text-muted-foreground">+ GST</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground" data-premium-breakdown>
            {breakdown}
          </p>
        </>
      ) : (
        <p className="mt-3 text-base font-medium text-muted-foreground" data-premium-price>
          {planPrice(plan)}
        </p>
      )}
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

function MoneyLines({ lines, testId }: { lines: ReceiptLine[]; testId: string }) {
  return (
    <dl className="mt-3 space-y-1 text-sm" data-premium-lines={testId}>
      {lines.map((l, i) => (
        <div
          key={l.label}
          className={i === lines.length - 1 && lines.length > 1 ? "flex justify-between border-t border-border pt-1 font-semibold text-brand-text" : "flex justify-between text-brand-text"}
        >
          <dt>{l.label}</dt>
          <dd>{l.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const BTN_DOWNLOAD =
  "inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-secondary disabled:opacity-50"

/**
  The success view's invoice: a Download button once the pass names its
  invoice; until then "ready in a moment" (the hook reads the pass again
  briefly), then a pointer to the Invoices list.
*/
function PaidInvoiceLine({
  invoiceId,
  gaveUp,
  invoices,
  download,
  onDownload,
}: {
  invoiceId: string | null
  gaveUp: boolean
  invoices: PremiumInvoice[] | null
  download: InvoiceDownloadState
  onDownload?: (target: InvoiceTarget) => void
}) {
  if (!invoiceId) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" data-premium-invoice="waiting">
        {gaveUp ? null : <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {gaveUp ? INVOICE_WORDS.later : INVOICE_WORDS.preparing}
      </p>
    )
  }
  const number = invoices?.find((r) => r.id === invoiceId)?.number
  const pending = download.pendingId === invoiceId
  return (
    <div className="mt-3" data-premium-invoice="ready">
      <button type="button" className={BTN_DOWNLOAD} disabled={pending || !onDownload} onClick={() => onDownload?.({ id: invoiceId, number })} data-premium-invoice-download>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
        {INVOICE_WORDS.download}
      </button>
      {download.failedId === invoiceId && download.message ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {download.message}
        </p>
      ) : null}
    </div>
  )
}

/**
  The buyer's tax invoices and credit notes, newest first. Hidden when there
  are none (and while loading or on error). A credit note is a refund: its
  amount carries a minus and it names the invoice it reverses when that
  invoice is in the list.
*/
export function InvoicesSection({
  invoices,
  download = idleDownload,
  onDownload,
}: {
  invoices: PremiumInvoice[] | null
  download?: InvoiceDownloadState
  onDownload?: (target: InvoiceTarget) => void
}) {
  if (!invoices || invoices.length === 0) return null
  const cols = "sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
  return (
    <section className="rounded-2xl border border-border bg-brand-card" aria-labelledby="premium-invoices" data-premium-invoices>
      <h2 id="premium-invoices" className="px-5 pt-5 text-lg font-semibold text-brand-text">
        {INVOICE_WORDS.heading}
      </h2>
      <div className={`mt-3 hidden px-5 pb-2 text-xs font-medium text-muted-foreground ${cols}`} aria-hidden>
        <span>Number</span>
        <span>Date</span>
        <span>Type</span>
        <span className="text-right">Amount</span>
        <span className="sr-only">Download</span>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {invoices.map((inv) => {
          const reverses = reversedInvoice(inv, invoices)
          const pending = download.pendingId === inv.id
          const credit = inv.kind === "credit_note"
          return (
            <li key={inv.id} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 ${cols}`} data-premium-invoice-row={inv.kind}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-brand-text">{inv.number}</p>
                {reverses ? <p className="text-xs text-muted-foreground">Reverses {reverses.number}</p> : null}
              </div>
              <p className="text-sm text-muted-foreground">{invoiceDate(inv.date)}</p>
              <p className="text-sm text-muted-foreground">{invoiceKindLabel(inv.kind)}</p>
              <p className={`text-sm font-semibold tabular-nums sm:text-right ${credit ? "text-success" : "text-brand-text"}`} data-premium-invoice-amount>
                {invoiceAmount(inv)}
              </p>
              <div className="flex flex-col items-end">
                <button
                  type="button"
                  className={BTN_QUIET}
                  disabled={pending || !onDownload}
                  onClick={() => onDownload?.({ id: inv.id, number: inv.number })}
                  aria-label={`Download ${invoiceKindLabel(inv.kind).toLowerCase()} ${inv.number}`}
                  data-premium-invoice-download={inv.id}
                >
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-2 h-4 w-4" aria-hidden />}
                  {INVOICE_WORDS.downloadRow}
                </button>
              </div>
              {download.failedId === inv.id && download.message ? (
                <p role="alert" className="w-full text-sm text-danger sm:col-span-5">
                  {download.message}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** The purchase's own state, above the passes. Nothing shows while idle. */
export function PurchaseBanner({
  purchase,
  onPay,
  onCheckAgain,
  onRetry,
  onReset,
  invoices,
  paidInvoice,
  download = idleDownload,
  onDownload,
}: Pick<PremiumBodyProps, "purchase" | "onCheckAgain" | "onRetry" | "onReset" | "invoices" | "paidInvoice" | "download" | "onDownload"> & { onPay?: () => void }) {
  const box = "rounded-2xl border p-5"
  switch (purchase.phase) {
    case "idle":
    case "unavailable":
      return null
    case "review":
      return (
        <div className={`${box} border-border bg-brand-card`} data-premium-purchase="review">
          <h2 className="text-base font-semibold text-brand-text">Confirm your pass</h2>
          <MoneyLines lines={checkoutLines(purchase.checkout)} testId="checkout" />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} onClick={onPay}>
              Pay {rupees(purchase.checkout.amountPaise)}
            </button>
            <button type="button" className={BTN_QUIET} onClick={onReset}>
              Cancel
            </button>
          </div>
        </div>
      )
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
          {purchase.receipt ? <MoneyLines lines={receiptLines(purchase.receipt)} testId="receipt" /> : null}
          <PaidInvoiceLine
            invoiceId={purchase.invoiceId ?? paidInvoice?.invoiceId ?? null}
            gaveUp={paidInvoice?.gaveUp ?? false}
            invoices={invoices ?? null}
            download={download}
            onDownload={onDownload}
          />
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

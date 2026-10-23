"use client"

/*
  The one way to join a creator's membership on the web: every lock card,
  the watch page, the comments panel, the Members tab and the profile open
  this sheet. Levels with price and perks → POST /subscribe (Idempotency-Key)
  → the Razorpay dialog from client_session → the payment poll → on paid the
  entitlement and every post / feed read are refetched, so the content opens
  where it is, without a reload.
*/

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, CheckCircle2, Clock, Loader2, Lock, XCircle } from "lucide-react"

import { useGlobalToast } from "@/contexts/ToastContext"
import { ComposeSheet } from "@/features/post-compose/components/ComposeSheet"

import { checkoutBusy, type CheckoutPhase } from "../checkout"
import { joinIntent, useCreatorLevels, useMembershipCheckout } from "../hooks"
import { joinChoices, membershipErrorMessage, MY_MEMBERSHIPS_PATH, perMonth, type Tier } from "../model"

export interface JoinSheetProps {
  open: boolean
  onClose: () => void
  creatorId: string
  creatorName?: string
  /** The level the locked item needs: it and dearer levels are highlighted, and the sheet starts on it. */
  requiredTierId?: string | null
  /** The row's tier_required_price_paise, when it carried one: what decides which levels unlock it. */
  requiredPricePaise?: number | null
}

export const PAYMENT_TERMS = "Prices include GST. Renewal isn't automatic: we remind you before it ends and you pay to keep access. Payments aren't refunded once access has started."

export function JoinSheet({ open, onClose, creatorId, creatorName, requiredTierId = null, requiredPricePaise = null }: JoinSheetProps) {
  const levels = useCreatorLevels(open ? creatorId : null)
  const choices = useMemo(() => joinChoices(levels.data ?? [], requiredTierId, requiredPricePaise), [levels.data, requiredTierId, requiredPricePaise])
  const offered = choices.levels
  const [picked, setPicked] = useState<string | null>(null)
  const checkout = useMembershipCheckout()
  const { reset } = checkout
  const chosen = offered.find((t) => t.id === picked) ?? choices.lowest ?? offered[0] ?? null
  const unlocking = new Set(choices.unlocking)
  const chosenMisses = !!chosen && choices.unlocking.length > 0 && !unlocking.has(chosen.id)
  const who = creatorName?.trim() || "this creator"

  // A fresh open starts on the cheapest level that unlocks, with no stale verdict.
  useEffect(() => {
    if (!open) return
    setPicked(null)
    reset()
  }, [open, reset])

  // Paid: the content behind this sheet refetches and opens, which can take
  // the lock card (and this sheet) away; the toast outlives it.
  const toast = useGlobalToast()
  const paid = checkout.state.phase === "paid"
  useEffect(() => {
    if (paid) toast({ type: "success", title: `You're a member of ${who}`, description: "Members-only posts and videos are open to you now." })
  }, [paid, toast, who])

  const busy = checkoutBusy(checkout.state)
  const close = () => {
    if (busy) return
    onClose()
  }

  const join = () => {
    if (!chosen || busy) return
    void checkout.run(joinIntent(creatorId, chosen.id, `${chosen.name} membership — ${perMonth(chosen.pricePaise)}`))
  }

  const footer = <JoinFooter state={checkout.state} chosen={chosen} onJoin={join} onRetry={checkout.retryLast} onCheckAgain={checkout.checkAgain} onDone={onClose} />

  return (
    <ComposeSheet open={open} title={`Join ${who}`} onClose={close} footer={levels.isSuccess && offered.length > 0 ? footer : undefined}>
      <div data-membership="join-sheet" className="space-y-3 pb-1">
        <StatusPanel state={checkout.state} creator={who} />
        {checkout.state.phase === "idle" || checkout.state.phase === "error" ? (
          levels.isLoading ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading levels…
            </p>
          ) : levels.isError ? (
            <p role="alert" className="py-6 text-sm text-muted-foreground">
              {membershipErrorMessage(levels.error, "Levels couldn't load. Try again.")}
            </p>
          ) : offered.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">{`${creatorName?.trim() || "This creator"} doesn't offer memberships right now.`}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Members see members-only posts, shorts and videos{choices.unlocking.length > 0 ? " at their level" : requiredTierId ? ", including this one" : ""}.</p>
              {choices.line ? (
                <p data-membership="unlock-line" className="flex items-center gap-2 text-sm font-semibold text-brand-text">
                  <Lock className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" /> {choices.line}
                </p>
              ) : null}
              <div role="radiogroup" aria-label="Membership levels" className="space-y-2">
                {offered.map((t) => (
                  <LevelChoice key={t.id} tier={t} checked={chosen?.id === t.id} unlocks={unlocking.has(t.id)} onPick={() => setPicked(t.id)} disabled={busy} />
                ))}
              </div>
              {chosenMisses ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {chosen.name} doesn&apos;t open this one. {choices.line}.
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">{PAYMENT_TERMS}</p>
            </>
          )
        ) : null}
      </div>
    </ComposeSheet>
  )
}

function LevelChoice({ tier, checked, unlocks, onPick, disabled }: { tier: Tier; checked: boolean; unlocks: boolean; onPick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      data-level={tier.id}
      data-unlocks={unlocks ? "" : undefined}
      data-autofocus={checked ? "" : undefined}
      disabled={disabled}
      onClick={onPick}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition disabled:opacity-60 ${checked ? "border-primary bg-primary-tint" : "border-brand-divider hover:bg-brand-secondary"}`}
    >
      <span className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-brand-text">{tier.name}</span>
            {unlocks ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary-ink">
                <Lock className="h-3 w-3" aria-hidden="true" /> Unlocks this
              </span>
            ) : null}
          </span>
          <span className="block text-sm text-muted-foreground">{perMonth(tier.pricePaise)}</span>
        </span>
        <span aria-hidden="true" className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-brand-divider"}`}>
          {checked ? <Check className="h-3 w-3" /> : null}
        </span>
      </span>
      {tier.perks.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {tier.perks.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm text-brand-text">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span className="min-w-0 break-words">{p}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </button>
  )
}

/** What the checkout is doing, in words; nothing while the levels are being chosen. */
export function StatusPanel({ state, creator }: { state: CheckoutPhase; creator: string }) {
  const row = (icon: React.ReactNode, title: string, detail?: React.ReactNode, tone: "info" | "ok" | "bad" = "info") => (
    <div role={tone === "bad" ? "alert" : "status"} className="flex gap-3 rounded-2xl bg-brand-secondary px-4 py-3">
      <span className={tone === "ok" ? "text-success" : tone === "bad" ? "text-danger" : "text-muted-foreground"}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-text">{title}</span>
        {detail ? <span className="mt-0.5 block text-sm text-muted-foreground">{detail}</span> : null}
      </span>
    </div>
  )
  const spin = <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
  switch (state.phase) {
    case "starting":
      return row(spin, "Opening checkout…")
    case "dialog":
      return row(spin, "Finish paying in the payment window", "Keep this page open.")
    case "confirming":
      return row(spin, "Confirming your payment…", "This usually takes a few seconds.")
    case "paid":
      return row(<CheckCircle2 className="h-5 w-5" aria-hidden="true" />, `You're a member of ${creator}`, state.refunding ? "Your payment is being refunded." : "Members-only posts and videos are open to you now.", "ok")
    case "failed":
      return row(<XCircle className="h-5 w-5" aria-hidden="true" />, "Payment not completed", state.message, "bad")
    case "still_confirming":
      return row(<Clock className="h-5 w-5" aria-hidden="true" />, "Still confirming", "Your payment is taking longer than usual. Access opens as soon as it lands.")
    case "dismissed":
      return row(<Lock className="h-5 w-5" aria-hidden="true" />, "Payment not finished", "The payment window was closed before paying.")
    case "scheduled":
      return row(<Clock className="h-5 w-5" aria-hidden="true" />, "Level change booked", state.effectiveAt ? `Your new level starts on ${new Date(state.effectiveAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}. Nothing is charged now.` : "Your new level starts at your next renewal. Nothing is charged now.", "ok")
    case "unavailable":
      return row(<Lock className="h-5 w-5" aria-hidden="true" />, "Memberships aren't available yet", "Check back soon.", "bad")
    case "already":
      return row(
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
        "You're already a member",
        <Link href={MY_MEMBERSHIPS_PATH} className="font-semibold text-primary-ink underline underline-offset-2">
          See your memberships
        </Link>,
        "ok",
      )
    case "error":
      return row(<XCircle className="h-5 w-5" aria-hidden="true" />, "Couldn't start checkout", state.message, "bad")
    default:
      return null
  }
}

const primary = "w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
const secondary = "w-full rounded-full border border-brand-divider px-4 py-2.5 text-sm font-semibold text-brand-text transition hover:bg-brand-secondary"

function JoinFooter({ state, chosen, onJoin, onRetry, onCheckAgain, onDone }: { state: CheckoutPhase; chosen: Tier | null; onJoin: () => void; onRetry: () => void; onCheckAgain: () => void; onDone: () => void }) {
  switch (state.phase) {
    case "starting":
    case "dialog":
    case "confirming":
      return (
        <button type="button" className={primary} disabled>
          Please wait…
        </button>
      )
    case "paid":
    case "already":
    case "unavailable":
    case "scheduled":
      return (
        <button type="button" className={primary} onClick={onDone}>
          Done
        </button>
      )
    case "still_confirming":
      return (
        <button type="button" className={primary} onClick={onCheckAgain}>
          Check again
        </button>
      )
    case "dismissed":
      return (
        <div className="flex gap-2">
          <button type="button" className={secondary} onClick={onDone}>
            Not now
          </button>
          <button type="button" className={primary} onClick={onRetry}>
            Pay now
          </button>
        </div>
      )
    case "failed":
      return (
        <button type="button" className={primary} onClick={onJoin} disabled={!chosen}>
          Try again
        </button>
      )
    default:
      return (
        <button type="button" className={primary} onClick={onJoin} disabled={!chosen} data-membership="join">
          {state.phase === "error" ? "Try again" : chosen ? `Join for ${perMonth(chosen.pricePaise)}` : "Join"}
        </button>
      )
  }
}

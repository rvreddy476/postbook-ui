"use client"

/*
  My memberships (/memberships) and one membership (/memberships/[id]),
  where every notice to the member lands. Renewal is by reminder: Renew
  pays for the next month through the same checkout as joining. Change
  level: up pays the pro-rata difference now; down starts at the next
  renewal and charges nothing. Cancel keeps access until the paid month ends.
*/

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react"

import { useBatchProfiles } from "@/hooks/useProfile"
import type { UserProfile } from "@/types/profile"

import { checkoutBusy } from "../checkout"
import { changeLevelIntent, renewIntent, useCancelMembership, useCreatorLevels, useMembershipCheckout, useMyMemberships } from "../hooks"
import { activeLevels, canCancel, canChangeLevel, formatDate, membershipErrorMessage, MY_MEMBERSHIPS_PATH, perMonth, STATUS_LABEL, statusLine, type MyMembership } from "../model"
import { PAYMENT_TERMS, StatusPanel } from "./JoinSheet"

const card = "rounded-2xl border border-brand-divider bg-brand-card"
const primary = "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
const ghost = "inline-flex items-center justify-center gap-2 rounded-full border border-brand-divider px-4 py-2 text-sm font-semibold text-brand-text transition hover:bg-brand-secondary disabled:opacity-50"

function creatorName(p: UserProfile | undefined): string {
  return p?.display_name?.trim() || p?.username?.trim() || "Creator"
}

function Avatar({ profile }: { profile: UserProfile | undefined }) {
  const src = profile?.avatar_media_id ? `/v1/media/${profile.avatar_media_id}/serve` : ""
  return src ? (
    <img src={src} alt="" className="h-11 w-11 shrink-0 rounded-full bg-brand-secondary object-cover" />
  ) : (
    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-base font-semibold text-brand-text">
      {creatorName(profile).slice(0, 1).toUpperCase()}
    </span>
  )
}

function useCreatorProfiles(memberships: readonly MyMembership[]) {
  const ids = useMemo(() => [...new Set(memberships.map((m) => m.creatorId).filter(Boolean))], [memberships])
  const q = useBatchProfiles(ids)
  return q.data ?? new Map<string, UserProfile>()
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-4 pb-16 pt-6">{children}</div>
}

export function MyMembershipsScreen() {
  const q = useMyMemberships()
  const list = q.data ?? []
  const profiles = useCreatorProfiles(list)
  return (
    <Page>
      <h1 className="text-2xl font-bold text-brand-text">Memberships</h1>
      <p className="mt-1 text-sm text-muted-foreground">Creators you support. Renewal isn&apos;t automatic: we remind you before a month ends.</p>
      <div className="mt-5">
        {q.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
          </p>
        ) : q.isError ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {membershipErrorMessage(q.error, "Your memberships couldn't load.")}
          </p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">You aren&apos;t a member of anyone yet. Look for Join on a creator&apos;s profile or a members-only post.</p>
        ) : (
          <ul className="space-y-2" data-membership="my-list">
            {list.map((m) => {
              const p = profiles.get(m.creatorId)
              return (
                <li key={m.subscriptionId}>
                  <Link href={`${MY_MEMBERSHIPS_PATH}/${m.subscriptionId}`} className={`${card} flex items-center gap-3 px-4 py-3 hover:bg-brand-secondary`}>
                    <Avatar profile={p} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-base font-semibold text-brand-text">{creatorName(p)}</span>
                        <StatusChip m={m} />
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {m.tier.name} · {perMonth(m.tier.pricePaise)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{statusLine(m)}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Page>
  )
}

function StatusChip({ m }: { m: MyMembership }) {
  const tone = m.status === "active" ? "bg-success/15 text-success" : m.status === "past_due" || m.status === "grace" ? "bg-warning/15 text-warning" : "bg-brand-secondary text-muted-foreground"
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{STATUS_LABEL[m.status]}</span>
}

export function MembershipDetailScreen({ subscriptionId }: { subscriptionId: string }) {
  const q = useMyMemberships()
  const m = q.data?.find((x) => x.subscriptionId === subscriptionId) ?? null
  const profiles = useCreatorProfiles(m ? [m] : [])
  const p = m ? profiles.get(m.creatorId) : undefined

  return (
    <Page>
      <Link href={MY_MEMBERSHIPS_PATH} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Memberships
      </Link>
      {q.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
        </p>
      ) : q.isError ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {membershipErrorMessage(q.error, "This membership couldn't load.")}
        </p>
      ) : !m ? (
        <p className="text-sm text-muted-foreground">This membership isn&apos;t in your list any more. Memberships that ended over 30 days ago drop off.</p>
      ) : (
        <MembershipDetail m={m} profile={p} />
      )}
    </Page>
  )
}

function MembershipDetail({ m, profile }: { m: MyMembership; profile: UserProfile | undefined }) {
  const checkout = useMembershipCheckout()
  const cancel = useCancelMembership()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)
  const name = creatorName(profile)
  const busy = checkoutBusy(checkout.state)
  const end = formatDate(m.accessUntil || m.currentPeriodEnd)

  const renew = () => void checkout.run(renewIntent(m.subscriptionId, `${m.tier.name} membership — ${perMonth(m.tier.pricePaise)}`))

  const doCancel = () => {
    setCancelError(null)
    cancel.mutate(m.subscriptionId, {
      onSuccess: () => setConfirmCancel(false),
      onError: (e) => setCancelError(membershipErrorMessage(e, "The membership couldn't be cancelled. Try again.")),
    })
  }

  return (
    <div data-membership="detail" className="space-y-4">
      <section className={`${card} p-5`}>
        <div className="flex items-center gap-3">
          <Avatar profile={profile} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-brand-text">{name}</h1>
            {profile?.username ? (
              <Link href={`/u/${profile.username}`} className="text-sm text-muted-foreground hover:underline">
                @{profile.username}
              </Link>
            ) : null}
          </div>
          <StatusChip m={m} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">Level</dt>
            <dd className="text-sm font-semibold text-brand-text">{m.tier.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Price</dt>
            <dd className="text-sm font-semibold text-brand-text">{perMonth(m.tier.pricePaise)}</dd>
          </div>
          {end ? (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">{m.status === "active" ? "Renew by" : m.status === "cancelled_at_period_end" ? "Access until" : m.status === "expired" || m.status === "cancelled" ? "Ended" : "Access until"}</dt>
              <dd className="text-sm font-semibold text-brand-text">{end}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">{statusLine(m)}</p>
      </section>

      <StatusPanel state={checkout.state} creator={name} />

      <div className="flex flex-wrap gap-2">
        {m.renewAvailable ? (
          <button type="button" className={primary} onClick={checkout.state.phase === "dismissed" ? checkout.retryLast : checkout.state.phase === "still_confirming" ? checkout.checkAgain : renew} disabled={busy} data-membership="renew">
            {checkout.state.phase === "still_confirming" ? "Check again" : m.status === "cancelled_at_period_end" ? `Renew and keep it on · ${perMonth(m.tier.pricePaise)}` : `Renew · ${perMonth(m.tier.pricePaise)}`}
          </button>
        ) : null}
        {canChangeLevel(m) ? (
          <button type="button" className={ghost} onClick={() => setChanging((v) => !v)} aria-expanded={changing} disabled={busy}>
            Change level
          </button>
        ) : null}
        {canCancel(m) ? (
          <button type="button" className={ghost} onClick={() => setConfirmCancel(true)} disabled={busy || cancel.isPending} data-membership="cancel">
            Cancel membership
          </button>
        ) : null}
      </div>

      {changing ? <ChangeLevel m={m} onPick={(tierId, label) => void checkout.run(changeLevelIntent(m.subscriptionId, tierId, label))} busy={busy} /> : null}

      {confirmCancel ? (
        <div role="alertdialog" aria-label="Cancel membership" className={`${card} p-4`}>
          <p className="text-sm text-brand-text">{end ? `You keep access until ${end}. After that, members-only posts lock again.` : "You keep access until the paid month ends."} Nothing is refunded.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={ghost} onClick={() => setConfirmCancel(false)}>
              Keep membership
            </button>
            <button type="button" className={primary} onClick={doCancel} disabled={cancel.isPending}>
              {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null} Cancel membership
            </button>
          </div>
          {cancelError ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {cancelError}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">{PAYMENT_TERMS}</p>
    </div>
  )
}

function ChangeLevel({ m, onPick, busy }: { m: MyMembership; onPick: (tierId: string, label: string) => void; busy: boolean }) {
  const levels = useCreatorLevels(m.creatorId)
  const others = activeLevels(levels.data ?? []).filter((t) => t.id !== m.tier.id)
  const from = formatDate(m.currentPeriodEnd)
  if (levels.isLoading) return <p className="text-sm text-muted-foreground">Loading levels…</p>
  if (levels.isError) return <p role="alert" className="text-sm text-muted-foreground">{membershipErrorMessage(levels.error, "Levels couldn't load.")}</p>
  if (others.length === 0) return <p className="text-sm text-muted-foreground">This creator has no other level right now.</p>
  return (
    <ul className={`${card} divide-y divide-brand-divider`} data-membership="change-level">
      {others.map((t) => {
        const up = t.pricePaise > m.tier.pricePaise
        return (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-brand-text">{t.name}</span>
              <span className="block text-xs text-muted-foreground">
                {perMonth(t.pricePaise)} · {up ? "pay the difference for the rest of this month now" : from ? `from ${from}, nothing charged now` : "from your next renewal, nothing charged now"}
              </span>
            </span>
            <button type="button" className={ghost} disabled={busy} onClick={() => onPick(t.id, `Move to ${t.name} — ${perMonth(t.pricePaise)}`)}>
              {up ? "Upgrade" : "Switch"}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

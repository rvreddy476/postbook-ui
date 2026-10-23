"use client"

/*
  The creator's members (/monetization/members), where the new-member
  notice lands: who joined, on which level at the price they pay, since
  when and until when. GET /v1/monetization/members pages by
  meta.next_cursor, newest first. A row carries only what that member pays
  this creator. A person the server could not name shows as "A member".
*/

import { useMemo } from "react"
import Link from "next/link"
import { AlertCircle, Loader2, Users } from "lucide-react"

import { useCreatorMembers } from "../hooks"
import { CREATOR_LEVELS_PATH, CREATOR_MEMBERS_PATH, formatDate, isMembershipsOff, membershipErrorMessage, perMonth, personName, STATUS_LABEL, type CreatorMember } from "../model"
import { CreatorNav } from "./LevelsScreen"
import { PersonAvatar } from "./MyMemberships"

const card = "rounded-2xl border border-brand-divider bg-brand-card"

export function CreatorMembersScreen() {
  const q = useCreatorMembers()
  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.rows) ?? [], [q.data])
  const off = isMembershipsOff(q.error)

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-brand-text">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">People with a live membership, newest first. Each pays by reminder every month; nothing renews by itself.</p>
        </header>
        <CreatorNav current={CREATOR_MEMBERS_PATH} />

        <div data-membership="creator-members">
          {q.isPending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your members…
            </p>
          ) : off ? (
            <div role="status" className={`${card} flex gap-3 p-5`}>
              <AlertCircle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-brand-text">Memberships aren&apos;t available yet. Your members will show here when they are.</p>
            </div>
          ) : q.isError && rows.length === 0 ? (
            <p role="alert" className="text-sm text-muted-foreground">
              {membershipErrorMessage(q.error, "Your members couldn't load.")}{" "}
              <button type="button" className="font-semibold text-primary-ink underline underline-offset-2" onClick={() => void q.refetch()}>
                Try again
              </button>
            </p>
          ) : rows.length === 0 ? (
            <div className={`${card} flex flex-col items-center gap-2 px-6 py-10 text-center`}>
              <Users className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-semibold text-brand-text">No members yet</p>
              <p className="text-sm text-muted-foreground">
                When someone joins one of your levels, they show here.{" "}
                <Link href={CREATOR_LEVELS_PATH} className="font-semibold text-primary-ink underline underline-offset-2">
                  Your levels
                </Link>
              </p>
            </div>
          ) : (
            <ul className={`${card} divide-y divide-brand-divider`}>
              {rows.map((m) => (
                <MemberRow key={m.subscriptionId} m={m} />
              ))}
            </ul>
          )}
          {q.hasNextPage ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => void q.fetchNextPage()}
                disabled={q.isFetchingNextPage}
                className="rounded-full border border-brand-divider bg-brand-card px-4 py-2 text-sm font-semibold text-brand-text hover:bg-brand-secondary disabled:opacity-50"
              >
                {q.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** "Since 3 Oct 2026 · access until 3 Nov 2026" (either half only when known). */
export function memberDates(m: Pick<CreatorMember, "since" | "accessUntil">): string {
  const since = formatDate(m.since)
  const until = formatDate(m.accessUntil)
  return [since ? `Since ${since}` : "", until ? `access until ${until}` : ""].filter(Boolean).join(" · ")
}

function MemberRow({ m }: { m: CreatorMember }) {
  const name = personName(m.subscriber, "A member")
  const dates = memberDates(m)
  const chip = m.status === "past_due" || m.status === "grace" ? "bg-warning/15 text-warning" : m.status === "active" ? "bg-success/15 text-success" : "bg-brand-secondary text-muted-foreground"
  const who = (
    <>
      <PersonAvatar person={m.subscriber} fallback="A member" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-base font-semibold text-brand-text">{name}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${chip}`}>{STATUS_LABEL[m.status]}</span>
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {m.subscriber.username ? `@${m.subscriber.username} · ` : ""}
          {m.tier.name} · {perMonth(m.tier.pricePaise)}
        </span>
        {dates ? <span className="block truncate text-xs text-muted-foreground">{dates}</span> : null}
      </span>
    </>
  )
  return (
    <li data-member={m.subscriptionId}>
      {m.subscriber.username ? (
        <Link href={`/u/${encodeURIComponent(m.subscriber.username)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-secondary">
          {who}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">{who}</div>
      )}
    </li>
  )
}

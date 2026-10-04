"use client"

/* /doorstep/bookings — upcoming and past bookings (GET /bookings?status=). */

import { CalendarCheck, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { categoryIcon, ErrorState, Skel, StateBlock, StatusTag } from "../components/parts"
import { useBookings, useCatalogue } from "../hooks/queries"
import { formatPaise } from "../model/money"
import { formatSlot } from "../model/slots"

type Tab = "upcoming" | "past"

const TABS: { value: Tab; label: string }[] = [
  { value: "past", label: "Past" },
  { value: "upcoming", label: "Upcoming" },
]

export function BookingsScreen() {
  const [tab, setTab] = useState<Tab>("upcoming")
  const list = useBookings(tab)
  const catalogue = useCatalogue()
  const familyOf = (slug: string) => catalogue.data?.categories.find((c) => c.slug === slug)?.family ?? "HOME_CLEANING"

  return (
    <>
      <div className="ds-head">
        <h1 className="ds-title">Bookings</h1>
        <Link href="/doorstep" className="ds-btn ds-btn--outline ds-btn--sm">
          Book a service
        </Link>
      </div>
      <div className="ds-tabs" role="group" aria-label="Which bookings">
        {TABS.map((t) => (
          <button key={t.value} type="button" aria-pressed={tab === t.value} onClick={() => setTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="ds-stack">
          <Skel h={64} />
          <Skel h={64} />
        </div>
      ) : list.isError ? (
        <ErrorState error={list.error} what="Your bookings" onRetry={() => void list.refetch()} />
      ) : !list.data?.items.length ? (
        <StateBlock icon={<CalendarCheck size={22} />} title={tab === "upcoming" ? "Nothing booked yet" : "No past bookings"} text={tab === "upcoming" ? "Your next visit will show here." : undefined} />
      ) : (
        <ul className="ds-blist">
          {list.data.items.map((b) => {
            const Icon = categoryIcon(b.categorySlug, familyOf(b.categorySlug))
            return (
              <li key={b.id}>
                <Link href={`/doorstep/bookings/${encodeURIComponent(b.id)}`} className="ds-bitem">
                  <span className="ds-cat__icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span className="ds-grow">
                    <strong className="ds-truncate" style={{ display: "block" }}>
                      {b.serviceName}
                    </strong>
                    <span className="ds-meta">
                      {formatSlot(b.slotStart)} · {formatPaise(b.totalPaise)}
                    </span>
                  </span>
                  <StatusTag status={b.status} />
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

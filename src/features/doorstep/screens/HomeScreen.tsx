"use client"

/*
  /doorstep — the city's categories (GET /catalogue?city=HYD), searchable,
  with the visit address and the outstanding-dues banner on top.
*/

import { MapPinned, Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { AddressBar } from "../components/AddressBar"
import { categoryIcon, DuesBanner, ErrorState, PriceTag, Skel, StateBlock } from "../components/parts"
import { useCatalogue, useOutstanding } from "../hooks/queries"
import type { CategorySummary } from "../model/wire"

function matchesCategory(c: CategorySummary, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return `${c.name} ${c.description}`.toLowerCase().includes(needle)
}

export function HomeScreen() {
  const catalogue = useCatalogue()
  const outstanding = useOutstanding()
  const [q, setQ] = useState("")

  const list = useMemo(() => [...(catalogue.data?.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)).filter((c) => matchesCategory(c, q)), [catalogue.data, q])

  return (
    <>
      <div className="ds-head">
        <div>
          <h1 className="ds-title">Home services</h1>
          <p className="ds-sub">Fixed prices, booked into a slot, done by verified professionals.</p>
        </div>
        <span className="ds-city">
          <MapPinned size={14} aria-hidden="true" />
          {catalogue.data?.city.name ?? "Hyderabad"}
        </span>
      </div>

      <DuesBanner outstanding={outstanding.data} />
      <AddressBar />

      <label className="ds-search">
        <Search size={16} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cleaning, AC, salon…" aria-label="Search services" type="search" />
      </label>

      {catalogue.isLoading ? (
        <ul className="ds-cats" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i}>
              <Skel h={128} />
            </li>
          ))}
        </ul>
      ) : catalogue.isError ? (
        <ErrorState error={catalogue.error} what="Services" onRetry={() => void catalogue.refetch()} />
      ) : !list.length ? (
        <StateBlock icon={<Search size={22} />} title={q ? "Nothing matches" : "No services yet"} text={q ? "Try another word." : "Services in this city will show here."} />
      ) : (
        <ul className="ds-cats" aria-label="Categories">
          {list.map((c) => {
            const Icon = categoryIcon(c.slug, c.family)
            return (
              <li key={c.id}>
                <Link href={`/doorstep/c/${encodeURIComponent(c.slug)}`} className="ds-cat">
                  <span className="ds-cat__icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <p className="ds-cat__name">{c.name}</p>
                  <p className="ds-cat__desc">{c.description}</p>
                  <span className="ds-meta">
                    <PriceTag price={c.startingPricePaise} mrp={null} from />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

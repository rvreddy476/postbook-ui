"use client"

import { ArrowRight, CalendarDays, Check, ChevronRight, Headphones, Search, X } from "lucide-react"
import { PortalLink as Link } from "@/components/auth/PortalLink"
import { useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AvailabilityState, DuesBanner, ErrorState, FromPrice, Skel, StateBlock } from "../components/parts"
import { StorefrontArtwork } from "../components/StorefrontArtwork"
import { useCatalogue, useOutstanding } from "../hooks/queries"
import { serviceDirectoryCategories, serviceDirectoryGroups } from "../model/storefront"
import type { CategorySummary } from "../model/wire"

export function HomeScreen() {
  const params = useSearchParams()
  const initialQuery = (params.get("q") ?? "").slice(0, 120)
  const catalogue = useCatalogue()
  const outstanding = useOutstanding()
  return <>
    <DuesBanner outstanding={outstanding.data} />
    {catalogue.isLoading ? <div className="dsc-home-loading"><Skel h={330} /><Skel h={150} /></div> : catalogue.isError ?
      <ErrorState error={catalogue.error} what="Services" onRetry={() => void catalogue.refetch()} /> :
      !catalogue.data?.categories.length ? <AvailabilityState text="There are no home services listed for your area at the moment. Please check back later." /> :
      <StorefrontHome key={initialQuery} initialQuery={initialQuery} categories={catalogue.data.categories} />}
  </>
}

const BOOKING_STEPS = [
  { icon: Search, title: "Choose a service", text: "Explore options and see what’s included." },
  { icon: CalendarDays, title: "Make it work for you", text: "Compare prices, professionals and available times." },
  { icon: Check, title: "You’re all set", text: "Review your booking, pay and manage it in one place." },
]

/** The directory, categories and prices all use the active city's live catalogue. */
export function StorefrontHome({ categories, initialQuery = "" }: { categories: CategorySummary[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [groupId, setGroupId] = useState("all")
  const directory = useRef<HTMLElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const groups = useMemo(() => serviceDirectoryGroups(categories), [categories])
  const list = useMemo(() => serviceDirectoryCategories(categories, groupId, query), [categories, groupId, query])
  const selectedGroup = groups.find(group => group.id === groupId)
  const clearSearch = () => { setQuery(""); setGroupId("all"); searchInput.current?.focus() }
  return <div className="dsh-home">
    <section className="dsh-hero" aria-labelledby="doorstep-home-title">
      <div className="dsh-hero__panel">
        <h1 id="doorstep-home-title">Home services, made simple.</h1>
        <p>Cleaning, repairs and care. Right at your doorstep.</p>
        <form role="search" className="dsh-search" onSubmit={event => { event.preventDefault(); directory.current?.scrollIntoView({ block: "start", behavior: "smooth" }) }}>
          <input ref={searchInput} type="search" value={query} maxLength={120} onChange={event => { setQuery(event.target.value); setGroupId("all") }} aria-label="Search home services" placeholder="Search for a service, e.g. AC repair" />
          {query && <button type="button" className="dsh-search__clear" onClick={clearSearch} aria-label="Clear service search"><X size={17} aria-hidden /></button>}
          <button type="submit" className="dsh-search__submit" aria-label="View matching services"><Search size={21} aria-hidden /><span>Search</span></button>
        </form>
      </div>
    </section>

    <section ref={directory} className="dsh-directory" aria-labelledby="doorstep-categories">
      <div className="dsh-directory__heading"><h2 id="doorstep-categories">All home services</h2><span>Choose a service to get started</span></div>
      <div className="dsh-directory__layout">
        <nav className="dsh-category-nav" aria-label="Browse service categories">
          <h3>Categories</h3>
          <div><button type="button" aria-pressed={groupId === "all"} onClick={() => setGroupId("all")}>All services <ChevronRight size={15} aria-hidden /></button>
            {groups.map(group => <button type="button" key={group.id} aria-pressed={groupId === group.id} onClick={() => setGroupId(group.id)}>{group.label}<ChevronRight size={15} aria-hidden /></button>)}
          </div>
          <Link href="/grievance" className="dsh-directory-help"><Headphones size={22} aria-hidden /><span>Need a hand?<small>Contact support</small></span></Link>
        </nav>
        <div className="dsh-directory__results">
          <div className="dsh-results-title"><h3>{query.trim() ? "Search results" : selectedGroup?.label ?? "Explore our services"}</h3><span role="status">{list.length} {list.length === 1 ? "category" : "categories"}</span></div>
          {!list.length ? <StateBlock icon={<Search size={24} />} title="No matching services" text="Try another service name or browse all categories." action={<button type="button" className="ds-btn ds-btn--outline" onClick={clearSearch}>Clear search</button>} /> :
            <ul className="dsh-service-grid" aria-label="Service categories">{list.map(category => <li key={category.id}>
              <Link href={"/doorstep/c/" + encodeURIComponent(category.slug)} className="dsh-service-card">
                <StorefrontArtwork slug={category.slug} family={category.family} imageUrl={category.imageUrl} />
                <div><h3>{category.name}</h3><p>{category.description}</p><span className="dsh-service-card__footer"><span>{category.startingPricePaise !== null ? <FromPrice paise={category.startingPricePaise} /> : "Explore services"}</span><ChevronRight size={18} aria-hidden /></span></div>
              </Link>
            </li>)}</ul>}
        </div>
      </div>
    </section>

    {!query.trim() && <>
      <section className="dsh-how" aria-labelledby="doorstep-how"><h2 id="doorstep-how">A little help. A lot less to do.</h2><div>{BOOKING_STEPS.map(({ icon: Icon, title, text }) => <article key={title}><span><Icon size={28} strokeWidth={1.5} aria-hidden /></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section className="dsh-professional-cta"><div><h2>Great at what you do?</h2><p>Bring your skills to Doorstep.</p></div><Link href="/doorstep/partner" signInAs="doorstep-partner" className="ds-btn ds-btn--outline">Become a professional<ArrowRight size={16} aria-hidden /></Link></section>
    </>}
  </div>
}

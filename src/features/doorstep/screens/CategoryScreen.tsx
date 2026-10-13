"use client"

import { ArrowLeft, ArrowRight, Clock, Search, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { DuesBanner, ErrorState, FromPrice, Skel, StateBlock } from "../components/parts"
import { StorefrontArtwork } from "../components/StorefrontArtwork"
import { useCategory, useOutstanding } from "../hooks/queries"
import { formatDuration, genderRuleNote } from "../model/selection"
import type { CategoryPage } from "../model/wire"

export function CategoryScreen({ slug }: { slug: string }) {
  const page = useCategory(slug)
  const outstanding = useOutstanding()
  return <>
    <DuesBanner outstanding={outstanding.data} />
    {page.isLoading ? <div className="dsc-home-loading"><Skel h={220} /><Skel h={200} /></div> : page.isError || !page.data ? <ErrorState error={page.error} what="This category" onRetry={() => void page.refetch()} /> : <StorefrontCategory page={page.data} />}
  </>
}

export function StorefrontCategory({ page }: { page: CategoryPage }) {
  const { category, services } = page
  return <>
    <div className="dsc-breadcrumb"><Link href="/doorstep"><ArrowLeft size={15} aria-hidden />Home services</Link><span aria-hidden>/</span><span>{category.name}</span></div>
    <section className="dsc-service-hero"><div><p className="dsc-eyebrow">Home comfort, taken care of</p><h1>{category.name}</h1><p>{category.description}</p><div className="dsc-service-points"><span><ShieldCheck size={17} aria-hidden />Reviewed professionals</span><span><Clock size={17} aria-hidden />Choose your time</span></div></div><StorefrontArtwork slug={category.slug} family={category.family} imageUrl={category.imageUrl} /></section>
    {genderRuleNote(category.genderRule) && <p className="ds-info">{genderRuleNote(category.genderRule)}</p>}
    {!services.length ? <StateBlock icon={<Search size={22} />} title="No services here yet" text="Please check back soon, or explore another category." action={<Link href="/doorstep" className="ds-btn ds-btn--outline">Explore services</Link>} /> :
      <div className="dsc-service-layout"><section className="dsc-service-list" aria-label="Services"><h2 className="dsc-list-heading">Choose your service</h2>{services.map(service => <article className="dsc-catalogue-service" key={service.id}><div><h2><Link href={`/doorstep/s/${encodeURIComponent(service.id)}`}>{service.name}</Link></h2><p>{service.description}</p><div className="dsc-service-meta"><FromPrice paise={service.startingPricePaise} />{service.durationMinutes > 0 && <span><Clock size={14} aria-hidden />{formatDuration(service.durationMinutes)}</span>}</div></div><div className="dsc-catalogue-service__action"><StorefrontArtwork slug={service.slug} categorySlug={category.slug} family={category.family} imageUrl={service.imageUrl} /><Link href={`/doorstep/s/${encodeURIComponent(service.id)}`} className="ds-btn ds-btn--outline" aria-label={`View ${service.name}`}>View options<ArrowRight size={14} aria-hidden /></Link></div></article>)}</section>
        <aside className="dsc-summary dsc-summary--category"><span className="dsc-summary__icon"><ShieldCheck size={25} aria-hidden /></span><h2>Care that fits your home</h2><p>Choose a service to see its options and inclusions. Then compare professionals and available times.</p><Link href="/doorstep/bookings" className="dsc-link">Already booked? View your bookings<ArrowRight size={15} aria-hidden /></Link></aside>
      </div>}
  </>
}

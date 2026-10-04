"use client"

/* /doorstep/c/[slug] — the services in one category (GET /categories/:slug?city=HYD). */

import { ArrowLeft, Clock, Search } from "lucide-react"
import Link from "next/link"

import { categoryIcon, DuesBanner, ErrorState, PriceTag, Skel, StateBlock } from "../components/parts"
import { useCategory, useOutstanding } from "../hooks/queries"
import { formatDuration, genderRuleNote } from "../model/selection"

export function CategoryScreen({ slug }: { slug: string }) {
  const page = useCategory(slug)
  const outstanding = useOutstanding()
  const p = page.data

  return (
    <>
      <div className="ds-head">
        <div className="ds-row">
          <Link href="/doorstep" className="ds-back" aria-label="Back to all services">
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          {p ? (
            <>
              <span className="ds-cat__icon" aria-hidden="true">
                {(() => {
                  const Icon = categoryIcon(p.category.slug, p.category.family)
                  return <Icon size={20} />
                })()}
              </span>
              <div className="ds-grow">
                <h1 className="ds-title">{p.category.name}</h1>
                <p className="ds-sub">{p.category.description}</p>
              </div>
            </>
          ) : (
            <h1 className="ds-title">Services</h1>
          )}
        </div>
      </div>

      <DuesBanner outstanding={outstanding.data} />
      {p && genderRuleNote(p.category.genderRule) ? <p className="ds-info" style={{ marginBottom: 16 }}>{genderRuleNote(p.category.genderRule)}</p> : null}

      {page.isLoading ? (
        <div className="ds-card">
          <Skel h={56} />
          <Skel h={56} />
          <Skel h={56} />
        </div>
      ) : page.isError ? (
        <ErrorState error={page.error} what="This category" onRetry={() => void page.refetch()} />
      ) : !p?.services.length ? (
        <StateBlock icon={<Search size={22} />} title="No services here yet" />
      ) : (
        <section className="ds-card" aria-label="Services">
          <ul className="ds-svcs">
            {p.services.map((s) => (
              <li key={s.id}>
                <Link href={`/doorstep/s/${encodeURIComponent(s.id)}`} className="ds-svc">
                  <div className="ds-grow">
                    <p className="ds-svc__name">{s.name}</p>
                    <p className="ds-svc__desc">{s.description}</p>
                    <div className="ds-row ds-wrap" style={{ marginTop: 4 }}>
                      <PriceTag price={s.startingPricePaise} mrp={s.startingMrpPaise} from />
                      {s.durationMinutes ? (
                        <span className="ds-meta ds-row" style={{ gap: 4 }}>
                          <Clock size={12} aria-hidden="true" />
                          {formatDuration(s.durationMinutes)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="ds-btn ds-btn--outline ds-btn--sm" aria-hidden="true">
                    View
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

"use client"

/*
  /feast — restaurants for the chosen address.

  With a pinned address the list is asked for that point, so each
  restaurant carries its distance and the server's serviceability; the
  server orders it (serviceable first, then nearest) and that order is kept.
  An unserviceable restaurant still opens — browsing is always allowed —
  but shows its card.
*/

import { MapPin, Search, Star, Store, UtensilsCrossed, X } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { AddressBar } from "../components/AddressBar"
import { ServiceCardView, Skel, StateBlock } from "../components/parts"
import { useChosenAddress, useRestaurants } from "../hooks/queries"
import { formatPaise } from "../model/money"
import { filterRestaurants } from "../model/discovery"
import { canOrder, formatDistance, serviceCard } from "../model/serviceability"
import type { Restaurant } from "../model/wire"

function RestaurantCard({ r }: { r: Restaurant }) {
  const [failedImage,setFailedImage] = useState(false)
  const card = serviceCard(r)
  const distance = formatDistance(r.distanceMeters)
  return (
    <li>
      <Link href={`/feast/r/${encodeURIComponent(r.id)}`} className={canOrder(card) ? "fc-rest" : "fc-rest is-blocked"}>
        {r.heroImageUrl && !failedImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="fc-rest__img" src={r.heroImageUrl} alt="" loading="lazy" onError={() => setFailedImage(true)} />
        ) : (
          <div className="fc-rest__img" aria-hidden="true">
            <UtensilsCrossed size={28} />
          </div>
        )}
        <div className="fc-rest__body">
          <div className="fc-row">
            <h2 className="fc-rest__name fc-grow fc-truncate">{r.name}</h2>
            {r.avgRating !== null && r.ratingCount > 0 ? (
              <span className="fc-rating" aria-label={`Rated ${r.avgRating.toFixed(1)} from ${r.ratingCount} ratings`}>
                <Star size={12} aria-hidden="true" />
                {r.avgRating.toFixed(1)}
              </span>
            ) : null}
          </div>
          {r.cuisines.length ? <p className="fc-meta fc-truncate" style={{ margin: 0 }}>{r.cuisines.join(", ")}</p> : null}
          <p className="fc-meta" style={{ margin: 0 }}>
            {r.estimatedDelivery ? <span>{r.estimatedDelivery}</span> : null}
            {distance ? <span className={r.estimatedDelivery ? "fc-dot" : undefined}>{distance}</span> : null}
            {r.minOrderPaise ? <span className="fc-dot">Min {formatPaise(r.minOrderPaise)}</span> : null}
          </p>
          <ServiceCardView card={card} />
        </div>
      </Link>
    </li>
  )
}

export function HomeScreen() {
  const [query,setQuery] = useState("")
  const [cuisine,setCuisine] = useState("")
  const { addresses, chosen, pin, choose } = useChosenAddress()
  const ready = !addresses.isLoading
  const restaurants = useRestaurants(pin, ready)
  const cuisines = useMemo(() => Array.from(new Set((restaurants.data ?? []).flatMap(r => r.cuisines))).sort(),[restaurants.data])
  const visible = filterRestaurants(restaurants.data ?? [],query,cuisine)

  return (
    <>
      <div className="fc-head fc-discovery-head">
        <div>
          <span className="workspace-eyebrow"><UtensilsCrossed size={15} aria-hidden/>Made for your cravings</span>
          <h1 className="fc-title">Find your next favourite.</h1>
          <p className="fc-sub">{pin ? "Restaurants that deliver to you come first." : "Choose an address to see who delivers to you."}</p>
        </div>
        <AddressBar addresses={addresses.data ?? []} chosen={chosen} loading={addresses.isLoading} failed={addresses.isError} onChoose={choose} />
      </div>
      {chosen && !pin ? (
        <p className="fc-info" style={{ marginBottom: 16 }}>
          This address has no map pin, so delivery can&apos;t be checked yet. <Link className="fc-link" href="/feast/addresses">Add one with your location</Link>.
        </p>
      ) : null}

      <div className="fc-discovery-controls">
        <div className="fc-discovery-search"><Search size={18} aria-hidden/><input type="search" aria-label="Search restaurants and cuisines" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search restaurants and cuisines"/>{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear restaurant search"><X size={16}/></button> : null}</div>
        {cuisines.length > 0 ? <div className="fc-cuisine-filters" role="group" aria-label="Filter by cuisine"><button type="button" aria-pressed={!cuisine} onClick={() => setCuisine("")}>All cuisines</button>{cuisines.map(value => <button key={value} type="button" aria-pressed={cuisine === value} onClick={() => setCuisine(value)}>{value}</button>)}</div> : null}
      </div>

      {!ready || restaurants.isLoading ? (
        <ul className="fc-list" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="fc-stack">
              <Skel h={150} />
              <Skel h={14} w="60%" />
              <Skel h={12} w="40%" />
            </li>
          ))}
        </ul>
      ) : restaurants.isError ? (
        <StateBlock
          icon={<Store size={22} />}
          title="Restaurants couldn't be loaded"
          text={(restaurants.error as Error)?.message || "Please try again."}
          action={
            <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" onClick={() => restaurants.refetch()}>
              Try again
            </button>
          }
        />
      ) : !restaurants.data?.length ? (
        <StateBlock
          icon={<MapPin size={22} />}
          title="No restaurants here yet"
          text={pin ? "Nobody is listed near this address. Try another one." : "Nothing is listed yet."}
        />
      ) : !visible.length ? (
        <StateBlock icon={<Search size={22}/>} title="No restaurants match" text="Try another name or cuisine." action={<button type="button" className="fc-btn fc-btn--outline" onClick={() => {setQuery("");setCuisine("")}}>Clear filters</button>}/>
      ) : (
        <section aria-label="Restaurants">
        <div className="fc-results-head"><h2>{pin ? "Restaurants near you" : "Explore restaurants"}</h2><span className="fc-meta" role="status">{visible.length} {visible.length === 1 ? "restaurant" : "restaurants"}</span></div>
        <ul className="fc-list">
          {visible.map((r) => (
            <RestaurantCard key={r.id} r={r} />
          ))}
        </ul>
        </section>
      )}
    </>
  )
}

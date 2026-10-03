"use client"

/*
  /feast — restaurants for the chosen address.

  With a pinned address the list is asked for that point, so each
  restaurant carries its distance and the server's serviceability; the
  server orders it (serviceable first, then nearest) and that order is kept.
  An unserviceable restaurant still opens — browsing is always allowed —
  but shows its card.
*/

import { MapPin, Star, Store, UtensilsCrossed } from "lucide-react"
import Link from "next/link"

import { AddressBar } from "../components/AddressBar"
import { ServiceCardView, Skel, StateBlock } from "../components/parts"
import { useChosenAddress, useRestaurants } from "../hooks/queries"
import { formatPaise } from "../model/money"
import { canOrder, formatDistance, serviceCard } from "../model/serviceability"
import type { Restaurant } from "../model/wire"

function RestaurantCard({ r }: { r: Restaurant }) {
  const card = serviceCard(r)
  const distance = formatDistance(r.distanceMeters)
  return (
    <li>
      <Link href={`/feast/r/${encodeURIComponent(r.id)}`} className={canOrder(card) ? "fc-rest" : "fc-rest is-blocked"}>
        {r.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="fc-rest__img" src={r.heroImageUrl} alt="" loading="lazy" />
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
  const { addresses, chosen, pin, choose } = useChosenAddress()
  const ready = !addresses.isLoading
  const restaurants = useRestaurants(pin, ready)

  return (
    <>
      <div className="fc-head">
        <div>
          <h1 className="fc-title">Order food</h1>
          <p className="fc-sub">{pin ? "Restaurants that deliver to you come first." : "Choose an address to see who delivers to you."}</p>
        </div>
      </div>

      <AddressBar addresses={addresses.data ?? []} chosen={chosen} loading={addresses.isLoading} failed={addresses.isError} onChoose={choose} />
      {chosen && !pin ? (
        <p className="fc-info" style={{ marginBottom: 16 }}>
          This address has no map pin, so delivery can&apos;t be checked yet. <Link className="fc-link" href="/feast/addresses">Add one with your location</Link>.
        </p>
      ) : null}

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
      ) : (
        <ul className="fc-list">
          {restaurants.data.map((r) => (
            <RestaurantCard key={r.id} r={r} />
          ))}
        </ul>
      )}
    </>
  )
}

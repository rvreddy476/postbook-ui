"use client"

/*
  /feast/r/[id] — the restaurant and its menu.

  Add → POST /cart/items with variant_id, addons and the chosen address_id.
    409 FOOD_CART_RESTAURANT_CONFLICT → ask, then resend with clear_existing.
    422 a serviceability refusal     → remembered for this address; the card shows the server's words.
    422 anything else                → the server's message in the sheet.
    404                               → the address is gone: choose one again.
*/

import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Clock, Star, UtensilsCrossed } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import { useGlobalToast } from "@/contexts/ToastContext"

import { toFeastError } from "../api/client"
import { AddressBar } from "../components/AddressBar"
import { ItemSheet } from "../components/ItemSheet"
import { ServiceCardView, Skel, StateBlock, VegMark } from "../components/parts"
import { keys, useAddToCart, useChosenAddress, useMenu, useRestaurant } from "../hooks/queries"
import { CHOSEN_ADDRESS_KEY } from "../model/address"
import { cartBody, initialSheet, needsSheet, type SheetState } from "../model/itemSheet"
import { formatPaise } from "../model/money"
import { canOrder, formatDistance, fromRefusal, recallRefusal, rememberRefusal, serviceCard, type ServiceCard } from "../model/serviceability"
import type { MenuItem } from "../model/wire"

function localStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

function DishRow({ item, blocked, onAdd }: { item: MenuItem; blocked: boolean; onAdd: () => void }) {
  const price = item.variants.length ? Math.min(...item.variants.map((v) => v.pricePaise)) : item.discountPricePaise ?? item.basePricePaise
  const struck = !item.variants.length && item.discountPricePaise !== null && item.discountPricePaise < item.basePricePaise
  return (
    <div className="fc-dish">
      <div className="fc-grow">
        <div className="fc-row">
          <VegMark foodType={item.foodType} />
          <h3 className="fc-dish__name">{item.name}</h3>
          {item.isRecommended ? <span className="fc-tag">Bestseller</span> : null}
        </div>
        <div style={{ marginTop: 2 }}>
          <span className="fc-price">{item.variants.length ? `From ${formatPaise(price)}` : formatPaise(price)}</span>
          {struck ? <span className="fc-strike">{formatPaise(item.basePricePaise)}</span> : null}
        </div>
        {item.description ? <p className="fc-dish__desc">{item.description}</p> : null}
        {needsSheet(item) ? <p className="fc-meta" style={{ margin: "2px 0 0" }}>Customisable</p> : null}
      </div>
      <div className="fc-stack" style={{ alignItems: "center", gap: 6 }}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="fc-dish__img" src={item.imageUrl} alt="" loading="lazy" />
        ) : null}
        <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" onClick={onAdd} disabled={!item.isAvailable || blocked} aria-label={`Add ${item.name}`}>
          {item.isAvailable ? "Add" : "Sold out"}
        </button>
      </div>
    </div>
  )
}

export function RestaurantScreen({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient()
  const toast = useGlobalToast()
  const { addresses, chosen, pin, choose } = useChosenAddress()
  const restaurant = useRestaurant(restaurantId, pin, !addresses.isLoading)
  const menu = useMenu(restaurantId)
  const add = useAddToCart()

  const [open, setOpen] = useState<MenuItem | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)
  const [remembered, setRemembered] = useState<ServiceCard | null>(null)
  const [conflict, setConflict] = useState<{ item: MenuItem; state: SheetState } | null>(null)

  const addressId = chosen?.id ?? null
  useEffect(() => setRemembered(recallRefusal(localStore(), restaurantId, addressId)), [restaurantId, addressId])

  const card = restaurant.data ? serviceCard(restaurant.data, remembered) : null
  const blocked = card ? !canOrder(card) : false

  const categories = useMemo(
    () => (menu.data?.categories ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder).filter((c) => c.items.length),
    [menu.data],
  )

  const send = useCallback(
    (item: MenuItem, state: SheetState, clearExisting = false) => {
      setSheetError(null)
      add.mutate(cartBody(item, state, addressId, clearExisting), {
        onSuccess: () => {
          setOpen(null)
          setConflict(null)
          toast({ type: "success", title: `${item.name} added`, description: "Open your cart when you're ready." })
        },
        onError: (error) => {
          const e = toFeastError(error)
          if (e.status === 409 && e.code === "FOOD_CART_RESTAURANT_CONFLICT") {
            setConflict({ item, state })
            return
          }
          if (e.status === 404) {
            // The address (or the dish) is gone. Make the customer choose again.
            try {
              localStore()?.removeItem(CHOSEN_ADDRESS_KEY)
            } catch {
              /* ignore */
            }
            void qc.invalidateQueries({ queryKey: keys.addresses })
            void qc.invalidateQueries({ queryKey: keys.menu(restaurantId) })
            setSheetError("That address or dish is no longer available. Choose your address again and retry.")
            return
          }
          const refusal = fromRefusal(e.code, e.fromServer ? e.message : "")
          if (refusal) {
            rememberRefusal(localStore(), restaurantId, addressId, refusal)
            setRemembered(refusal)
            setOpen(null)
            return
          }
          setSheetError(e.message)
        },
      })
    },
    [add, addressId, qc, restaurantId, toast],
  )

  const onAddClicked = (item: MenuItem) => {
    if (needsSheet(item)) {
      setSheetError(null)
      setOpen(item)
    } else {
      send(item, initialSheet(item))
    }
  }

  if (restaurant.isError && menu.isError) {
    const e = toFeastError(restaurant.error)
    return (
      <StateBlock
        icon={<UtensilsCrossed size={22} />}
        title={e.status === 404 ? "This restaurant isn't on Feast" : "This restaurant couldn't be loaded"}
        text={e.status === 404 ? undefined : e.message}
        action={
          <Link href="/feast" className="fc-btn fc-btn--outline fc-btn--sm">
            Back to restaurants
          </Link>
        }
      />
    )
  }

  const r = restaurant.data
  return (
    <>
      <div className="fc-row" style={{ marginBottom: 8 }}>
        <Link href="/feast" className="fc-back" aria-label="Back to restaurants">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
      </div>

      {!r && restaurant.isError ? (
        <p className="fc-alert" role="alert" style={{ marginBottom: 16 }}>
          {toFeastError(restaurant.error).message}
        </p>
      ) : !r ? (
        <div className="fc-stack" style={{ marginBottom: 16 }}>
          <Skel h={160} />
          <Skel h={20} w="50%" />
          <Skel h={12} w="30%" />
        </div>
      ) : (
        <section className="fc-hero">
          {r.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="fc-hero__img" src={r.heroImageUrl} alt="" />
          ) : null}
          <h1 className="fc-title">{r.name}</h1>
          {r.cuisines.length ? <p className="fc-sub">{r.cuisines.join(", ")}</p> : null}
          <p className="fc-meta fc-row" style={{ margin: 0, flexWrap: "wrap" }}>
            {r.avgRating !== null && r.ratingCount > 0 ? (
              <span className="fc-rating">
                <Star size={12} aria-hidden="true" />
                {r.avgRating.toFixed(1)} <span className="fc-meta">({r.ratingCount})</span>
              </span>
            ) : null}
            {r.estimatedDelivery ? (
              <span className="fc-row" style={{ gap: 4 }}>
                <Clock size={12} aria-hidden="true" />
                {r.estimatedDelivery}
              </span>
            ) : null}
            {formatDistance(r.distanceMeters) ? <span>{formatDistance(r.distanceMeters)}</span> : null}
            {r.minOrderPaise ? <span>Min order {formatPaise(r.minOrderPaise)}</span> : null}
          </p>
          {card ? <ServiceCardView card={card} /> : null}
        </section>
      )}

      <AddressBar addresses={addresses.data ?? []} chosen={chosen} loading={addresses.isLoading} failed={addresses.isError} onChoose={choose} />

      {conflict ? (
        <div className="fc-card" role="alertdialog" aria-labelledby="fc-conflict" style={{ marginBottom: 16 }}>
          <p id="fc-conflict" style={{ margin: 0 }}>Your cart has dishes from another restaurant. Start a new cart with {conflict.item.name}?</p>
          <div className="fc-row">
            <button type="button" className="fc-btn fc-btn--primary fc-btn--sm" disabled={add.isPending} onClick={() => send(conflict.item, conflict.state, true)}>
              Start a new cart
            </button>
            <button type="button" className="fc-btn fc-btn--ghost fc-btn--sm" onClick={() => setConflict(null)}>
              Keep my cart
            </button>
          </div>
        </div>
      ) : null}

      {menu.isLoading ? (
        <div className="fc-stack">
          {Array.from({ length: 4 }, (_, i) => (
            <Skel key={i} h={88} />
          ))}
        </div>
      ) : menu.isError ? (
        <StateBlock
          title="The menu couldn't be loaded"
          text={toFeastError(menu.error).message}
          action={
            <button type="button" className="fc-btn fc-btn--outline fc-btn--sm" onClick={() => menu.refetch()}>
              Try again
            </button>
          }
        />
      ) : !categories.length ? (
        <StateBlock icon={<UtensilsCrossed size={22} />} title="No dishes yet" text="This restaurant hasn't put up its menu." />
      ) : (
        categories.map((c) => (
          <section key={c.id} aria-labelledby={`cat-${c.id}`}>
            <h2 id={`cat-${c.id}`} className="fc-cat">
              {c.name} <span className="fc-meta">({c.items.length})</span>
            </h2>
            {c.items.map((item) => (
              <DishRow key={item.id} item={item} blocked={blocked || add.isPending} onAdd={() => onAddClicked(item)} />
            ))}
          </section>
        ))
      )}

      {sheetError && !open ? (
        <p className="fc-alert" role="alert" style={{ marginTop: 12 }}>
          {sheetError}
        </p>
      ) : null}

      {open ? (
        <ItemSheet
          key={open.id}
          item={open}
          busy={add.isPending}
          error={sheetError}
          blockedReason={blocked && card ? `${card.title}: ${card.message}` : null}
          onAdd={(state) => send(open, state)}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  )
}

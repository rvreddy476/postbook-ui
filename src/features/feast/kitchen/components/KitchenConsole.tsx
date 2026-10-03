"use client"

/*
  Feast Kitchen, the restaurant console at /feast/kitchen.

  1. Role gate (fails closed): GET /v1/food/me/capabilities, then the
     caller's own restaurants. Anything unreadable keeps the console shut.
  2. Restaurant picker when the owner has more than one (remembered here).
  3. Tabs: Orders (live board), Menu, Setup (onboarding + review), Earnings.
     The accepting/pause switch sits in the top bar.
*/

import { ArrowLeftRight, ChefHat, ClipboardList, IndianRupee, Settings2, UtensilsCrossed } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { fetchCapabilitiesRaw, fetchRestaurant, fetchRestaurantsRaw } from "../api/client"
import { restaurantStatusLabel, restaurantStatusTone } from "../model/checklist"
import { decideGate, pickRestaurant, type GateDecision } from "../model/gate"
import type { PartnerRestaurant } from "../model/wire"
import { AcceptingToggle } from "./AcceptingToggle"
import { BecomePartner } from "./BecomePartner"
import { Earnings } from "./Earnings"
import { MenuEditor } from "./menu/MenuEditor"
import { Onboarding } from "./onboarding/Onboarding"
import { OrderBoard } from "./orders/OrderBoard"
import { Notice, Pill } from "./ui"

const PICK_KEY = "feast.kitchen.restaurant"
type Tab = "orders" | "menu" | "setup" | "earnings"

function remembered(): string | null {
  try {
    return localStorage.getItem(PICK_KEY)
  } catch {
    return null
  }
}

function remember(id: string | null) {
  try {
    if (id) localStorage.setItem(PICK_KEY, id)
    else localStorage.removeItem(PICK_KEY)
  } catch {
    // Storage blocked: the picker simply asks again next visit.
  }
}

export function KitchenConsole() {
  const [gate, setGate] = useState<GateDecision | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)

  const check = useCallback(async () => {
    setGate(null)
    let capabilities: Parameters<typeof decideGate>[0]["capabilities"]
    try {
      capabilities = { ok: true, body: await fetchCapabilitiesRaw() }
    } catch (error) {
      capabilities = { ok: false, error }
    }
    const first = decideGate({ capabilities })
    if (first.kind === "not-partner" || !capabilities.ok) return setGate(first)
    let restaurants: Parameters<typeof decideGate>[0]["restaurants"]
    try {
      restaurants = { ok: true, body: await fetchRestaurantsRaw() }
    } catch (error) {
      restaurants = { ok: false, error }
    }
    const decision = decideGate({ capabilities, restaurants })
    setGate(decision)
    if (decision.kind === "owner") setRestaurantId(pickRestaurant(decision.restaurants, remembered()))
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  if (!gate) {
    return (
      <main className="kit-main">
        <p className="kit-meta">Checking your restaurant access…</p>
      </main>
    )
  }
  if (gate.kind === "error") {
    return (
      <main className="kit-main">
        <div style={{ maxWidth: 520, margin: "48px auto" }} className="kit-form">
          <Notice tone="danger">{gate.message}</Notice>
          <div>
            <button type="button" className="kit-btn kit-btn--outline" onClick={() => void check()}>
              Try again
            </button>
          </div>
        </div>
      </main>
    )
  }
  if (gate.kind === "not-partner") {
    return (
      <main className="kit-main">
        <BecomePartner onCreated={() => void check()} />
      </main>
    )
  }
  if (!restaurantId) {
    return (
      <main className="kit-main">
        <Picker
          restaurants={gate.restaurants}
          onPick={(id) => {
            remember(id)
            setRestaurantId(id)
          }}
        />
      </main>
    )
  }
  const initial = gate.restaurants.find((r) => r.id === restaurantId)
  if (!initial) return null
  return (
    <Console
      key={restaurantId}
      initial={initial}
      canSwitch={gate.restaurants.length > 1}
      onSwitch={() => {
        remember(null)
        setRestaurantId(null)
      }}
    />
  )
}

function Picker({ restaurants, onPick }: { restaurants: PartnerRestaurant[]; onPick: (id: string) => void }) {
  const sorted = restaurants.slice().sort((a, b) => (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name))
  return (
    <div className="kit-card" style={{ maxWidth: 560, margin: "24px auto" }}>
      <h1 className="kit-title">Choose a restaurant</h1>
      <p className="kit-lede">This account runs more than one kitchen.</p>
      <ul className="kit-cats" style={{ marginTop: 12 }}>
        {sorted.map((r) => (
          <li key={r.id}>
            <button type="button" className="kit-cat" onClick={() => onPick(r.id)}>
              <span>
                <strong>{r.displayName ?? r.name}</strong>
                <span className="kit-small"> · {r.city}</span>
              </span>
              <Pill tone={restaurantStatusTone(r.status)}>{restaurantStatusLabel(r.status)}</Pill>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Console({ initial, canSwitch, onSwitch }: { initial: PartnerRestaurant; canSwitch: boolean; onSwitch: () => void }) {
  const [restaurant, setRestaurant] = useState(initial)
  const [tab, setTab] = useState<Tab>(initial.status === "ACTIVE" ? "orders" : "setup")
  const [newCount, setNewCount] = useState(0)

  const reload = useCallback(
    async (next?: PartnerRestaurant) => {
      if (next) return setRestaurant(next)
      try {
        setRestaurant(await fetchRestaurant(initial.id))
      } catch {
        // Keep what is on screen; the next action reports its own failure.
      }
    },
    [initial.id],
  )

  const tabs: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
    { id: "orders", label: "Orders", icon: ClipboardList },
    { id: "menu", label: "Menu", icon: UtensilsCrossed },
    { id: "setup", label: "Setup", icon: Settings2 },
    { id: "earnings", label: "Earnings", icon: IndianRupee },
  ]

  return (
    <>
      <header className="kit-bar">
        <div className="kit-bar__row">
          <span className="kit-bar__brand">
            <ChefHat size={18} aria-hidden /> Feast Kitchen
          </span>
          <span className="kit-bar__name" title={restaurant.displayName ?? restaurant.name}>
            {restaurant.displayName ?? restaurant.name}
          </span>
          <Pill tone={restaurantStatusTone(restaurant.status)}>{restaurantStatusLabel(restaurant.status)}</Pill>
          {canSwitch ? (
            <button type="button" className="kit-btn kit-btn--ghost kit-btn--sm" onClick={onSwitch}>
              <ArrowLeftRight size={13} aria-hidden /> Switch
            </button>
          ) : null}
          <span className="kit-bar__spacer" />
          <AcceptingToggle restaurant={restaurant} onChanged={(accepting, status) => setRestaurant((r) => ({ ...r, isAcceptingOrders: accepting, status }))} />
        </div>
        <div className="kit-tabs" role="tablist" aria-label="Kitchen">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" className="kit-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              <t.icon size={14} aria-hidden /> {t.label}
              {t.id === "orders" && newCount > 0 ? <span className="kit-tab__count">{newCount}</span> : null}
            </button>
          ))}
        </div>
      </header>
      <main className="kit-main">
        {/* The board stays mounted so the stream, the countdowns and the sound keep running behind other tabs. */}
        <div hidden={tab !== "orders"}>
          <OrderBoard restaurantId={restaurant.id} onNewCount={setNewCount} />
        </div>
        {tab === "menu" ? <MenuEditor restaurantId={restaurant.id} onChanged={() => void reload()} /> : null}
        {tab === "setup" ? <Onboarding restaurant={restaurant} onRestaurantChanged={(r) => void reload(r)} onOpenMenu={() => setTab("menu")} /> : null}
        {tab === "earnings" ? <Earnings restaurantId={restaurant.id} /> : null}
      </main>
    </>
  )
}

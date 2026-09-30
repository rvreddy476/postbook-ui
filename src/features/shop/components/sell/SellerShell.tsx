"use client"

// The MSeller frame: the wordmark, the rail (alphabetical), the status banner
// from GET /onboarding/status, and the one gate every /shop/sell route shares:
// no seller profile → /shop/sell/start.

import { useEffect, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { useSellerStatus } from "../../hooks/sell"
import { SELLER_RAIL, activeRailHref, sellerNeedsWizard, sellerStatusBanner, type SellerWire } from "../../model/sell"
import { ErrorState, Notice, TONE_CLASS } from "./primitives"

const START = "/shop/sell/start"
const ONBOARDING = "/shop/sell/onboarding"

export function SellerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/shop/sell"
  const router = useRouter()
  const status = useSellerStatus()
  const seller = status.data ?? null
  const onStart = pathname === START
  const onOnboarding = pathname === ONBOARDING

  useEffect(() => {
    if (status.isPending || status.isError) return
    if (!seller && !onStart) router.replace(START)
    if (seller && onStart) router.replace(sellerNeedsWizard(seller.status) ? ONBOARDING : "/shop/sell")
  }, [status.isPending, status.isError, seller, onStart, router])

  if (status.isPending) {
    return (
      <div className="shop-sell">
        <Wordmark />
        <div className="shop-sell__body">
          <div className="shop-sell-skeleton" aria-busy="true">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (status.isError) {
    return (
      <div className="shop-sell">
        <Wordmark />
        <div className="shop-sell__body">
          <ErrorState text="Your seller account could not be loaded." onRetry={() => void status.refetch()} />
        </div>
      </div>
    )
  }

  if (!seller) {
    // Redirecting to /shop/sell/start, or already there.
    return (
      <div className="shop-sell">
        <Wordmark />
        <div className="shop-sell__body">{onStart ? children : null}</div>
      </div>
    )
  }

  return (
    <div className="shop-sell shop-sell--framed">
      <Wordmark storeName={seller.store_name} />
      <nav className="shop-sell__rail" aria-label="MSeller">
        <ul>
          {SELLER_RAIL.map((entry) => (
            <li key={entry.href}>
              <Link href={entry.href} className={cn("shop-sell__rail-link", activeRailHref(pathname) === entry.href && "is-active")}>
                {entry.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="shop-sell__body">
        {onOnboarding ? null : <StatusBanner seller={seller} />}
        {children}
      </div>
    </div>
  )
}

function Wordmark({ storeName }: { storeName?: string }) {
  return (
    <header className="shop-sell__top">
      <Link href="/shop/sell" className="shop-sell__wordmark">
        MSeller
      </Link>
      {storeName ? <span className="shop-sell__store">{storeName}</span> : null}
      <Link href="/shop" className="shop-sell__back">
        MStore
      </Link>
    </header>
  )
}

export function StatusBanner({ seller }: { seller: SellerWire }) {
  const banner = sellerStatusBanner(seller)
  return (
    <Notice tone={banner.tone} role="status">
      <span className={cn("shop-sell-pill", TONE_CLASS[banner.tone])}>{banner.label}</span>
      <span className="shop-sell-notice__body">{banner.body}</span>
      {banner.action ? (
        <Link href={banner.action.href} className="shop-sell-link">
          {banner.action.label}
        </Link>
      ) : null}
    </Notice>
  )
}

/** The sentence a trading screen shows instead of its data when the shop is not approved. */
export function NotTradingYet({ seller }: { seller: SellerWire }) {
  const banner = sellerStatusBanner(seller)
  return (
    <div className="shop-sell-empty">
      <p>{banner.canTrade ? "" : `This page opens once your shop is approved. Status: ${banner.label}.`}</p>
      {banner.action ? (
        <Link href={banner.action.href} className="shop-sell-link">
          {banner.action.label}
        </Link>
      ) : null}
    </div>
  )
}

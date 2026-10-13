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
import { sellerNeedsWizard, sellerStatusBanner, type SellerWire } from "../../model/sell"
import { ErrorState, Notice, TONE_CLASS } from "./primitives"
import { HeaderBar } from "@/features/reels/components/HeaderBar"
import { Store } from "lucide-react"
import { VideoShell } from "@/features/video-shell/VideoShell"
import { WorkspaceNavigation } from "@/features/video-shell/WorkspaceShell"
import "@/features/video-shell/workspace.css"

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
    <div className="shop-sell">
      <VideoShell app="workspace" header={<HeaderBar hideSearch hideCreate brand={{ key: "seller", name: "MSeller", href: "/shop/sell", icon: Store, searchPlaceholder: "", prefixes: ["/shop/sell"] }} />} navigation={props => <WorkspaceNavigation {...props} partner title="Partner workspace" links={[]} />}>
      <div className="shop-sell__body">
        {onOnboarding ? null : <StatusBanner seller={seller} />}
        {children}
      </div>
      </VideoShell>
    </div>
  )
}

function Wordmark({ storeName }: { storeName?: string }) {
  return (
    <div className="shop-sell__top" style={{ display: "block", padding: 0 }}>
      <HeaderBar hideSearch hideCreate brand={{ key: "seller", name: storeName ? `MSeller · ${storeName}` : "MSeller", href: "/shop/sell", icon: Store, searchPlaceholder: "", prefixes: ["/shop/sell"] }} />
    </div>
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

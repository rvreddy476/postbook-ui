'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useProductPage } from '@/hooks/useProductFeatures'
import { productForPath } from '@/lib/productFeatures'

/*
  Direct visits to a product the gateway has closed (GET /v1/features, lib/
  productFeatures.ts). Every route a gated product owns renders a plain
  "Not available" page instead of the product's screens, whose API calls the
  gateway would refuse. Other routes pass straight through.

  While the features answer is on its way, a gated route shows a short
  holding line rather than flashing the product and then taking it away.
*/

export function ProductUnavailable() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-brand-bg px-6 py-16 text-center text-brand-text" data-product-unavailable>
      <h1 className="text-2xl font-bold">Not available</h1>
      <p className="max-w-md text-sm text-brand-text/70">This part of VChat is not open right now. Please check back later.</p>
      <Link href="/" className="mt-2 rounded-lg bg-primary-ink px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
        Go to Home
      </Link>
    </main>
  )
}

export function ProductRouteGateView({ status, children }: { status: 'loading' | 'open' | 'closed'; children: React.ReactNode }) {
  if (status === 'open') return <>{children}</>
  if (status === 'closed') return <ProductUnavailable />
  return <p role="status" className="py-16 text-center text-sm text-brand-text/60">Loading…</p>
}

export default function ProductRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const status = useProductPage(productForPath(pathname))
  return <ProductRouteGateView status={status}>{children}</ProductRouteGateView>
}

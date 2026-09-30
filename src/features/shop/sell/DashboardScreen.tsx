"use client"

// /shop/sell: GET /dashboard counts and GET /seller/action-needed.

import Link from "next/link"
import { useActionNeeded, useDashboard, useSellerStatus } from "../hooks/sell"
import { sellerStatusBanner } from "../model/sell"
import { ErrorState, Notice, PageHead, Panel, RowsSkeleton } from "../components/sell/primitives"
import { NotTradingYet } from "../components/sell/SellerShell"

export function DashboardScreen() {
  const status = useSellerStatus()
  const seller = status.data ?? null
  const canTrade = !!seller && sellerStatusBanner(seller).canTrade
  const dashboard = useDashboard(!!seller)
  const actionNeeded = useActionNeeded(canTrade)

  if (!seller) return null

  return (
    <div>
      <PageHead title="Dashboard" />
      {dashboard.isPending ? (
        <RowsSkeleton rows={2} />
      ) : dashboard.isError ? (
        <ErrorState text="The counts could not be loaded." onRetry={() => void dashboard.refetch()} />
      ) : (
        <div className="shop-sell-stats">
          <Stat label="Live listings" value={dashboard.data.live_products} href="/shop/sell/products" />
          <Stat label="Drafts" value={dashboard.data.draft_products} href="/shop/sell/products" />
          <Stat label="In review" value={dashboard.data.pending_products} href="/shop/sell/products" />
          <Stat label="Low stock" value={dashboard.data.low_stock_items} href="/shop/sell/stock" />
          <Stat label="Orders today" value={dashboard.data.orders_today} href="/shop/sell/orders" />
        </div>
      )}

      {!canTrade ? (
        <NotTradingYet seller={seller} />
      ) : (
        <Panel title="Action needed" sub="Listings still on sale whose category asks for a field that became required after approval.">
          {actionNeeded.isPending ? (
            <RowsSkeleton rows={2} />
          ) : actionNeeded.isError ? (
            <ErrorState text="The list could not be loaded." onRetry={() => void actionNeeded.refetch()} />
          ) : actionNeeded.data.products.length === 0 ? (
            <p className="shop-sell-muted">Nothing needs your attention.</p>
          ) : (
            <ul className="shop-sell-list">
              {actionNeeded.data.products.map((p) => (
                <li key={p.product_id} className="shop-sell-list__row">
                  <div>
                    <Link href={`/shop/sell/products/${p.product_id}`} className="shop-sell-link">
                      {p.product_title || "Untitled listing"}
                    </Link>
                    <p className="shop-sell-muted">{p.fields.map((f) => f.label || f.code).join(", ")}</p>
                  </div>
                  {p.still_selling ? <Notice tone="muted">Still on sale</Notice> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  )
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="shop-sell-stat">
      <span className="shop-sell-stat__value">{Number.isFinite(value) ? value : 0}</span>
      <span className="shop-sell-stat__label">{label}</span>
    </Link>
  )
}

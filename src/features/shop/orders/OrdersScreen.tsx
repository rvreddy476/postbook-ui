"use client"

/*
  /shop/orders — the buyer's orders, newest first, paged on `cursor`.
  `?history=1` narrows to the ones that are over (delivered, cancelled,
  expired, refunded), client-side.
*/

import { Package } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import "../shop.css"

import { OrderRowCard } from "../components/orders/OrderParts"
import { useOrdersList } from "../hooks/orders"
import { isHistory } from "../model/orders"

export function OrdersScreen() {
  const params = useSearchParams()
  const history = params.get("history") === "1" || params.get("history") === "true"
  const query = useOrdersList()

  const rows = (query.data?.pages || []).flatMap((p) => p.rows)
  const shown = history ? rows.filter((r) => isHistory(r.status)) : rows

  return (
    <div className="shop-orders">
      <div className="shop-orders__head">
        <h1 className="shop-w2-title">Orders</h1>
        <nav className="shop-ord-chips" aria-label="Show">
          <Link href="/shop/orders" className={history ? "shop-ord-chip" : "shop-ord-chip is-on"} aria-current={history ? undefined : "page"}>
            All
          </Link>
          <Link href="/shop/orders?history=1" className={history ? "shop-ord-chip is-on" : "shop-ord-chip"} aria-current={history ? "page" : undefined}>
            History
          </Link>
        </nav>
      </div>

      {query.isLoading ? (
        <div className="shop-orders__list">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="shop-state">
          <p>Your orders couldn't be loaded.</p>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <div className="shop-state">
          <Package size={28} aria-hidden="true" className="shop-state__icon" />
          <p>{history ? "Nothing finished yet. Delivered orders will show here." : "Nothing ordered yet."}</p>
          {history && rows.length ? (
            <Link href="/shop/orders" className="shop-link">
              All orders
            </Link>
          ) : (
            <Link href="/shop" className="shop-link">
              Start shopping
            </Link>
          )}
        </div>
      ) : (
        <>
          <ul className="shop-orders__list">
            {shown.map((row) => (
              <li key={row.id}>
                <OrderRowCard row={row} />
              </li>
            ))}
          </ul>
          {query.hasNextPage ? (
            <div className="shop-orders__more">
              <Button variant="outline" size="sm" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {query.isFetchingNextPage ? "Loading…" : "Show more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

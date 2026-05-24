"use client"

// FiGo admin item-reviews moderation.
//
// The backend only exposes a per-menu-item list endpoint (no global
// recent-reviews feed) — fit for the typical workflow where the admin
// gets a moderation ping with a menu_item_id and drills in. This page
// takes the id via input or query param and lists every review on
// that item, with an inline Hide action that hard-deletes via the
// admin endpoint (the store recomputes avg_rating + rating_count
// atomically — cf. cf57a26).

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, Star } from "lucide-react"

import {
  useFoodHideItemReview,
  useFoodItemReviews,
} from "@/hooks/useFoodAdmin"

import { EmptyState, errorMessage } from "../../mopedu/_shared"

export default function FoodAdminReviewsPage() {
  const sp = useSearchParams()
  const initialId = sp?.get("item") ?? ""
  const [menuItemId, setMenuItemId] = useState(initialId)
  const [draft, setDraft] = useState(initialId)
  const q = useFoodItemReviews(menuItemId || undefined, 100)
  const hide = useFoodHideItemReview()

  // Keep the input in sync if the query param changes (e.g. coming
  // back from another admin tab with a different id).
  useEffect(() => {
    setMenuItemId(initialId)
    setDraft(initialId)
  }, [initialId])

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setMenuItemId(draft.trim())
        }}
        className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-white p-3"
      >
        <label className="flex flex-1 flex-col">
          <span className="text-xs text-slate-500">Menu item ID (UUID)</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. 7e3c…"
            className="rounded border border-slate-300 px-2 py-1 font-mono text-xs"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700"
        >
          Load
        </button>
      </form>

      {!menuItemId ? (
        <EmptyState
          title="Enter a menu item id"
          body="Reviews load per-item. Get the id from the moderation queue (auto-flagged items)."
        />
      ) : q.isLoading ? (
        <div className="flex items-center justify-center p-6 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : q.error ? (
        <p className="p-4 text-sm text-rose-700">{errorMessage(q.error)}</p>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState title="No reviews" body="This item has no reviews yet." />
      ) : (
        <ul className="space-y-2">
          {(q.data ?? []).map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                {r.review ? (
                  <p className="mt-1 text-sm text-slate-800">{r.review}</p>
                ) : null}
                <div className="mt-1 font-mono text-xs text-slate-500">
                  by {r.customer_id.slice(0, 8)}…
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Hide this review? avg_rating will be recomputed.")) {
                    hide.mutate(r.id)
                  }
                }}
                disabled={hide.isPending}
                className={[
                  "rounded bg-rose-600 px-3 py-1 text-xs font-medium text-white",
                  hide.isPending ? "cursor-wait opacity-60" : "hover:bg-rose-700",
                ].join(" ")}
              >
                Hide
              </button>
            </li>
          ))}
        </ul>
      )}

      {hide.isError ? (
        <p className="text-sm text-rose-700">{errorMessage(hide.error)}</p>
      ) : null}
    </div>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={[
            "h-4 w-4",
            n <= rating ? "fill-amber-500 text-amber-500" : "text-slate-300",
          ].join(" ")}
        />
      ))}
    </div>
  )
}

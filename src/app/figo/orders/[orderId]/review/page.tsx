"use client"

// Customer review-submit screen.
//
// Renders one rating block per item on a DELIVERED order. Submitting
// hits POST /v1/food/menu-items/:itemId/reviews; the backend enforces:
//   - order DELIVERED + owned by caller,
//   - item belongs to the order,
//   - UNIQUE (order, item, customer) — re-submit is rejected.
//
// Each item shows its own submit state so a partial save doesn't lose
// the user's typed feedback on the other items.

import { useParams } from "next/navigation"
import { useState } from "react"
import { Loader2, Star } from "lucide-react"

import {
  useFoodCreateItemReview,
  useFoodCustomerOrder,
} from "@/hooks/useFoodAdmin"

import { EmptyState, errorMessage } from "../../../../admin/mopedu/_shared"

export default function FoodOrderReviewPage() {
  const params = useParams<{ orderId: string }>()
  const orderId = params?.orderId
  const order = useFoodCustomerOrder(orderId)

  if (order.isLoading) {
    return <CenterLoader label="Loading order…" />
  }
  if (order.error) {
    return <p className="p-4 text-sm text-rose-700">{errorMessage(order.error)}</p>
  }
  const o = order.data
  if (!o) {
    return <EmptyState title="Not found" body="Order not found." />
  }
  if (o.status !== "DELIVERED") {
    return (
      <EmptyState
        title="Not delivered yet"
        body="You can review the items once the order is delivered."
      />
    )
  }
  const items = (o.items ?? []).filter((i) => i.menu_item_id)
  if (items.length === 0) {
    return <EmptyState title="Nothing to review" body="This order has no items." />
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Review your order</h1>
        <p className="text-sm text-slate-600">
          Order <span className="font-mono">{o.order_number ?? o.id.slice(0, 8)}</span>
        </p>
      </header>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.id}>
            <ItemReviewForm
              orderId={orderId!}
              menuItemId={it.menu_item_id!}
              label={it.item_name_snapshot ?? it.name ?? "Item"}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ItemReviewForm({
  orderId,
  menuItemId,
  label,
}: {
  orderId: string
  menuItemId: string
  label: string
}) {
  const mutate = useFoodCreateItemReview()
  const [rating, setRating] = useState(0)
  const [text, setText] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (rating < 1) {
      setErr("Pick a star rating first.")
      return
    }
    setErr(null)
    try {
      await mutate.mutateAsync({
        orderId,
        menuItemId,
        rating,
        review: text.trim() || undefined,
      })
      setSubmitted(true)
    } catch (e) {
      setErr(errorMessage(e))
    }
  }

  if (submitted) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
        <p className="text-sm font-medium text-emerald-800">{label}</p>
        <p className="text-xs text-emerald-700">Thanks — your review is in.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="font-medium text-slate-900">{label}</p>
        <Stars rating={rating} onChange={setRating} />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Optional — what did you think?"
        className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <div className="mt-2 flex items-center justify-between">
        {err ? (
          <p className="text-xs text-rose-700">{err}</p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={submit}
          disabled={mutate.isPending}
          className={[
            "rounded bg-amber-600 px-3 py-1 text-sm font-medium text-white transition",
            mutate.isPending
              ? "cursor-wait opacity-60"
              : "hover:bg-amber-700",
          ].join(" ")}
        >
          {mutate.isPending ? "Saving…" : "Submit"}
        </button>
      </div>
    </div>
  )
}

function Stars({
  rating,
  onChange,
}: {
  rating: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} stars`}
          className="rounded"
        >
          <Star
            className={[
              "h-5 w-5 transition",
              n <= rating
                ? "fill-amber-500 text-amber-500"
                : "text-slate-300",
            ].join(" ")}
          />
        </button>
      ))}
    </div>
  )
}

function CenterLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center p-6 text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {label}
    </div>
  )
}

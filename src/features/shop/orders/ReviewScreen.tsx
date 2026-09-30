"use client"

/*
  /shop/orders/[id]/review?product= — rating, title, body for one
  delivered item → POST /products/:productId/reviews. The server is the
  judge of "delivered"; its refusal code becomes one sentence.
*/

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { StarRating } from "@/components/ui/StarRating"
import { useGlobalToast } from "@/contexts/ToastContext"

import "../shop.css"

import { useCreateReview, useOrder } from "../hooks/orders"
import { errorCode } from "../model/checkout"
import { buildReviewBody, reviewRefusalMessage } from "../model/orders"

export function ReviewScreen({ orderId }: { orderId: string }) {
  const params = useSearchParams()
  const router = useRouter()
  const toast = useGlobalToast()
  const productParam = params.get("product") || ""
  const orderQuery = useOrder(orderId)
  const createReview = useCreateReview()

  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [refused, setRefused] = useState("")

  const order = orderQuery.data
  const item = order ? order.items.find((i) => i.productId === productParam) || order.items.find((i) => i.delivered) || order.items[0] : undefined

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item) return
    setRefused("")
    try {
      await createReview.mutateAsync({ productId: item.productId, body: buildReviewBody(item, { rating, title, body }) })
      toast({ type: "success", title: "Thanks for your review" })
      router.push(`/shop/orders/${orderId}`)
    } catch (error) {
      setRefused(reviewRefusalMessage(errorCode(error)))
    }
  }

  if (orderQuery.isLoading) {
    return (
      <div className="shop-rev">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!order || !item) {
    return (
      <div className="shop-state">
        <p>There's nothing here to review.</p>
        <Link href={`/shop/orders/${orderId}`} className="shop-link">
          Back to the order
        </Link>
      </div>
    )
  }

  return (
    <div className="shop-rev">
      <div className="shop-order__head">
        <Link href={`/shop/orders/${orderId}`} className="shop-w2-back" aria-label="Back to order">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <h1 className="shop-w2-title">Write a review</h1>
      </div>

      <form className="shop-w2-sec shop-rev__form" onSubmit={onSubmit}>
        <p className="shop-rev__item">{item.title}</p>

        <label className="shop-rev__field">
          <span className="shop-rev__label">Your rating</span>
          <StarRating value={rating} onChange={setRating} size="lg" />
        </label>

        <label className="shop-rev__field">
          <span className="shop-rev__label">Title (optional)</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Sum it up" />
        </label>

        <label className="shop-rev__field">
          <span className="shop-rev__label">Review (optional)</span>
          <textarea className="shop-rev__body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000} placeholder="What was it like?" />
        </label>

        {refused ? (
          <p className="shop-checkout__refusal" role="alert">
            {refused}
          </p>
        ) : null}

        <div className="shop-rev__actions">
          <Button type="submit" disabled={createReview.isPending}>
            {createReview.isPending ? "Saving…" : "Post review"}
          </Button>
        </div>
      </form>
    </div>
  )
}

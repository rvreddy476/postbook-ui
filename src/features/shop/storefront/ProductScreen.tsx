"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, PackageX, ShoppingBag, Store } from "lucide-react"
import { useGlobalToast } from "@/contexts/ToastContext"
import { useAddToBag } from "../hooks/bag"
import { useDeliveryEstimate, usePincode } from "../hooks/delivery"
import { useProductReaction, useReviewVote } from "../hooks/reactions"
import { useLegacyAttributes, useProductDetail, useProductMedia } from "../hooks/catalogue"
import { usePaymentOffers } from "../hooks/offers"
import { useProductReviews } from "../hooks/reviews"
import { useCategories, useShopSession } from "../hooks/storefront"
import {
  addToBagFailure,
  findVariant,
  galleryImages,
  hasVariantPicker,
  initialSelection,
  isProductMissing,
  legacySpecGroups,
  maxQuantity,
  priceLine,
  selectOption,
  sellableVariants,
  specGroups,
  stepQuantity,
  stockLine,
  variantAxes,
  type Selection,
} from "../model/catalogue"
import { bestCoupon } from "../model/coupons"
import { deliveryView } from "../model/delivery"
import { DEFAULT_REVIEW_SORT, readProductReaction, voteFailureMessage, type ReviewSort } from "../model/reactions"
import { ratingSummary } from "../model/reviews"
import { productPath } from "../model/share"
import { browseHref, isSignedOut, SHOP_BASE, signInHref, toProductCard } from "../model/storefront"
import { CouponChip } from "../components/coupons/CouponChip"
import { BankOffers } from "../components/offers/BankOffers"
import { DeliveryBlock } from "../components/catalogue/DeliveryBlock"
import { Gallery } from "../components/catalogue/Gallery"
import { QuantityStepper } from "../components/catalogue/QuantityStepper"
import { ReactionButtons } from "../components/catalogue/ReactionButtons"
import { ShareButton } from "../components/catalogue/ShareButton"
import { Specifications } from "../components/catalogue/Specifications"
import { VariantPicker } from "../components/catalogue/VariantPicker"
import { FavouriteButton } from "../components/favourites/FavouriteButton"
import { ReviewList } from "../components/reviews/ReviewList"
import { StateBlock } from "../components/storefront/StateBlock"

function ProductSkeleton() {
  return (
    <div className="shop-pdp" aria-busy="true" aria-label="Loading this product">
      <div className="shop-skeleton" style={{ aspectRatio: "1 / 1" }} />
      <div>
        <div className="shop-skeleton" style={{ height: 11, width: "30%" }} />
        <div className="shop-skeleton" style={{ height: 18, marginTop: 10 }} />
        <div className="shop-skeleton" style={{ height: 18, width: "60%", marginTop: 6 }} />
        <div className="shop-skeleton" style={{ height: 20, width: "35%", marginTop: 20 }} />
        <div className="shop-skeleton" style={{ height: 40, width: "50%", marginTop: 24 }} />
      </div>
    </div>
  )
}

/**
 * `/shop/products/[id]`: gallery, title, "Sold by", rating, price from the
 * selected variant, the per-axis variant picker, quantity (cap 10), Add to
 * bag, Buy now, the heart, specs, description, reviews. Unknown id ⇒ 404.
 */
export function ProductScreen({ productId }: { productId: string }) {
  const router = useRouter()
  const toast = useGlobalToast()
  const { signedIn, known, user } = useShopSession()
  const detail = useProductDetail(productId)
  const body = detail.data
  const product = body?.product ?? null
  // The detail body carries `media` and typed `attributes`; the dedicated
  // routes are asked only when the body did not answer.
  const media = useProductMedia(productId, !!body && !Array.isArray(body.media))
  const legacy = useLegacyAttributes(productId, !!body && (!Array.isArray(body.attributes) || body.attributes.length === 0))
  const [reviewSort, setReviewSort] = useState<ReviewSort>(DEFAULT_REVIEW_SORT)
  const reviews = useProductReviews(productId, reviewSort)
  const { pincode, ready: pincodeReady, setPincode } = usePincode()
  const estimate = useDeliveryEstimate(productId, pincode, pincodeReady)
  const reaction = useProductReaction(productId)
  const vote = useReviewVote(productId)
  const categories = useCategories()
  const addToBag = useAddToBag()

  const variants = useMemo(() => sellableVariants(body?.variants), [body?.variants])
  const axes = useMemo(() => variantAxes(variants), [variants])
  const [selection, setSelection] = useState<Selection>({})
  const [quantity, setQuantity] = useState(1)
  useEffect(() => {
    setSelection(initialSelection(variants))
    setQuantity(1)
  }, [variants])
  const selected = findVariant(variants, selection, axes)
  const images = useMemo(() => galleryImages(Array.isArray(body?.media) ? body?.media : media.data, product), [body?.media, media.data, product])
  const specs = useMemo(() => {
    const typed = specGroups(body?.attributes)
    return typed.length ? typed : legacySpecGroups(legacy.data)
  }, [body?.attributes, legacy.data])
  const card = product ? toProductCard(product) : null
  const price = priceLine(selected)
  const available = selected?.availableQty ?? 0
  const stock = stockLine(selected ? available : 0)
  // Coupons and bank offers: the chip is the server's best_coupon, the
  // offers are asked for at the price on screen (the selected variant's,
  // else the listing's), and both only ever list — no total moves here.
  const coupon = bestCoupon(product, body)
  const offers = usePaymentOffers(selected?.priceMinor ?? card?.priceMinor ?? null)
  const cap = maxQuantity(available)
  useEffect(() => setQuantity((q) => (cap <= 0 ? 1 : Math.min(Math.max(1, q), cap))), [cap])
  const category = product?.category_id ? categories.data?.find((c) => c.id === product.category_id) : undefined
  const categoryName = category?.name ?? product?.category_name ?? null
  const canBuy = !!selected && available > 0 && !addToBag.isPending
  const signedOut = known && !signedIn
  const signInBack = signInHref(productPath(productId))
  const reactionState = readProductReaction(body)
  const delivery = deliveryView({
    pincode,
    asked: estimate.asked,
    isLoading: estimate.isLoading,
    estimate: estimate.data ?? null,
    error: estimate.error,
  })
  // A refusal other than "signed out" (which goes to sign in) is said once.
  const voteFailed = (error: unknown) => {
    if (!isSignedOut(error)) toast({ type: "error", title: voteFailureMessage(error) })
  }

  const add = async (thenCheckout: boolean) => {
    if (!selected) return
    if (known && !signedIn) {
      window.location.assign(signInHref(window.location.pathname + window.location.search))
      return
    }
    try {
      await addToBag.mutateAsync({ variant_id: selected.id, quantity })
      if (thenCheckout) {
        router.push(`${SHOP_BASE}/checkout`)
        return
      }
      toast({ type: "success", title: "Added to bag", description: `${quantity} × ${product?.title ?? "item"}` })
    } catch (error) {
      toast({ type: "error", title: addToBagFailure(error) })
    }
  }

  if (detail.isLoading) return <ProductSkeleton />
  if (detail.isError && isProductMissing(detail.error)) {
    return (
      <StateBlock
        icon={<PackageX size={20} aria-hidden="true" />}
        title="This product is not here"
        text="It may have been removed, or the link is not right."
        action={{ label: "Back to the shop", href: SHOP_BASE }}
      />
    )
  }
  if (detail.isError || !product || !card) {
    return <StateBlock text="This product could not be loaded." action={{ label: "Try again", onClick: () => void detail.refetch() }} />
  }

  const badge = price?.off ? <span className="shop-photo__badge">{price.off}% off</span> : null

  return (
    <div>
      <ol className="shop-crumbs" aria-label="Breadcrumb">
        <li><Link href={SHOP_BASE}>Shop</Link></li>
        {categoryName ? (
          <>
            <li aria-hidden="true">/</li>
            <li><Link href={category ? browseHref({ category: category.id }) : browseHref({ q: categoryName })}>{categoryName}</Link></li>
          </>
        ) : null}
        <li aria-hidden="true">/</li>
        <li aria-current="page">{product.title}</li>
      </ol>

      <div className="shop-pdp">
        <Gallery images={images} alt={product.title || "Product"} badge={badge} />

        <div>
          {card.seller ? (
            <span className="shop-pdp__seller"><Store size={12} aria-hidden="true" /> Sold by {card.seller}</span>
          ) : null}
          <div className="shop-pdp__title-row">
            <h1 className="shop-pdp__title">{product.title}</h1>
            <div className="shop-pdp__engage">
              <ReactionButtons
                state={reactionState}
                signInUrl={signedOut ? signInBack : null}
                pending={reaction.isPending}
                onPress={(pressed) => reaction.mutate({ before: reactionState, pressed }, { onError: voteFailed })}
              />
              <ShareButton productId={product.id || productId} title={product.title || ""} priceMinor={price ? selected?.priceMinor ?? null : card.priceMinor} />
              <FavouriteButton product={{ ...card, isFavourite: product.is_favourite === true }} size={20} inline />
            </div>
          </div>
          <div className="shop-pdp__rating">
            <span>{card.rating !== null ? "★ " : ""}{ratingSummary(card.rating, card.reviewCount)}</span>
            {card.reviewCount > 0 ? <a href="#shop-reviews-title">Read reviews</a> : null}
          </div>

          {product.short_description ? <p className="shop-pdp__desc" style={{ marginTop: 10 }}>{product.short_description}</p> : null}

          {price ? (
            <div className="shop-pdp__price">
              <span className="shop-pdp__amount">{price.price}</span>
              {price.was ? <s className="shop-pdp__was">{price.was}</s> : null}
              {price.off ? <span className="shop-pdp__off">{price.off}% off</span> : null}
              <span className="shop-pdp__tax">Inclusive of all taxes · Delivery charge at checkout</span>
            </div>
          ) : (
            <div className="shop-pdp__price"><span className="shop-pdp__tax">{axes.length ? "Choose the options to see the price." : "Price not available."}</span></div>
          )}

          <CouponChip coupon={coupon} />
          <BankOffers offers={offers.data ?? []} title="Bank offers" />

          <DeliveryBlock view={delivery} onPincode={setPincode} />

          {hasVariantPicker(variants) ? (
            <VariantPicker
              axes={axes}
              variants={variants}
              selection={selection}
              onSelect={(axis, value) => setSelection((current) => selectOption(variants, current, axis, value))}
            />
          ) : null}

          <p className={`shop-pdp__stock shop-pdp__stock--${selected ? stock.tone : "warning"}`} aria-live="polite">
            {selected ? stock.text : "Choose the options above"}
          </p>

          <div className="shop-pdp__actions">
            <QuantityStepper
              value={quantity}
              min={1}
              max={Math.max(1, cap)}
              onChange={(next) => setQuantity(stepQuantity(next, 0, Math.max(1, available)))}
              disabled={!canBuy}
              label="Quantity"
            />
            <button type="button" className="shop-btn shop-btn--outline" disabled={!canBuy} onClick={() => void add(false)}>
              <ShoppingBag size={16} aria-hidden="true" /> {addToBag.isPending ? "Adding…" : "Add to bag"}
            </button>
            <button type="button" className="shop-btn shop-btn--primary" disabled={!canBuy} onClick={() => void add(true)}>
              Buy now <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          {selected?.sku ? <p className="shop-page__lede" style={{ marginTop: 10 }}>SKU {selected.sku}</p> : null}
        </div>
      </div>

      <Specifications groups={specs} />

      {product.description ? (
        <section className="shop-pdp__section" aria-labelledby="shop-about-title">
          <h2 id="shop-about-title">About this product</h2>
          <p className="shop-pdp__desc" style={{ marginTop: 0 }}>{product.description}</p>
        </section>
      ) : null}

      <ReviewList
        reviews={reviews.data?.reviews ?? []}
        total={reviews.data?.total ?? card.reviewCount}
        average={reviews.data?.average ?? null}
        isLoading={reviews.isLoading}
        sort={reviewSort}
        onSort={setReviewSort}
        voting={{
          viewerId: user?.id || null,
          known,
          signInUrl: signedOut ? signInBack : null,
          pendingReviewId: vote.isPending ? vote.variables?.reviewId ?? null : null,
          onVote: (reviewId, pressed, before) => vote.mutate({ reviewId, before, pressed }, { onError: voteFailed }),
        }}
      />
    </div>
  )
}

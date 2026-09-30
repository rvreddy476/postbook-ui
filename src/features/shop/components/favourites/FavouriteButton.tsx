"use client"

import { Heart } from "lucide-react"
import { useShopSession } from "../../hooks/storefront"
import { useToggleFavourite } from "../../hooks/favourites"
import { signInHref, type ProductCard } from "../../model/storefront"

/**
 * The heart. On a card it sits on the plate's top-right corner; on the
 * product page beside the title. Same button, same rule: press it and the
 * heart fills NOW, and un-fills only if the server refuses. Signed out, it
 * goes to sign in with a way back.
 */
export function FavouriteButton({ product, size = 18, inline, className }: {
  product: ProductCard
  size?: number
  /** No plate shadow — beside a title rather than on a photo. */
  inline?: boolean
  className?: string
}) {
  const toggle = useToggleFavourite()
  const { signedIn, known } = useShopSession()
  const on = product.isFavourite
  const classes = ["shop-fav-btn", on ? "shop-fav-btn--on" : "", inline ? "shop-fav-btn--inline" : "", className ?? ""].filter(Boolean).join(" ")
  return (
    <button
      type="button"
      className={classes}
      aria-pressed={on}
      aria-label={on ? `Remove ${product.title} from favourites` : `Add ${product.title} to favourites`}
      title={on ? "Remove from favourites" : "Add to favourites"}
      onClick={(event) => {
        // The heart lives inside a card that is itself a link.
        event.preventDefault()
        event.stopPropagation()
        if (known && !signedIn) {
          window.location.assign(signInHref(window.location.pathname + window.location.search))
          return
        }
        toggle.mutate({ product, isFavourite: !on })
      }}
    >
      <Heart size={size} aria-hidden="true" fill={on ? "currentColor" : "none"} />
    </button>
  )
}

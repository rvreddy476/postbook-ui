"use client"

import { Heart } from "lucide-react"
import { useFavourites } from "../hooks/favourites"
import { useShopSession } from "../hooks/storefront"
import { isSignedOut, SHOP_BASE, signInHref } from "../model/storefront"
import { ProductGrid } from "../components/storefront/ProductGrid"
import { StateBlock } from "../components/storefront/StateBlock"

/**
 * `/shop/favourites`: everything the shopper has hearted, drawn with the
 * same card the grid uses, so un-hearting here is the same gesture as
 * hearting there and the card leaves the page the moment it is pressed.
 */
export function FavouritesScreen() {
  const { signedIn, known } = useShopSession()
  const favourites = useFavourites()
  const items = favourites.data?.items ?? []

  if (known && !signedIn) {
    return (
      <StateBlock
        icon={<Heart size={20} aria-hidden="true" />}
        title="Sign in to see your favourites"
        text="Your favourites are kept with your account."
        action={{ label: "Sign in", href: signInHref(`${SHOP_BASE}/favourites`) }}
      />
    )
  }
  if (favourites.isError) {
    if (isSignedOut(favourites.error)) {
      return <StateBlock title="Sign in to see your favourites" text="Your favourites are kept with your account." action={{ label: "Sign in", href: signInHref(`${SHOP_BASE}/favourites`) }} />
    }
    return <StateBlock text="Your favourites could not be loaded." action={{ label: "Try again", onClick: () => void favourites.refetch() }} />
  }

  return (
    <div>
      <div className="shop-page__head">
        <div>
          <h1 className="shop-page__title">Favourites</h1>
          <p className="shop-page__lede">
            {!known || favourites.isLoading ? "Loading what you saved…" : `${items.length} ${items.length === 1 ? "product" : "products"} saved`}
          </p>
        </div>
      </div>
      <ProductGrid
        products={items}
        isLoading={!known || favourites.isLoading}
        empty={
          <StateBlock
            icon={<Heart size={20} aria-hidden="true" />}
            text="Nothing saved yet. Press the heart on any product to keep it here."
            action={{ label: "Explore the shop", href: SHOP_BASE }}
          />
        }
      />
    </div>
  )
}

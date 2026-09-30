import type { Metadata } from "next"

import { FavouritesScreen } from "@/features/shop/favourites/FavouritesScreen"

export const metadata: Metadata = {
  title: "Favourites",
  robots: { index: false },
}

export default function ShopFavouritesPage() {
  return <FavouritesScreen />
}

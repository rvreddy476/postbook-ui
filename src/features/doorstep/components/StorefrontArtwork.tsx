"use client"

import { useState } from "react"
import type { Family } from "../model/wire"
import { serviceArt } from "../model/storefront"
import { categoryIcon } from "./parts"

export function StorefrontArtwork({ slug, categorySlug = slug, family, imageUrl, className = "" }: { slug: string; categorySlug?: string; family: Family; imageUrl?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false)
  const art = serviceArt(slug, categorySlug, family)
  const Icon = categoryIcon(categorySlug, family)
  const safeImage = imageUrl && (/^https:\/\//i.test(imageUrl) || /^\/(?!\/)/.test(imageUrl))
  return <span className={`dsc-art ${!safeImage || failed ? art ? `dsc-art--${art}` : "dsc-art--icon" : ""} ${className}`} aria-hidden="true">
    {safeImage && !failed ? <img src={imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} /> : !art ? <Icon size={44} strokeWidth={1.4} /> : null}
  </span>
}

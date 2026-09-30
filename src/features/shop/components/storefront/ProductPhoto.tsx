import { ImageOff } from "lucide-react"

export interface ProductPhotoProps {
  src: string | null
  alt: string
  /** Top-left pill on the plate. */
  badge?: React.ReactNode
  /** Eager for the hero image; lazy everywhere else. */
  priority?: boolean
  /** Show the whole image rather than cropping it — the product page's hero. */
  contain?: boolean
  className?: string
}

/**
 * One product photograph, on its plate. Every catalogue image goes through
 * here so the treatment is identical everywhere; a missing image is the
 * same plate with a mark rather than a hole in the layout.
 */
export function ProductPhoto({ src, alt, badge, priority, contain, className }: ProductPhotoProps) {
  const classes = ["shop-photo", contain ? "shop-photo--contain" : "", className ?? ""].filter(Boolean).join(" ")
  return (
    <div className={classes}>
      {badge}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" />
      ) : (
        <span className="shop-photo__empty">
          <ImageOff size={20} aria-hidden="true" />
          No image
        </span>
      )}
    </div>
  )
}

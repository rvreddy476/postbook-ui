"use client"

import { useEffect, useState } from "react"
import { galleryStep, type GalleryImage } from "../../model/catalogue"
import { ProductPhoto } from "../storefront/ProductPhoto"

/**
 * The product's photographs: one large image and a row of thumbs. The
 * arrow keys walk it when the large image has focus; no lightbox.
 */
export function Gallery({ images, alt, badge }: { images: GalleryImage[]; alt: string; badge?: React.ReactNode }) {
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [images])
  const count = images.length
  const current = images[Math.min(index, Math.max(0, count - 1))] ?? null

  return (
    <div className="shop-gallery">
      <div
        className="shop-gallery__main"
        tabIndex={count > 1 ? 0 : -1}
        role={count > 1 ? "group" : undefined}
        aria-roledescription={count > 1 ? "image gallery" : undefined}
        aria-label={count > 1 ? `Product image ${index + 1} of ${count}. Use the arrow keys to see the others.` : undefined}
        onKeyDown={(event) => {
          if (count <= 1) return
          const next = galleryStep(index, count, event.key)
          if (next !== index) {
            event.preventDefault()
            setIndex(next)
          }
        }}
      >
        <ProductPhoto src={current?.src ?? null} alt={alt} priority contain badge={badge} />
      </div>
      {count > 1 ? (
        <ul className="shop-gallery__thumbs" aria-label="Product images">
          {images.map((image, i) => (
            <li key={image.id}>
              <button
                type="button"
                className={`shop-gallery__thumb${i === index ? " shop-gallery__thumb--on" : ""}`}
                aria-label={`Image ${i + 1} of ${count}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.thumb} alt="" loading="lazy" decoding="async" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

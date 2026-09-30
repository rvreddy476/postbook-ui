"use client"

// The gallery editor: up to eight images, the first is the cover, reorder,
// remove. Each pick uploads through media-service at once; the gallery is
// written to the product with POST /products/:id/media {media_ids} (which
// REPLACES it in order) once an upload is ready, PUT …/media/order on a
// reorder, DELETE …/media/:mediaId on a remove.

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQueryClient } from "@tanstack/react-query"
import { deleteGalleryImage, reorderGallery, setGallery } from "../../api/sell"
import { uploadSellerImage } from "../../api/sellMedia"
import { sellKeys, useProductGallery } from "../../hooks/sell"
import { apiMessage } from "../../model/sell"
import {
  IMAGE_ACCEPT_ATTR,
  MAX_GALLERY_IMAGES,
  addToGallery,
  attachedGalleryItem,
  galleryMediaIds,
  moveGalleryItem,
  patchGalleryItem,
  removeGalleryItem,
  type GalleryItem,
} from "../../model/sellListing"
import { Notice } from "./primitives"

export function ListingImages({ productId }: { productId: string }) {
  const qc = useQueryClient()
  const gallery = useProductGallery(productId)
  const [items, setItems] = useState<GalleryItem[]>([])
  const [seeded, setSeeded] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const input = useRef<HTMLInputElement | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    if (seeded || !gallery.data) return
    setItems(gallery.data.map((g) => attachedGalleryItem(g)))
    setSeeded(true)
  }, [seeded, gallery.data])

  useEffect(
    () => () => {
      for (const it of itemsRef.current) if (it.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(it.previewUrl)
    },
    [],
  )

  async function persist(next: GalleryItem[]) {
    const ids = galleryMediaIds(next)
    try {
      await setGallery(productId, ids)
      void qc.invalidateQueries({ queryKey: sellKeys.product(productId) })
      void qc.invalidateQueries({ queryKey: sellKeys.products })
    } catch (err) {
      setNotice(apiMessage(err, "The gallery could not be saved."))
    }
  }

  async function upload(item: GalleryItem) {
    if (!item.file) return
    setItems((prev) => patchGalleryItem(prev, item.key, { status: "uploading", progress: 0, error: null }))
    try {
      const mediaId = await uploadSellerImage(item.file, "product", {
        onProgress: (f) => setItems((prev) => patchGalleryItem(prev, item.key, { progress: f })),
        onProcessing: () => setItems((prev) => patchGalleryItem(prev, item.key, { status: "processing", progress: 1 })),
      })
      // itemsRef holds the latest render, so a sibling's progress since this
      // upload began is kept rather than overwritten by a stale closure.
      const next = patchGalleryItem(itemsRef.current, item.key, { status: "ready", mediaId })
      itemsRef.current = next
      setItems(next)
      await persist(next)
    } catch (err) {
      setItems((prev) => patchGalleryItem(prev, item.key, { status: "failed", error: err instanceof Error ? err.message : "The upload failed." }))
    }
  }

  function pick(files: FileList | null) {
    if (!files) return
    setNotice(null)
    const { items: next, rejected } = addToGallery(items, Array.from(files), undefined, (f) => URL.createObjectURL(f))
    setItems(next)
    if (rejected.length > 0) setNotice(rejected.map((r) => `${r.fileName}: ${r.reason}`).join(" "))
    for (const it of next) if (it.status === "queued") void upload(it)
  }

  async function move(from: number, to: number) {
    const next = moveGalleryItem(items, from, to)
    setItems(next)
    const ids = galleryMediaIds(next)
    if (ids.length < 2) return
    try {
      await reorderGallery(productId, ids)
      void qc.invalidateQueries({ queryKey: sellKeys.products })
    } catch (err) {
      setNotice(apiMessage(err, "The order could not be saved."))
    }
  }

  async function remove(item: GalleryItem) {
    setItems((prev) => removeGalleryItem(prev, item.key))
    if (item.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl)
    if (item.status === "ready" && item.mediaId) {
      try {
        await deleteGalleryImage(productId, item.mediaId)
        void qc.invalidateQueries({ queryKey: sellKeys.products })
      } catch (err) {
        setNotice(apiMessage(err, "The image could not be removed."))
      }
    }
  }

  return (
    <div className="shop-sell-gallery">
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT_ATTR}
        multiple
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files)
          e.target.value = ""
        }}
      />
      <div className="shop-sell-actions">
        <Button type="button" variant="outline" size="sm" disabled={items.length >= MAX_GALLERY_IMAGES} onClick={() => input.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Add images
        </Button>
        <span className="shop-sell-muted">
          {items.length} of {MAX_GALLERY_IMAGES}. The first is the cover.
        </span>
      </div>
      {notice ? <Notice tone="warning">{notice}</Notice> : null}
      {items.length === 0 ? (
        <p className="shop-sell-muted">No images yet. A listing without one renders as a blank tile and cannot be submitted.</p>
      ) : (
        <ul className="shop-sell-gallery__grid">
          {items.map((it, i) => (
            <li key={it.key} className="shop-sell-gallery__item">
              {it.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.previewUrl} alt={it.fileName || "Product image"} className="shop-sell-gallery__img" />
              ) : (
                <span className="shop-sell-gallery__img shop-sell-thumb--empty" aria-hidden="true" />
              )}
              <div className="shop-sell-gallery__meta">
                <span className="shop-sell-muted">
                  {i === 0 ? "Cover · " : ""}
                  {it.status === "uploading" ? `Uploading ${Math.round(it.progress * 100)}%` : it.status === "processing" ? "Processing…" : it.status === "failed" ? it.error : it.status === "queued" ? "Waiting" : "Ready"}
                </span>
                <div className="shop-sell-gallery__btns">
                  <button type="button" className="shop-sell-iconbtn" aria-label="Move earlier" disabled={i === 0} onClick={() => void move(i, i - 1)}>
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" className="shop-sell-iconbtn" aria-label="Move later" disabled={i === items.length - 1} onClick={() => void move(i, i + 1)}>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {it.status === "failed" && it.file ? (
                    <button type="button" className="shop-sell-link" onClick={() => void upload(it)}>
                      Retry
                    </button>
                  ) : null}
                  <button type="button" className="shop-sell-iconbtn" aria-label="Remove image" onClick={() => void remove(it)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

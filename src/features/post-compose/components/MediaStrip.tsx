"use client"

import { Plus, X } from "lucide-react"

import { isPhotoPost, MAX_PHOTOS, type ComposeMedia } from "../model"

export interface MediaStripProps {
  media: readonly ComposeMedia[]
  coverIndex: number
  onCover: (index: number) => void
  onRemove: (index: number) => void
  onAdd: () => void
  /** The most the post can hold; the "+" goes when it is full. */
  max?: number
  disabled?: boolean
}

/*
  The post's photos in a row. With more than one photo the selected one
  carries the "Cover" mark, and choosing another photo makes that the cover
  (the post's cover_index). A post with a video has no cover to choose.
*/
export function MediaStrip({ media, coverIndex, onCover, onRemove, onAdd, max = MAX_PHOTOS, disabled }: MediaStripProps) {
  const choosable = isPhotoPost(media) && media.length > 1
  return (
    <div data-compose="media-strip">
      <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Photos in this post">
        {media.map((item, index) => {
          const cover = choosable && index === coverIndex
          const label = item.kind === "video" ? `Video ${index + 1}` : cover ? `Photo ${index + 1}, the cover` : `Photo ${index + 1}`
          return (
            <li key={item.key} className="relative shrink-0">
              <button
                type="button"
                onClick={() => choosable && onCover(index)}
                disabled={disabled}
                aria-label={choosable && !cover ? `${label}. Make this the cover` : label}
                aria-pressed={choosable ? cover : undefined}
                className={`relative block h-24 w-[72px] overflow-hidden rounded-xl bg-brand-secondary outline-offset-2 ${
                  cover ? "ring-2 ring-primary" : "border border-brand-divider"
                }`}
              >
                {item.kind === "video" ? (
                  <video src={item.previewUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                ) : (
                  <img src={item.previewUrl} alt={item.altText} className="h-full w-full object-cover" />
                )}
                <span className="absolute left-1 top-1 rounded-full bg-brand-card/85 px-1.5 text-[10px] font-semibold tabular-nums text-brand-text">
                  {index + 1}
                </span>
                {cover ? (
                  <span data-compose="cover-mark" className="absolute inset-x-0 bottom-0 bg-primary py-0.5 text-center text-[10px] font-semibold text-primary-foreground">
                    Cover
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={disabled}
                aria-label={`Remove ${item.kind === "video" ? "video" : "photo"} ${index + 1}`}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-brand-divider bg-brand-card text-brand-text shadow-sm hover:bg-brand-secondary"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          )
        })}
        {media.length < max ? (
          <li className="shrink-0">
            <button
              type="button"
              onClick={onAdd}
              disabled={disabled}
              aria-label="Add photos"
              className="flex h-24 w-[72px] items-center justify-center rounded-xl border-2 border-dashed border-brand-divider text-brand-text/60 hover:bg-brand-secondary hover:text-brand-text"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          </li>
        ) : null}
      </ul>
      {choosable ? <p className="mt-1.5 text-[12px] text-brand-text/60">Tap a photo to make it the cover.</p> : null}
    </div>
  )
}

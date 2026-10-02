"use client"

import { ImageOff, Lock, User } from "lucide-react"

import { usePhoto, type PhotoLoad } from "../hooks/discovery"
import { isBlurredPath } from "../model/people"

/** The frame, without the fetch — what the tests render. */
export function PhotoFrame({ load, alt, blurred, className }: { load: PhotoLoad; alt: string; blurred: boolean; className?: string }) {
  return (
    <div className={`pulse-photo${className ? ` ${className}` : ""}`} data-state={load.state}>
      {load.state === "ready" ? (
        // The source is a blob URL made from an authenticated fetch; next/image cannot optimise it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={load.src} alt={alt} draggable={false} />
      ) : (
        <span className="pulse-photo__empty" aria-label={load.state === "loading" ? "Loading photo" : alt || "No photo"} role="img">
          {load.state === "failed" ? <ImageOff size={28} aria-hidden="true" /> : <User size={28} aria-hidden="true" />}
        </span>
      )}
      {blurred ? (
        <span className="pulse-photo__badge">
          <Lock size={12} aria-hidden="true" /> Blurred until you match
        </span>
      ) : null}
    </div>
  )
}

/**
  A dating photo, from exactly the path the server named for this viewer.
  A blurred path stays blurred: nothing here asks for the other variant.
*/
export function DatingPhoto({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const load = usePhoto(path)
  return <PhotoFrame load={load} alt={alt} blurred={!!path && isBlurredPath(path)} className={className} />
}

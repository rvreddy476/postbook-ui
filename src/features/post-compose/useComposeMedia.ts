"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { MAX_PHOTOS, type ComposeMedia } from "./model"

let seq = 0
const nextKey = () => `m${Date.now().toString(36)}-${(seq += 1)}`

/**
 * The post's photos (and, in the modal, a video): picked files with their
 * previews, ids once uploaded, and each photo's alt text. Object URLs are
 * revoked when their item goes and when the composer unmounts.
 */
export function useComposeMedia(max: number = MAX_PHOTOS) {
  const [media, setMedia] = useState<ComposeMedia[]>([])
  const blobs = useRef(new Set<string>())

  useEffect(() => {
    const owned = blobs.current
    return () => {
      owned.forEach((url) => URL.revokeObjectURL(url))
      owned.clear()
    }
  }, [])

  const release = (items: readonly ComposeMedia[]) => {
    for (const item of items) {
      if (blobs.current.has(item.previewUrl)) {
        URL.revokeObjectURL(item.previewUrl)
        blobs.current.delete(item.previewUrl)
      }
    }
  }

  const addFiles = useCallback(
    (files: readonly File[]) => {
      setMedia((current) => {
        const room = Math.max(0, max - current.length)
        const added = files.slice(0, room).map<ComposeMedia>((file) => {
          const previewUrl = URL.createObjectURL(file)
          blobs.current.add(previewUrl)
          return { key: nextKey(), kind: file.type.startsWith("video") ? "video" : "image", file, previewUrl, altText: "" }
        })
        return [...current, ...added]
      })
    },
    [max],
  )

  const removeAt = useCallback((index: number) => {
    setMedia((current) => {
      const gone = current[index]
      if (gone) release([gone])
      return current.filter((_, i) => i !== index)
    })
  }, [])

  const clear = useCallback(() => {
    setMedia((current) => {
      release(current)
      return []
    })
  }, [])

  /** Replace everything (a draft opened into the form). */
  const replace = useCallback((next: ComposeMedia[]) => {
    setMedia((current) => {
      release(current)
      return next
    })
  }, [])

  const setAltText = useCallback((key: string, altText: string) => {
    setMedia((current) => current.map((m) => (m.key === key ? { ...m, altText } : m)))
  }, [])

  /** An upload landed: keep its id, so nothing is uploaded twice. */
  const markUploaded = useCallback((key: string, mediaId: string) => {
    setMedia((current) => current.map((m) => (m.key === key ? { ...m, mediaId } : m)))
  }, [])

  return { media, addFiles, removeAt, clear, replace, setAltText, markUploaded }
}

"use client"

import { createContext, useContext, useEffect, useMemo, type RefObject } from "react"

import { sendViews } from "../api"
import { ViewBatcher } from "../v2"

/*
  Views (contract §5): every note card that is at least half on screen for
  a moment is queued, and the queue goes out every few seconds as one
  POST /v1/notes/views. Signed-out views are not counted by the server, so
  nothing is sent for them. Whatever is queued goes out when the tab hides.
*/

const ViewsContext = createContext<ViewBatcher | null>(null)

export function ViewTrackingProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const batcher = useMemo(() => (enabled ? new ViewBatcher((ids) => sendViews(ids)) : null), [enabled])

  useEffect(() => {
    if (!batcher) return
    const hide = () => {
      if (document.visibilityState === "hidden") void batcher.flush()
    }
    document.addEventListener("visibilitychange", hide)
    return () => {
      document.removeEventListener("visibilitychange", hide)
      void batcher.flush()
    }
  }, [batcher])

  return <ViewsContext.Provider value={batcher}>{children}</ViewsContext.Provider>
}

/** Queue `noteId` once the element is half visible. A no-op outside the provider or signed out. */
export function useTrackView(ref: RefObject<HTMLElement | null>, noteId: string) {
  const batcher = useContext(ViewsContext)
  useEffect(() => {
    const el = ref.current
    if (!batcher || !el || !noteId || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          batcher.add(noteId)
          io.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [batcher, ref, noteId])
}

"use client"

/* Voice and video prompt answers (M15): playing a card's clip, and the owner's upload, attach and remove. */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"

import { fetchClipBlob, uploadPromptClip } from "../api/media"
import { deletePromptClip, putPromptClip } from "../api/photos"
import { attachWhenReady, CLIP_IDLE, clipFailureCopy, clipPath, clipRefusal, type ClipKind, type ClipPhase, type ClipResult } from "../model/promptClips"
import { KEYS } from "./profile"

export type ClipLoad = { state: "idle" | "loading" | "ready" | "failed"; src: string }

/**
  A card's clip, from exactly the route the server named, read with the
  token into a blob URL. Nothing is fetched until `wanted` (the person
  pressed play), so a card costs no request and nothing ever starts by itself.
  `attempt` re-reads after a failure.
*/
export function useClipSource(serverPath: string, wanted: boolean, attempt = 0): ClipLoad {
  const path = clipPath(serverPath)
  const [load, setLoad] = useState<ClipLoad>({ state: "idle", src: "" })

  useEffect(() => {
    if (!path || !wanted) {
      setLoad({ state: path ? "idle" : "failed", src: "" })
      return
    }
    const controller = new AbortController()
    let url = ""
    setLoad({ state: "loading", src: "" })
    fetchClipBlob(path, controller.signal).then(
      (blob) => {
        if (controller.signal.aborted) return
        url = URL.createObjectURL(blob)
        setLoad({ state: "ready", src: url })
      },
      () => {
        if (!controller.signal.aborted) setLoad({ state: "failed", src: "" })
      },
    )
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [path, wanted, attempt])

  return load
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface PromptClipEditor {
  phase: ClipPhase
  /** 404 MECHANIC_NOT_ENABLED came back: the clip controls go. */
  off: boolean
  /** Upload a recording or a file, then attach it to the prompt. */
  send: (promptId: number, clip: Blob, kind: ClipKind, mime: string) => Promise<ClipResult | null>
  remove: (promptId: number) => void
  removing: boolean
  /** A problem found before any upload (too long, wrong type), shown like a failure. */
  fail: (message: string) => void
  reset: () => void
}

export function usePromptClipEditor(): PromptClipEditor {
  const qc = useQueryClient()
  const [phase, setPhase] = useState<ClipPhase>(CLIP_IDLE)
  const [off, setOff] = useState(false)
  const alive = useRef(true)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      controller.current?.abort()
    }
  }, [])

  const refused = useCallback((error: unknown) => {
    if (!alive.current) return
    if (clipRefusal(error) === "off") {
      setOff(true)
      setPhase(CLIP_IDLE)
      return
    }
    setPhase({ kind: "failed", message: clipFailureCopy(error) })
  }, [])

  const send = useCallback(
    async (promptId: number, clip: Blob, kind: ClipKind, mime: string) => {
      controller.current?.abort()
      const abort = new AbortController()
      controller.current = abort
      setPhase({ kind: "uploading", percent: 0 })
      try {
        const mediaId = await uploadPromptClip(clip, kind, mime, {
          signal: abort.signal,
          onProgress: (f) => alive.current && setPhase({ kind: "uploading", percent: f * 100 }),
          onProcessing: () => alive.current && setPhase({ kind: "processing" }),
        })
        if (!alive.current) return null
        setPhase({ kind: "attaching" })
        const result = await attachWhenReady(() => putPromptClip(promptId, mediaId), sleep)
        void qc.invalidateQueries({ queryKey: KEYS.prompts })
        if (alive.current) setPhase(CLIP_IDLE)
        return result
      } catch (error) {
        if (!abort.signal.aborted) refused(error)
        return null
      }
    },
    [qc, refused],
  )

  const removal = useMutation<void, unknown, number>({
    mutationFn: deletePromptClip,
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.prompts }),
    onError: refused,
  })

  return {
    phase,
    off,
    send,
    remove: (promptId) => {
      setPhase(CLIP_IDLE)
      removal.mutate(promptId)
    },
    removing: removal.isPending,
    fail: (message) => setPhase({ kind: "failed", message }),
    reset: () => setPhase(CLIP_IDLE),
  }
}

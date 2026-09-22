import { useEffect, useRef, useState } from "react"
import api from "@/lib/api"

export type MediaKind = "image" | "video" | "audio"

interface BatchMediaResponse {
    data: Record<string, { kind?: string } | null>
}

/**
 * Resolve what an attached media asset actually IS.
 *
 * The chat wire carries `type: "media"` and a `media_id`, and nothing more —
 * message-service stores one media type and the asset's kind lives in
 * media-service. The chat renderer switches on image/video/audio, so it never
 * matched anything and a reloaded attachment drew an empty bubble. Only the
 * sending tab knew the kind, from the File it had just picked, and it lost
 * that on the next load.
 *
 * `POST /v1/media/batch` answers with `kind` per id, which is the cheapest
 * place to get it: one request for a whole page of messages.
 */
export function useMediaKinds(mediaIds: string[]): Record<string, MediaKind> {
    const [kinds, setKinds] = useState<Record<string, MediaKind>>({})
    // Ids already asked about, so a re-render cannot re-request them and a
    // miss (deleted asset, denied viewer) is not retried forever.
    const requested = useRef(new Set<string>())
    const key = mediaIds.join(",")

    useEffect(() => {
        const missing = mediaIds.filter((id) => id && !requested.current.has(id))
        if (missing.length === 0) return
        missing.forEach((id) => requested.current.add(id))

        let cancelled = false
        void (async () => {
            // media-service caps a batch at 50.
            for (let i = 0; i < missing.length; i += 50) {
                const slice = missing.slice(i, i + 50)
                try {
                    const res = await api.post<BatchMediaResponse>("/v1/media/batch", {
                        ids: slice,
                    })
                    if (cancelled) return
                    const next: Record<string, MediaKind> = {}
                    for (const [id, value] of Object.entries(res.data?.data ?? {})) {
                        const kind = value?.kind
                        if (kind === "image" || kind === "video" || kind === "audio") {
                            next[id] = kind
                        }
                    }
                    if (Object.keys(next).length > 0) {
                        setKinds((prev) => ({ ...prev, ...next }))
                    }
                } catch {
                    // Leave these ids unresolved; the bubble falls back to a
                    // plain link rather than pretending to know the type.
                }
            }
        })()

        return () => {
            cancelled = true
        }
        // `mediaIds` is a fresh array every render; `key` is its content.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])

    return kinds
}

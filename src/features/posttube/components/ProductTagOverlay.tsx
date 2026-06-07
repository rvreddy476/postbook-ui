"use client"

import { useEffect, useMemo, useRef } from "react"
import {
    emitProductTagClick,
    emitProductTagImpression,
    useProductTags,
    type PostProductTag,
} from "@/hooks/useProductTags"

interface ProductTagOverlayProps {
    postId: string
    /**
     * Player cursor in milliseconds. Drives which tags are visible. The
     * parent feeds this from the <video>'s timeupdate event; we don't
     * subscribe to the element here so the overlay stays decoupled from
     * the player implementation (react-player, Shaka, raw <video>).
     */
    currentTimeMs: number
}

/**
 * Renders the tappable product cards on top of the video. Cards are
 * positioned via the tag's (position_x, position_y) percentages of the
 * stage. The whole overlay is `pointer-events: none` except for the
 * card itself — so playback controls underneath still receive clicks.
 *
 * Time window
 * - time_start_ms NULL = "from the beginning"
 * - time_end_ms   NULL = "until the end"
 * - both NULL = "the whole video" (image posts behave this way)
 *
 * Impressions
 * - We fire one impression per (tag, mount) — re-mounting on next
 *   playthrough is intentional. Re-firing every appearance would
 *   overstate impressions for a viewer who scrubs back-and-forth.
 */
export function ProductTagOverlay({
    postId,
    currentTimeMs,
}: ProductTagOverlayProps) {
    const { data: tags } = useProductTags(postId)

    const activeTags = useMemo(
        () => filterActiveTags(tags ?? [], currentTimeMs),
        [tags, currentTimeMs],
    )

    if (!postId || activeTags.length === 0) return null

    return (
        <div
            className="pointer-events-none absolute inset-0 z-30"
            aria-hidden={false}
        >
            {activeTags.map((tag) => (
                <ProductCard key={tag.id} postId={postId} tag={tag} />
            ))}
        </div>
    )
}

function ProductCard({
    postId,
    tag,
}: {
    postId: string
    tag: PostProductTag
}) {
    const impressionFiredRef = useRef(false)

    // Fire impression on first mount per playthrough. The parent
    // controls re-mount cadence (key={tag.id} above) — if the player
    // re-mounts the overlay, that's a new playthrough.
    useEffect(() => {
        if (impressionFiredRef.current) return
        impressionFiredRef.current = true
        void emitProductTagImpression(postId, tag.id)
    }, [postId, tag.id])

    const handleClick = async () => {
        await emitProductTagClick(postId, tag.id)
        // Deep link to the commerce listing with the affiliate code
        // attached. monetization-service.GetAffiliateLinkByCode resolves
        // the click → conversion when the user buys. The actual code
        // lives in the affiliate_link payload — we don't have it cached
        // on the tag (the tag references the link by ID only), so we
        // route through /v1/commerce/affiliate/:linkId which serves a
        // 302 to the listing URL with ?via=<code>.
        window.location.assign(`/commerce/affiliate/${tag.affiliate_link_id}`)
    }

    const x = tag.position_x ?? 50 // default: dead centre
    const y = tag.position_y ?? 80 // default: lower-third

    return (
        <button
            type="button"
            onClick={handleClick}
            className={[
                "pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2",
                "flex items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 shadow-lg",
                "backdrop-blur-sm transition hover:scale-[1.03] hover:bg-white",
                "focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2",
            ].join(" ")}
            style={{ left: `${x}%`, top: `${y}%` }}
            aria-label={`View product: ${tag.label || "tagged product"}`}
        >
            {tag.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src={tag.image_url}
                    alt=""
                    className="h-9 w-9 rounded-lg object-cover"
                    loading="lazy"
                />
            ) : (
                <div className="h-9 w-9 rounded-lg bg-violet-100" />
            )}
            <div className="flex flex-col items-start text-left">
                {tag.label && (
                    <span className="text-xs font-semibold leading-tight text-slate-900">
                        {tag.label}
                    </span>
                )}
                <span className="text-[10px] font-medium uppercase tracking-wider text-violet-600">
                    Affiliate ↗
                </span>
            </div>
        </button>
    )
}

/**
 * Pure filter. Exported for test (no test file in this commit but the
 * shape is intentionally pure so it's straightforward to add one).
 */
export function filterActiveTags(
    tags: PostProductTag[],
    currentTimeMs: number,
): PostProductTag[] {
    return tags.filter((t) => {
        if (!t.is_active) return false
        const startOk = t.time_start_ms == null || currentTimeMs >= t.time_start_ms
        const endOk = t.time_end_ms == null || currentTimeMs <= t.time_end_ms
        return startOk && endOk
    })
}

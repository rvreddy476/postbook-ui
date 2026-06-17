"use client"

import { useEffect, useState } from "react"
import { ProductTagComposer } from "./ProductTagComposer"
import { getCurrentUserId } from "@/lib/api"

/**
 * Author-gated entry point for the in-video product-tag composer.
 *
 * Renders a small "Tag products" button on the watch page when the
 * viewer is the post's author. Clicking opens the composer modal.
 *
 * Self-contained — embedding screens don't need to know about the
 * modal or the author check. Drop it into any container; it does
 * nothing for non-authors.
 *
 * Note: getCurrentUserId reads from localStorage. The lazy useEffect
 * read is intentional — Next.js server-rendered shells don't have
 * window, so we defer the check until after hydration.
 */
export function ProductTagComposerButton({
    postId,
    postAuthorId,
}: {
    postId: string
    postAuthorId: string
}) {
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        setCurrentUserId(getCurrentUserId())
    }, [])

    if (!currentUserId || currentUserId !== postAuthorId) return null

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={[
                    "inline-flex items-center gap-2 rounded-full bg-brand-text px-4 py-2",
                    "text-sm font-semibold text-white shadow-sm transition",
                    "hover:bg-black focus:outline-none focus:ring-2 focus:ring-brand-text/20",
                ].join(" ")}
                aria-label="Tag products in this video"
            >
                <span aria-hidden>🏷️</span>
                Tag products
            </button>
            {open && (
                <ProductTagComposer postId={postId} onClose={() => setOpen(false)} />
            )}
        </>
    )
}

"use client"

import { useEffect, useState } from "react"
import api from "@/lib/api"
import { getCurrentUserId } from "@/lib/api"
import type { PostProductTag } from "@/hooks/useProductTags"

/**
 * Creator product-tag analytics — /creator/product-tags.
 *
 * Lists every active tag the creator has placed across all their
 * posts, newest first, with running impression + click totals + the
 * implied CTR. Backed by GET /v1/creators/:creatorId/product-tags.
 *
 * Why a separate page (not a tab on the existing creator dashboard):
 * - The dashboard's monetization tab already groups affiliate links;
 *   in-video tags are a different placement model and deserve their
 *   own surface for now. Can merge later once the dashboard team
 *   decides on the IA.
 */
export default function CreatorProductTagsPage() {
    const [creatorId, setCreatorId] = useState<string | null>(null)
    const [tags, setTags] = useState<PostProductTag[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setCreatorId(getCurrentUserId())
    }, [])

    useEffect(() => {
        if (!creatorId) return
        let cancelled = false
        ;(async () => {
            try {
                const res = await api.get<{ data: PostProductTag[] }>(
                    `/v1/creators/${creatorId}/product-tags`,
                )
                if (cancelled) return
                setTags(res.data?.data ?? [])
            } catch (e) {
                if (cancelled) return
                setError(
                    e instanceof Error
                        ? e.message
                        : "Failed to load tags",
                )
            }
        })()
        return () => {
            cancelled = true
        }
    }, [creatorId])

    if (!creatorId) {
        return (
            <main className="mx-auto max-w-3xl p-6">
                <p className="text-slate-600">Sign in to see your tags.</p>
            </main>
        )
    }

    if (error) {
        return (
            <main className="mx-auto max-w-3xl p-6">
                <p className="text-red-600">{error}</p>
            </main>
        )
    }

    if (!tags) {
        return (
            <main className="mx-auto max-w-3xl p-6">
                <p className="text-slate-500">Loading…</p>
            </main>
        )
    }

    return (
        <main className="mx-auto max-w-3xl p-6">
            <header className="mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">
                    In-video product tags
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                    Every tappable product card you've placed in a reel,
                    with running view + tap counts.
                </p>
            </header>

            {tags.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                    No tags placed yet. Open one of your videos and use{" "}
                    <strong>Tag products</strong> to add one.
                </p>
            ) : (
                <ul className="space-y-2">
                    {tags.map((t) => {
                        const ctr =
                            t.impression_count > 0
                                ? (t.click_count / t.impression_count) * 100
                                : 0
                        return (
                            <li
                                key={t.id}
                                className="flex items-center gap-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm"
                            >
                                <div className="h-12 w-12 shrink-0 rounded-md bg-slate-100">
                                    {t.image_url && (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={t.image_url}
                                            alt=""
                                            className="h-12 w-12 rounded-md object-cover"
                                        />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <a
                                        href={`/posttube/watch/${t.post_id}`}
                                        className="block truncate text-sm font-medium text-slate-900 hover:text-violet-700"
                                    >
                                        {t.label || "Untitled tag"}
                                    </a>
                                    <div className="text-xs text-slate-500">
                                        Post {t.post_id.slice(0, 8)}… ·{" "}
                                        Placed {new Date(t.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-right">
                                    <Stat label="Views" value={t.impression_count} />
                                    <Stat label="Taps" value={t.click_count} />
                                    <Stat label="CTR" value={`${ctr.toFixed(1)}%`} />
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </main>
    )
}

function Stat({ label, value }: { label: string; value: number | string }) {
    return (
        <div>
            <div className="text-sm font-semibold text-slate-900">{value}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
                {label}
            </div>
        </div>
    )
}

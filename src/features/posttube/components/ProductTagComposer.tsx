"use client"

import { useMemo, useState } from "react"
import {
    useMyAffiliateLinks,
    useProductPreview,
    type AffiliateLink,
} from "@/hooks/useAffiliateLinks"
import {
    useCreateProductTag,
    useDeleteProductTag,
    useProductTags,
    type PostProductTag,
} from "@/hooks/useProductTags"

/**
 * Composer modal — the creator-side surface for in-video product tags.
 *
 * Two columns
 *   left  — "your affiliate links" (clickable list of the creator's
 *           live links; tapping one opens the placement form)
 *   right — "tags on this video" (active tags + delete)
 *
 * The composer trusts the post-service handler to enforce
 *   - caller owns the post
 *   - affiliate link is the caller's
 *   - affiliate link is active
 * so it doesn't pre-check anything client-side beyond "is the
 * affiliate-link list empty? then nudge the creator to make one in
 * monetization-settings first".
 *
 * Mounted by the watch page's CTA button — the caller passes the
 * post in via props.
 */
export function ProductTagComposer({
    postId,
    onClose,
}: {
    postId: string
    onClose: () => void
}) {
    const { data: links = [], isPending: linksPending } = useMyAffiliateLinks()
    const { data: tags = [], refetch: refetchTags } = useProductTags(postId)
    const createTag = useCreateProductTag()
    const deleteTag = useDeleteProductTag()

    // Local UI state for the placement form.
    const [pickedLink, setPickedLink] = useState<AffiliateLink | null>(null)
    const [posX, setPosX] = useState(50)
    const [posY, setPosY] = useState(80)
    const [timeStartMs, setTimeStartMs] = useState<number | null>(null)
    const [timeEndMs, setTimeEndMs] = useState<number | null>(null)

    const taggedLinkIDs = useMemo(
        () => new Set(tags.map((t) => t.affiliate_link_id)),
        [tags],
    )

    async function handleCreate() {
        if (!pickedLink) return
        await createTag.mutateAsync({
            postId,
            affiliate_link_id: pickedLink.id,
            position_x: posX,
            position_y: posY,
            ...(timeStartMs !== null && { time_start_ms: timeStartMs }),
            ...(timeEndMs !== null && { time_end_ms: timeEndMs }),
        })
        setPickedLink(null)
        setTimeStartMs(null)
        setTimeEndMs(null)
        await refetchTags()
    }

    async function handleDelete(tagId: string) {
        await deleteTag.mutateAsync({ postId, tagId })
        await refetchTags()
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Tag products"
        >
            <div className="flex h-full max-h-[640px] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                {/* Header */}
                <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">
                            Tag products in this video
                        </h2>
                        <p className="text-xs text-slate-500">
                            Viewers can tap your tag to buy — you earn the
                            commission on the linked product.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </header>

                {/* Body — two columns */}
                <div className="grid flex-1 grid-cols-2 gap-0 overflow-hidden">
                    {/* Left — pick an affiliate link */}
                    <section className="flex flex-col overflow-hidden border-r border-slate-100">
                        <h3 className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Your affiliate links
                        </h3>
                        <div className="flex-1 overflow-y-auto px-3">
                            {linksPending && (
                                <p className="px-2 py-4 text-sm text-slate-500">
                                    Loading…
                                </p>
                            )}
                            {!linksPending && links.length === 0 && (
                                <p className="px-2 py-4 text-sm text-slate-500">
                                    No affiliate links yet. Create one in
                                    <strong> Monetization → Affiliate</strong>{" "}
                                    first.
                                </p>
                            )}
                            {links.map((link) => {
                                const isTagged = taggedLinkIDs.has(link.id)
                                const isPicked = pickedLink?.id === link.id
                                return (
                                    <button
                                        key={link.id}
                                        type="button"
                                        disabled={isTagged}
                                        onClick={() => setPickedLink(link)}
                                        className={[
                                            "mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition",
                                            isTagged && "cursor-not-allowed opacity-50",
                                            !isTagged && !isPicked && "hover:bg-slate-50",
                                            isPicked && "bg-brand-secondary ring-1 ring-brand-text/20",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                    >
                                        <LinkRow link={link} isTagged={isTagged} />
                                    </button>
                                )
                            })}
                        </div>

                        {/* Placement form (when a link is picked) */}
                        {pickedLink && (
                            <PlacementForm
                                posX={posX}
                                posY={posY}
                                timeStartMs={timeStartMs}
                                timeEndMs={timeEndMs}
                                onPosX={setPosX}
                                onPosY={setPosY}
                                onTimeStart={setTimeStartMs}
                                onTimeEnd={setTimeEndMs}
                                onSubmit={handleCreate}
                                onCancel={() => setPickedLink(null)}
                                submitting={createTag.isPending}
                                error={createTag.error?.message ?? null}
                            />
                        )}
                    </section>

                    {/* Right — existing tags */}
                    <section className="flex flex-col overflow-hidden">
                        <h3 className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Tags on this video ({tags.length})
                        </h3>
                        <div className="flex-1 overflow-y-auto px-3">
                            {tags.length === 0 && (
                                <p className="px-2 py-4 text-sm text-slate-500">
                                    No tags placed yet.
                                </p>
                            )}
                            {tags.map((tag) => (
                                <TagRow
                                    key={tag.id}
                                    tag={tag}
                                    onDelete={() => handleDelete(tag.id)}
                                    deleting={deleteTag.isPending}
                                />
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}

function LinkRow({
    link,
    isTagged,
}: {
    link: AffiliateLink
    isTagged: boolean
}) {
    const { data: preview } = useProductPreview(link.listing_id)
    return (
        <>
            <div className="h-10 w-10 shrink-0 rounded-md bg-slate-100" />
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">
                    {preview?.title ?? "Loading product…"}
                </div>
                <div className="text-xs text-slate-500">
                    {link.commission_pct}% · {link.click_count} clicks
                    {isTagged && " · already tagged"}
                </div>
            </div>
        </>
    )
}

function TagRow({
    tag,
    onDelete,
    deleting,
}: {
    tag: PostProductTag
    onDelete: () => void
    deleting: boolean
}) {
    const window =
        tag.time_start_ms == null && tag.time_end_ms == null
            ? "Whole video"
            : `${fmtMs(tag.time_start_ms)} → ${fmtMs(tag.time_end_ms)}`
    return (
        <div className="mb-1 flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
            <div className="h-10 w-10 shrink-0 rounded-md bg-slate-100">
                {tag.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={tag.image_url}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover"
                    />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">
                    {tag.label || "Untitled tag"}
                </div>
                <div className="text-xs text-slate-500">
                    {window} · {tag.impression_count} views ·{" "}
                    {tag.click_count} taps
                </div>
            </div>
            <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
                Remove
            </button>
        </div>
    )
}

function PlacementForm({
    posX,
    posY,
    timeStartMs,
    timeEndMs,
    onPosX,
    onPosY,
    onTimeStart,
    onTimeEnd,
    onSubmit,
    onCancel,
    submitting,
    error,
}: {
    posX: number
    posY: number
    timeStartMs: number | null
    timeEndMs: number | null
    onPosX: (n: number) => void
    onPosY: (n: number) => void
    onTimeStart: (n: number | null) => void
    onTimeEnd: (n: number | null) => void
    onSubmit: () => void
    onCancel: () => void
    submitting: boolean
    error: string | null
}) {
    return (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Placement
            </h4>

            <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-slate-700">
                    X (0–100%)
                    <input
                        type="number"
                        min={0}
                        max={100}
                        value={posX}
                        onChange={(e) => onPosX(Number(e.target.value))}
                        className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                    />
                </label>
                <label className="text-xs text-slate-700">
                    Y (0–100%)
                    <input
                        type="number"
                        min={0}
                        max={100}
                        value={posY}
                        onChange={(e) => onPosY(Number(e.target.value))}
                        className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                    />
                </label>
                <label className="text-xs text-slate-700">
                    Start (ms, blank = beginning)
                    <input
                        type="number"
                        min={0}
                        value={timeStartMs ?? ""}
                        onChange={(e) =>
                            onTimeStart(
                                e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                            )
                        }
                        className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                    />
                </label>
                <label className="text-xs text-slate-700">
                    End (ms, blank = until end)
                    <input
                        type="number"
                        min={0}
                        value={timeEndMs ?? ""}
                        onChange={(e) =>
                            onTimeEnd(
                                e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                            )
                        }
                        className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                    />
                </label>
            </div>

            {error && (
                <p className="mt-2 text-xs text-red-600" role="alert">
                    {error}
                </p>
            )}

            <div className="mt-3 flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={submitting}
                    className="rounded-md bg-brand-text px-3 py-1.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
                >
                    {submitting ? "Adding…" : "Add tag"}
                </button>
            </div>
        </div>
    )
}

function fmtMs(ms: number | null): string {
    if (ms == null) return "—"
    const totalSec = Math.floor(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m}:${s.toString().padStart(2, "0")}`
}

"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Bookmark, ChevronRight, FolderInput, FolderPlus, Loader2, Pencil, Trash2, X } from "lucide-react"
import AppShell from "@/components/AppShell"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useGlobalToast } from "@/contexts/ToastContext"
import {
    SAVED_COLLECTIONS_KEY,
    useCollections,
    useCreateCollection,
    useDeleteCollection,
    useMoveSavedItem,
    useRenameCollection,
    useSavedItems,
    useUnsaveItem,
} from "@/hooks/useSavedItems"
import { usePostDetail } from "@/hooks/useFeedPosts"
import { useUserProfile } from "@/hooks/useEditProfile"
import SaveToCollectionSheet from "@/features/saved/SaveToCollectionSheet"
import CollectionNameDialog from "@/features/saved/CollectionNameDialog"
import {
    COLLECTION_NAME_PROBLEM_TEXT,
    DEFAULT_COLLECTION_NAME,
    canCreateCollection,
    errorCode,
    resolveTab,
    savedErrorText,
    tabOf,
    type SavedCollectionView,
    type SavedItemView,
    type SavedTab,
} from "@/features/saved/savedCollections"

/*
  /saved: the viewer's saved posts, one tab per collection (post-service
  saved collections, 546eec063). All Saved is the default collection — the
  posts in no named collection — so a post moved to "Recipes" is listed
  under Recipes only (an item is in exactly one collection). Deleting a
  collection moves its posts back to All Saved; nothing is unsaved.
*/

const REEL_TYPES = new Set(["reel", "short", "flick"])

function contentRoute(post: { id: string; content_type?: string } | undefined, fallbackId: string): string {
    if (!post) return `/post/${fallbackId}`
    const t = post.content_type
    if (t && REEL_TYPES.has(t)) return `/reels?postId=${post.id}`
    if (t === "video" || t === "long_video") return `/posttube/watch?v=${post.id}`
    return `/post/${post.id}`
}

function contentLabel(post: { content_type?: string } | undefined): string {
    const t = post?.content_type
    if (!t) return "Post"
    if (REEL_TYPES.has(t)) return "Reel"
    if (t === "video" || t === "long_video") return "Video"
    if (t === "article") return "Article"
    if (t === "poll") return "Poll"
    return "Post"
}

function itemCount(n: number): string {
    return n === 1 ? "1 item" : `${n.toLocaleString("en-US")} items`
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SavedItemSkeleton() {
    return (
        <div className="rounded-2xl border border-brand-divider bg-brand-card p-4 shadow-xs motion-safe:animate-pulse" aria-hidden="true">
            <div className="flex items-start gap-4">
                <div className="h-24 w-24 shrink-0 rounded-xl bg-brand-secondary" />
                <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="h-3 w-1/2 rounded-full bg-brand-secondary" />
                    <div className="h-3 w-1/3 rounded-full bg-brand-secondary" />
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Saved item card
// ---------------------------------------------------------------------------

interface SavedItemCardProps {
    item: SavedItemView
    collectionName: string
    onMove: (item: SavedItemView) => void
    onUnsave: (id: string) => void
    removing: boolean
}

function SavedItemCard({ item, collectionName, onMove, onUnsave, removing }: SavedItemCardProps) {
    const router = useRouter()
    const { data: post } = usePostDetail(item.targetId)
    const { data: author } = useUserProfile(post?.author_id)

    const route = contentRoute(post as { id: string; content_type?: string } | undefined, item.targetId)
    const label = contentLabel(post)
    const authorName = author?.display_name || "Someone"
    const firstMedia = post?.media?.[0]
    const thumbnailUrl = firstMedia ? `/v1/media/${firstMedia.media_id}/serve` : null
    const isVideoMedia = firstMedia?.kind === "video"
    const title = post?.title || post?.text || "Untitled"
    const open = useCallback(() => router.push(route), [router, route])

    return (
        <article className="rounded-2xl border border-brand-divider bg-brand-card shadow-xs transition-shadow hover:shadow-md">
            <div className="flex items-stretch gap-4 p-4">
                <button
                    type="button"
                    onClick={open}
                    className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-brand-secondary sm:h-28 sm:w-28"
                    aria-label={`Open ${label.toLowerCase()}: ${title}`}
                >
                    {thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <span className="flex h-full w-full items-center justify-center text-brand-text/30">
                            <Bookmark className="h-6 w-6" aria-hidden="true" />
                        </span>
                    )}
                    {isVideoMedia && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20" aria-hidden="true">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60">
                                <svg className="ml-0.5 h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7L8 5z" />
                                </svg>
                            </span>
                        </span>
                    )}
                </button>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <button type="button" onClick={open} className="text-left">
                        <h3 className="line-clamp-2 text-base font-semibold text-brand-text">{title}</h3>
                    </button>
                    <p className="text-xs text-muted-foreground">
                        {label} · {authorName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        In <span className="font-semibold text-brand-text">{collectionName}</span>
                    </p>

                    <div className="mt-auto flex items-center gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => onMove(item)}
                            disabled={removing}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-secondary px-3 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-text/10 disabled:opacity-50"
                        >
                            <FolderInput className="h-4 w-4" aria-hidden="true" />
                            Move to collection
                        </button>
                        <button
                            type="button"
                            onClick={open}
                            aria-label="Open"
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-secondary text-brand-text transition-colors hover:bg-brand-text/10"
                        >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onUnsave(item.id)}
                            disabled={removing}
                            aria-label="Remove from Saved"
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-secondary text-brand-text transition-colors hover:bg-destructive/10 hover:text-danger disabled:opacity-50"
                        >
                            {removing ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
                        </button>
                    </div>
                </div>
            </div>
        </article>
    )
}

// ---------------------------------------------------------------------------
// Collection tabs
// ---------------------------------------------------------------------------

interface CollectionTabsProps {
    collections: SavedCollectionView[]
    active: SavedTab
    onSelect: (tab: SavedTab) => void
    onCreate: () => void
    isLoading: boolean
}

function CollectionTabs({ collections, active, onSelect, onCreate, isLoading }: CollectionTabsProps) {
    if (isLoading) {
        return (
            <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-hidden="true">
                {[96, 110, 90].map((w, i) => (
                    <div key={i} className="h-10 shrink-0 rounded-xl bg-brand-secondary motion-safe:animate-pulse" style={{ width: w }} />
                ))}
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Collections">
            {collections.map((c) => {
                const tab = tabOf(c.id)
                const selected = active === tab
                return (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onSelect(tab)}
                        className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                            selected
                                ? "border-primary-outline bg-primary-tint text-primary-ink"
                                : "border-transparent bg-brand-secondary text-brand-text hover:border-brand-divider hover:bg-brand-card"
                        }`}
                    >
                        <span className="max-w-[12rem] truncate">{c.name}</span>
                        <span className={`rounded-full px-1.5 text-xs tabular-nums ${selected ? "bg-primary-ink/10" : "bg-brand-text/5 text-muted-foreground"}`}>
                            {c.count.toLocaleString("en-US")}
                        </span>
                    </button>
                )
            })}
            <button
                type="button"
                onClick={onCreate}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-brand-divider px-4 py-2 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary-tint"
            >
                <FolderPlus className="h-4 w-4" aria-hidden="true" />
                New collection
            </button>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Dialog =
    | { kind: "create" }
    | { kind: "rename"; collection: SavedCollectionView }
    | { kind: "delete"; collection: SavedCollectionView }
    | null

export default function SavedPage() {
    const qc = useQueryClient()
    const toast = useGlobalToast()
    const [chosenTab, setChosenTab] = useState<SavedTab>("default")
    const [pendingUnsaveId, setPendingUnsaveId] = useState<string | null>(null)
    const [moving, setMoving] = useState<SavedItemView | null>(null)
    const [moveError, setMoveError] = useState<string | null>(null)
    const [dialog, setDialog] = useState<Dialog>(null)
    const [dialogError, setDialogError] = useState<string | null>(null)

    const collectionsQuery = useCollections()
    const collections = collectionsQuery.data ?? []
    // A collection deleted elsewhere drops the view back to All Saved.
    const tab = resolveTab(chosenTab, collectionsQuery.data)
    const activeCollection = collections.find((c) => tabOf(c.id) === tab)
    const activeName = activeCollection?.name ?? DEFAULT_COLLECTION_NAME

    const items = useSavedItems(tab, !collectionsQuery.isLoading)
    const allItems: SavedItemView[] = items.data?.pages.flatMap((page) => page.items) ?? []

    const unsave = useUnsaveItem()
    const move = useMoveSavedItem()
    const create = useCreateCollection()
    const rename = useRenameCollection()
    const remove = useDeleteCollection()

    // The listed collection vanished between the tabs and the list: re-read the tabs.
    const itemsMissing = items.isError && errorCode(items.error) === "COLLECTION_NOT_FOUND"
    useEffect(() => {
        if (itemsMissing) {
            void qc.invalidateQueries({ queryKey: SAVED_COLLECTIONS_KEY })
            setChosenTab("default")
        }
    }, [itemsMissing, qc])

    const nameOf = (collectionId: string | null) =>
        collections.find((c) => c.id === collectionId)?.name ?? DEFAULT_COLLECTION_NAME

    const handleUnsave = (id: string) => {
        setPendingUnsaveId(id)
        unsave.mutate(id, {
            onError: (err) => toast({ type: "error", title: savedErrorText(err, "unsave") }),
            onSettled: () => setPendingUnsaveId(null),
        })
    }

    const handleMove = (to: { id: string | null; name: string }) => {
        if (!moving) return
        setMoveError(null)
        move.mutate(
            { item: moving, toCollectionId: to.id, tab },
            {
                onSuccess: () => {
                    setMoving(null)
                    toast({ type: "success", title: `Moved to ${to.name}` })
                },
                onError: (err) => setMoveError(savedErrorText(err, "move")),
            },
        )
    }

    const openDialog = (next: Dialog) => {
        setDialogError(null)
        setDialog(next)
    }

    const handleCreate = (name: string) => {
        create.mutate(name, {
            onSuccess: (created) => {
                setDialog(null)
                setChosenTab(tabOf(created.id))
            },
            onError: (err) => setDialogError(savedErrorText(err, "create")),
        })
    }

    const handleRename = (collection: SavedCollectionView, name: string) => {
        rename.mutate(
            { id: collection.id!, name },
            {
                onSuccess: () => setDialog(null),
                onError: (err) => setDialogError(savedErrorText(err, "rename")),
            },
        )
    }

    const handleDelete = (collection: SavedCollectionView) => {
        remove.mutate(collection.id!, {
            onSuccess: ({ movedToDefault }) => {
                setDialog(null)
                setChosenTab("default")
                toast({
                    type: "success",
                    title: `Deleted ${collection.name}`,
                    description: movedToDefault > 0 ? `${itemCount(movedToDefault)} moved to ${DEFAULT_COLLECTION_NAME}.` : undefined,
                })
            },
            onError: (err) => {
                setDialog(null)
                toast({ type: "error", title: savedErrorText(err, "delete") })
            },
        })
    }

    const createAllowed = canCreateCollection(collections)

    return (
        <AppShell>
            <div className="min-h-screen bg-brand-bg">
                <div className="mx-auto max-w-3xl px-4 pb-16 pt-10">
                    <div className="mb-8 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-tint text-primary-ink" aria-hidden="true">
                            <Bookmark className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-brand-text">Saved</h1>
                            <p className="text-sm text-muted-foreground">Only you can see what you save.</p>
                        </div>
                    </div>

                    <div className="mb-4">
                        {collectionsQuery.isError ? (
                            <div role="alert" className="rounded-2xl border border-brand-divider bg-brand-card px-4 py-3 text-sm text-brand-text">
                                {savedErrorText(collectionsQuery.error, "load")}{" "}
                                <button type="button" onClick={() => void collectionsQuery.refetch()} className="font-semibold text-primary-ink hover:underline">
                                    Try again
                                </button>
                            </div>
                        ) : (
                            <CollectionTabs
                                collections={collections}
                                active={tab}
                                onSelect={setChosenTab}
                                onCreate={() =>
                                    createAllowed
                                        ? openDialog({ kind: "create" })
                                        : toast({ type: "warning", title: COLLECTION_NAME_PROBLEM_TEXT.limit })
                                }
                                isLoading={collectionsQuery.isLoading}
                            />
                        )}
                    </div>

                    {/* The open collection: its name, count, and Rename / Delete for a named one. */}
                    <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-brand-divider pb-4">
                        <div className="min-w-0 flex-1">
                            <h2 className="truncate text-lg font-semibold text-brand-text">{activeName}</h2>
                            <p className="text-xs text-muted-foreground">
                                {activeCollection ? itemCount(activeCollection.count) : ""}
                                {tab === "default" ? " not in a collection" : ""}
                            </p>
                        </div>
                        {activeCollection && !activeCollection.isDefault && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => openDialog({ kind: "rename", collection: activeCollection })}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-brand-divider px-3 py-2 text-sm font-semibold text-brand-text hover:bg-brand-secondary"
                                >
                                    <Pencil className="h-4 w-4" aria-hidden="true" />
                                    Rename
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openDialog({ kind: "delete", collection: activeCollection })}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-brand-divider px-3 py-2 text-sm font-semibold text-danger hover:bg-destructive/10"
                                >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>

                    {collectionsQuery.isLoading || items.isLoading ? (
                        <div className="space-y-3" role="status" aria-label="Loading saved items">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <SavedItemSkeleton key={i} />
                            ))}
                        </div>
                    ) : items.isError && !itemsMissing ? (
                        <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
                            <p className="text-sm font-semibold text-brand-text">{savedErrorText(items.error, "load")}</p>
                            <button
                                type="button"
                                onClick={() => void items.refetch()}
                                className="rounded-xl border border-brand-divider px-4 py-2 text-sm font-semibold text-brand-text hover:bg-brand-secondary"
                            >
                                Try again
                            </button>
                        </div>
                    ) : allItems.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-tint text-primary-ink" aria-hidden="true">
                                <Bookmark className="h-7 w-7" />
                            </div>
                            <p className="text-base font-semibold text-brand-text">
                                {tab === "default" ? "Nothing here yet" : `Nothing in ${activeName} yet`}
                            </p>
                            <p className="max-w-sm text-sm text-muted-foreground">
                                {tab === "default"
                                    ? "Tap Save on a post to keep it here. Posts you move to a collection are listed under that collection."
                                    : "Use Move to collection on a saved post, or Save to collection when you save one."}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                {allItems.map((item) => (
                                    <SavedItemCard
                                        key={item.id}
                                        item={item}
                                        collectionName={nameOf(item.collectionId)}
                                        onMove={(it) => {
                                            setMoveError(null)
                                            setMoving(it)
                                        }}
                                        onUnsave={handleUnsave}
                                        removing={pendingUnsaveId === item.id}
                                    />
                                ))}
                            </div>

                            {items.hasNextPage ? (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        type="button"
                                        onClick={() => void items.fetchNextPage()}
                                        disabled={items.isFetchingNextPage}
                                        className="inline-flex items-center gap-2 rounded-xl border border-brand-divider bg-brand-card px-5 py-2.5 text-sm font-semibold text-brand-text hover:bg-brand-secondary disabled:opacity-60"
                                    >
                                        {items.isFetchingNextPage && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
                                        {items.isFetchingNextPage ? "Loading…" : "Load more"}
                                    </button>
                                </div>
                            ) : (
                                <p className="mt-10 text-center text-xs text-muted-foreground">That’s everything in {activeName}.</p>
                            )}
                        </>
                    )}
                </div>
            </div>

            {moving && (
                <SaveToCollectionSheet
                    title="Move to collection"
                    currentCollectionId={moving.collectionId}
                    busy={move.isPending}
                    error={moveError}
                    onPick={handleMove}
                    onClose={() => { if (!move.isPending) setMoving(null) }}
                />
            )}

            {dialog?.kind === "create" && (
                <CollectionNameDialog
                    mode="create"
                    collections={collections}
                    busy={create.isPending}
                    error={dialogError}
                    onSubmit={handleCreate}
                    onClose={() => { if (!create.isPending) setDialog(null) }}
                />
            )}

            {dialog?.kind === "rename" && (
                <CollectionNameDialog
                    mode="rename"
                    collection={dialog.collection}
                    collections={collections}
                    busy={rename.isPending}
                    error={dialogError}
                    onSubmit={(name) => handleRename(dialog.collection, name)}
                    onClose={() => { if (!rename.isPending) setDialog(null) }}
                />
            )}

            <ConfirmDialog
                open={dialog?.kind === "delete"}
                onClose={() => { if (!remove.isPending) setDialog(null) }}
                onConfirm={() => { if (dialog?.kind === "delete") handleDelete(dialog.collection) }}
                title={dialog?.kind === "delete" ? `Delete ${dialog.collection.name}?` : "Delete collection?"}
                description={
                    dialog?.kind === "delete"
                        ? dialog.collection.count > 0
                            ? `The ${itemCount(dialog.collection.count)} in it move to ${DEFAULT_COLLECTION_NAME}. Nothing is unsaved.`
                            : "It is empty. Nothing is unsaved."
                        : ""
                }
                confirmLabel="Delete collection"
                destructive
                loading={remove.isPending}
            />
        </AppShell>
    )
}

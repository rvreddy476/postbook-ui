"use client"

import Link from "next/link"
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query"
import { ArrowLeft, Clapperboard, Film, Loader2, RotateCcw, StickyNote, Trash2 } from "lucide-react"

import AppShell from "@/components/AppShell"
import { useGlobalToast } from "@/contexts/ToastContext"
import api from "@/lib/api"
import {
    DELETED_POSTS_PATH,
    daysLeftText,
    deletedPostKindLabel,
    deletedPostsParams,
    parseDeletedPostsPage,
    restoreRemovesRow,
    restoreText,
    runRestore,
    withoutDeletedPost,
    type DeletedPost,
    type DeletedPostKind,
    type DeletedPostsPage,
    type RestoreOutcome,
} from "../_lib/recentlyDeleted"

/*
  Settings › Recently deleted. A deleted post (from the reels menu, the
  studio, or a post's own menu) waits here until post-service purges it at
  purge_at; Restore brings it back exactly as it was. The list and the
  restore are post-service's (see _lib/recentlyDeleted.ts).
*/

const RECENTLY_DELETED_KEY = ["recently-deleted"] as const

const KIND_ICON: Record<DeletedPostKind, typeof Film> = { reel: Film, video: Clapperboard, post: StickyNote }

function useDeletedPosts() {
    return useInfiniteQuery<DeletedPostsPage, Error, InfiniteData<DeletedPostsPage>, typeof RECENTLY_DELETED_KEY, string | null>({
        queryKey: RECENTLY_DELETED_KEY,
        initialPageParam: null,
        queryFn: async ({ pageParam }) => {
            const res = await api.get(DELETED_POSTS_PATH, { params: deletedPostsParams(pageParam) })
            return parseDeletedPostsPage(res.data)
        },
        getNextPageParam: (last) => last.nextCursor,
        staleTime: 0,
    })
}

function useRestorePost() {
    const qc = useQueryClient()
    return useMutation<RestoreOutcome, never, string>({
        mutationFn: (postId) => runRestore((url, body) => api.post(url, body), postId),
        onSuccess: (outcome, postId) => {
            if (!restoreRemovesRow(outcome)) return
            qc.setQueryData<InfiniteData<DeletedPostsPage>>(RECENTLY_DELETED_KEY, (data) =>
                data ? { ...data, pages: withoutDeletedPost(data.pages, postId) } : data,
            )
            if (outcome === "restored") {
                // The post is live again: the profile grids and counts re-read.
                void qc.invalidateQueries({ queryKey: ["profile-posts"] })
                void qc.invalidateQueries({ queryKey: ["content-counts"] })
            }
        },
    })
}

function DeletedRow({ post, onRestore, busy }: { post: DeletedPost; onRestore: () => void; busy: boolean }) {
    const Icon = KIND_ICON[post.kind]
    const kind = deletedPostKindLabel(post.kind)
    return (
        <li className="flex items-center gap-4 rounded-xl border border-border bg-brand-card p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-secondary text-brand-highlight">
                <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-brand-text">{post.text || kind}</p>
                <p className="mt-0.5 text-xs text-brand-highlight">
                    {kind} · Deleted {new Date(post.deletedAt).toLocaleDateString()}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-brand-text">{daysLeftText(post.purgeAt)}</p>
            </div>
            <button
                type="button"
                onClick={onRestore}
                disabled={busy}
                aria-label={`Restore ${kind.toLowerCase()}${post.text ? `: ${post.text}` : ""}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-secondary px-3 py-1.5 text-sm font-semibold text-brand-text transition hover:bg-brand-divider disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
                Restore
            </button>
        </li>
    )
}

export default function RecentlyDeletedPage() {
    const toast = useGlobalToast()
    const list = useDeletedPosts()
    const restore = useRestorePost()
    const items = list.data?.pages.flatMap((p) => p.items) ?? []

    const handleRestore = (postId: string) =>
        restore.mutate(postId, {
            onSuccess: (outcome) => toast({ type: outcome === "restored" ? "success" : outcome === "failed" ? "error" : "info", title: restoreText(outcome) }),
        })

    return (
        <AppShell>
            <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
                <Link
                    href="/settings"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text transition-colors hover:text-brand-text/70"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Settings
                </Link>

                <div>
                    <h1 className="text-2xl font-bold text-brand-text">Recently deleted</h1>
                    <p className="mt-1 text-sm text-brand-highlight">
                        Posts, reels and videos you deleted stay here for a while before they are removed for good. Restore one to put it back
                        on your profile exactly as it was.
                    </p>
                </div>

                {list.isPending ? (
                    <div className="flex items-center gap-2 text-sm text-brand-highlight" role="status">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                    </div>
                ) : list.isError ? (
                    <div className="space-y-3 rounded-2xl border border-brand-divider bg-brand-card p-6" role="alert">
                        <p className="text-sm font-semibold text-danger">Could not load Recently deleted.</p>
                        <button
                            type="button"
                            onClick={() => void list.refetch()}
                            className="rounded-xl border border-brand-divider px-4 py-2 text-sm font-semibold text-brand-text hover:bg-brand-secondary"
                        >
                            Try again
                        </button>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-16 text-center">
                        <Trash2 className="h-7 w-7 text-brand-highlight" aria-hidden />
                        <p className="text-sm font-semibold text-brand-text">Nothing here</p>
                        <p className="max-w-xs text-sm text-brand-highlight">When you delete a post, reel or video, you can restore it from here.</p>
                    </div>
                ) : (
                    <>
                        <ul className="space-y-2">
                            {items.map((post) => (
                                <DeletedRow
                                    key={post.id}
                                    post={post}
                                    busy={restore.isPending && restore.variables === post.id}
                                    onRestore={() => handleRestore(post.id)}
                                />
                            ))}
                        </ul>
                        {list.hasNextPage && (
                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => void list.fetchNextPage()}
                                    disabled={list.isFetchingNextPage}
                                    className="rounded-xl border border-brand-divider px-4 py-2 text-sm font-semibold text-brand-text hover:bg-brand-secondary disabled:opacity-50"
                                >
                                    {list.isFetchingNextPage ? "Loading…" : "Load more"}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppShell>
    )
}

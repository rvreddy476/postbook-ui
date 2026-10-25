"use client"

import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pin, X } from "lucide-react"

import api from "@/lib/api"
import type { PostDetail } from "@/types/profile"
import { pinnedHref, pinnedLabel, pinnedPosts, pinnedPostsRequest, unpinRequest } from "./pinned"

/*
  Pinned posts above the Media tab (see pinned.ts for where they come from).
  The key sits under "profile-posts" so a pin or unpin anywhere
  (usePostActions useTogglePin invalidates that prefix) refreshes this row.
*/
export function PinnedPosts({ userId, isOwn }: { userId: string; isOwn: boolean }) {
    const qc = useQueryClient()
    const { data: pins = [] } = useQuery<PostDetail[]>({
        queryKey: ["profile-posts", userId, "pinned-row"],
        queryFn: async () => {
            const req = pinnedPostsRequest(userId)
            const res = await api.get(req.url, { params: req.params })
            return pinnedPosts<PostDetail>(res.data)
        },
        enabled: !!userId,
        staleTime: 60_000,
    })

    const unpin = useMutation({
        mutationFn: async (postId: string) => {
            const req = unpinRequest(postId)
            await api.put(req.url, req.body)
        },
        onSuccess: () => void qc.invalidateQueries({ queryKey: ["profile-posts", userId] }),
    })

    if (pins.length === 0) return null

    return (
        <section className="mb-6" aria-label="Pinned">
            <div className="flex items-center gap-2 mb-3">
                <Pin className="w-3.5 h-3.5 text-brand-text" aria-hidden />
                <h2 className="text-xs font-black tracking-[0.2em] text-brand-highlight">Pinned</h2>
            </div>
            <ul className="flex flex-wrap gap-2">
                {pins.map((post) => {
                    const label = pinnedLabel(post)
                    return (
                        <li
                            key={post.id}
                            className="flex items-center gap-2 bg-brand-card border border-brand-divider rounded-xl px-3 py-2 shadow-xs"
                        >
                            <Pin className="w-3 h-3 text-primary-ink shrink-0" aria-hidden />
                            <Link
                                href={pinnedHref(post.id)}
                                className="text-xs font-medium text-brand-text max-w-[200px] truncate hover:underline"
                            >
                                {label}
                            </Link>
                            {isOwn && (
                                <button
                                    type="button"
                                    onClick={() => unpin.mutate(post.id)}
                                    disabled={unpin.isPending}
                                    className="ml-1 text-brand-text/40 hover:text-brand-text transition-colors disabled:opacity-40"
                                    title="Unpin"
                                    aria-label={`Unpin ${label}`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}

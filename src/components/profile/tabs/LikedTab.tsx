"use client"

import Link from "next/link"
import { Clapperboard, Heart } from "lucide-react"

import { useLikedReels } from "@/features/reels/hooks/useLikedReels"
import { formatCount } from "@/features/reels/model"
import { ProfileTabError } from "../states/ProfileTabError"

const LIMIT = 60

/*
  Liked (owner only, T-21): the reels the viewer liked, newest first —
  the same loader as /reels/liked (GET /v1/reels/liked + POST
  /v1/posts/batch, features/reels/liked.ts). post-service serves likes to
  their owner only, so this tab is never shown to visitors.
*/
export function LikedTab() {
    const liked = useLikedReels(LIMIT)
    const items = liked.data ?? []

    if (liked.isPending) {
        return (
            <ul className="grid grid-cols-3 gap-2 sm:gap-3" aria-busy="true" aria-label="Loading liked reels">
                {Array.from({ length: 6 }).map((_, i) => (
                    <li key={i} className="aspect-9/16 animate-pulse rounded-2xl bg-brand-secondary" aria-hidden />
                ))}
            </ul>
        )
    }

    if (liked.isError) {
        return <ProfileTabError subject="your liked reels" onRetry={() => void liked.refetch()} />
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Heart className="mb-4 h-9 w-9 text-muted-foreground" aria-hidden />
                <h3 className="text-lg font-semibold text-brand-text">Reels you like will show up here</h3>
                <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">Only you can see this tab.</p>
                <Link
                    href="/reels"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-ink px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline"
                >
                    <Clapperboard className="h-4 w-4" aria-hidden />
                    Watch reels
                </Link>
            </div>
        )
    }

    return (
        <ul className="grid grid-cols-3 gap-2 sm:gap-3">
            {items.map((reel) => (
                <li key={reel.id}>
                    <Link
                        href={`/reels?reelId=${encodeURIComponent(reel.id)}`}
                        aria-label={`${reel.title || `Reel by ${reel.authorName}`}, ${formatCount(reel.likeCount)} likes`}
                        className="group relative block aspect-9/16 overflow-hidden rounded-2xl bg-brand-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-outline"
                    >
                        {reel.media.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={reel.media.posterUrl}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        ) : null}
                        <span
                            className="absolute bottom-2 left-2 flex items-center gap-1 text-xs font-semibold text-[rgb(var(--reel-on-stage))] drop-shadow"
                            aria-hidden
                        >
                            <Heart className="h-3.5 w-3.5 fill-current" />
                            {formatCount(reel.likeCount)}
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    )
}

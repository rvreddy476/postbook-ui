"use client"

import React, { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Compass, Hash, Search, Users } from "lucide-react"

import { useTrending, type TrendingHashtag } from "@/hooks/useSearch"
import { readSessionUserId } from "@/features/reels/session"
import { ExploreReels } from "@/features/reels/explore/ExploreReels"
import { SuggestedCreators } from "@/features/reels/explore/SuggestedCreators"
import { EXPLORE_CATEGORY_PARAM } from "@/features/reels/explore/exploreApi"

/*
  /discover — Explore (TikTok parity T-18). Short-video category chips over
  a tile grid (GET /v1/feed/reels?category=), a "People to follow" row
  with a working Follow (graph-service), and trending hashtags. The chip
  lives in the URL (?category=) so a filtered page can be shared or
  reloaded. Nothing here plays: tiles are covers, and a tap opens the reels
  stage on that reel, muted as every reel starts.

  The route is gated by middleware; the signed-out branches below cover a
  session that lapsed while the page was open.
*/

function SectionTitle({ id, icon, title, action }: { id: string; icon: React.ReactNode; title: string; action?: React.ReactNode }) {
    return (
        <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id={id} className="flex items-center gap-2 text-base font-bold text-brand-text">
                <span className="text-brand-text/60" aria-hidden>{icon}</span>
                {title}
            </h2>
            {action}
        </div>
    )
}

function TrendingHashtags({ items }: { items: readonly TrendingHashtag[] }) {
    return (
        <ul className="flex flex-wrap gap-2">
            {items.map((item) => (
                <li key={item.hashtag}>
                    <Link
                        href={`/hashtag/${encodeURIComponent(item.hashtag)}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-divider bg-brand-card px-3.5 text-[13px] font-semibold text-brand-text transition-colors hover:bg-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                    >
                        <Hash className="h-3.5 w-3.5 text-brand-text/50" aria-hidden />
                        {item.hashtag}
                    </Link>
                </li>
            ))}
        </ul>
    )
}

function DiscoverContent() {
    const router = useRouter()
    const pathname = usePathname() || "/discover"
    const searchParams = useSearchParams()
    const category = searchParams.get(EXPLORE_CATEGORY_PARAM) ?? ""

    // The session is read on the client; the server render is neutral.
    const [viewerId, setViewerId] = useState("")
    const [session, setSession] = useState<"unknown" | "in" | "out">("unknown")
    useEffect(() => {
        const id = readSessionUserId()
        setViewerId(id)
        setSession(id ? "in" : "out")
    }, [])

    const { data: trendingData, isLoading: trendingLoading } = useTrending()
    const hashtags = trendingData?.trending ?? []

    const onCategoryChange = useCallback(
        (slug: string) => {
            const next = new URLSearchParams(searchParams.toString())
            if (slug) next.set(EXPLORE_CATEGORY_PARAM, slug)
            else next.delete(EXPLORE_CATEGORY_PARAM)
            const qs = next.toString()
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
        },
        [router, pathname, searchParams],
    )

    const returnTo = category ? `/discover?${EXPLORE_CATEGORY_PARAM}=${encodeURIComponent(category)}` : "/discover"

    return (
        <div className="min-h-screen bg-brand-bg">
            <div className="sticky top-0 z-10 border-b border-brand-divider bg-brand-card/90 backdrop-blur-xl">
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
                    <Compass className="h-6 w-6 text-brand-text" aria-hidden />
                    <h1 className="text-xl font-black tracking-tight text-brand-text">Explore</h1>
                    <Link
                        href="/search"
                        className="ml-auto inline-flex h-9 items-center gap-2 rounded-full border border-brand-divider bg-brand-secondary px-4 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-text/5"
                    >
                        <Search className="h-4 w-4" aria-hidden />
                        Search
                    </Link>
                </div>
            </div>

            <main className="mx-auto max-w-6xl space-y-8 px-4 py-5">
                {session === "in" ? (
                    <section aria-labelledby="explore-people">
                        <SectionTitle
                            id="explore-people"
                            icon={<Users className="h-4 w-4" />}
                            title="People to follow"
                            action={
                                <Link href="/connections" className="text-xs font-semibold text-brand-highlight hover:text-brand-text">
                                    See all
                                </Link>
                            }
                        />
                        <SuggestedCreators viewerId={viewerId} variant="row" limit={12} label="People to follow" />
                    </section>
                ) : null}

                <section aria-label="Reels by category">
                    <ExploreReels category={category} onCategoryChange={onCategoryChange} session={session} returnTo={returnTo} />
                </section>

                {trendingLoading || hashtags.length > 0 ? (
                    <section aria-labelledby="explore-trending">
                        <SectionTitle id="explore-trending" icon={<Hash className="h-4 w-4" />} title="Trending hashtags" />
                        {trendingLoading ? (
                            <div className="flex flex-wrap gap-2" aria-busy="true" aria-label="Loading hashtags">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <span key={i} className="h-9 w-24 animate-pulse rounded-full bg-brand-secondary" />
                                ))}
                            </div>
                        ) : (
                            <TrendingHashtags items={hashtags.slice(0, 20)} />
                        )}
                    </section>
                ) : null}
            </main>
        </div>
    )
}

export default function DiscoverPage() {
    // useSearchParams needs a Suspense boundary for the static render.
    return (
        <Suspense fallback={<div className="min-h-screen bg-brand-bg" />}>
            <DiscoverContent />
        </Suspense>
    )
}

"use client"

import React, { Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
    Search, X, Loader2, Users, FileText, LayoutGrid, CheckCircle,
    ShoppingBag, Calendar, MessageSquare, Clock, Bookmark, Trash2,
    Hash, Globe, Radio,
} from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
    useUniversalSearch,
    useAutocomplete,
    useMultiEntitySearch,
    useRecordSearchClick,
    SearchType,
} from "@/hooks/useSearch"
import type {
    EntityType,
    HashtagHit,
    CommunityHit,
    ChannelHit,
    ProductHit,
    UserHit,
    PostHit,
} from "@/types/search"
import type { PostDetail } from "@/types/profile"
import PostCard from "@/components/PostCard"
import api from "@/lib/api"

// ─── Extended tab types ───────────────────────────────────────────────────────

// `ExtendedSearchType` now includes the six multi-entity buckets the
// search-service ranked API returns (posts, users, hashtags, products,
// communities, channels) plus the legacy core "all" tab and the
// non-multi-entity tabs that still hit dedicated endpoints
// (`events`, `messages`).
type ExtendedSearchType =
    | SearchType
    | "products"
    | "hashtags"
    | "communities"
    | "channels"
    | "events"
    | "messages"

// Subset of ExtendedSearchType served by the multi-entity ranked API.
// Used to gate click-tracking + cursor-paged "Show more" buttons.
const MULTI_ENTITY_TYPES: ExtendedSearchType[] = [
    "profiles",
    "posts",
    "hashtags",
    "products",
    "communities",
    "channels",
]

// Map ExtendedSearchType → backend EntityType (the wire name).
function toEntityType(t: ExtendedSearchType): EntityType | null {
    switch (t) {
        case "profiles": return "users"
        case "posts": return "posts"
        case "hashtags": return "hashtags"
        case "products": return "products"
        case "communities": return "communities"
        case "channels": return "channels"
        default: return null
    }
}

// ─── Tab configuration ──────────────────────────────────────────────────────

interface Tab {
    label: string
    type: ExtendedSearchType
    icon: React.ReactNode
}

const TABS: Tab[] = [
    { label: "All", type: "all", icon: <LayoutGrid className="w-4 h-4" /> },
    { label: "People", type: "profiles", icon: <Users className="w-4 h-4" /> },
    { label: "Posts", type: "posts", icon: <FileText className="w-4 h-4" /> },
    { label: "Hashtags", type: "hashtags", icon: <Hash className="w-4 h-4" /> },
    // Communities feature disabled — tab hidden, render code kept below.
    // { label: "Communities", type: "communities", icon: <Globe className="w-4 h-4" /> },
    { label: "Channels", type: "channels", icon: <Radio className="w-4 h-4" /> },
    { label: "Products", type: "products", icon: <ShoppingBag className="w-4 h-4" /> },
    { label: "Events", type: "events", icon: <Calendar className="w-4 h-4" /> },
    { label: "Messages", type: "messages", icon: <MessageSquare className="w-4 h-4" /> },
]

// ─── Profile result card ─────────────────────────────────────────────────────

interface ProfileCardProps {
    profile: {
        id: string
        username: string
        display_name: string
        bio: string
        avatar_media_id?: string
        is_verified: boolean
        follower_count: number
    }
}

function ProfileCard({ profile }: ProfileCardProps) {
    const avatar = profile.avatar_media_id
        ? `/v1/media/${profile.avatar_media_id}/serve`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`

    const bioSnippet = profile.bio?.length > 100 ? profile.bio.slice(0, 100) + "…" : profile.bio

    return (
        <Link
            href={`/u/${profile.username}`}
            className="flex items-center gap-4 p-4 bg-brand-card rounded-2xl border border-brand-divider shadow-sm hover:shadow-md hover:border-brand-text/10 transition-all duration-200 group"
        >
            <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-gray-100 group-hover:ring-brand-text/20 transition-all">
                    <img src={avatar} alt={profile.display_name} className="w-full h-full object-cover" />
                </div>
                {profile.is_verified && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-white">
                        <CheckCircle className="w-3 h-3 text-white fill-current" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-bold text-brand-text group-hover:text-brand-text transition-colors truncate">
                        {profile.display_name}
                    </span>
                </div>
                <p className="text-sm text-brand-text/40 truncate">@{profile.username}</p>
                {bioSnippet && (
                    <p className="text-sm text-brand-text/60 mt-0.5 line-clamp-1">{bioSnippet}</p>
                )}
                <p className="text-xs text-brand-text/40 mt-1 font-medium">
                    {profile.follower_count.toLocaleString()} follower{profile.follower_count !== 1 ? "s" : ""}
                </p>
            </div>
            <div className="flex-shrink-0 text-brand-text/30 group-hover:text-brand-text/50 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </Link>
    )
}

// ─── Section heading ─────────────────────────────────────────────────────────

function SectionHeading({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <span className="text-brand-text/50">{icon}</span>
            <h2 className="text-sm font-black text-brand-text uppercase tracking-wider">{label}</h2>
            {count !== undefined && (
                <span className="ml-auto text-xs font-semibold text-brand-text/40">{count} result{count !== 1 ? "s" : ""}</span>
            )}
        </div>
    )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-text/5 to-fuchsia-50 border border-brand-text/10 flex items-center justify-center">
                <Search className="w-9 h-9 text-brand-text/30" />
            </div>
            <div className="text-center max-w-xs">
                <p className="text-base font-bold text-brand-text">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-sm text-brand-text/40 mt-1.5 leading-relaxed">
                    Try searching for a different name, username, or topic.
                </p>
            </div>
        </div>
    )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
    return (
        <div className="space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-brand-card rounded-2xl border border-brand-divider">
                    <div className="w-14 h-14 rounded-full bg-brand-divider flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-brand-divider rounded-lg w-1/3" />
                        <div className="h-3 bg-brand-divider rounded-lg w-1/4" />
                        <div className="h-3 bg-brand-divider rounded-lg w-2/3" />
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Hint state (query too short) ────────────────────────────────────────────

function HintState() {
    return (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-text/50 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-brand-text/20">
                <Search className="w-7 h-7 text-white" />
            </div>
            <div className="text-center">
                <p className="text-sm font-bold text-brand-text">Search VChat</p>
                <p className="text-xs text-brand-text/40 mt-1">Type at least 2 characters to begin</p>
            </div>
        </div>
    )
}

// ─── Search history & saved searches panel ───────────────────────────────────

interface SearchItem {
    id?: string
    query: string
}

function HistoryAndSavedPanel({ onSelectQuery }: { onSelectQuery: (q: string) => void }) {
    const queryClient = useQueryClient()

    const { data: historyData } = useQuery<SearchItem[]>({
        queryKey: ["search", "history"],
        queryFn: () => api.get("/v1/search/history").then((r) => r.data?.data?.items ?? []),
        staleTime: 30_000,
    })

    const { data: savedData } = useQuery<SearchItem[]>({
        queryKey: ["search", "saved"],
        queryFn: () => api.get("/v1/search/saved").then((r) => r.data?.data?.items ?? []),
        staleTime: 30_000,
    })

    const deleteHistory = useMutation({
        mutationFn: (query: string) => api.delete(`/v1/search/history`, { data: { query } }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["search", "history"] }),
    })

    const deleteSaved = useMutation({
        mutationFn: (id: string) => api.delete(`/v1/search/saved/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["search", "saved"] }),
    })

    const recentItems = (historyData ?? []).slice(0, 5)
    const savedItems = savedData ?? []

    if (recentItems.length === 0 && savedItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-text/50 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-brand-text/20">
                    <Search className="w-7 h-7 text-white" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-bold text-brand-text">Search VChat</p>
                    <p className="text-xs text-brand-text/40 mt-1">Your recent and saved searches will appear here</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {recentItems.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-brand-text/50" />
                        <h2 className="text-sm font-black text-brand-text uppercase tracking-wider">Recent Searches</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {recentItems.map((item, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-1.5 bg-brand-divider hover:bg-brand-text/5 border border-brand-divider hover:border-brand-text/20 rounded-full px-3 py-1.5 transition-all group"
                            >
                                <button
                                    onClick={() => onSelectQuery(item.query)}
                                    className="text-sm font-medium text-brand-text group-hover:text-brand-text"
                                >
                                    {item.query}
                                </button>
                                <button
                                    onClick={() => deleteHistory.mutate(item.query)}
                                    className="text-brand-text/40 hover:text-red-500 transition-colors ml-0.5"
                                    aria-label="Remove"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {savedItems.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <Bookmark className="w-4 h-4 text-brand-text/50" />
                        <h2 className="text-sm font-black text-brand-text uppercase tracking-wider">Saved Searches</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {savedItems.map((item, i) => (
                            <div
                                key={item.id ?? i}
                                className="flex items-center gap-1.5 bg-brand-text/5 hover:bg-brand-text/10 border border-brand-text/15 hover:border-brand-text/30 rounded-full px-3 py-1.5 transition-all group"
                            >
                                <button
                                    onClick={() => onSelectQuery(item.query)}
                                    className="text-sm font-medium text-brand-text"
                                >
                                    {item.query}
                                </button>
                                {item.id && (
                                    <button
                                        onClick={() => deleteSaved.mutate(item.id!)}
                                        className="text-brand-text/40 hover:text-red-600 transition-colors ml-0.5"
                                        aria-label="Delete saved search"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}

// ─── Products tab ────────────────────────────────────────────────────────────

interface Product {
    id: string
    name: string
    description: string
    price: number
    currency: string
    url?: string
}

function ProductsTab({ query }: { query: string }) {
    const { data, isLoading, isFetching } = useQuery<Product[]>({
        queryKey: ["search", "products", query],
        queryFn: () =>
            api.get("/v1/search/products", { params: { q: query, limit: 20 } }).then((r) => r.data?.data?.items ?? []),
        enabled: query.length > 2,
        staleTime: 60_000,
    })

    if (query.length <= 2) return <HintState />
    if (isLoading || isFetching) return <LoadingSkeleton />

    const items = data ?? []

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-text/5 to-fuchsia-50 border border-brand-text/10 flex items-center justify-center">
                    <ShoppingBag className="w-9 h-9 text-brand-text/30" />
                </div>
                <p className="text-base font-bold text-brand-text">No products found for &ldquo;{query}&rdquo;</p>
            </div>
        )
    }

    const currencySymbol = (currency: string) => {
        const map: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", INR: "₹", JPY: "¥" }
        return map[currency] ?? currency + " "
    }

    return (
        <div className="space-y-3">
            <SectionHeading icon={<ShoppingBag className="w-4 h-4" />} label="Products" count={items.length} />
            {items.map((product) => (
                <div
                    key={product.id}
                    className="flex items-start gap-4 p-4 bg-brand-card rounded-2xl border border-brand-divider shadow-sm hover:shadow-md hover:border-brand-text/10 transition-all duration-200"
                >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-text/10 to-fuchsia-50 flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-6 h-6 text-brand-text/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-brand-text truncate">{product.name}</p>
                        {product.description && (
                            <p className="text-sm text-brand-text/60 mt-0.5 line-clamp-2">{product.description}</p>
                        )}
                        <p className="text-sm font-bold text-brand-text mt-1.5">
                            {currencySymbol(product.currency)}{product.price.toLocaleString()}
                        </p>
                    </div>
                    {product.url && (
                        <Link
                            href={product.url}
                            className="flex-shrink-0 px-3 py-1.5 text-sm font-bold text-white bg-brand-text rounded-lg hover:bg-brand-text transition-colors"
                        >
                            View
                        </Link>
                    )}
                </div>
            ))}
        </div>
    )
}

// ─── Events tab ──────────────────────────────────────────────────────────────

interface SearchEvent {
    id: string
    title: string
    description: string
    date: string
    location?: string
}

function EventsTab({ query }: { query: string }) {
    const { data, isLoading, isFetching } = useQuery<SearchEvent[]>({
        queryKey: ["search", "events", query],
        queryFn: () =>
            api.get("/v1/search/events", { params: { q: query, limit: 20 } }).then((r) => r.data?.data?.items ?? []),
        enabled: query.length > 2,
        staleTime: 60_000,
    })

    if (query.length <= 2) return <HintState />
    if (isLoading || isFetching) return <LoadingSkeleton />

    const items = data ?? []

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-text/5 to-fuchsia-50 border border-brand-text/10 flex items-center justify-center">
                    <Calendar className="w-9 h-9 text-brand-text/30" />
                </div>
                <p className="text-base font-bold text-brand-text">No events found for &ldquo;{query}&rdquo;</p>
            </div>
        )
    }

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString(undefined, {
                weekday: "short", year: "numeric", month: "short", day: "numeric",
            })
        } catch {
            return dateStr
        }
    }

    return (
        <div className="space-y-3">
            <SectionHeading icon={<Calendar className="w-4 h-4" />} label="Events" count={items.length} />
            {items.map((event) => (
                <div
                    key={event.id}
                    className="flex items-start gap-4 p-4 bg-brand-card rounded-2xl border border-brand-divider shadow-sm hover:shadow-md hover:border-brand-text/10 transition-all duration-200"
                >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-text/10 to-fuchsia-50 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-6 h-6 text-brand-text/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-brand-text truncate">{event.title}</p>
                        {event.description && (
                            <p className="text-sm text-brand-text/60 mt-0.5 line-clamp-2">{event.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-brand-text">{formatDate(event.date)}</span>
                            {event.location && (
                                <span className="text-xs text-brand-text/40">{event.location}</span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Messages tab ─────────────────────────────────────────────────────────────

interface SearchMessage {
    id: string
    content: string
    conversation_id?: string
}

function MessagesTab({ query }: { query: string }) {
    const { data, isLoading, isFetching } = useQuery<SearchMessage[]>({
        queryKey: ["search", "messages", query],
        queryFn: () =>
            api.get("/v1/search/messages", { params: { q: query, limit: 20 } }).then((r) => r.data?.data?.items ?? []),
        enabled: query.length > 2,
        staleTime: 60_000,
    })

    if (query.length <= 2) return <HintState />
    if (isLoading || isFetching) return <LoadingSkeleton />

    const items = data ?? []

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-text/5 to-fuchsia-50 border border-brand-text/10 flex items-center justify-center">
                    <MessageSquare className="w-9 h-9 text-brand-text/30" />
                </div>
                <p className="text-base font-bold text-brand-text">No messages found for &ldquo;{query}&rdquo;</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <SectionHeading icon={<MessageSquare className="w-4 h-4" />} label="Messages" count={items.length} />
            {items.map((msg) => (
                <div
                    key={msg.id}
                    className="flex items-start gap-4 p-4 bg-brand-card rounded-2xl border border-brand-divider shadow-sm hover:shadow-md hover:border-brand-text/10 transition-all duration-200"
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-text/10 to-fuchsia-50 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-5 h-5 text-brand-text/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-brand-text line-clamp-2">{msg.content}</p>
                    </div>
                    <Link
                        href="/messenger"
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-bold text-brand-text border border-brand-text/30 rounded-lg hover:bg-brand-text/5 transition-colors whitespace-nowrap"
                    >
                        View Conversation
                    </Link>
                </div>
            ))}
        </div>
    )
}

// ─── Multi-entity tab content ────────────────────────────────────────────────
//
// Renders one bucket of the multi-entity ranked search response.
// Supports per-entity "Show more" via the cursor returned by the
// backend, and fires search-click analytics on every result tap.

interface MultiEntityTabContentProps {
    query: string
    entity: EntityType
    bucket: { items: any[]; next_cursor: string | null } | undefined
    isLoading: boolean
    isFetching: boolean
    isFetchingMore: boolean
    onFetchMore: () => void
    onResultClick: (entity_type: EntityType, entity_id: string, position: number) => void
}

function MultiEntityTabContent({
    query,
    entity,
    bucket,
    isLoading,
    isFetching,
    isFetchingMore,
    onFetchMore,
    onResultClick,
}: MultiEntityTabContentProps) {
    if (query.length < 2) return <HintState />
    if ((isLoading || isFetching) && !bucket) return <LoadingSkeleton />
    const items = bucket?.items ?? []
    if (items.length === 0) return <EmptyState query={query} />

    const cursor = bucket?.next_cursor ?? null

    return (
        <div className="space-y-3">
            <SectionHeading
                icon={ENTITY_ICONS[entity]}
                label={ENTITY_LABELS[entity]}
                count={items.length}
            />
            <div className="space-y-3">
                {items.map((item, idx) => (
                    <EntityResultRow
                        key={entityKey(entity, item)}
                        entity={entity}
                        item={item}
                        position={idx}
                        onClick={onResultClick}
                    />
                ))}
            </div>
            {cursor && (
                <div className="pt-4 flex justify-center">
                    <button
                        onClick={onFetchMore}
                        disabled={isFetchingMore}
                        className="px-5 py-2.5 text-sm font-bold rounded-xl border border-brand-divider bg-brand-card hover:bg-brand-text/5 text-brand-text transition-all disabled:opacity-60 flex items-center gap-2"
                    >
                        {isFetchingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isFetchingMore ? "Loading…" : "Show more"}
                    </button>
                </div>
            )}
        </div>
    )
}

const ENTITY_ICONS: Record<EntityType, React.ReactNode> = {
    posts: <FileText className="w-4 h-4" />,
    users: <Users className="w-4 h-4" />,
    hashtags: <Hash className="w-4 h-4" />,
    products: <ShoppingBag className="w-4 h-4" />,
    communities: <Globe className="w-4 h-4" />,
    channels: <Radio className="w-4 h-4" />,
}

const ENTITY_LABELS: Record<EntityType, string> = {
    posts: "Posts",
    users: "People",
    hashtags: "Hashtags",
    products: "Products",
    communities: "Communities",
    channels: "Channels",
}

function entityKey(entity: EntityType, item: any): string {
    switch (entity) {
        case "posts": return (item as PostHit).post_id
        case "users": return (item as UserHit).user_id
        case "hashtags": return (item as HashtagHit).hashtag
        case "products": return (item as ProductHit).product_id
        case "communities": return (item as CommunityHit).community_id
        case "channels": return (item as ChannelHit).channel_id
    }
}

interface EntityResultRowProps {
    entity: EntityType
    item: any
    position: number
    onClick: (entity_type: EntityType, entity_id: string, position: number) => void
}

function EntityResultRow({ entity, item, position, onClick }: EntityResultRowProps) {
    switch (entity) {
        case "users": {
            const u = item as UserHit
            return (
                <Link
                    href={`/u/${u.username}`}
                    onClick={() => onClick("users", u.user_id, position)}
                    className="flex items-center gap-4 p-4 bg-brand-card rounded-2xl border border-brand-divider shadow-sm hover:shadow-md hover:border-brand-text/10 transition-all duration-200 group"
                >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-text/50 to-fuchsia-400 flex-shrink-0 flex items-center justify-center text-white font-bold">
                        {(u.display_name || u.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[15px] font-bold text-brand-text truncate">{u.display_name}</span>
                            {u.is_verified && <CheckCircle className="w-4 h-4 text-blue-500 fill-current" />}
                        </div>
                        <p className="text-sm text-brand-text/40 truncate">@{u.username}</p>
                        {u.bio && <p className="text-sm text-brand-text/60 mt-0.5 line-clamp-1">{u.bio}</p>}
                    </div>
                </Link>
            )
        }
        case "posts": {
            const p = item as PostHit
            return (
                <Link
                    href={`/post/${p.post_id}`}
                    onClick={() => onClick("posts", p.post_id, position)}
                    className="block p-4 bg-brand-card rounded-2xl border border-brand-divider shadow-sm hover:shadow-md hover:border-brand-text/10 transition-all"
                >
                    <p className="text-sm text-brand-text line-clamp-3">{p.text}</p>
                    <div className="flex gap-4 mt-2 text-xs text-brand-text/40 font-semibold">
                        <span>{p.like_count} likes</span>
                        <span>{p.comment_count} comments</span>
                        {p.author_username && <span>by @{p.author_username}</span>}
                    </div>
                </Link>
            )
        }
        case "hashtags": {
            const h = item as HashtagHit
            return (
                <Link
                    href={`/hashtag/${encodeURIComponent(h.hashtag)}`}
                    onClick={() => onClick("hashtags", h.hashtag, position)}
                    className="flex items-center gap-4 p-4 bg-brand-card rounded-2xl border border-brand-divider shadow-sm hover:shadow-md hover:border-brand-text/10 transition-all"
                >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-text/10 to-fuchsia-50 flex items-center justify-center flex-shrink-0">
                        <Hash className="w-6 h-6 text-brand-text/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-brand-text truncate">#{h.hashtag}</p>
                        <p className="text-xs text-brand-text/40">{h.use_count.toLocaleString()} posts</p>
                    </div>
                </Link>
            )
        }
        case "products": {
            const p = item as ProductHit
            return (
                <Link
                    href={`/commerce?product=${p.product_id}`}
                    onClick={() => onClick("products", p.product_id, position)}
                    className="flex items-start gap-4 p-4 bg-brand-card rounded-2xl border border-brand-divider shadow-sm hover:shadow-md hover:border-brand-text/10 transition-all"
                >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-text/10 to-fuchsia-50 flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-6 h-6 text-brand-text/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-brand-text truncate">{p.title}</p>
                        {p.description && (
                            <p className="text-sm text-brand-text/60 mt-0.5 line-clamp-2">{p.description}</p>
                        )}
                        {typeof p.price === "number" && p.price > 0 && (
                            <p className="text-sm font-bold text-brand-text mt-1.5">
                                {p.price.toLocaleString()}
                            </p>
                        )}
                    </div>
                </Link>
            )
        }
        case "communities": {
            const c = item as CommunityHit
            return (
                <Link
                    href={`/communities/${c.community_id}`}
                    onClick={() => onClick("communities", c.community_id, position)}
                    className="flex items-center gap-4 p-4 bg-brand-card rounded-2xl border border-brand-divider shadow-sm hover:shadow-md hover:border-brand-text/10 transition-all"
                >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-text/10 to-fuchsia-50 flex items-center justify-center flex-shrink-0">
                        <Globe className="w-6 h-6 text-brand-text/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[15px] font-bold text-brand-text truncate">{c.name}</span>
                            {c.is_verified && <CheckCircle className="w-4 h-4 text-blue-500 fill-current" />}
                        </div>
                        <p className="text-sm text-brand-text/40 truncate">@{c.handle} · {c.member_count.toLocaleString()} members</p>
                        {c.description && <p className="text-sm text-brand-text/60 mt-0.5 line-clamp-1">{c.description}</p>}
                    </div>
                </Link>
            )
        }
        case "channels": {
            const ch = item as ChannelHit
            return (
                <Link
                    href={`/channels/${ch.channel_id}`}
                    onClick={() => onClick("channels", ch.channel_id, position)}
                    className="flex items-center gap-4 p-4 bg-brand-card rounded-2xl border border-brand-divider shadow-sm hover:shadow-md hover:border-brand-text/10 transition-all"
                >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-text/10 to-fuchsia-50 flex items-center justify-center flex-shrink-0">
                        <Radio className="w-6 h-6 text-brand-text/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[15px] font-bold text-brand-text truncate">{ch.name}</span>
                            {ch.is_verified && <CheckCircle className="w-4 h-4 text-blue-500 fill-current" />}
                        </div>
                        <p className="text-sm text-brand-text/40 truncate">@{ch.handle} · {ch.subscriber_count.toLocaleString()} subscribers</p>
                        {ch.description && <p className="text-sm text-brand-text/60 mt-0.5 line-clamp-1">{ch.description}</p>}
                    </div>
                </Link>
            )
        }
    }
}

// ─── Main page ────────────────────────────────────────────────────────────────

function SearchPageContent() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const searchParams = useSearchParams()
    const initialQuery = searchParams.get("q") ?? ""
    const initialType = (searchParams.get("type") as ExtendedSearchType) ?? "all"

    const [inputValue, setInputValue] = useState(initialQuery)
    const [activeType, setActiveType] = useState<ExtendedSearchType>(initialType)
    const [showDropdown, setShowDropdown] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const saveSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Sync URL when query or type changes (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            const params = new URLSearchParams()
            if (inputValue) params.set("q", inputValue)
            if (activeType !== "all") params.set("type", activeType)
            const qs = params.toString()
            router.replace(`/search${qs ? `?${qs}` : ""}`, { scroll: false })
        }, 300)
        return () => clearTimeout(timer)
    }, [inputValue, activeType, router])

    // Auto-save search when query is long enough (debounced, fire-and-forget)
    useEffect(() => {
        if (saveSearchTimerRef.current) clearTimeout(saveSearchTimerRef.current)
        if (inputValue.length >= 3) {
            saveSearchTimerRef.current = setTimeout(() => {
                api.post("/v1/search/saved", { query: inputValue, search_type: activeType }).catch(() => {
                    // fire-and-forget — ignore errors
                })
            }, 1500)
        }
        return () => {
            if (saveSearchTimerRef.current) clearTimeout(saveSearchTimerRef.current)
        }
    }, [inputValue, activeType])

    // Cleanup blur timer on unmount
    useEffect(() => {
        return () => {
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
        }
    }, [])

    // Only pass core SearchType values to the universal search hook
    const coreSearchType: SearchType =
        (["all", "profiles", "posts"].includes(activeType as string)
            ? activeType
            : "all") as SearchType

    const { data, isLoading, isFetching } = useUniversalSearch(
        inputValue,
        coreSearchType,
    )
    const { data: autocompleteResults } = useAutocomplete(inputValue)

    // Multi-entity ranked search — drives the dedicated entity tabs
    // (Hashtags, Communities, Channels, Products) plus per-bucket
    // "Show more" pagination. We deliberately keep the legacy
    // `useUniversalSearch` powering the "All" tab so the existing
    // PostCard rendering keeps working unchanged; the dedicated tabs
    // below pull from the multi-entity buckets instead.
    const isMultiEntityTab = MULTI_ENTITY_TYPES.includes(activeType)
    const requestedEntity = toEntityType(activeType)
    const multiTypes = useMemo<EntityType[]>(
        () => (requestedEntity ? [requestedEntity] : []),
        [requestedEntity],
    )
    const {
        data: multiData,
        isLoading: multiLoading,
        isFetching: multiFetching,
        queryId,
        fetchMore,
        fetchingMore,
    } = useMultiEntitySearch({
        q: inputValue,
        types: multiTypes,
        enabled: isMultiEntityTab && requestedEntity !== null,
    })

    const recordClick = useRecordSearchClick()
    const handleResultClick = useCallback(
        (entity_type: EntityType, entity_id: string, position: number) => {
            if (!queryId) return
            recordClick.mutate({ query_id: queryId, entity_type, entity_id, position })
        },
        [queryId, recordClick],
    )

    const profiles = data?.profiles ?? []
    const posts = data?.posts ?? []
    const hasResults = profiles.length > 0 || posts.length > 0
    const queryTooShort = inputValue.length < 2
    // Legacy non-multi-entity tabs that still hit dedicated endpoints.
    const isLegacyExtendedTab = ["events", "messages"].includes(activeType as string)

    // Communities feature disabled — drop community hits from autocomplete.
    const visibleAutocomplete = (autocompleteResults ?? []).filter((i) => i.kind !== "community")
    const hasAutocomplete = showDropdown && inputValue.length >= 1 && visibleAutocomplete.length > 0

    const handleTabChange = (type: ExtendedSearchType) => {
        setActiveType(type)
    }

    const handleClear = () => {
        setInputValue("")
        setShowDropdown(false)
        inputRef.current?.focus()
    }

    const handleInputFocus = () => {
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
        setShowDropdown(true)
    }

    const handleInputBlur = () => {
        blurTimerRef.current = setTimeout(() => {
            setShowDropdown(false)
        }, 150)
    }

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            setShowDropdown(false)
            inputRef.current?.blur()
        }
    }

    // Multi-entity autocomplete dispatch — users → /u/:username,
    // hashtags → /hashtag/:tag, communities → /communities/:id.
    const handleAutocompleteSelect = useCallback(
        (item: { kind: string; username?: string; hashtag?: string; community_id?: string }) => {
            setShowDropdown(false)
            if (item.kind === "user" && item.username) {
                router.push(`/u/${item.username}`)
            } else if (item.kind === "hashtag" && item.hashtag) {
                router.push(`/hashtag/${encodeURIComponent(item.hashtag)}`)
            } else if (item.kind === "community" && item.community_id) {
                router.push(`/communities/${item.community_id}`)
            }
        },
        [router],
    )

    const handleSelectQuery = useCallback((q: string) => {
        setInputValue(q)
        inputRef.current?.focus()
        queryClient.invalidateQueries({ queryKey: ["search", "history"] })
    }, [queryClient])

    return (
        <div className="min-h-screen bg-brand-bg">
            {/* Sticky header with search input and tabs */}
            <div className="sticky top-0 z-20 bg-brand-card/90 backdrop-blur-xl border-b border-brand-divider shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="max-w-2xl mx-auto px-4 pt-4 pb-0">
                    {/* Search input with autocomplete dropdown */}
                    <div className="relative flex items-center mb-4">
                        <div className="absolute left-4 text-brand-text/40 pointer-events-none z-10">
                            {isLoading || isFetching ? (
                                <Loader2 className="w-5 h-5 animate-spin text-brand-text/50" />
                            ) : (
                                <Search className="w-5 h-5" />
                            )}
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value)
                                setShowDropdown(true)
                            }}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                            onKeyDown={handleInputKeyDown}
                            placeholder="Search people, posts, hashtags..."
                            autoFocus
                            className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-brand-secondary border border-brand-divider text-[15px] text-brand-text placeholder-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-brand-text/30 focus:border-brand-text/30 focus:bg-brand-card transition-all"
                        />
                        {inputValue && (
                            <button
                                onClick={handleClear}
                                className="absolute right-4 text-brand-text/40 hover:text-brand-text transition-colors z-10"
                                aria-label="Clear search"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}

                        {/* Autocomplete dropdown — multi-entity (users / hashtags / communities) */}
                        {hasAutocomplete && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-brand-card shadow-lg rounded-lg max-h-72 overflow-y-auto z-50 border border-brand-divider">
                                {visibleAutocomplete.map((item, idx) => {
                                    const key =
                                        item.kind === "user"
                                            ? `user-${item.user_id ?? idx}`
                                            : item.kind === "hashtag"
                                                ? `tag-${item.hashtag ?? idx}`
                                                : `comm-${item.community_id ?? idx}`
                                    const label =
                                        item.kind === "user"
                                            ? item.display_name ?? item.username ?? ""
                                            : item.kind === "hashtag"
                                                ? `#${item.hashtag ?? ""}`
                                                : item.name ?? item.handle ?? ""
                                    const sub =
                                        item.kind === "user"
                                            ? `@${item.username ?? ""}`
                                            : item.kind === "hashtag"
                                                ? "Hashtag"
                                                : `@${item.handle ?? ""}`
                                    const initial = (label || "?").charAt(0).toUpperCase()
                                    const kindBadge =
                                        item.kind === "user"
                                            ? "Person"
                                            : item.kind === "hashtag"
                                                ? "Tag"
                                                : "Community"
                                    return (
                                        <button
                                            key={key}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleAutocompleteSelect(item)}
                                            className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-brand-text/5 transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-text/50 to-fuchsia-400 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold select-none">
                                                {item.kind === "hashtag" ? "#" : initial}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-brand-text truncate">{label}</p>
                                                <p className="text-xs text-brand-text/40 truncate">{sub}</p>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text/40 px-2 py-0.5 rounded-full border border-brand-divider">
                                                {kindBadge}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Tab bar */}
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                        {TABS.map((tab) => {
                            const isActive = activeType === tab.type
                            return (
                                <button
                                    key={tab.type}
                                    onClick={() => handleTabChange(tab.type)}
                                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-xl border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                                        isActive
                                            ? "border-brand-text/50 text-brand-text bg-brand-text/60"
                                            : "border-transparent text-brand-text/60 hover:text-brand-text hover:bg-brand-secondary"
                                    }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Results area */}
            <main className="max-w-2xl mx-auto px-4 py-6">
                {/* Empty query — show history & saved panel */}
                {inputValue.length === 0 && (
                    <HistoryAndSavedPanel onSelectQuery={handleSelectQuery} />
                )}

                {/* Legacy tabs that still hit dedicated endpoints */}
                {inputValue.length > 0 && activeType === "events" && (
                    <EventsTab query={inputValue} />
                )}
                {inputValue.length > 0 && activeType === "messages" && (
                    <MessagesTab query={inputValue} />
                )}

                {/* Multi-entity ranked tabs — one tab per entity bucket. */}
                {inputValue.length > 0 && isMultiEntityTab && requestedEntity && (
                    <MultiEntityTabContent
                        query={inputValue}
                        entity={requestedEntity}
                        bucket={multiData?.results?.[requestedEntity] as any}
                        isLoading={multiLoading}
                        isFetching={multiFetching}
                        isFetchingMore={!!fetchingMore[requestedEntity]}
                        onFetchMore={() => fetchMore(requestedEntity)}
                        onResultClick={handleResultClick}
                    />
                )}

                {/* Core "All" tab — legacy universal search keeps the
                    mixed People + Posts layout the existing PostCard
                    component already understands. */}
                {inputValue.length > 0 && !isMultiEntityTab && !isLegacyExtendedTab && (
                    <>
                        {/* Too short hint */}
                        {queryTooShort && <HintState />}

                        {/* Loading */}
                        {!queryTooShort && (isLoading || isFetching) && !data && <LoadingSkeleton />}

                        {/* Empty state */}
                        {!queryTooShort && !isLoading && !isFetching && !hasResults && data && (
                            <EmptyState query={inputValue} />
                        )}

                        {/* Results */}
                        {!queryTooShort && hasResults && (
                            <div className="space-y-8">
                                {profiles.length > 0 && (
                                    <section>
                                        <SectionHeading
                                            icon={<Users className="w-4 h-4" />}
                                            label="People"
                                            count={profiles.length}
                                        />
                                        <div className="space-y-3">
                                            {profiles.map((profile) => (
                                                <ProfileCard key={profile.id} profile={profile} />
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {posts.length > 0 && (
                                    <section>
                                        <SectionHeading
                                            icon={<FileText className="w-4 h-4" />}
                                            label="Posts"
                                            count={posts.length}
                                        />
                                        <div className="space-y-4">
                                            {posts.map((post: PostDetail) => (
                                                <PostCard key={post.id} post={post} />
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    )
}

function SearchPageFallback() {
    return (
        <div className="min-h-screen bg-brand-bg flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-text/50" />
        </div>
    )
}

export default function SearchPage() {
    return (
        <Suspense fallback={<SearchPageFallback />}>
            <SearchPageContent />
        </Suspense>
    )
}

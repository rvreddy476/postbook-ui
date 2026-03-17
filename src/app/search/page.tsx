"use client"

import React, { Suspense, useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
    Search, X, Loader2, Users, FileText, LayoutGrid, CheckCircle,
    ShoppingBag, Calendar, MessageSquare, Clock, Bookmark, Trash2,
} from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useUniversalSearch, useAutocomplete, SearchType } from "@/hooks/useSearch"
import type { PostDetail } from "@/types/profile"
import PostCard from "@/components/PostCard"
import api from "@/lib/api"

// ─── Extended tab types ───────────────────────────────────────────────────────

type ExtendedSearchType = SearchType | "products" | "events" | "messages"

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
            className="flex items-center gap-4 p-4 bg-brand-card rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#D8103F]/10 transition-all duration-200 group"
        >
            <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-gray-100 group-hover:ring-[#D8103F]/20 transition-all">
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
                    <span className="text-[15px] font-bold text-gray-900 group-hover:text-[#b80d35] transition-colors truncate">
                        {profile.display_name}
                    </span>
                </div>
                <p className="text-sm text-gray-400 truncate">@{profile.username}</p>
                {bioSnippet && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{bioSnippet}</p>
                )}
                <p className="text-xs text-gray-400 mt-1 font-medium">
                    {profile.follower_count.toLocaleString()} follower{profile.follower_count !== 1 ? "s" : ""}
                </p>
            </div>
            <div className="flex-shrink-0 text-gray-300 group-hover:text-[#D8103F]/50 transition-colors">
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
            <span className="text-[#D8103F]/50">{icon}</span>
            <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">{label}</h2>
            {count !== undefined && (
                <span className="ml-auto text-xs font-semibold text-gray-400">{count} result{count !== 1 ? "s" : ""}</span>
            )}
        </div>
    )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#D8103F]/5 to-fuchsia-50 border border-[#D8103F]/10 flex items-center justify-center">
                <Search className="w-9 h-9 text-[#D8103F]/30" />
            </div>
            <div className="text-center max-w-xs">
                <p className="text-base font-bold text-gray-900">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
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
                <div key={i} className="flex items-center gap-4 p-4 bg-brand-card rounded-2xl border border-gray-100">
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-100 rounded-lg w-1/3" />
                        <div className="h-3 bg-gray-100 rounded-lg w-1/4" />
                        <div className="h-3 bg-gray-100 rounded-lg w-2/3" />
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
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D8103F]/50 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-[#D8103F]/20">
                <Search className="w-7 h-7 text-white" />
            </div>
            <div className="text-center">
                <p className="text-sm font-bold text-gray-700">Search PostBook</p>
                <p className="text-xs text-gray-400 mt-1">Type at least 2 characters to begin</p>
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
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D8103F]/50 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-[#D8103F]/20">
                    <Search className="w-7 h-7 text-white" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-bold text-gray-700">Search PostBook</p>
                    <p className="text-xs text-gray-400 mt-1">Your recent and saved searches will appear here</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {recentItems.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-[#D8103F]/50" />
                        <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Recent Searches</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {recentItems.map((item, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-1.5 bg-gray-100 hover:bg-[#D8103F]/5 border border-gray-200 hover:border-[#D8103F]/20 rounded-full px-3 py-1.5 transition-all group"
                            >
                                <button
                                    onClick={() => onSelectQuery(item.query)}
                                    className="text-sm font-medium text-gray-700 group-hover:text-[#b80d35]"
                                >
                                    {item.query}
                                </button>
                                <button
                                    onClick={() => deleteHistory.mutate(item.query)}
                                    className="text-gray-400 hover:text-red-500 transition-colors ml-0.5"
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
                        <Bookmark className="w-4 h-4 text-[#D8103F]/50" />
                        <h2 className="text-sm font-black text-gray-700 uppercase tracking-wider">Saved Searches</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {savedItems.map((item, i) => (
                            <div
                                key={item.id ?? i}
                                className="flex items-center gap-1.5 bg-[#D8103F]/5 hover:bg-[#D8103F]/10 border border-[#D8103F]/15 hover:border-[#D8103F]/30 rounded-full px-3 py-1.5 transition-all group"
                            >
                                <button
                                    onClick={() => onSelectQuery(item.query)}
                                    className="text-sm font-medium text-[#b80d35]"
                                >
                                    {item.query}
                                </button>
                                {item.id && (
                                    <button
                                        onClick={() => deleteSaved.mutate(item.id!)}
                                        className="text-[#D8103F]/40 hover:text-red-600 transition-colors ml-0.5"
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
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#D8103F]/5 to-fuchsia-50 border border-[#D8103F]/10 flex items-center justify-center">
                    <ShoppingBag className="w-9 h-9 text-[#D8103F]/30" />
                </div>
                <p className="text-base font-bold text-gray-900">No products found for &ldquo;{query}&rdquo;</p>
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
                    className="flex items-start gap-4 p-4 bg-brand-card rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#D8103F]/10 transition-all duration-200"
                >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D8103F]/10 to-fuchsia-50 flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-6 h-6 text-[#D8103F]/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-gray-900 truncate">{product.name}</p>
                        {product.description && (
                            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{product.description}</p>
                        )}
                        <p className="text-sm font-bold text-[#D8103F] mt-1.5">
                            {currencySymbol(product.currency)}{product.price.toLocaleString()}
                        </p>
                    </div>
                    {product.url && (
                        <Link
                            href={product.url}
                            className="flex-shrink-0 px-3 py-1.5 text-sm font-bold text-white bg-[#D8103F] rounded-lg hover:bg-[#b80d35] transition-colors"
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
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#D8103F]/5 to-fuchsia-50 border border-[#D8103F]/10 flex items-center justify-center">
                    <Calendar className="w-9 h-9 text-[#D8103F]/30" />
                </div>
                <p className="text-base font-bold text-gray-900">No events found for &ldquo;{query}&rdquo;</p>
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
                    className="flex items-start gap-4 p-4 bg-brand-card rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#D8103F]/10 transition-all duration-200"
                >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D8103F]/10 to-fuchsia-50 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-6 h-6 text-[#D8103F]/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-gray-900 truncate">{event.title}</p>
                        {event.description && (
                            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{event.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-[#D8103F]">{formatDate(event.date)}</span>
                            {event.location && (
                                <span className="text-xs text-gray-400">{event.location}</span>
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
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#D8103F]/5 to-fuchsia-50 border border-[#D8103F]/10 flex items-center justify-center">
                    <MessageSquare className="w-9 h-9 text-[#D8103F]/30" />
                </div>
                <p className="text-base font-bold text-gray-900">No messages found for &ldquo;{query}&rdquo;</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <SectionHeading icon={<MessageSquare className="w-4 h-4" />} label="Messages" count={items.length} />
            {items.map((msg) => (
                <div
                    key={msg.id}
                    className="flex items-start gap-4 p-4 bg-brand-card rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#D8103F]/10 transition-all duration-200"
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D8103F]/10 to-fuchsia-50 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-5 h-5 text-[#D8103F]/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 line-clamp-2">{msg.content}</p>
                    </div>
                    <Link
                        href="/messenger"
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-bold text-[#D8103F] border border-[#D8103F]/30 rounded-lg hover:bg-[#D8103F]/5 transition-colors whitespace-nowrap"
                    >
                        View Conversation
                    </Link>
                </div>
            ))}
        </div>
    )
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

    const profiles = data?.profiles ?? []
    const posts = data?.posts ?? []
    const hasResults = profiles.length > 0 || posts.length > 0
    const queryTooShort = inputValue.length < 2
    const isExtendedTab = ["products", "events", "messages"].includes(activeType as string)

    const hasAutocomplete = showDropdown && inputValue.length >= 1 && (autocompleteResults?.length ?? 0) > 0

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

    const handleAutocompleteClick = useCallback((username: string) => {
        setShowDropdown(false)
        router.push(`/u/${username}`)
    }, [router])

    const handleSelectQuery = useCallback((q: string) => {
        setInputValue(q)
        inputRef.current?.focus()
        queryClient.invalidateQueries({ queryKey: ["search", "history"] })
    }, [queryClient])

    return (
        <div className="min-h-screen bg-brand-bg">
            {/* Sticky header with search input and tabs */}
            <div className="sticky top-0 z-20 bg-brand-card/90 backdrop-blur-xl border-b border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="max-w-2xl mx-auto px-4 pt-4 pb-0">
                    {/* Search input with autocomplete dropdown */}
                    <div className="relative flex items-center mb-4">
                        <div className="absolute left-4 text-gray-400 pointer-events-none z-10">
                            {isLoading || isFetching ? (
                                <Loader2 className="w-5 h-5 animate-spin text-[#D8103F]/50" />
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
                            className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-[15px] text-gray-900 placeholder-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-[#D8103F]/30 focus:border-[#D8103F]/30 focus:bg-brand-card transition-all"
                        />
                        {inputValue && (
                            <button
                                onClick={handleClear}
                                className="absolute right-4 text-gray-400 hover:text-gray-700 transition-colors z-10"
                                aria-label="Clear search"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}

                        {/* Autocomplete dropdown */}
                        {hasAutocomplete && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-brand-card shadow-lg rounded-lg max-h-60 overflow-y-auto z-50 border border-gray-100">
                                {autocompleteResults!.map((user) => (
                                    <button
                                        key={user.user_id}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handleAutocompleteClick(user.username)}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-[#D8103F]/5 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D8103F]/50 to-fuchsia-400 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold select-none">
                                            {(user.display_name || user.username).charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{user.display_name}</p>
                                            <p className="text-xs text-gray-400 truncate">@{user.username}</p>
                                        </div>
                                    </button>
                                ))}
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
                                            ? "border-[#D8103F]/50 text-[#D8103F] bg-[#D8103F]/60"
                                            : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
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

                {/* Extended tabs (products / events / messages) */}
                {inputValue.length > 0 && activeType === "products" && (
                    <ProductsTab query={inputValue} />
                )}
                {inputValue.length > 0 && activeType === "events" && (
                    <EventsTab query={inputValue} />
                )}
                {inputValue.length > 0 && activeType === "messages" && (
                    <MessagesTab query={inputValue} />
                )}

                {/* Core tabs (all / profiles / posts) */}
                {inputValue.length > 0 && !isExtendedTab && (
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
                                {/* People section */}
                                {profiles.length > 0 && (activeType === "all" || activeType === "profiles") && (
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

                                {/* Posts section */}
                                {posts.length > 0 && (activeType === "all" || activeType === "posts") && (
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
            <Loader2 className="w-6 h-6 animate-spin text-[#D8103F]/50" />
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

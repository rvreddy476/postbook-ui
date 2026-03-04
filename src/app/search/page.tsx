"use client"

import React, { Suspense, useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Search, X, Loader2, Users, FileText, LayoutGrid, CheckCircle } from "lucide-react"
import { useUniversalSearch, useAutocomplete, SearchType } from "@/hooks/useSearch"
import type { PostDetail } from "@/types/profile"
import PostCard from "@/components/PostCard"

// ─── Tab configuration ──────────────────────────────────────────────────────

interface Tab {
    label: string
    type: SearchType
    icon: React.ReactNode
}

const TABS: Tab[] = [
    { label: "All", type: "all", icon: <LayoutGrid className="w-4 h-4" /> },
    { label: "People", type: "profiles", icon: <Users className="w-4 h-4" /> },
    { label: "Posts", type: "posts", icon: <FileText className="w-4 h-4" /> },
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
            className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-violet-100 transition-all duration-200 group"
        >
            <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-gray-100 group-hover:ring-violet-200 transition-all">
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
                    <span className="text-[15px] font-bold text-gray-900 group-hover:text-violet-700 transition-colors truncate">
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
            <div className="flex-shrink-0 text-gray-300 group-hover:text-violet-400 transition-colors">
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
            <span className="text-violet-500">{icon}</span>
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
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-100 flex items-center justify-center">
                <Search className="w-9 h-9 text-violet-300" />
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
                <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100">
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
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Search className="w-7 h-7 text-white" />
            </div>
            <div className="text-center">
                <p className="text-sm font-bold text-gray-700">Search PostBook</p>
                <p className="text-xs text-gray-400 mt-1">Type at least 2 characters to begin</p>
            </div>
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function SearchPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const initialQuery = searchParams.get("q") ?? ""
    const initialType = (searchParams.get("type") as SearchType) ?? "all"

    const [inputValue, setInputValue] = useState(initialQuery)
    const [activeType, setActiveType] = useState<SearchType>(initialType)
    const [showDropdown, setShowDropdown] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

    // Cleanup blur timer on unmount
    useEffect(() => {
        return () => {
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
        }
    }, [])

    const { data, isLoading, isFetching } = useUniversalSearch(inputValue, activeType)
    const { data: autocompleteResults } = useAutocomplete(inputValue)

    const profiles = data?.profiles ?? []
    const posts = data?.posts ?? []
    const hasResults = profiles.length > 0 || posts.length > 0
    const queryTooShort = inputValue.length < 2

    const hasAutocomplete = showDropdown && inputValue.length >= 1 && (autocompleteResults?.length ?? 0) > 0

    const handleTabChange = (type: SearchType) => {
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

    return (
        <div className="min-h-screen bg-[#fcfaff]">
            {/* Sticky header with search input and tabs */}
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="max-w-2xl mx-auto px-4 pt-4 pb-0">
                    {/* Search input with autocomplete dropdown */}
                    <div className="relative flex items-center mb-4">
                        <div className="absolute left-4 text-gray-400 pointer-events-none z-10">
                            {isLoading || isFetching ? (
                                <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
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
                            className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-[15px] text-gray-900 placeholder-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 focus:bg-white transition-all"
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
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white shadow-lg rounded-lg max-h-60 overflow-y-auto z-50 border border-gray-100">
                                {autocompleteResults!.map((user) => (
                                    <button
                                        key={user.user_id}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handleAutocompleteClick(user.username)}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-violet-50 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold select-none">
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
                    <div className="flex gap-1">
                        {TABS.map((tab) => {
                            const isActive = activeType === tab.type
                            return (
                                <button
                                    key={tab.type}
                                    onClick={() => handleTabChange(tab.type)}
                                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-t-xl border-b-2 transition-all ${
                                        isActive
                                            ? "border-violet-500 text-violet-600 bg-violet-50/60"
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
            </main>
        </div>
    )
}

function SearchPageFallback() {
    return (
        <div className="min-h-screen bg-[#fcfaff] flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
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

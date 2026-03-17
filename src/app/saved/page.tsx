"use client"

import React, { useState, useCallback } from "react"
import { useSavedItems, useCollections, useUnsaveItem } from "@/hooks/useSavedItems"
import type { SavedItem, SavedCollection } from "@/types/profile"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return `${Math.floor(days / 7)}w ago`
}

function targetTypeIcon(type: string): React.ReactNode {
    switch (type.toLowerCase()) {
        case "post":
            return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            )
        case "video":
            return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
            )
        case "short":
            return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
            )
        case "photo":
            return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            )
        default:
            return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
            )
    }
}

function targetTypeBadgeColor(type: string): string {
    switch (type.toLowerCase()) {
        case "post":    return "bg-[#D8103F]/5 text-[#D8103F] border-[#D8103F]/10"
        case "video":   return "bg-indigo-50 text-indigo-600 border-indigo-100"
        case "short":   return "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100"
        case "photo":   return "bg-rose-50 text-rose-600 border-rose-100"
        default:        return "bg-brand-secondary text-brand-highlight border-brand-divider"
    }
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SavedItemSkeleton() {
    return (
        <div className="bg-brand-card rounded-2xl border border-brand-divider p-5 shadow-sm animate-pulse">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0" />
                <div className="flex-1 space-y-2.5 min-w-0">
                    <div className="h-3 bg-slate-100 rounded-full w-1/3" />
                    <div className="h-3 bg-slate-100 rounded-full w-1/2" />
                    <div className="h-2.5 bg-slate-100 rounded-full w-1/4" />
                </div>
                <div className="w-16 h-8 bg-slate-100 rounded-xl flex-shrink-0" />
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Saved item card
// ---------------------------------------------------------------------------

interface SavedItemCardProps {
    item: SavedItem
    onUnsave: (id: string) => void
    isPending: boolean
}

function SavedItemCard({ item, onUnsave, isPending }: SavedItemCardProps) {
    const badgeColor = targetTypeBadgeColor(item.target_type)

    return (
        <div className="group bg-brand-card rounded-2xl border border-brand-divider p-5 shadow-sm hover:shadow-md hover:border-[#D8103F]/10 transition-all duration-300">
            <div className="flex items-start gap-4">
                {/* Type icon */}
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${badgeColor}`}>
                    {targetTypeIcon(item.target_type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Type + Collection row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${badgeColor}`}>
                            {item.target_type}
                        </span>
                        {item.collection_name && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100">
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                {item.collection_name}
                            </span>
                        )}
                    </div>

                    {/* Target ID */}
                    <p className="text-[11px] font-bold text-slate-700 truncate">
                        <span className="text-brand-text/60 font-medium">ID: </span>
                        <span className="font-mono">{item.target_id}</span>
                    </p>

                    {/* Timestamp */}
                    <p className="text-[9px] font-bold text-brand-text/60 uppercase tracking-widest">
                        Saved {formatTimeAgo(item.created_at)}
                    </p>
                </div>

                {/* Unsave button */}
                <button
                    onClick={() => onUnsave(item.id)}
                    disabled={isPending}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-brand-divider text-brand-highlight bg-brand-card hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove from saved"
                >
                    {isPending ? (
                        <div className="w-3 h-3 border-2 border-rose-300 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                    )}
                    Unsave
                </button>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Collection tab bar
// ---------------------------------------------------------------------------

interface CollectionTabBarProps {
    collections: SavedCollection[]
    activeCollection: string | undefined
    onSelect: (name: string | undefined) => void
    isLoading: boolean
}

function CollectionTabBar({ collections, activeCollection, onSelect, isLoading }: CollectionTabBarProps) {
    const allCount = collections.reduce((sum, c) => sum + c.count, 0)

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                {[80, 100, 90, 110].map((w, i) => (
                    <div key={i} className={`h-9 rounded-xl bg-slate-100 animate-pulse flex-shrink-0`} style={{ width: w }} />
                ))}
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
            {/* All tab */}
            <button
                onClick={() => onSelect(undefined)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 transition-all duration-200 border ${
                    activeCollection === undefined
                        ? "bg-brand-card text-[#D8103F] border-[#D8103F]/20 shadow-sm shadow-[#D8103F]/10"
                        : "bg-brand-secondary text-brand-highlight border-transparent hover:bg-brand-card hover:text-slate-700 hover:border-brand-divider"
                }`}
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                All
                {allCount > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[8px] font-black ${
                        activeCollection === undefined ? "bg-[#D8103F]/10 text-[#D8103F]" : "bg-slate-200 text-brand-highlight"
                    }`}>
                        {allCount}
                    </span>
                )}
            </button>

            {/* Per-collection tabs */}
            {collections.map((col) => (
                <button
                    key={col.name}
                    onClick={() => onSelect(col.name)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 transition-all duration-200 border ${
                        activeCollection === col.name
                            ? "bg-brand-card text-[#D8103F] border-[#D8103F]/20 shadow-sm shadow-[#D8103F]/10"
                            : "bg-brand-secondary text-brand-highlight border-transparent hover:bg-brand-card hover:text-slate-700 hover:border-brand-divider"
                    }`}
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    {col.name}
                    {col.count > 0 && (
                        <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[8px] font-black ${
                            activeCollection === col.name ? "bg-[#D8103F]/10 text-[#D8103F]" : "bg-slate-200 text-brand-highlight"
                        }`}>
                            {col.count}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SavedPage() {
    const [activeCollection, setActiveCollection] = useState<string | undefined>(undefined)
    const [pendingUnsaveId, setPendingUnsaveId] = useState<string | null>(null)

    const {
        data: collectionsData,
        isLoading: collectionsLoading,
    } = useCollections()
    const collections: SavedCollection[] = collectionsData ?? []

    const {
        data,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        isError,
    } = useSavedItems(activeCollection)

    const unsaveItem = useUnsaveItem()

    const allItems: SavedItem[] = data?.pages.flatMap((page) => page.data) ?? []

    const handleUnsave = useCallback((id: string) => {
        setPendingUnsaveId(id)
        unsaveItem.mutate(id, {
            onSettled: () => setPendingUnsaveId(null),
        })
    }, [unsaveItem])

    return (
        <div className="min-h-screen bg-brand-bg">
            {/* Page content — no header wrapper needed; parent layout provides global header */}
            <div className="max-w-3xl mx-auto px-4 pt-10 pb-16">

                {/* Page heading */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 orchid-gradient rounded-[0.8rem] flex items-center justify-center shadow-lg shadow-[#D8103F]/20">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-brand-text">Saved</h1>
                    </div>
                    <p className="text-[11px] font-bold text-brand-text/60 uppercase tracking-widest ml-[52px]">
                        Your bookmarked content, organised by collection
                    </p>
                </div>

                {/* Collection tab bar */}
                <div className="mb-6">
                    <CollectionTabBar
                        collections={collections}
                        activeCollection={activeCollection}
                        onSelect={setActiveCollection}
                        isLoading={collectionsLoading}
                    />
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-100 mb-6" />

                {/* Content area */}
                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <SavedItemSkeleton key={i} />
                        ))}
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Something went wrong</p>
                            <p className="text-[10px] font-bold text-brand-text/60 mt-0.5">Failed to load your saved items.</p>
                        </div>
                    </div>
                ) : allItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-16 h-16 rounded-2xl orchid-gradient flex items-center justify-center shadow-lg shadow-[#D8103F]/20 opacity-30">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                                {activeCollection ? `No items in "${activeCollection}"` : "Nothing saved yet"}
                            </p>
                            <p className="text-[10px] font-bold text-brand-text/60 mt-0.5">
                                {activeCollection
                                    ? "Try another collection or save something new."
                                    : "Bookmark posts, videos, and more to find them here."}
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Item count header */}
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[9px] font-black uppercase tracking-widest text-brand-text/60">
                                {allItems.length} item{allItems.length !== 1 ? "s" : ""}
                                {activeCollection ? ` in "${activeCollection}"` : " total"}
                            </p>
                        </div>

                        {/* Saved item list */}
                        <div className="space-y-3">
                            {allItems.map((item) => (
                                <SavedItemCard
                                    key={item.id}
                                    item={item}
                                    onUnsave={handleUnsave}
                                    isPending={pendingUnsaveId === item.id}
                                />
                            ))}
                        </div>

                        {/* Load more */}
                        {hasNextPage && (
                            <div className="mt-8 flex justify-center">
                                <button
                                    onClick={() => fetchNextPage()}
                                    disabled={isFetchingNextPage}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-brand-card border border-brand-divider text-brand-highlight hover:border-[#D8103F]/20 hover:text-[#D8103F] hover:bg-[#D8103F]/5 active:scale-95 transition-all duration-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isFetchingNextPage ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-[#D8103F]/30 border-t-transparent rounded-full animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                            Load more
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* End of list indicator */}
                        {!hasNextPage && allItems.length > 0 && (
                            <div className="mt-10 flex items-center gap-3">
                                <div className="flex-1 h-px bg-slate-100" />
                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-300 flex-shrink-0">
                                    End of saved items
                                </p>
                                <div className="flex-1 h-px bg-slate-100" />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

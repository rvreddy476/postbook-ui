'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useDiscoverPages } from '@/hooks/useBusinessPages'
import { BadgeCheck, Star, MapPin, Search, Users, Plus, Loader2 } from 'lucide-react'

const CATEGORIES = [
    'All',
    'Restaurant',
    'Cafe',
    'Retail',
    'Services',
    'Health',
    'Beauty',
    'Education',
    'Tech',
    'Entertainment',
]

function PageCard({ page }: { page: import('@/types/profile').BusinessPage }) {
    const avatarUrl = page.avatar_media_id ? `/v1/media/${page.avatar_media_id}/serve` : null
    const coverUrl = page.cover_media_id ? `/v1/media/${page.cover_media_id}/serve` : null

    return (
        <Link
            href={`/page/${page.page_handle}`}
            className="group bg-white rounded-2xl border border-[#F0E6DC] overflow-hidden hover:shadow-md transition-all"
        >
            {/* Cover */}
            <div className="h-28 relative overflow-hidden">
                {coverUrl ? (
                    <img src={coverUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#3C2415] via-[#7B5B3A] to-[#D4A574]" />
                )}
            </div>

            {/* Body */}
            <div className="p-3">
                <div className="flex items-start gap-3 -mt-8">
                    <div className="h-14 w-14 rounded-xl bg-white p-1 shadow-md border border-[#F0E6DC] shrink-0">
                        <div className="w-full h-full rounded-lg overflow-hidden bg-[#F0E6DC]">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={page.page_name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-lg font-bold text-[#7B5B3A]">
                                    {page.page_name.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 pt-8 min-w-0">
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-[#3C2415] truncate">{page.page_name}</span>
                            {page.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-[#D4A574] shrink-0" />}
                        </div>
                        <span className="text-xs text-[#7B5B3A]">{page.category}</span>
                    </div>
                </div>

                {page.description && (
                    <p className="text-xs text-[#7B5B3A] mt-2 line-clamp-2">{page.description}</p>
                )}

                <div className="flex items-center justify-between mt-3 text-xs text-[#7B5B3A]">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-[#D4A574] text-[#D4A574]" />
                            {page.avg_rating.toFixed(1)}
                        </span>
                        <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {page.follower_count.toLocaleString()}
                        </span>
                    </div>
                    {page.address && (
                        <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[100px]">{page.address}</span>
                        </span>
                    )}
                </div>
            </div>
        </Link>
    )
}

export default function PagesDiscoveryPage() {
    const [search, setSearch] = useState('')
    const [activeCategory, setActiveCategory] = useState('All')
    const [debouncedSearch, setDebouncedSearch] = React.useState('')

    React.useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400)
        return () => clearTimeout(t)
    }, [search])

    const category = activeCategory === 'All' ? '' : activeCategory

    const { data: pages = [], isLoading } = useDiscoverPages({
        category,
        search: debouncedSearch,
        limit: 30,
    })

    return (
        <div className="min-h-screen bg-[#FAF5F0]">
            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[#3C2415]">Business Pages</h1>
                        <p className="text-sm text-[#7B5B3A] mt-0.5">Discover local businesses</p>
                    </div>
                    <Link
                        href="/pages/create"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#7B5B3A] rounded-xl hover:bg-[#3C2415] transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Create Page
                    </Link>
                </div>

                {/* Sell on AtPost CTA */}
                <Link
                    href="/commerce"
                    className="flex items-center justify-between mb-6 px-5 py-4 bg-[#1A1A1A] rounded-2xl text-white hover:bg-[#3A2E26] transition"
                >
                    <div>
                        <p className="font-bold text-sm">Sell on AtPost</p>
                        <p className="text-xs text-white/60 mt-0.5">Turn your business page into a storefront</p>
                    </div>
                    <span className="text-2xl">🛍️</span>
                </Link>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7B5B3A]" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search businesses..."
                        className="w-full pl-10 pr-4 py-3 text-sm border border-[#F0E6DC] rounded-2xl bg-white text-[#3C2415] placeholder:text-[#7B5B3A]/40 focus:outline-none focus:ring-2 focus:ring-[#D4A574]/50"
                    />
                </div>

                {/* Category pills */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`shrink-0 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                                activeCategory === cat
                                    ? 'bg-[#7B5B3A] text-white'
                                    : 'bg-white border border-[#F0E6DC] text-[#7B5B3A] hover:bg-[#F0E6DC]'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-[#7B5B3A]" />
                    </div>
                ) : pages.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-[#7B5B3A] text-sm">No pages found.</p>
                        <Link href="/pages/create" className="text-[#D4A574] text-sm font-semibold mt-2 inline-block hover:underline">
                            Create the first one
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pages.map((page) => (
                            <PageCard key={page.id} page={page} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

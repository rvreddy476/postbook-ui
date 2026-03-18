'use client'

import React, { useState } from 'react'
import AppShell from '@/components/AppShell'
import {
  useMyCommunities,
  useDiscoverCommunities,
  useNearbyCommunities,
  useSuggestedCommunities,
} from '@/hooks/useCommunities'
import CommunityCard from '@/components/communities/CommunityCard'
import { Search, Plus, Users, Compass, MapPin, Sparkles } from 'lucide-react'
import Link from 'next/link'

type Tab = 'my-communities' | 'discover' | 'nearby' | 'suggested'

const CATEGORIES = [
  { emoji: '💻', label: 'Technology' },
  { emoji: '🎮', label: 'Gaming' },
  { emoji: '🎨', label: 'Art & Design' },
  { emoji: '📚', label: 'Education' },
  { emoji: '🎵', label: 'Music' },
  { emoji: '⚽', label: 'Sports' },
  { emoji: '🍕', label: 'Food' },
  { emoji: '✈️', label: 'Travel' },
  { emoji: '📸', label: 'Photography' },
  { emoji: '💼', label: 'Business' },
  { emoji: '🧘', label: 'Wellness' },
  { emoji: '🎬', label: 'Film & TV' },
]

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'my-communities', label: 'My Communities', icon: <Users className="w-4 h-4" /> },
  { key: 'discover', label: 'Discover', icon: <Compass className="w-4 h-4" /> },
  { key: 'nearby', label: 'Nearby', icon: <MapPin className="w-4 h-4" /> },
  { key: 'suggested', label: 'Suggested', icon: <Sparkles className="w-4 h-4" /> },
]

export default function CommunitiesPage() {
  const [tab, setTab] = useState<Tab>('my-communities')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const { data: myCommunities, isLoading: loadingMy } = useMyCommunities()
  const { data: discoverCommunities, isLoading: loadingDiscover } = useDiscoverCommunities()
  const { data: nearbyCommunities, isLoading: loadingNearby } = useNearbyCommunities()
  const { data: suggestedCommunities, isLoading: loadingSuggested } = useSuggestedCommunities()

  const dataMap: Record<Tab, typeof myCommunities> = {
    'my-communities': myCommunities,
    discover: discoverCommunities,
    nearby: nearbyCommunities,
    suggested: suggestedCommunities,
  }
  const loadingMap: Record<Tab, boolean> = {
    'my-communities': loadingMy,
    discover: loadingDiscover,
    nearby: loadingNearby,
    suggested: loadingSuggested,
  }

  const allCommunities = dataMap[tab]
  const isLoading = loadingMap[tab]

  // Filter by search + category
  let communities = allCommunities
  if (searchQuery.length >= 2) {
    communities = communities?.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.handle.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }
  if (selectedCategory) {
    communities = communities?.filter(
      (c) => c.category?.toLowerCase() === selectedCategory.toLowerCase()
    )
  }

  const showHero =
    tab === 'my-communities' && !loadingMy && (!myCommunities || myCommunities.length === 0) && !searchQuery

  return (
    <AppShell>
    <div className="max-w-5xl mx-auto px-4 pt-8 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Communities</h1>
          <p className="text-sm text-brand-text/60 mt-0.5">
            Join communities that share your interests
          </p>
        </div>
        <Link
          href="/communities/create"
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-text text-brand-bg text-sm font-bold rounded-xl hover:bg-brand-text/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Community
        </Link>
      </div>

      {/* Hero banner when no communities */}
      {showHero && (
        <div className="bg-white border border-brand-divider rounded-2xl p-8 mb-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-bg mx-auto mb-4 flex items-center justify-center">
            <Users className="w-8 h-8 text-brand-text/30" />
          </div>
          <h2 className="text-lg font-bold text-brand-text mb-1">Find your community</h2>
          <p className="text-sm text-brand-text/60 max-w-md mx-auto">
            Discover groups of people who share your passions, hobbies, and interests.
          </p>
          <button
            onClick={() => setTab('discover')}
            className="mt-4 px-6 py-2.5 bg-brand-text text-brand-bg text-sm font-bold rounded-xl hover:bg-brand-text/90 transition-colors"
          >
            Explore Communities
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/30" />
        <input
          type="text"
          placeholder="Search communities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-brand-divider rounded-xl text-sm placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/20 focus:border-brand-text/30 transition-all text-brand-text"
        />
      </div>

      {/* Tabs */}
      {!searchQuery && (
        <div className="flex items-center gap-0 border-b border-brand-divider mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key)
                setSelectedCategory(null)
              }}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${
                tab === t.key ? 'text-brand-text' : 'text-brand-text/60 hover:text-brand-text'
              }`}
            >
              {t.icon}
              {t.label}
              {tab === t.key && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 border-b-2 border-brand-text rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Category grid (discover tab) */}
      {tab === 'discover' && !searchQuery && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-brand-text/70 mb-3">Browse by Category</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                onClick={() =>
                  setSelectedCategory(selectedCategory === cat.label ? null : cat.label)
                }
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center ${
                  selectedCategory === cat.label
                    ? 'bg-brand-text text-brand-bg border-brand-text'
                    : 'bg-white border-brand-divider text-brand-text hover:bg-brand-bg'
                }`}
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-xs font-semibold truncate w-full">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Communities grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-brand-divider overflow-hidden animate-pulse"
            >
              <div className="h-[100px] bg-brand-bg" />
              <div className="p-4 space-y-2">
                <div className="w-12 h-12 rounded-xl bg-brand-bg -mt-7" />
                <div className="h-4 w-32 bg-brand-bg rounded" />
                <div className="h-3 w-48 bg-brand-bg rounded" />
                <div className="h-3 w-24 bg-brand-bg rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : communities && communities.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {communities.map((community) => (
            <CommunityCard key={community.id} community={community} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-brand-bg mx-auto mb-4 flex items-center justify-center">
            <Users className="w-8 h-8 text-brand-text/20" />
          </div>
          <p className="text-sm font-semibold text-brand-text/60">
            {searchQuery
              ? 'No communities found'
              : selectedCategory
                ? `No communities in ${selectedCategory}`
                : tab === 'my-communities'
                  ? "You haven't joined any communities yet"
                  : 'No communities to discover'}
          </p>
          <p className="text-xs text-brand-text/40 mt-1">
            {tab === 'my-communities' && !searchQuery && "Create one or explore what's out there"}
          </p>
        </div>
      )}
    </div>
    </AppShell>
  )
}

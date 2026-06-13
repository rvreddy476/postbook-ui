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

  let communities = allCommunities
  if (searchQuery.length >= 2) {
    communities = communities?.filter(
      (community) =>
        community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        community.handle.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }
  if (selectedCategory) {
    communities = communities?.filter(
      (community) => community.category?.toLowerCase() === selectedCategory.toLowerCase()
    )
  }

  const showHero =
    tab === 'my-communities' && !loadingMy && (!myCommunities || myCommunities.length === 0) && !searchQuery

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-brand-text tracking-tight">Communities</h1>
            <p className="text-sm text-brand-text/60 mt-1">
              Join communities that share your interests
            </p>
          </div>
          <Link
            href="/communities/create"
            className="flex items-center gap-2 px-6 py-3 bg-brand-text text-brand-bg text-sm font-bold rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <Plus className="w-4 h-4" />
            Create
          </Link>
        </div>

        {showHero && (
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/50 dark:from-brand-bg dark:via-brand-bg/50 dark:to-brand-text/5 border border-brand-divider rounded-3xl p-10 mb-8 text-center shadow-sm backdrop-blur-sm group">
            <div className="absolute inset-0 bg-white/40 dark:bg-black/20 backdrop-blur-[2px] z-0"></div>
            <div className="relative z-10">
              <div className="w-20 h-20 rounded-2xl bg-white dark:bg-brand-divider mx-auto mb-5 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-500">
                <Users className="w-10 h-10 text-brand-text/60 group-hover:text-brand-text transition-colors duration-500" />
              </div>
              <h2 className="text-2xl font-black text-brand-text mb-2 tracking-tight">Find your community</h2>
              <p className="text-sm text-brand-text/70 max-w-md mx-auto mb-6">
                Discover groups of people who share your passions, hobbies, and interests.
              </p>
              <button
                onClick={() => setTab('discover')}
                className="px-8 py-3 bg-brand-text text-brand-bg text-sm font-bold rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                Explore Communities
              </button>
            </div>
          </div>
        )}

        <div className="relative mb-8 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-text/40 group-focus-within:text-brand-text transition-colors" />
          <input
            type="text"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-5 py-4 bg-white/50 dark:bg-brand-bg/50 backdrop-blur-md border border-brand-divider rounded-2xl text-base placeholder:text-brand-text/40 focus:outline-none focus:ring-4 focus:ring-brand-text/10 focus:border-brand-text/30 transition-all text-brand-text shadow-sm hover:bg-white dark:hover:bg-brand-bg"
          />
        </div>

        {!searchQuery && (
          <div className="flex items-center gap-2 mb-8 overflow-x-auto scrollbar-hide pb-2">
            {tabs.map((tabOption) => (
              <button
                key={tabOption.key}
                onClick={() => {
                  setTab(tabOption.key)
                  setSelectedCategory(null)
                }}
                className={`relative flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl whitespace-nowrap transition-all duration-300 ${
                  tab === tabOption.key 
                    ? 'bg-brand-text text-brand-bg shadow-md scale-100' 
                    : 'bg-brand-bg/50 text-brand-text/70 hover:bg-brand-bg hover:text-brand-text scale-95 hover:scale-100 border border-transparent hover:border-brand-divider'
                }`}
              >
                {tabOption.icon}
                {tabOption.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'discover' && !searchQuery && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-brand-text/80 uppercase tracking-wider">Browse by Category</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {CATEGORIES.map((category) => (
                <button
                  key={category.label}
                  onClick={() =>
                    setSelectedCategory(selectedCategory === category.label ? null : category.label)
                  }
                  className={`group flex flex-col items-center gap-2 p-4 rounded-2xl border backdrop-blur-sm transition-all duration-300 text-center ${
                    selectedCategory === category.label
                      ? 'bg-brand-text text-brand-bg border-brand-text shadow-lg -translate-y-1'
                      : 'bg-white/60 dark:bg-brand-bg/60 border-brand-divider/60 text-brand-text hover:bg-white dark:hover:bg-brand-bg hover:shadow-md hover:-translate-y-1 hover:border-brand-text/30'
                  }`}
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform duration-300">{category.emoji}</span>
                  <span className="text-[11px] font-bold truncate w-full uppercase tracking-wide">{category.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <div
                key={index}
                className="flex items-center gap-3.5 p-3 bg-brand-card border border-brand-divider rounded-xl animate-pulse"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-text/5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 bg-brand-text/5 rounded" />
                  <div className="h-3 w-24 bg-brand-text/5 rounded" />
                </div>
                <div className="h-7 w-16 bg-brand-text/5 rounded-lg" />
              </div>
            ))}
          </div>
        ) : communities && communities.length > 0 ? (
          <div className="space-y-2">
            {communities.map((community) => (
              <CommunityCard key={community.id} community={community} isMyCommunity={tab === 'my-communities'} />
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

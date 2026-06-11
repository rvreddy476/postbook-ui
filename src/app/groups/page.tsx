'use client'

import React, { useState } from 'react'
import AppShell from '@/components/AppShell'
import { useMyGroups, useDiscoverGroups, useGroupSearch } from '@/hooks/useGroups'
import GroupCard from '@/components/groups/GroupCard'
import { Search, Plus, Users, Compass, Mail, Sparkles } from 'lucide-react'
import Link from 'next/link'

type Tab = 'my-groups' | 'discover' | 'invites' | 'suggested'

const FILTER_CHIPS = ['All', 'Public', 'Private', 'Local', 'Recent', 'Active'] as const
type FilterChip = (typeof FILTER_CHIPS)[number]

export default function GroupsPage() {
  const [tab, setTab] = useState<Tab>('my-groups')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterChip>('All')

  const { data: myGroups, isLoading: loadingMy } = useMyGroups()
  const { data: discoverGroups, isLoading: loadingDiscover } = useDiscoverGroups()
  const { data: searchResults } = useGroupSearch(searchQuery)

  const groups = searchQuery.length >= 2
    ? searchResults
    : tab === 'my-groups'
      ? myGroups
      : tab === 'discover'
        ? discoverGroups
        : tab === 'suggested'
          ? discoverGroups
          : undefined

  const filteredGroups = groups?.filter((group) => {
    if (tab !== 'my-groups' || activeFilter === 'All') return true
    if (activeFilter === 'Public') return group.privacy_level === 'public' || group.visibility === 'public'
    if (activeFilter === 'Private') return group.privacy_level === 'private' || group.visibility === 'private'
    if (activeFilter === 'Local') return !!group.location
    if (activeFilter === 'Recent') return true
    if (activeFilter === 'Active') return true
    return true
  })

  const isLoading = tab === 'my-groups' ? loadingMy : loadingDiscover

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'my-groups', label: 'My Spaces', icon: <Users className="w-4 h-4" /> },
    { key: 'discover', label: 'Discover', icon: <Compass className="w-4 h-4" /> },
    { key: 'invites', label: 'Invites', icon: <Mail className="w-4 h-4" /> },
    { key: 'suggested', label: 'Suggested', icon: <Sparkles className="w-4 h-4" /> },
  ]

  const renderEmptyState = () => {
    const config: Record<Tab, { title: string; desc: string }> = {
      'my-groups': {
        title: 'No groups yet',
        desc: 'Join groups to connect with people who share your interests',
      },
      discover: {
        title: 'Nothing to discover',
        desc: 'No groups to discover right now. Check back later!',
      },
      invites: {
        title: 'No invites',
        desc: 'You have no pending group invitations',
      },
      suggested: {
        title: 'No suggestions',
        desc: 'We don\'t have any group suggestions for you yet',
      },
    }
    const { title, desc } = config[tab]
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-brand-text/5 mx-auto mb-4 flex items-center justify-center">
          <Users className="w-8 h-8 text-brand-text/20" />
        </div>
        <h3 className="text-base font-semibold text-brand-text/60">{title}</h3>
        <p className="text-sm text-brand-text/40 mt-1">{desc}</p>
      </div>
    )
  }

  return (
    <AppShell>
    <div className="max-w-5xl mx-auto px-4 pt-8 pb-16">
      {/* Header: Title + Create Group button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[26px] font-[800] tracking-tight text-brand-text" style={{ fontFamily: 'var(--font-outfit, Outfit, sans-serif)' }}>
          MySpace
        </h1>
        <Link
          href="/groups/create"
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-text text-brand-bg text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Group
        </Link>
      </div>

      {/* Search bar — white card, full width */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/30" />
        <input
          type="text"
          placeholder="Search groups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-brand-divider rounded-2xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10 focus:border-brand-text/20 transition-all"
        />
      </div>

      {/* 4 Tabs */}
      {!searchQuery && (
        <div className="flex items-center gap-0 border-b border-brand-divider mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-bold transition-colors ${
                tab === t.key ? 'text-brand-text' : 'text-brand-text/40 hover:text-brand-text/70'
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

      {/* Filter chips on My Groups tab */}
      {!searchQuery && tab === 'my-groups' && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setActiveFilter(chip)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeFilter === chip
                  ? 'bg-brand-text text-brand-bg'
                  : 'bg-brand-text/8 text-brand-text/60 hover:bg-brand-text/12'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Groups list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3.5 p-3 bg-white border border-brand-divider rounded-xl animate-pulse">
              <div className="w-12 h-12 rounded-xl bg-brand-text/5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 bg-brand-text/5 rounded" />
                <div className="h-3 w-24 bg-brand-text/5 rounded" />
              </div>
              <div className="h-7 w-16 bg-brand-text/5 rounded-lg" />
            </div>
          ))}
        </div>
      ) : filteredGroups && filteredGroups.length > 0 ? (
        <div className="space-y-2">
          {filteredGroups.map((group) => (
            <GroupCard key={group.id} group={group} isMyGroup={tab === 'my-groups'} />
          ))}
        </div>
      ) : (
        renderEmptyState()
      )}
    </div>
    </AppShell>
  )
}

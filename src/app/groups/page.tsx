'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMyGroups, useDiscoverGroups, useGroupSearch } from '@/hooks/useGroups'
import GroupCard from '@/components/groups/GroupCard'
import { Search, Plus } from 'lucide-react'
import { motion } from 'framer-motion'

type Tab = 'my-groups' | 'discover'

export default function GroupsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('my-groups')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: myGroups, isLoading: loadingMy } = useMyGroups()
  const { data: discoverGroups, isLoading: loadingDiscover } = useDiscoverGroups()
  const { data: searchResults } = useGroupSearch(searchQuery)

  const groups = searchQuery.length >= 2
    ? searchResults
    : tab === 'my-groups'
      ? myGroups
      : discoverGroups
  const isLoading = tab === 'my-groups' ? loadingMy : loadingDiscover

  return (
    <div className="max-w-4xl mx-auto px-4 pt-8 pb-12">
      {/* Title + Create button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-slate-800">Groups</h1>
        <button
          onClick={() => router.push('/groups/create')}
          className="flex items-center gap-2 px-4 py-2 orchid-gradient text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Create Group
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search groups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
        />
      </div>

      {/* Tabs */}
      {!searchQuery && (
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setTab('my-groups')}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              tab === 'my-groups' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            My Groups
          </button>
          <button
            onClick={() => setTab('discover')}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              tab === 'discover' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Discover
          </button>
        </div>
      )}

      {/* Groups grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : groups && groups.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <motion.div key={group.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <GroupCard group={group} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">
            {searchQuery
              ? 'No groups found'
              : tab === 'my-groups'
                ? "You haven't joined any groups yet"
                : 'No groups to discover'}
          </p>
        </div>
      )}
    </div>
  )
}

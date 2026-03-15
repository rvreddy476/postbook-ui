'use client'

import React, { useState } from 'react'
import { useMyGroups, useDiscoverGroups, useGroupSearch } from '@/hooks/useGroups'
import GroupCard from '@/components/groups/GroupCard'
import GroupCreateModal from '@/components/groups/GroupCreateModal'
import { Search, Plus, Users, Compass } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

type Tab = 'my-groups' | 'discover'

export default function GroupsPage() {
  const [tab, setTab] = useState<Tab>('my-groups')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)

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
    <div className="max-w-5xl mx-auto px-4 pt-8 pb-16">
      {/* Title + Create button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Groups</h1>
          <p className="text-sm text-slate-400 mt-0.5">Connect with communities that matter to you</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#D8103F] text-white text-sm font-bold rounded-xl hover:bg-[#C00E38] transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Group
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
        <input
          type="text"
          placeholder="Search groups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20 focus:border-[#D8103F]/30 transition-all"
        />
      </div>

      {/* Tabs */}
      {!searchQuery && (
        <div className="flex items-center gap-0 border-b border-slate-100 mb-6 -mx-1">
          <button
            onClick={() => setTab('my-groups')}
            className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${
              tab === 'my-groups' ? 'text-[#D8103F]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Users className="w-4 h-4" />
            My Groups
            {tab === 'my-groups' && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#D8103F] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setTab('discover')}
            className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${
              tab === 'discover' ? 'text-[#D8103F]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Compass className="w-4 h-4" />
            Discover
            {tab === 'discover' && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#D8103F] rounded-full" />
            )}
          </button>
        </div>
      )}

      {/* Groups grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
              <div className="h-28 bg-slate-100" />
              <div className="p-4 space-y-2">
                <div className="w-12 h-12 rounded-xl bg-slate-100 -mt-7" />
                <div className="h-4 w-32 bg-slate-100 rounded" />
                <div className="h-3 w-48 bg-slate-50 rounded" />
                <div className="h-3 w-24 bg-slate-50 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : groups && groups.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group, i) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GroupCard group={group} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 mx-auto mb-4 flex items-center justify-center">
            <Users className="w-8 h-8 text-slate-200" />
          </div>
          <p className="text-sm font-semibold text-slate-400">
            {searchQuery
              ? 'No groups found'
              : tab === 'my-groups'
                ? "You haven't joined any groups yet"
                : 'No groups to discover'}
          </p>
          <p className="text-xs text-slate-300 mt-1">
            {tab === 'my-groups' && !searchQuery && 'Create one or explore what\'s out there'}
          </p>
        </div>
      )}

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreate && <GroupCreateModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  )
}

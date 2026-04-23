'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useQATopics } from '@/hooks/useQA'
import { Search, BookOpen, Users, Star } from 'lucide-react'

export default function QATopicsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false)

  const { data: topics, isLoading } = useQATopics(false, 200)

  const filtered = topics?.filter(t => {
    if (showFeaturedOnly && !t.is_featured) return false
    if (searchQuery.length >= 2) {
      return (
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    return true
  })

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Topics</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Explore questions by subject area</p>
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search topics..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-violet-500"
            />
          </div>
          <button
            onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              showFeaturedOnly
                ? 'bg-violet-600 text-white border-violet-600'
                : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Star className="w-4 h-4" />
            Featured
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered?.map(topic => (
              <Link key={topic.id} href={`/qa/topics/${topic.slug}`}>
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 hover:border-violet-400 dark:hover:border-violet-600 transition-colors cursor-pointer h-full">
                  {topic.is_featured && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full mb-2">
                      <Star className="w-3 h-3" />Featured
                    </span>
                  )}
                  <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 mb-1">{topic.name}</h3>
                  {topic.description && (
                    <p className="text-xs text-neutral-500 line-clamp-2 mb-2">{topic.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{topic.question_count}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{topic.follower_count}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && filtered?.length === 0 && (
          <div className="text-center py-16 text-neutral-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No topics found</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}

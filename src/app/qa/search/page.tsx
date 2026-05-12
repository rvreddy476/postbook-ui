'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { Search, X } from 'lucide-react'
import { useQASearch, useQATopics } from '@/hooks/useQA'
import { useMyCommunities } from '@/hooks/useCommunities'
import { QuestionList } from '@/components/qa/QuestionCard'

function QASearchPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const initialQ = params.get('q') ?? ''
  const initialCommunity = params.get('communityId') ?? ''
  const initialTopic = params.get('topicId') ?? ''

  const [input, setInput] = useState(initialQ)
  const [debounced, setDebounced] = useState(initialQ)
  const [communityId, setCommunityId] = useState(initialCommunity)
  const [topicId, setTopicId] = useState(initialTopic)

  // Debounce input -> debounced
  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), 350)
    return () => clearTimeout(t)
  }, [input])

  // Push query string for shareability
  useEffect(() => {
    const sp = new URLSearchParams()
    if (debounced) sp.set('q', debounced)
    if (communityId) sp.set('communityId', communityId)
    if (topicId) sp.set('topicId', topicId)
    const qs = sp.toString()
    router.replace(qs ? `/qa/search?${qs}` : '/qa/search')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, communityId, topicId])

  const { data: communities } = useMyCommunities()
  const { data: topics } = useQATopics(false, 100)

  const { data: results, isLoading, isFetching } = useQASearch({
    q: debounced,
    communityId: communityId || undefined,
    topicId: topicId || undefined,
  })

  const hasFilters = useMemo(
    () => Boolean(communityId || topicId),
    [communityId, topicId],
  )

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-5">
          <Search className="w-6 h-6 text-violet-600" />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Search Q&A</h1>
        </div>

        {/* Search input */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Search questions, topics, tags…"
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm"
          />
          {input && (
            <button
              type="button"
              onClick={() => setInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <select
            value={communityId}
            onChange={e => setCommunityId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-700 dark:text-neutral-200 focus:outline-none focus:border-violet-500"
          >
            <option value="">All communities</option>
            {communities?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={topicId}
            onChange={e => setTopicId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-700 dark:text-neutral-200 focus:outline-none focus:border-violet-500"
          >
            <option value="">All topics</option>
            {topics?.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setCommunityId(''); setTopicId('') }}
              className="text-xs text-neutral-500 hover:text-neutral-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Results */}
        {debounced.trim().length < 2 ? (
          <div className="py-16 text-center text-neutral-500 text-sm">
            Start typing to search Q&A.
          </div>
        ) : isLoading || isFetching ? (
          <div className="py-12 text-center text-neutral-500">Searching…</div>
        ) : (
          <>
            <div className="text-xs text-neutral-500 mb-3">
              {results?.length ?? 0} result{(results?.length ?? 0) === 1 ? '' : 's'}
            </div>
            <QuestionList items={results} emptyLabel="No results found." />
          </>
        )}

        {/* Helpful link back */}
        <div className="mt-8 text-center">
          <Link href="/qa" className="text-sm text-violet-600 hover:underline">
            Back to Q&A home
          </Link>
        </div>
      </div>
    </AppShell>
  )
}

export default function QASearchPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-neutral-500">Loading…</div>}>
      <QASearchPageInner />
    </Suspense>
  )
}

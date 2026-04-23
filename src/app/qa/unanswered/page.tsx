'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useQAUnanswered, useQATopics } from '@/hooks/useQA'
import { HelpCircle, Eye, ChevronUp, Tag } from 'lucide-react'
import type { QuestionSummary } from '@/types/qa'

function QuestionCard({ q }: { q: QuestionSummary }) {
  return (
    <Link href={`/qa/questions/${q.id}`}>
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 hover:border-violet-400 dark:hover:border-violet-600 transition-colors cursor-pointer">
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-1 min-w-[48px] text-center">
            <div className="flex items-center gap-1 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              <ChevronUp className="w-4 h-4" />{q.vote_score}
            </div>
            <div className="text-xs text-neutral-500">votes</div>
            <div className="mt-1 px-2 py-0.5 rounded text-xs font-medium border border-neutral-300 dark:border-neutral-600 text-neutral-500">
              0
            </div>
            <div className="text-xs text-neutral-500">ans</div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
              {q.title}
            </h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {q.tags?.slice(0, 4).map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 text-xs">
                  <Tag className="w-3 h-3" />{tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{q.view_count}</span>
              {q.author && (
                <span className="ml-auto">asked by <span className="text-violet-600 dark:text-violet-400">{q.author.display_name || 'Anonymous'}</span></span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function UnansweredPage() {
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>()
  const { data: questions, isLoading } = useQAUnanswered(selectedTopic)
  const { data: topics } = useQATopics(false, 30)

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-2">
          <HelpCircle className="w-6 h-6 text-violet-600" />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Unanswered Questions</h1>
        </div>
        <p className="text-sm text-neutral-500 mb-6">Help the community — answer questions that haven't been answered yet.</p>

        {/* Topic filter */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setSelectedTopic(undefined)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !selectedTopic ? 'bg-violet-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-violet-100 dark:hover:bg-violet-900/30'
            }`}
          >
            All Topics
          </button>
          {topics?.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTopic(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedTopic === t.id ? 'bg-violet-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-violet-100 dark:hover:bg-violet-900/30'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-12 space-y-1.5">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded" />
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4" />
                    <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : questions?.length === 0 ? (
          <div className="text-center py-16 text-neutral-500">
            <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No unanswered questions!</p>
            <p className="text-sm mt-1">The community is well-served. Check back later.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions?.map(q => <QuestionCard key={q.id} q={q} />)}
          </div>
        )}
      </div>
    </AppShell>
  )
}

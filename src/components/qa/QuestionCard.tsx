'use client'

import Link from 'next/link'
import { ChevronUp, Eye, Tag } from 'lucide-react'
import type { QuestionSummary } from '@/types/qa'

export function QuestionCard({ q }: { q: QuestionSummary }) {
  return (
    <Link href={`/qa/questions/${q.id}`}>
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 hover:border-violet-400 dark:hover:border-violet-600 transition-colors cursor-pointer">
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-1 min-w-[48px] text-center">
            <div className="flex items-center gap-1 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              <ChevronUp className="w-4 h-4" />{q.vote_score ?? 0}
            </div>
            <div className="text-xs text-neutral-500">votes</div>
            <div className="mt-1 px-2 py-0.5 rounded text-xs font-medium border border-neutral-300 dark:border-neutral-600 text-neutral-500">
              {q.answer_count ?? 0}
            </div>
            <div className="text-xs text-neutral-500">ans</div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
              {q.title}
            </h3>
            {q.tags && q.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {q.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 text-xs"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {q.view_count ?? 0}
              </span>
              {q.author ? (
                <span className="ml-auto">
                  asked by{' '}
                  <span className="text-violet-600 dark:text-violet-400">
                    {q.author.display_name || 'Anonymous'}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function QuestionList({ items, emptyLabel = 'Nothing here yet.' }: {
  items: QuestionSummary[] | undefined
  emptyLabel?: string
}) {
  if (!items || items.length === 0) {
    return (
      <div className="py-16 text-center text-neutral-500 text-sm">{emptyLabel}</div>
    )
  }
  return (
    <div className="space-y-3">
      {items.map((q) => (
        <QuestionCard key={q.id} q={q} />
      ))}
    </div>
  )
}

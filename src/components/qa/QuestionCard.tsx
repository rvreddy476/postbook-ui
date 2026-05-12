'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronUp, Eye, Tag, Users, MoreHorizontal, Flag, UserCircle2 } from 'lucide-react'
import type { QuestionSummary } from '@/types/qa'
import { useCreateQAReport } from '@/hooks/useQA'

const ANON_AUTHOR_ID = '00000000-0000-0000-0000-000000000000'

function isAnonymousQuestion(q: QuestionSummary): boolean {
  return Boolean(q.is_anonymous) || q.author_id === ANON_AUTHOR_ID
}

export function QuestionCard({ q }: { q: QuestionSummary }) {
  const anon = isAnonymousQuestion(q)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reported, setReported] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const reportMut = useCreateQAReport()

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  const handleReport = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    if (reported) return
    try {
      await reportMut.mutateAsync({
        target_type: 'question',
        target_id: q.id,
        reason: 'inappropriate',
      })
      setReported(true)
    } catch {
      // swallow
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 hover:border-violet-400 dark:hover:border-violet-600 transition-colors relative">
      <Link href={`/qa/questions/${q.id}`} className="block">
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
            <h3 className="font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2 hover:text-violet-600 dark:hover:text-violet-400 transition-colors pr-8">
              {q.title}
            </h3>

            {/* Community pill */}
            {q.community_id && (
              <div
                className="mt-1.5"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Link
                  href={`/communities/${q.community_id}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[11px] font-medium hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                >
                  <Users className="w-3 h-3" />
                  Asked in community
                </Link>
              </div>
            )}

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
              <span className="ml-auto flex items-center gap-1.5">
                {anon ? (
                  <>
                    <UserCircle2 className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="text-neutral-500">Anonymous</span>
                  </>
                ) : q.author ? (
                  <>
                    asked by{' '}
                    <span className="text-violet-600 dark:text-violet-400">
                      {q.author.display_name || 'Unknown'}
                    </span>
                  </>
                ) : null}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* Kebab menu */}
      <div className="absolute top-3 right-3" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setMenuOpen((v) => !v)
          }}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="More options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 z-30 w-44 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg py-1 text-sm">
            <button
              type="button"
              onClick={handleReport}
              disabled={reportMut.isPending || reported}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              <Flag className="w-4 h-4 text-neutral-500" />
              {reported ? 'Reported' : 'Report'}
            </button>
          </div>
        )}
      </div>
    </div>
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

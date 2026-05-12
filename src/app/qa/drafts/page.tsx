'use client'

import { useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useQuestionDrafts,
  useAnswerDrafts,
  useDeleteQuestionDraft,
  useDeleteAnswerDraft,
} from '@/hooks/useQA'
import { FileText, Trash2, ArrowRight, BookOpen } from 'lucide-react'

type Tab = 'questions' | 'answers'

export default function QADraftsPage() {
  const [tab, setTab] = useState<Tab>('questions')
  const { data: qDrafts, isLoading: qLoading } = useQuestionDrafts()
  const { data: aDrafts, isLoading: aLoading } = useAnswerDrafts()
  const deleteQ = useDeleteQuestionDraft()
  const deleteA = useDeleteAnswerDraft()

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-6 h-6 text-violet-600" />
          <h1 className="text-2xl font-semibold">Drafts</h1>
        </div>
        <p className="text-sm text-neutral-500 mb-6">
          Continue where you left off.
        </p>

        <div className="flex gap-2 mb-5 border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setTab('questions')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'questions'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Question drafts
          </button>
          <button
            onClick={() => setTab('answers')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'answers'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Answer drafts
          </button>
        </div>

        {tab === 'questions' ? (
          qLoading ? (
            <div className="py-12 text-center text-neutral-500">Loading…</div>
          ) : !qDrafts || qDrafts.length === 0 ? (
            <EmptyState text="No question drafts yet." />
          ) : (
            <div className="space-y-3">
              {qDrafts.map(d => (
                <div
                  key={d.id}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-neutral-400 mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-1">
                        {d.title || 'Untitled draft'}
                      </div>
                      {d.body && (
                        <div className="text-sm text-neutral-500 mt-1 line-clamp-2">
                          {d.body}
                        </div>
                      )}
                      <div className="text-xs text-neutral-400 mt-1.5">
                        Updated {new Date(d.updated_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/qa/ask?draftId=${d.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
                      >
                        Resume
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteQ.mutate(d.id)}
                        disabled={deleteQ.isPending}
                        className="p-2 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        aria-label="Delete draft"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : aLoading ? (
          <div className="py-12 text-center text-neutral-500">Loading…</div>
        ) : !aDrafts || aDrafts.length === 0 ? (
          <EmptyState text="No answer drafts yet." />
        ) : (
          <div className="space-y-3">
            {aDrafts.map(d => (
              <div
                key={d.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-neutral-400 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-700 dark:text-neutral-200 line-clamp-3">
                      {d.body || 'Empty draft'}
                    </div>
                    <div className="text-xs text-neutral-400 mt-1.5">
                      Updated {new Date(d.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/qa/questions/${d.question_id}?answerDraftId=${d.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
                    >
                      Resume
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => deleteA.mutate(d.id)}
                      disabled={deleteA.isPending}
                      className="p-2 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      aria-label="Delete draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-16 text-center text-neutral-500 text-sm">
      <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
      {text}
    </div>
  )
}

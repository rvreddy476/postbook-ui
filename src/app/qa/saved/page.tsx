'use client'

import { useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useSavedQuestions, useSavedAnswers } from '@/hooks/useQA'
import { QuestionList } from '@/components/qa/QuestionCard'
import { Bookmark } from 'lucide-react'

type Tab = 'questions' | 'answers'

export default function QASavedPage() {
  const [tab, setTab] = useState<Tab>('questions')
  const { data: questions, isLoading: qLoading } = useSavedQuestions(30)
  const { data: answers, isLoading: aLoading } = useSavedAnswers(30)

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <Bookmark className="w-6 h-6 text-violet-600" />
          <h1 className="text-2xl font-semibold">Saved</h1>
        </div>
        <p className="text-sm text-neutral-500 mb-6">
          Questions and answers you saved for later.
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
            Questions
          </button>
          <button
            onClick={() => setTab('answers')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'answers'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Answers
          </button>
        </div>

        {tab === 'questions' ? (
          qLoading ? (
            <div className="py-12 text-center text-neutral-500">Loading…</div>
          ) : (
            <QuestionList items={questions} emptyLabel="No saved questions yet." />
          )
        ) : aLoading ? (
          <div className="py-12 text-center text-neutral-500">Loading…</div>
        ) : !answers || answers.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 text-sm">No saved answers yet.</div>
        ) : (
          <div className="space-y-3">
            {answers.map((a) => (
              <Link
                key={a.id}
                href={`/qa/questions/${a.question_id}#answer-${a.id}`}
                className="block bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 hover:border-violet-400 transition-colors"
              >
                <div className="text-sm text-neutral-700 line-clamp-3">{a.body}</div>
                <div className="text-xs text-neutral-500 mt-2">
                  {a.vote_score ?? 0} votes · {new Date(a.created_at).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

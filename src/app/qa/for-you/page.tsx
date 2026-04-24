'use client'

import AppShell from '@/components/AppShell'
import { useQAForYouFeed } from '@/hooks/useQA'
import { QuestionList } from '@/components/qa/QuestionCard'
import { Sparkles } from 'lucide-react'

export default function QAForYouPage() {
  const { data, isLoading } = useQAForYouFeed(30)

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-6 h-6 text-violet-600" />
          <h1 className="text-2xl font-semibold">For you</h1>
        </div>
        <p className="text-sm text-neutral-500 mb-6">
          Personalized recommendations based on your interests.
        </p>
        {isLoading ? (
          <div className="py-12 text-center text-neutral-500">Loading…</div>
        ) : (
          <QuestionList items={data} emptyLabel="No recommendations yet — follow a few topics first." />
        )}
      </div>
    </AppShell>
  )
}

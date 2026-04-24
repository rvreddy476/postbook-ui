'use client'

import AppShell from '@/components/AppShell'
import { useQAFollowingFeed } from '@/hooks/useQA'
import { QuestionList } from '@/components/qa/QuestionCard'

export default function QAFollowingPage() {
  const { data, isLoading } = useQAFollowingFeed(30)

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-4">
        <h1 className="text-2xl font-semibold mb-4">Following</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Questions from topics and people you follow.
        </p>
        {isLoading ? (
          <div className="py-12 text-center text-neutral-500">Loading…</div>
        ) : (
          <QuestionList
            items={data}
            emptyLabel="Follow a topic or contributor to populate this feed."
          />
        )}
      </div>
    </AppShell>
  )
}

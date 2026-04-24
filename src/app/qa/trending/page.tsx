'use client'

import AppShell from '@/components/AppShell'
import { useQATrending } from '@/hooks/useQA'
import { QuestionList } from '@/components/qa/QuestionCard'
import { TrendingUp } from 'lucide-react'

export default function QATrendingPage() {
  const { data, isLoading } = useQATrending(30)

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-6 h-6 text-violet-600" />
          <h1 className="text-2xl font-semibold">Trending</h1>
        </div>
        <p className="text-sm text-neutral-500 mb-6">
          Popular questions right now.
        </p>
        {isLoading ? (
          <div className="py-12 text-center text-neutral-500">Loading…</div>
        ) : (
          <QuestionList items={data} emptyLabel="Nothing trending yet." />
        )}
      </div>
    </AppShell>
  )
}

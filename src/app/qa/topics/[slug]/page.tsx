'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import {
  useQATopic, useTopicQuestions, useTopicTopContributors,
  useFollowTopic, useUnfollowTopic,
} from '@/hooks/useQA'
import { BookOpen, Users, ChevronUp, Eye, Tag, CheckCircle } from 'lucide-react'
import type { QuestionSummary } from '@/types/qa'

type SortOption = 'newest' | 'votes' | 'unanswered'

function QuestionRow({ q }: { q: QuestionSummary }) {
  return (
    <Link href={`/qa/questions/${q.id}`}>
      <div className="flex gap-4 p-4 border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer last:border-0">
        <div className="flex flex-col items-center gap-0.5 min-w-[48px] text-center text-xs">
          <div className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-0.5">
            <ChevronUp className="w-3 h-3" />{q.vote_score}
          </div>
          <div className="text-neutral-400">votes</div>
          <div className={`mt-1.5 px-1.5 py-0.5 rounded text-xs font-medium ${q.is_answered ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'border border-neutral-300 dark:border-neutral-600 text-neutral-500'}`}>
            {q.answer_count}
          </div>
          <div className="text-neutral-400">ans</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2 hover:text-violet-600 dark:hover:text-violet-400 text-sm">
            {q.title}
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {q.tags?.slice(0, 3).map(tag => (
              <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400 text-xs">
                <Tag className="w-2.5 h-2.5" />{tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-400">
            <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{q.view_count}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function TopicDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [sort, setSort] = useState<SortOption>('newest')

  const { data: topic, isLoading: topicLoading } = useQATopic(slug)
  const { data: questions, isLoading: questionsLoading } = useTopicQuestions(topic?.id, sort)
  const { data: contributors } = useTopicTopContributors(topic?.id)
  const followTopic = useFollowTopic(topic?.id ?? '')
  const unfollowTopic = useUnfollowTopic(topic?.id ?? '')

  if (topicLoading) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3 mb-2" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
        </div>
      </AppShell>
    )
  }

  if (!topic) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-neutral-500">
          Topic not found.
        </div>
      </AppShell>
    )
  }

  const handleFollowToggle = () => {
    if (topic.is_following) {
      unfollowTopic.mutate()
    } else {
      followTopic.mutate()
    }
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Topic header */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">{topic.name}</h1>
              {topic.description && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{topic.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-neutral-500">
                <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4" />{topic.question_count.toLocaleString()} questions</span>
                <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{topic.follower_count.toLocaleString()} followers</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleFollowToggle}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  topic.is_following
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20'
                    : 'bg-violet-600 hover:bg-violet-700 text-white'
                }`}
              >
                {topic.is_following ? 'Following' : 'Follow'}
              </button>
              <Link href={`/qa/ask`}>
                <button className="px-4 py-2 rounded-lg text-sm font-medium border border-violet-500 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
                  Ask
                </button>
              </Link>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Questions */}
          <div className="flex-1 min-w-0">
            {/* Sort tabs */}
            <div className="flex gap-2 mb-4">
              {(['newest', 'votes', 'unanswered'] as SortOption[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    sort === s
                      ? 'bg-violet-600 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
              {questionsLoading ? (
                <div className="p-4 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4 animate-pulse">
                      <div className="w-12 space-y-1">
                        <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded" />
                        <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded" />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4" />
                        <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : questions?.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 text-sm">
                  No questions in this topic yet.{' '}
                  <Link href="/qa/ask" className="text-violet-600 hover:underline">Be the first to ask!</Link>
                </div>
              ) : (
                questions?.map(q => <QuestionRow key={q.id} q={q} />)
              )}
            </div>
          </div>

          {/* Sidebar: top contributors */}
          {contributors && contributors.length > 0 && (
            <div className="hidden lg:block w-56 shrink-0">
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">Top Contributors</h3>
                <div className="space-y-3">
                  {contributors.slice(0, 8).map((c, i) => (
                    <div key={c.user_id} className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400 w-4">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
                            {c.display_name || 'Anonymous'}
                          </span>
                          {c.is_verified && <CheckCircle className="w-3 h-3 text-violet-500 shrink-0" />}
                        </div>
                        <div className="text-xs text-neutral-500">{c.reputation_score.toLocaleString()} pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

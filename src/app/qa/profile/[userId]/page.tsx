'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useQAUserProfile, useUserQuestions, useReputationHistory, useContributorBadges,
} from '@/hooks/useQA'
import { Star, CheckCircle, HelpCircle, MessageSquare, Award, Clock, ChevronUp } from 'lucide-react'
import type { QuestionSummary, ReputationEvent, ContributorBadge } from '@/types/qa'

type Tab = 'questions' | 'reputation' | 'badges'

function ReputationRow({ event }: { event: ReputationEvent }) {
  const isPositive = event.points > 0
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      <div className={`text-sm font-bold w-12 text-right shrink-0 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
        {isPositive ? '+' : ''}{event.points}
      </div>
      <div className="flex-1 text-sm text-neutral-700 dark:text-neutral-300 capitalize">
        {event.event_type.replace(/_/g, ' ')}
      </div>
      <div className="text-xs text-neutral-400 shrink-0">
        {new Date(event.created_at).toLocaleDateString()}
      </div>
    </div>
  )
}

function BadgeItem({ badge }: { badge: ContributorBadge }) {
  const colors: Record<string, string> = {
    gold: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
    silver: 'text-neutral-500 bg-neutral-100 dark:bg-neutral-800',
    bronze: 'text-amber-700 bg-amber-50 dark:bg-amber-900/20',
  }
  const colorClass = colors[badge.badge_type] || colors.bronze
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colorClass}`}>
      <Award className="w-4 h-4 shrink-0" />
      <div>
        <div className="text-xs font-semibold">{badge.badge_name}</div>
        <div className="text-xs opacity-75">{new Date(badge.awarded_at).toLocaleDateString()}</div>
      </div>
    </div>
  )
}

function QuestionRow({ q }: { q: QuestionSummary }) {
  return (
    <Link href={`/qa/questions/${q.id}`}>
      <div className="flex items-start gap-3 py-3 border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 -mx-1 px-1 rounded transition-colors cursor-pointer">
        <div className="flex items-center gap-1 text-xs text-neutral-500 shrink-0 min-w-[48px] justify-end">
          <ChevronUp className="w-3 h-3" />{q.vote_score}
        </div>
        <div className={`px-1.5 py-0.5 rounded text-xs shrink-0 ${q.is_answered ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'border border-neutral-300 dark:border-neutral-600 text-neutral-500'}`}>
          {q.answer_count}
        </div>
        <p className="flex-1 text-sm text-neutral-800 dark:text-neutral-200 line-clamp-1">{q.title}</p>
        <span className="text-xs text-neutral-400 shrink-0">{new Date(q.created_at).toLocaleDateString()}</span>
      </div>
    </Link>
  )
}

export default function QAProfilePage() {
  const params = useParams()
  const userId = params.userId as string
  const [tab, setTab] = useState<Tab>('questions')

  const { data: profile, isLoading } = useQAUserProfile(userId)
  const { data: questions } = useUserQuestions(userId, 20)
  const { data: reputation } = useReputationHistory(userId, 30)
  const { data: badges } = useContributorBadges(userId)

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto px-4 py-6 animate-pulse">
          <div className="h-24 bg-neutral-200 dark:bg-neutral-700 rounded-xl mb-4" />
          <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3" />
        </div>
      </AppShell>
    )
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-neutral-500">Profile not found.</div>
      </AppShell>
    )
  }

  const stats = [
    { icon: <Star className="w-4 h-4 text-amber-500" />, label: 'Reputation', value: profile.reputation_score.toLocaleString() },
    { icon: <HelpCircle className="w-4 h-4 text-ask" />, label: 'Questions', value: profile.question_count },
    { icon: <MessageSquare className="w-4 h-4 text-blue-500" />, label: 'Answers', value: profile.answer_count },
    { icon: <CheckCircle className="w-4 h-4 text-green-500" />, label: 'Best Answers', value: profile.best_answer_count },
  ]

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Profile header */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-ask to-ask-hover flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {(profile.display_name || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {profile.display_name || 'Anonymous'}
                </h1>
                {profile.is_verified && <CheckCircle className="w-5 h-5 text-ask" />}
              </div>
              {profile.bio && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{profile.bio}</p>
              )}
              {profile.expertise_areas?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile.expertise_areas.map(area => (
                    <span key={area} className="px-2 py-0.5 rounded-md bg-ask-light dark:bg-ask-light text-ask dark:text-ask/60 text-xs">
                      {area}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <div className="flex justify-center mb-1">{s.icon}</div>
                <div className="font-bold text-neutral-900 dark:text-neutral-100">{s.value}</div>
                <div className="text-xs text-neutral-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-4">
          {([
            { key: 'questions' as Tab, label: 'Questions', icon: <HelpCircle className="w-4 h-4" /> },
            { key: 'reputation' as Tab, label: 'Reputation', icon: <Star className="w-4 h-4" /> },
            { key: 'badges' as Tab, label: 'Badges', icon: <Award className="w-4 h-4" /> },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-ask text-ask' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'questions' && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4">
            {questions?.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-sm">No questions yet.</div>
            ) : (
              questions?.map(q => <QuestionRow key={q.id} q={q} />)
            )}
          </div>
        )}

        {tab === 'reputation' && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4">
            {reputation?.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-sm">No reputation events yet.</div>
            ) : (
              reputation?.map(event => <ReputationRow key={event.id} event={event} />)
            )}
          </div>
        )}

        {tab === 'badges' && (
          <div>
            {badges?.length === 0 ? (
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl py-8 text-center text-neutral-500 text-sm">
                No badges earned yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {badges?.map(badge => <BadgeItem key={badge.id} badge={badge} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

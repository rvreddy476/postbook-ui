'use client'

import React, { useState } from 'react'
import AppShell from '@/components/AppShell'
import { useQALeaderboard, useQATopics } from '@/hooks/useQA'
import { Trophy, Star, Medal, CheckCircle } from 'lucide-react'
import type { QAProfile } from '@/types/qa'

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="w-5 h-5 text-amber-500" />
  if (rank === 2) return <Medal className="w-5 h-5 text-neutral-400" />
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-700" />
  return <span className="w-5 text-center text-sm font-medium text-neutral-500">#{rank}</span>
}

function LeaderboardRow({ profile, rank }: { profile: QAProfile; rank: number }) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
      rank <= 3
        ? 'bg-gradient-to-r from-violet-50 to-white dark:from-violet-900/10 dark:to-neutral-900 border-ask/20 dark:border-ask/30'
        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
    }`}>
      <div className="w-8 flex justify-center">
        <RankIcon rank={rank} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {profile.display_name || 'Anonymous'}
          </span>
          {profile.is_verified && <CheckCircle className="w-4 h-4 text-ask shrink-0" />}
        </div>
        <div className="flex gap-3 text-xs text-neutral-500 mt-0.5">
          <span>{profile.answer_count} answers</span>
          <span>{profile.best_answer_count} best</span>
          <span>{profile.question_count} questions</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
          <Star className="w-4 h-4" />
          {profile.reputation_score.toLocaleString()}
        </div>
        <div className="text-xs text-neutral-500">reputation</div>
      </div>
    </div>
  )
}

export default function LeaderboardPage() {
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>()
  const { data: leaders, isLoading } = useQALeaderboard(selectedTopic, 50)
  const { data: topics } = useQATopics(true, 20)

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Leaderboard</h1>
        </div>
        <p className="text-sm text-neutral-500 mb-6">Top contributors ranked by reputation score.</p>

        {/* Topic filter */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setSelectedTopic(undefined)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !selectedTopic ? 'bg-ask text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-ask-light dark:hover:bg-ask-light'
            }`}
          >
            All Topics
          </button>
          {topics?.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTopic(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedTopic === t.id ? 'bg-ask text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-ask-light dark:hover:bg-ask-light'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 animate-pulse">
                <div className="flex gap-4 items-center">
                  <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3" />
                    <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
                  </div>
                  <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {leaders?.map((profile, i) => (
              <LeaderboardRow key={profile.user_id} profile={profile} rank={i + 1} />
            ))}
            {!leaders?.length && (
              <div className="text-center py-16 text-neutral-500">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No contributors yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

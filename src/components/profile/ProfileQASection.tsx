'use client'

import Link from 'next/link'
import {
  HelpCircle,
  Award,
  ArrowRight,
  Star,
} from 'lucide-react'
import {
  useQAUserProfile,
  useUserQuestions,
  useUserAnswers,
  useUserBadges,
} from '@/hooks/useQA'

interface Props {
  userId: string
}

export default function ProfileQASection({ userId }: Props) {
  const { data: qaProfile } = useQAUserProfile(userId)
  const { data: questions } = useUserQuestions(userId, 5)
  const { data: answers } = useUserAnswers(userId, 5)
  const { data: badges } = useUserBadges(userId)

  const hasAny =
    (qaProfile?.reputation_score ?? 0) > 0 ||
    (questions?.length ?? 0) > 0 ||
    (answers?.length ?? 0) > 0

  return (
    <div className="bg-brand-card rounded-2xl shadow-sm border border-brand-divider overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-divider flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-brand-text" />
          <h3 className="text-sm font-bold text-brand-text">Questions & Answers</h3>
        </div>
        <Link
          href={`/qa/profile/${userId}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
        >
          View full Q&A profile
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="p-5 space-y-5">
        {/* Reputation + badges */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Star className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <div className="text-lg font-black text-brand-text leading-tight">
                {(qaProfile?.reputation_score ?? 0).toLocaleString()}
              </div>
              <div className="text-[11px] uppercase tracking-wider font-bold text-brand-text/50">
                Reputation
              </div>
            </div>
          </div>
          {badges && badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-w-[60%] justify-end">
              {badges.slice(0, 4).map(b => (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-semibold"
                  title={b.badge_name}
                >
                  <Award className="w-3 h-3" />
                  {b.badge_name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Recent questions */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/50 mb-2">
            Recent questions
          </p>
          {questions && questions.length > 0 ? (
            <ul className="space-y-1.5">
              {questions.slice(0, 3).map(q => (
                <li key={q.id}>
                  <Link
                    href={`/qa/questions/${q.id}`}
                    className="text-sm text-brand-text hover:text-violet-600 line-clamp-1"
                  >
                    {q.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-brand-text/50">No questions yet.</p>
          )}
        </div>

        {/* Recent answers */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text/50 mb-2">
            Recent answers
          </p>
          {answers && answers.length > 0 ? (
            <ul className="space-y-1.5">
              {answers.slice(0, 3).map(a => (
                <li key={a.id}>
                  <Link
                    href={`/qa/questions/${a.question_id}#answer-${a.id}`}
                    className="text-sm text-brand-text hover:text-violet-600 line-clamp-2"
                  >
                    {a.body.slice(0, 140)}
                    {a.body.length > 140 ? '…' : ''}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-brand-text/50">No answers yet.</p>
          )}
        </div>

        {!hasAny && (
          <div className="text-center py-4 text-xs text-brand-text/50">
            <Link
              href="/qa"
              className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-700 font-semibold"
            >
              Visit Q&A <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

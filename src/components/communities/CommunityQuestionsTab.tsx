'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  HelpCircle,
  Pin,
  PinOff,
  ArrowUpRight,
  Hash,
  Plus,
} from 'lucide-react'
import {
  useCommunityQuestions,
  useCommunityPopularTopics,
  usePinCommunityQuestion,
  useUnpinCommunityQuestion,
} from '@/hooks/useQA'
import type { QuestionSummary } from '@/types/qa'
import { isAtLeast } from '@/lib/communityRoles'

type Sort = 'new' | 'top' | 'unanswered'

interface Props {
  communityId: string
  viewerRole?: string
}

export default function CommunityQuestionsTab({ communityId, viewerRole }: Props) {
  const [sort, setSort] = useState<Sort>('new')
  const { data: questions, isLoading } = useCommunityQuestions(communityId, sort)
  const { data: popularTopics } = useCommunityPopularTopics(communityId)
  const pin = usePinCommunityQuestion(communityId)
  const unpin = useUnpinCommunityQuestion(communityId)
  const canModerate = isAtLeast(viewerRole, 'moderator')

  const { pinned, regular } = useMemo(() => {
    const list = questions ?? []
    const p = list.filter(q => q.pinned)
    const r = list.filter(q => !q.pinned)
    return { pinned: p, regular: r }
  }, [questions])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-brand-text">Questions</h2>
        <Link
          href={`/qa/ask?communityId=${communityId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-text text-brand-bg text-xs font-bold hover:bg-brand-text/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Ask
        </Link>
      </div>

      {/* Popular topic chips */}
      {popularTopics && popularTopics.length > 0 && (
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-text/50 mb-2">
            Popular topics
          </p>
          <div className="flex flex-wrap gap-2">
            {popularTopics.map(t => (
              <Link
                key={t.id}
                href={`/qa/topics/${t.slug}`}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-bg border border-brand-divider text-xs font-medium text-brand-text/80 hover:border-brand-text/40 transition-colors"
              >
                <Hash className="w-3 h-3" />
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Pinned section */}
      {pinned.length > 0 && (
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-text/50 mb-2">
            Pinned
          </p>
          <div className="space-y-2">
            {pinned.map(q => (
              <CommunityQuestionRow
                key={q.id}
                q={q}
                isPinned
                canModerate={canModerate}
                onPin={() => pin.mutate(q.id)}
                onUnpin={() => unpin.mutate(q.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sort tabs */}
      <div className="flex gap-1 mb-3 border-b border-brand-divider">
        {([
          { key: 'new', label: 'New' },
          { key: 'top', label: 'Top' },
          { key: 'unanswered', label: 'Unanswered' },
        ] as { key: Sort; label: string }[]).map(s => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
              sort === s.key
                ? 'border-brand-text text-brand-text'
                : 'border-transparent text-brand-text/60 hover:text-brand-text'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-brand-text/50">Loading…</div>
      ) : regular.length === 0 ? (
        <div className="bg-white rounded-2xl border border-brand-divider p-8 text-center">
          <HelpCircle className="w-8 h-8 text-brand-text/20 mx-auto mb-2" />
          <p className="text-sm text-brand-text/50">No questions yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {regular.map(q => (
            <CommunityQuestionRow
              key={q.id}
              q={q}
              canModerate={canModerate}
              onPin={() => pin.mutate(q.id)}
              onUnpin={() => unpin.mutate(q.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CommunityQuestionRow({
  q,
  isPinned,
  canModerate,
  onPin,
  onUnpin,
}: {
  q: QuestionSummary
  isPinned?: boolean
  canModerate: boolean
  onPin: () => void
  onUnpin: () => void
}) {
  return (
    <div className="bg-white dark:bg-brand-bg/40 border border-brand-divider rounded-xl p-3 flex items-start gap-3 hover:border-brand-text/30 transition-colors">
      <div className="flex flex-col items-center gap-0.5 min-w-[40px] text-center text-[11px] text-brand-text/60">
        <span className="font-semibold text-brand-text">{q.vote_score ?? 0}</span>
        <span>votes</span>
        <span className="font-semibold text-brand-text mt-1">{q.answer_count ?? 0}</span>
        <span>ans</span>
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/qa/questions/${q.id}`}
          className="text-sm font-semibold text-brand-text hover:text-violet-600 line-clamp-2 inline-flex items-start gap-1"
        >
          {isPinned && <Pin className="w-3.5 h-3.5 mt-0.5 text-brand-text/40 shrink-0" />}
          <span>{q.title}</span>
        </Link>
        {q.tags && q.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {q.tags.slice(0, 4).map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-brand-bg text-brand-text/70 text-[10px]">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      {canModerate && (
        <button
          type="button"
          onClick={isPinned ? onUnpin : onPin}
          className="p-1.5 rounded-lg text-brand-text/50 hover:text-brand-text hover:bg-brand-bg transition-colors"
          aria-label={isPinned ? 'Unpin question' : 'Pin question'}
          title={isPinned ? 'Unpin question' : 'Pin question'}
        >
          {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
        </button>
      )}
      <Link
        href={`/qa/questions/${q.id}`}
        className="p-1.5 rounded-lg text-brand-text/50 hover:text-brand-text hover:bg-brand-bg transition-colors"
        aria-label="Open question"
      >
        <ArrowUpRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

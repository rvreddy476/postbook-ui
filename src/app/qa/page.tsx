'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSession } from '@/services/authService'
import {
  useQAAnswerQueue,
  useQATrending,
  useMyAnswerRequests,
  useQATopics,
  useMyQAProfile,
  useCreateQuestion,
  useFollowQuestion,
  useUnfollowQuestion,
} from '@/hooks/useQA'
import type { QuestionSummary, AnswerRequest } from '@/types/qa'
import {
  HelpCircle,
  TrendingUp,
  PenLine,
  X,
  Plus,
  Search,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  Bell,
  Link2,
  Flag,
  Clock,
  MoreHorizontal,
  BookOpen,
  MessageCircle,
  ThumbsDown,
  Pencil,
} from 'lucide-react'

type NavSection = 'for-you' | 'answer-requests' | 'drafts'

/* Ask Modal */
function AskModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const { data: topics } = useQATopics(false, 100)
  const createQuestion = useCreateQuestion()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags(prev => [...prev, t])
      setTagInput('')
    }
  }

  const toggleTopic = (id: string) =>
    setSelectedTopics(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : prev.length < 3 ? [...prev, id] : prev
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    try {
      const q = await createQuestion.mutateAsync({
        title: title.trim(),
        body: "",
        body_html: "",
        topic_ids: selectedTopics,
        tags,
      })
      onClose()
      router.push(`/qa/questions/${q.id}`)
    } catch { /* shown below */ }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-brand-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-divider sticky top-0 bg-brand-card rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-brand-text">Add Question</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Start your question with 'What', 'How', 'Why'…"
              className="w-full px-4 py-3 rounded-xl border border-brand-divider bg-brand-secondary text-brand-text placeholder-neutral-400 focus:outline-none focus:border-ask focus:ring-1 focus:ring-ask text-sm font-medium"
              maxLength={200}
            />
            <div className="mt-1 text-xs text-neutral-400 text-right">{title.length}/200</div>
          </div>

          {topics && topics.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Topics <span className="normal-case font-normal text-neutral-400">(up to 3)</span></p>
              <div className="flex flex-wrap gap-2">
                {topics.map(t => (
                  <button key={t.id} type="button" onClick={() => toggleTopic(t.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                      selectedTopics.includes(t.id)
                        ? 'bg-ask text-white border-ask'
                        : 'border-brand-divider text-neutral-600 dark:text-neutral-400 hover:border-ask hover:text-ask'
                    }`}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Tags <span className="normal-case font-normal text-neutral-400">(up to 5)</span></p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-ask-light text-ask text-xs font-medium">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            {tags.length < 5 && (
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder="Add a tag…"
                  className="flex-1 px-3 py-2 rounded-lg border border-brand-divider bg-brand-secondary text-sm text-brand-text focus:outline-none focus:border-ask"
                />
                <button type="button" onClick={addTag} className="px-3 py-2 rounded-lg border border-brand-divider hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                  <Plus className="w-4 h-4 text-neutral-500" />
                </button>
              </div>
            )}
          </div>
          {createQuestion.error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Failed to post question. Please try again.
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!title.trim() || createQuestion.isPending}
              className="px-6 py-2.5 bg-ask hover:bg-ask-hover disabled:opacity-50 text-white rounded-full font-semibold text-sm transition-all shadow-sm active:scale-[0.98]"
            >
              {createQuestion.isPending ? 'Posting…' : 'Post Question'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 border border-brand-divider text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl font-medium text-sm transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* Question Card */
function QuestionCard({ q, passed, onPass }: { q: QuestionSummary; passed: boolean; onPass: (id: string) => void }) {
  const router = useRouter()
  const [upvoted, setUpvoted] = useState(false)
  const [followed, setFollowed] = useState(q.is_following ?? false)
  const [voteScore, setVoteScore] = useState(q.vote_score)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const followQuestion = useFollowQuestion(q.id)
  const unfollowQuestion = useUnfollowQuestion(q.id)

  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  const handleUpvote = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    setVoteScore(s => upvoted ? s - 1 : s + 1)
    setUpvoted(v => !v)
  }

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (followed) { await unfollowQuestion.mutateAsync(); setFollowed(false) }
    else { await followQuestion.mutateAsync(); setFollowed(true) }
  }

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime(), h = Math.floor(diff / 36e5)
    if (h < 1) return 'just now'
    if (h < 24) return `${h}h`
    const days = Math.floor(h / 24)
    return days < 7 ? `${days}d` : new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }

  const name = q.author?.display_name || 'Anonymous'
  const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
  const palette = ['#E80B42', '#7c3aed', '#0ea5e9', '#16a34a', '#ea580c', '#0891b2']
  const avatarBg = palette[(name.charCodeAt(0) || 0) % palette.length]

  if (passed) return null

  return (
    <div className="bg-brand-card border border-brand-divider rounded-2xl p-4 mb-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: avatarBg }}>
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-text leading-tight">{name}</p>
            {(q.author?.expertise_areas?.[0] || q.author?.bio) && (
              <p className="text-xs text-neutral-500 leading-tight mt-0.5 max-w-[200px] truncate">
                {q.author?.expertise_areas?.slice(0, 2).join(' · ') || q.author?.bio}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {q.created_at && <span className="text-xs text-neutral-400">{timeAgo(q.created_at)}</span>}
          <button onClick={handleFollow}
            className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
              followed ? 'border-ask text-ask bg-ask-light' : 'border-brand-divider text-neutral-500 hover:border-ask hover:text-ask'
            }`}>
            {followed ? 'Following' : '+ Follow'}
          </button>
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); onPass(q.id) }}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Link href={`/qa/questions/${q.id}`}>
        <h3 className="text-[15px] font-bold text-brand-text leading-snug hover:text-ask transition-colors mb-2.5 line-clamp-3">
          {q.title}
        </h3>
      </Link>

      {q.tags && q.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {q.tags.slice(0, 4).map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 text-xs">{tag}</span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-0.5 pt-2.5 border-t border-brand-divider/60">
        <button onClick={handleUpvote}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            upvoted ? 'bg-ask-light text-ask' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}>
          <ChevronDown className="w-4 h-4 rotate-180" />
          {voteScore > 0 ? `Upvote · ${voteScore}` : 'Upvote'}
        </button>

        <button className="flex items-center justify-center w-8 h-8 rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          <ChevronDown className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-brand-divider mx-1" />

        <button onClick={() => router.push(`/qa/questions/${q.id}#answer`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          <PenLine className="w-3.5 h-3.5" />
          {q.answer_count > 0 ? q.answer_count : 'Answer'}
        </button>

        <button onClick={e => { e.preventDefault(); navigator.clipboard.writeText(`${window.location.origin}/qa/questions/${q.id}`) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          <Link2 className="w-3.5 h-3.5" /> Share
        </button>

        <div className="relative ml-auto" ref={menuRef}>
          <button onClick={e => { e.preventDefault(); setMenuOpen(v => !v) }}
            className="flex items-center justify-center w-8 h-8 rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 bottom-10 z-30 bg-brand-card border border-brand-divider rounded-xl shadow-xl w-48 py-1 text-sm">
              {[
                { icon: <Link2 className="w-4 h-4" />, label: 'Copy link', fn: () => { navigator.clipboard.writeText(`${window.location.origin}/qa/questions/${q.id}`); setMenuOpen(false) } },
                { icon: <Clock className="w-4 h-4" />, label: 'Answer later', fn: () => setMenuOpen(false) },
                { icon: <Bell className="w-4 h-4" />, label: 'Notify on edits', fn: () => setMenuOpen(false) },
                { icon: <Flag className="w-4 h-4" />, label: 'Report', fn: () => setMenuOpen(false) },
              ].map(item => (
                <button key={item.label} onClick={item.fn}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-brand-text/80 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                  <span className="text-neutral-400">{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function QuestionFeed({ questions, isLoading, passedIds, onPass }: {
  questions: QuestionSummary[] | undefined
  isLoading: boolean
  passedIds: Set<string>
  onPass: (id: string) => void
}) {
  if (isLoading) return (
    <div className="p-4 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-brand-card border border-brand-divider rounded-2xl p-4 animate-pulse">
          <div className="flex gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3" />
              <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
            </div>
          </div>
          <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-full mb-2" />
          <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-3" />
          <div className="flex gap-2 pt-2 border-t border-brand-divider/60">
            <div className="h-7 bg-neutral-200 dark:bg-neutral-700 rounded-full w-28" />
            <div className="h-7 bg-neutral-200 dark:bg-neutral-700 rounded-full w-8" />
          </div>
        </div>
      ))}
    </div>
  )

  const visible = questions?.filter(q => !passedIds.has(q.id))
  if (!visible?.length) return (
    <div className="text-center py-24 text-neutral-400">
      <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
      <p className="font-semibold text-base">All caught up!</p>
      <p className="text-sm mt-1">No more questions right now.</p>
    </div>
  )

  return (
    <div className="p-4 space-y-0">
      {visible.map(q => (
        <QuestionCard key={q.id} q={q} passed={passedIds.has(q.id)} onPass={onPass} />
      ))}
    </div>
  )
}

/* Answer Requests Feed */
function AnswerRequestCard({ req }: { req: AnswerRequest }) {
  return (
    <div className="bg-brand-card border-b border-brand-divider px-5 py-5">
      <div className="text-xs text-neutral-500 mb-2">Someone requested your answer</div>
      <Link href={`/qa/questions/${req.question_id}`}>
        <h3 className="text-[15px] font-semibold text-brand-text hover:text-ask transition-colors mb-3">
          {req.question_title || 'View question'}
        </h3>
      </Link>
      <div className="flex gap-2">
        <Link href={`/qa/questions/${req.question_id}#answer`}>
          <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-brand-divider text-sm font-semibold text-brand-text/80 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            <PenLine className="w-3.5 h-3.5" /> Answer
          </button>
        </Link>
        <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-brand-divider text-sm font-semibold text-brand-text/80 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
          <X className="w-3.5 h-3.5" /> Decline
        </button>
      </div>
    </div>
  )
}

/* Main Page */
export default function QAPage() {
  const router = useRouter()
  const [section, setSection] = useState<NavSection>('for-you')
  const [showAskModal, setShowAskModal] = useState(false)
  const [topicSearch, setTopicSearch] = useState('')
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set())

  const { data: answerQueue, isLoading: queueLoading } = useQAAnswerQueue()
  const { data: trendingData, isLoading: trendingLoading } = useQATrending()
  const { data: answerRequests, isLoading: requestsLoading } = useMyAnswerRequests()
  const { data: topics } = useQATopics(false, 50)
  const { data: myProfile } = useMyQAProfile()

  const handlePass = useCallback((id: string) => {
    setPassedIds(prev => new Set([...prev, id]))
  }, [])

  const filteredTopics = topics?.filter(t =>
    !topicSearch || t.name.toLowerCase().includes(topicSearch.toLowerCase())
  )

  const navItems: { key: NavSection; label: string; icon: React.ReactNode }[] = [
    { key: 'for-you',         label: 'Questions for you', icon: <HelpCircle className="w-4 h-4" /> },
    { key: 'answer-requests', label: 'Answer requests',   icon: <MessageCircle className="w-4 h-4" /> },
    { key: 'drafts',          label: 'Drafts',            icon: <BookOpen className="w-4 h-4" /> },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa] dark:bg-neutral-950 font-sans">

      {/* Left sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 h-full bg-brand-card border-r border-brand-divider overflow-y-auto">
        <div className="px-4 pt-5 pb-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors mb-4"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Feed
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-ask">
              <HelpCircle className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-black text-brand-text tracking-tight">Q&A</span>
          </div>
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={() => setShowAskModal(true)}
            className="w-[calc(100%-24px)] mx-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-semibold bg-ask hover:bg-ask-hover shadow-sm active:scale-[0.98] transition-all mt-3"
          >
            <Plus className="w-4 h-4" strokeWidth={3} /> Add Question
          </button>
        </div>

        <div className="px-3 pb-4 border-b border-brand-divider">
          <p className="px-2 text-[11px] font-black uppercase tracking-widest text-neutral-400 mb-1">Questions</p>
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                section === item.key
                  ? 'bg-ask-light text-ask font-semibold'
                  : 'text-brand-text/80 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              <span className={section === item.key ? 'text-ask' : 'text-neutral-400'}>{item.icon}</span>
              {item.label}
              {item.key === 'answer-requests' && answerRequests && answerRequests.length > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-ask text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {answerRequests.length}
                </span>
              )}
            </button>
          ))}
          <Link href="/qa/following" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-brand-text/80 hover:bg-neutral-50 dark:hover:bg-neutral-800">
            <span className="text-neutral-400"><Bell className="w-4 h-4" /></span>
            Following
          </Link>
          <Link href="/qa/trending" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-brand-text/80 hover:bg-neutral-50 dark:hover:bg-neutral-800">
            <span className="text-neutral-400"><TrendingUp className="w-4 h-4" /></span>
            Trending
          </Link>
          <Link href="/qa/unanswered" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-brand-text/80 hover:bg-neutral-50 dark:hover:bg-neutral-800">
            <span className="text-neutral-400"><HelpCircle className="w-4 h-4" /></span>
            Unanswered
          </Link>
          <Link href="/qa/saved" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-brand-text/80 hover:bg-neutral-50 dark:hover:bg-neutral-800">
            <span className="text-neutral-400"><BookOpen className="w-4 h-4" /></span>
            Saved
          </Link>
        </div>

        <div className="px-3 py-4 flex-1">
          <p className="px-2 text-[11px] font-black uppercase tracking-widest text-neutral-400 mb-2">Topics</p>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              value={topicSearch}
              onChange={e => setTopicSearch(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-brand-divider bg-brand-secondary text-xs text-brand-text/80 placeholder-neutral-400 focus:outline-none focus:border-ask"
            />
          </div>
          <div className="space-y-0.5">
            {filteredTopics?.map(topic => (
              <Link key={topic.id} href={`/qa/topics/${topic.slug}`}>
                <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[10px] font-black text-white bg-ask">
                    {topic.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-text/80 truncate group-hover:text-ask transition-colors">{topic.name}</p>
                    {topic.question_count > 0 && (
                      <p className="text-[10px] text-neutral-400">{topic.question_count} questions</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            {filteredTopics?.length === 0 && (
              <p className="text-xs text-neutral-400 px-2 py-3 text-center">No topics found</p>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="bg-brand-card border-b border-brand-divider sticky top-0 z-20 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-brand-text">
              {navItems.find(n => n.key === section)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/qa/search"
              aria-label="Search Q&A"
              className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              <Search className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setShowAskModal(true)}
              className="md:hidden flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-xs font-semibold bg-ask hover:bg-ask-hover shadow-sm active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Ask
            </button>
          </div>
        </div>

        {section === 'for-you' && (
          <QuestionFeed
            questions={answerQueue}
            isLoading={queueLoading}
            passedIds={passedIds}
            onPass={handlePass}
          />
        )}

        {section === 'answer-requests' && (
          <>
            {requestsLoading ? (
              <div className="px-5 py-5 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3 mb-3" />
                    <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-4" />
                  </div>
                ))}
              </div>
            ) : answerRequests?.length ? (
              answerRequests.map(req => <AnswerRequestCard key={req.id} req={req} />)
            ) : (
              <div className="text-center py-24 text-neutral-400">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-semibold text-base">No answer requests</p>
                <p className="text-sm mt-1">When someone requests your expertise, it&apos;ll appear here.</p>
              </div>
            )}
          </>
        )}

        {section === 'drafts' && (
          <div className="text-center py-24 text-neutral-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-base">No drafts yet</p>
            <p className="text-sm mt-1">Questions you save as drafts will appear here.</p>
          </div>
        )}
      </main>

      {/* Right sidebar */}
      <aside className="hidden lg:flex flex-col w-72 shrink-0 h-full border-l border-brand-divider bg-brand-card overflow-y-auto p-5">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-brand-text">Topics you know about</h3>
            <button className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>

          {myProfile?.expertise_areas && myProfile.expertise_areas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {myProfile.expertise_areas.map(area => (
                <span key={area} className="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-brand-text/80 text-xs font-medium">
                  {area}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <HelpCircle className="w-7 h-7 text-neutral-400" />
              </div>
              <p className="text-sm font-semibold text-brand-text/80 mb-1">No topics yet</p>
              <p className="text-xs text-neutral-400 mb-3">You&apos;ll get better questions if you add more specific topics.</p>
              <Link href="/qa/profile/me">
                <button className="px-5 py-2 rounded-full border-2 border-ask text-ask text-sm font-semibold hover:bg-ask-light transition-colors">
                  Add topics
                </button>
              </Link>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-neutral-500" />
            <h3 className="text-sm font-bold text-brand-text">Trending</h3>
          </div>
          {trendingLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
              ))}
            </div>
          ) : trendingData?.slice(0, 5).map(q => (
            <Link key={q.id} href={`/qa/questions/${q.id}`}>
              <div className="py-2.5 border-b border-brand-divider last:border-0">
                <p className="text-sm text-brand-text/80 hover:text-ask transition-colors line-clamp-2 leading-snug">
                  {q.title}
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">{q.answer_count} answers</p>
              </div>
            </Link>
          ))}
        </div>
      </aside>

      {showAskModal && <AskModal onClose={() => setShowAskModal(false)} />}
    </div>
  )
}

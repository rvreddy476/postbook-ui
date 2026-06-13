'use client'

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useCreateQuestion,
  useSimilarQuestions,
  useQATopics,
  useCommunityQASettings,
  useCommunityPopularTopics,
  useUpsertQuestionDraft,
  useQuestionDraft,
} from '@/hooks/useQA'
import { useMyCommunities } from '@/hooks/useCommunities'
import {
  HelpCircle,
  X,
  Plus,
  AlertCircle,
  EyeOff,
  Save,
  FileText,
} from 'lucide-react'

function AskQuestionPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftIdParam = searchParams.get('draftId') || undefined

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showSimilar, setShowSimilar] = useState(false)
  const [communityId, setCommunityId] = useState<string>('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [draftId, setDraftId] = useState<string | undefined>(draftIdParam)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const { data: topics } = useQATopics(false, 100)
  const { data: similar } = useSimilarQuestions(title)
  const { data: myCommunities } = useMyCommunities()
  const { data: qaSettings } = useCommunityQASettings(communityId || undefined)
  const { data: popularTopics } = useCommunityPopularTopics(
    communityId && qaSettings?.auto_suggest_topics ? communityId : undefined,
  )
  const { data: existingDraft } = useQuestionDraft(draftIdParam)

  const createQuestion = useCreateQuestion()
  const upsertDraft = useUpsertQuestionDraft()

  // Pre-populate from draft if ?draftId is provided
  const draftLoadedRef = useRef(false)
  useEffect(() => {
    if (existingDraft && !draftLoadedRef.current) {
      draftLoadedRef.current = true
      setTitle(existingDraft.title || '')
      setBody(existingDraft.body || '')
      setSelectedTopics(existingDraft.topic_ids || [])
      setTags(existingDraft.tags || [])
      setCommunityId(existingDraft.community_id || '')
      setIsAnonymous(Boolean(existingDraft.is_anonymous))
      setDraftId(existingDraft.id)
    }
  }, [existingDraft])

  useEffect(() => {
    setShowSimilar(title.length >= 15 && (similar?.length ?? 0) > 0)
  }, [title, similar])

  // Auto-save draft (debounced 1.5s)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!title.trim() && !body.trim()) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setDraftStatus('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        const saved = await upsertDraft.mutateAsync({
          id: draftId,
          title: title.trim(),
          body: body.trim(),
          body_html: body.trim() ? `<p>${body.trim()}</p>` : '',
          topic_ids: selectedTopics,
          tags,
          community_id: communityId || undefined,
          is_anonymous: isAnonymous,
        })
        if (saved?.id && !draftId) setDraftId(saved.id)
        setDraftStatus('saved')
      } catch {
        setDraftStatus('idle')
      }
    }, 1500)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, selectedTopics, tags, communityId, isAnonymous])

  const qaEnabled = communityId ? qaSettings?.qa_enabled !== false : true
  const anonymityAllowed = communityId ? qaSettings?.anonymity_enabled !== false : true

  // If anonymity becomes disallowed, force off
  useEffect(() => {
    if (!anonymityAllowed && isAnonymous) setIsAnonymous(false)
  }, [anonymityAllowed, isAnonymous])

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags([...tags, t])
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag))

  const toggleTopic = (id: string) => {
    setSelectedTopics(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : prev.length < 3 ? [...prev, id] : prev
    )
  }

  const suggestedTopicChips = useMemo(() => {
    if (!popularTopics?.length) return []
    return popularTopics.filter(t => !selectedTopics.includes(t.id)).slice(0, 8)
  }, [popularTopics, selectedTopics])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    if (!qaEnabled) return
    try {
      const q = await createQuestion.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        body_html: `<p>${body.trim()}</p>`,
        topic_ids: selectedTopics,
        tags,
        community_id: communityId || undefined,
        is_anonymous: isAnonymous || undefined,
      })
      router.push(`/qa/questions/${q.id}`)
    } catch {
      // error shown via createQuestion.error
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-6 h-6 text-ask" />
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Ask a Question</h1>
          </div>
          <Link
            href="/qa/drafts"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Drafts
          </Link>
        </div>

        {/* Tips */}
        <div className="bg-ask-light dark:bg-ask-light border border-ask/20 dark:border-ask/30 rounded-xl p-4 mb-6 text-sm text-ask dark:text-ask/60">
          <p className="font-semibold mb-1">Writing a good question</p>
          <ul className="list-disc list-inside space-y-0.5 text-ask dark:text-ask/70">
            <li>Summarize your problem in the title</li>
            <li>Describe what you tried and what happened</li>
            <li>Add relevant topics and tags to reach the right experts</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Community selector */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Community <span className="text-neutral-400">(optional)</span>
            </label>
            <select
              value={communityId}
              onChange={e => setCommunityId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-ask focus:ring-1 focus:ring-ask text-sm"
            >
              <option value="">No community (post to general feed)</option>
              {myCommunities?.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {communityId && qaSettings && !qaEnabled && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Q&A is disabled in this community. Pick another community or post to the general feed.
              </div>
            )}
            {communityId && qaSettings?.welcome_message && qaEnabled && (
              <div className="mt-2 text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2">
                {qaSettings.welcome_message}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. How do I implement rate limiting in Go?"
              className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-ask focus:ring-1 focus:ring-ask text-sm"
              maxLength={200}
            />
            <div className="mt-1 text-xs text-neutral-400 text-right">{title.length}/200</div>
          </div>

          {/* Similar questions warning */}
          {showSimilar && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                <AlertCircle className="w-4 h-4" />
                Similar questions already exist
              </div>
              <ul className="space-y-1">
                {similar?.map(q => (
                  <li key={q.id}>
                    <a href={`/qa/questions/${q.id}`} className="text-sm text-ask hover:underline dark:text-ask/70" target="_blank" rel="noreferrer">
                      {q.title}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Make sure your question isn&apos;t already answered above before continuing.</p>
            </div>
          )}

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Body <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Describe your question in detail. Include what you've tried, what you expected, and what actually happened."
              rows={10}
              className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-ask focus:ring-1 focus:ring-ask text-sm resize-y"
            />
          </div>

          {/* Suggested topics from community */}
          {suggestedTopicChips.length > 0 && (
            <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 px-3 py-2.5">
              <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-2">
                Popular topics in this community
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedTopicChips.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTopic(t.id)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-neutral-900 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                  >
                    + {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Topics */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Topics <span className="text-neutral-400">(up to 3)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {topics?.map(topic => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => toggleTopic(topic.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedTopics.includes(topic.id)
                      ? 'bg-ask text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-ask-light dark:hover:bg-ask-light'
                  }`}
                >
                  {topic.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Tags <span className="text-neutral-400">(up to 5)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-ask-light dark:bg-ask-light text-ask dark:text-ask/60 text-xs">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            {tags.length < 5 && (
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder="e.g. golang, performance"
                  className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-ask"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Anonymity toggle */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 dark:border-neutral-800 px-4 py-3">
            <div className="flex items-start gap-3">
              <EyeOff className="w-4 h-4 text-neutral-500 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  Ask anonymously
                </div>
                <div className="text-xs text-neutral-500">
                  {anonymityAllowed
                    ? 'Your name and avatar will be hidden on this question.'
                    : 'Anonymous posting is disabled in this community.'}
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isAnonymous}
              disabled={!anonymityAllowed}
              onClick={() => setIsAnonymous(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isAnonymous ? 'bg-ask' : 'bg-neutral-300 dark:bg-neutral-700'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAnonymous ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Draft status */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Save className="w-3.5 h-3.5" />
            {draftStatus === 'saving' && 'Saving draft…'}
            {draftStatus === 'saved' && 'Draft saved'}
            {draftStatus === 'idle' && (draftId ? 'Draft loaded' : 'Drafts auto-save as you type')}
          </div>

          {createQuestion.error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              Failed to post question. Please try again.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!title.trim() || !body.trim() || !qaEnabled || createQuestion.isPending}
              className="px-6 py-2.5 bg-ask hover:bg-ask-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
            >
              {createQuestion.isPending ? 'Posting...' : 'Post Question'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg font-medium text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}

export default function AskQuestionPage() {
  return (
    <Suspense fallback={null}>
      <AskQuestionPageInner />
    </Suspense>
  )
}

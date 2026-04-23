'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useCreateQuestion, useSimilarQuestions, useQATopics } from '@/hooks/useQA'
import { HelpCircle, X, Plus, AlertCircle } from 'lucide-react'

export default function AskQuestionPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showSimilar, setShowSimilar] = useState(false)

  const { data: topics } = useQATopics(false, 100)
  const { data: similar } = useSimilarQuestions(title)
  const createQuestion = useCreateQuestion()

  useEffect(() => {
    setShowSimilar(title.length >= 15 && (similar?.length ?? 0) > 0)
  }, [title, similar])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    try {
      const q = await createQuestion.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        body_html: `<p>${body.trim()}</p>`,
        topic_ids: selectedTopics,
        tags,
      })
      router.push(`/qa/questions/${q.id}`)
    } catch {
      // error shown via createQuestion.error
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <HelpCircle className="w-6 h-6 text-ask" />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Ask a Question</h1>
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
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Make sure your question isn't already answered above before continuing.</p>
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

          {createQuestion.error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              Failed to post question. Please try again.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!title.trim() || !body.trim() || createQuestion.isPending}
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

'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useQuestion, useAnswers, useAnswerComments,
  useCreateAnswer, useCreateComment, useDeleteComment,
  useVoteQuestion, useRemoveQuestionVote,
  useVoteAnswer,
  useSelectBestAnswer,
  useFollowQuestion, useUnfollowQuestion,
  useSaveQuestion, useUnsaveQuestion,
} from '@/hooks/useQA'
import type { Answer, AnswerComment } from '@/types/qa'
import {
  ChevronUp, ChevronDown, MessageSquare, Bookmark, Bell, Share2,
  CheckCircle, Tag, Eye, Clock, MoreHorizontal, Send, Star, ThumbsUp, ThumbsDown
} from 'lucide-react'

// --- Comment thread ---
function CommentThread({ answerId, initialCount }: { answerId: string; initialCount: number }) {
  const [expanded, setExpanded] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const { data: comments } = useAnswerComments(expanded ? answerId : undefined)
  const createComment = useCreateComment(answerId)
  const deleteComment = useDeleteComment(answerId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentBody.trim()) return
    await createComment.mutateAsync(commentBody.trim())
    setCommentBody('')
  }

  return (
    <div className="mt-3 border-t border-brand-divider pt-3">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-brand-text/50 hover:text-ask transition-colors"
        >
          {initialCount > 0 ? `Show ${initialCount} comment${initialCount > 1 ? 's' : ''}` : 'Add comment'}
        </button>
      ) : (
        <div className="space-y-2">
          {comments?.map((c: AnswerComment) => (
            <div key={c.id} className="flex gap-2 group">
              <div className="flex-1 text-xs text-brand-text/80">
                <span className="font-medium text-ask dark:text-ask/70 mr-1">
                  {c.author?.display_name || 'Anonymous'}
                </span>
                {c.body}
              </div>
              <button
                onClick={() => deleteComment.mutate(c.id)}
                className="opacity-0 group-hover:opacity-100 text-xs text-neutral-400 hover:text-red-500 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
          <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
            <input
              value={commentBody}
              onChange={e => setCommentBody(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-brand-divider bg-brand-card text-brand-text focus:outline-none focus:border-ask"
            />
            <button
              type="submit"
              disabled={!commentBody.trim() || createComment.isPending}
              className="p-1.5 text-ask hover:text-ask disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// --- Answer card ---
function AnswerCard({
  answer,
  questionId,
  questionAuthorId,
  currentUserId,
}: {
  answer: Answer
  questionId: string
  questionAuthorId: string
  currentUserId?: string
}) {
  const voteAnswer = useVoteAnswer(answer.id, questionId)
  const selectBest = useSelectBestAnswer(questionId)

  const isQuestionAuthor = currentUserId === questionAuthorId

  return (
    <div className={`p-5 rounded-xl border ${answer.is_best ? 'border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-900/10' : 'border-brand-divider bg-brand-card'}`}>
      {/* Top: Author Info */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0 overflow-hidden">
            <span className="text-xl font-bold text-brand-text/50">
              {answer.author?.display_name?.charAt(0)?.toUpperCase() || 'A'}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-bold text-brand-text">
                {answer.author?.display_name || 'Anonymous'}
              </span>
              <span className="text-brand-text/50">·</span>
              <button className="text-ask hover:underline font-semibold">Follow</button>
            </div>
            <div className="flex items-center gap-1 text-xs text-brand-text/50">
              <span className="truncate max-w-[200px]">{answer.author?.bio || 'Contributor'}</span>
              <span>·</span>
              <span>{new Date(answer.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </div>
        {/* Best Answer Badge or More Menu */}
        {answer.is_best ? (
          <div className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
            <CheckCircle className="w-3.5 h-3.5" /> Best
          </div>
        ) : isQuestionAuthor && !answer.is_best ? (
          <button
            onClick={() => selectBest.mutate(answer.id)}
            className="text-xs text-brand-text/50 hover:text-green-600 transition-colors flex items-center gap-1"
          >
            <Star className="w-3.5 h-3.5" /> Mark Best
          </button>
        ) : null}
      </div>

      {/* Content */}
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-brand-text mb-4"
        dangerouslySetInnerHTML={{ __html: answer.body_html || answer.body }}
      />
      
      {answer.references && answer.references.length > 0 && (
        <div className="mb-4 mt-2 p-3 bg-brand-secondary/50 rounded-lg text-xs border border-brand-divider">
          <p className="font-semibold text-brand-text/80 mb-1">References</p>
          <ul className="space-y-1">
            {answer.references.map(ref => (
              <li key={ref.id} className="truncate">
                <a href={ref.url} target="_blank" rel="noreferrer" className="text-ask hover:underline dark:text-ask/80">
                  {ref.title || ref.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <div className="flex items-center rounded-full border border-brand-divider/60 bg-brand-secondary/50 overflow-hidden">
          <button
            onClick={() => voteAnswer.mutate('up')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold transition-colors ${answer.viewer_vote === 'up' ? 'text-ask bg-ask-light dark:bg-ask-light/20' : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
          >
            <ThumbsUp className="w-4 h-4" />
            Like {answer.vote_score > 0 ? `· ${answer.vote_score}` : ''}
          </button>
          <div className="w-[1px] h-5 bg-neutral-300 dark:bg-neutral-600" />
          <button
            onClick={() => voteAnswer.mutate('down')}
            className={`px-3 py-1.5 transition-colors ${answer.viewer_vote === 'down' ? 'text-red-500 bg-red-100 dark:bg-red-900/30' : 'text-brand-text/50 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
        </div>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-brand-divider/60 font-medium text-neutral-600 dark:text-neutral-300 hover:bg-brand-secondary transition-colors">
          <MessageSquare className="w-4 h-4" />
          {answer.comment_count > 0 ? answer.comment_count : ''}
        </button>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-brand-divider/60 font-medium text-neutral-600 dark:text-neutral-300 hover:bg-brand-secondary transition-colors">
          <Share2 className="w-4 h-4" />
        </button>

        <button className="ml-auto w-8 h-8 flex items-center justify-center rounded-full border border-brand-divider/60 text-brand-text/50 hover:bg-brand-secondary transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <CommentThread answerId={answer.id} initialCount={answer.comment_count} />
    </div>
  )
}

// --- Main page ---
export default function QuestionDetailPage() {
  const params = useParams()
  const questionId = params.id as string
  const [answerBody, setAnswerBody] = useState('')
  const [answerSort, setAnswerSort] = useState<'votes' | 'newest'>('votes')

  const { data: question, isLoading } = useQuestion(questionId)
  const { data: answers, isLoading: answersLoading } = useAnswers(questionId, answerSort)
  const createAnswer = useCreateAnswer(questionId)
  const voteQuestion = useVoteQuestion(questionId)
  const removeQuestionVote = useRemoveQuestionVote(questionId)
  const followQuestion = useFollowQuestion(questionId)
  const unfollowQuestion = useUnfollowQuestion(questionId)
  const saveQuestion = useSaveQuestion(questionId)
  const unsaveQuestion = useUnsaveQuestion(questionId)

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!answerBody.trim()) return
    await createAnswer.mutateAsync({
      body: answerBody.trim(),
      body_html: `<p>${answerBody.trim()}</p>`,
    })
    setAnswerBody('')
  }

  const handleVote = (type: 'up' | 'down') => {
    if (question?.viewer_vote === type) {
      removeQuestionVote.mutate()
    } else {
      voteQuestion.mutate(type)
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto px-4 py-6 animate-pulse space-y-4">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
          <div className="h-40 bg-neutral-200 dark:bg-neutral-700 rounded" />
        </div>
      </AppShell>
    )
  }

  if (!question) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-brand-text/50">
          Question not found.
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Question */}
        <div>
          <h1 className="text-xl font-bold text-brand-text mb-3">{question.title}</h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-text/50 mb-4">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Asked {new Date(question.created_at).toLocaleDateString()}</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{question.view_count} views</span>
            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{question.answer_count} answers</span>
          </div>

          <div className="flex gap-4">
            {/* Vote column */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <button
                onClick={() => handleVote('up')}
                className={`p-1.5 rounded-lg transition-colors ${question.viewer_vote === 'up' ? 'text-ask bg-ask-light dark:bg-ask-light' : 'text-neutral-400 hover:text-ask hover:bg-ask-light dark:hover:bg-violet-900/20'}`}
              >
                <ThumbsUp className="w-5 h-5" />
              </button>
              <span className="text-xl font-bold text-brand-text">{question.vote_score}</span>
              <button
                onClick={() => handleVote('down')}
                className={`p-1.5 rounded-lg transition-colors ${question.viewer_vote === 'down' ? 'text-red-500 bg-red-100 dark:bg-red-900/30' : 'text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
              >
                <ThumbsDown className="w-5 h-5" />
              </button>
              <div className="mt-3 flex flex-col items-center gap-2">
                <button
                  onClick={() => question.is_saved ? unsaveQuestion.mutate() : saveQuestion.mutate()}
                  className={`p-1.5 rounded-lg transition-colors ${question.is_saved ? 'text-amber-500' : 'text-neutral-400 hover:text-amber-500'}`}
                  title={question.is_saved ? 'Unsave' : 'Save'}
                >
                  <Bookmark className="w-4 h-4" />
                </button>
                <button
                  onClick={() => question.is_following ? unfollowQuestion.mutate() : followQuestion.mutate()}
                  className={`p-1.5 rounded-lg transition-colors ${question.is_following ? 'text-ask' : 'text-neutral-400 hover:text-ask'}`}
                  title={question.is_following ? 'Unfollow' : 'Follow'}
                >
                  <Bell className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 transition-colors"
                  title="Copy link"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-w-0">


              {/* Topics & tags */}
              <div className="flex flex-wrap gap-2 mt-4">
                {question.topics?.map(t => (
                  <Link key={t.id} href={`/qa/topics/${t.slug}`}>
                    <span className="px-2.5 py-1 rounded-lg bg-ask-light dark:bg-ask-light text-ask dark:text-ask/60 text-xs font-medium hover:bg-violet-200 transition-colors cursor-pointer">
                      {t.name}
                    </span>
                  </Link>
                ))}
                {question.tags?.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-secondary/80 text-neutral-600 dark:text-neutral-400 text-xs">
                    <Tag className="w-3 h-3" />{tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-brand-divider text-xs text-brand-text/50">
                {question.author && (
                  <span>asked by <span className="text-ask dark:text-ask/70 font-medium">{question.author.display_name || 'Anonymous'}</span></span>
                )}
                <button className="ml-auto p-1 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Answers header */}
        <div className="flex items-center justify-between border-b border-brand-divider pb-3">
          <h2 className="font-semibold text-brand-text">
            {question.answer_count} Answer{question.answer_count !== 1 ? 's' : ''}
          </h2>
          <div className="flex gap-1">
            {(['votes', 'newest'] as const).map(s => (
              <button
                key={s}
                onClick={() => setAnswerSort(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  answerSort === s
                    ? 'bg-ask text-white'
                    : 'text-brand-text/50 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                {s === 'votes' ? 'Top' : 'Newest'}
              </button>
            ))}
          </div>
        </div>

        {/* Answers list */}
        {answersLoading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-brand-card border border-brand-divider rounded-xl p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-8 space-y-2">
                    <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded" />
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded" />
                    <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full" />
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-4/5" />
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {answers?.map(answer => (
              <AnswerCard
                key={answer.id}
                answer={answer}
                questionId={question.id}
                questionAuthorId={question.author_id}
              />
            ))}
            {!answers?.length && (
              <div className="text-center py-8 text-brand-text/50 text-sm">
                No answers yet. Be the first to answer!
              </div>
            )}
          </div>
        )}

        {/* Write answer */}
        <div className="bg-brand-card border border-brand-divider rounded-xl p-5">
          <h3 className="font-semibold text-brand-text mb-3">Your Answer</h3>
          <form onSubmit={handleAnswerSubmit} className="space-y-3">
            <textarea
              value={answerBody}
              onChange={e => setAnswerBody(e.target.value)}
              placeholder="Write a detailed answer. Include code snippets, steps, or references where helpful."
              rows={8}
              className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-ask focus:ring-1 focus:ring-ask resize-y"
            />
            {createAnswer.error && (
              <p className="text-xs text-red-600 dark:text-red-400">Failed to post answer. Please try again.</p>
            )}
            <button
              type="submit"
              disabled={!answerBody.trim() || createAnswer.isPending}
              className="px-5 py-2 bg-ask hover:bg-ask-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
            >
              {createAnswer.isPending ? 'Posting...' : 'Post Answer'}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  )
}

"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type {
  Question,
  QuestionSummary,
  QATopic,
  Answer,
  AnswerComment,
  QAProfile,
  ReputationEvent,
  ContributorBadge,
  ModerationReport,
  AnswerRequest,
  QAListResponse,
  QASingleResponse,
} from "@/types/qa"

// ---- Feeds ----

export function useQAHomeFeed(limit = 20) {
  return useQuery({
    queryKey: ["qa-home"],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QuestionSummary>>("/v1/qa/feed/home", { params: { limit } })
      return res.data.data
    },
    staleTime: 30_000,
  })
}

export function useQATrending(limit = 20) {
  return useQuery({
    queryKey: ["qa-trending"],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QuestionSummary>>("/v1/qa/feed/trending", { params: { limit } })
      return res.data.data
    },
    staleTime: 60_000,
  })
}

export function useQAUnanswered(topicId?: string, limit = 20) {
  return useQuery({
    queryKey: ["qa-unanswered", topicId],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QuestionSummary>>("/v1/qa/feed/unanswered", {
        params: { limit, topic_id: topicId },
      })
      return res.data.data
    },
    staleTime: 60_000,
  })
}

export function useQAFollowingFeed(limit = 20) {
  return useQuery({
    queryKey: ["qa-following"],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QuestionSummary>>("/v1/qa/feed/following", { params: { limit } })
      return res.data.data
    },
    staleTime: 30_000,
  })
}

export function useQAForYouFeed(limit = 20) {
  return useQuery({
    queryKey: ["qa-for-you"],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QuestionSummary>>("/v1/qa/feed/for-you", { params: { limit } })
      return res.data.data
    },
    staleTime: 30_000,
  })
}

export function useQAAnswerQueue(limit = 20) {
  return useQuery({
    queryKey: ["qa-answer-queue"],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QuestionSummary>>("/v1/qa/feed/answer-queue", { params: { limit } })
      return res.data.data
    },
    staleTime: 30_000,
  })
}

// ---- Questions ----

export function useQuestion(id: string | undefined) {
  return useQuery({
    queryKey: ["qa-question", id],
    queryFn: async () => {
      const res = await api.get<QASingleResponse<Question>>(`/v1/qa/questions/${id}`)
      return res.data.data
    },
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useQuestionBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["qa-question-slug", slug],
    queryFn: async () => {
      const res = await api.get<QASingleResponse<Question>>(`/v1/qa/questions/slug/${slug}`)
      return res.data.data
    },
    enabled: !!slug,
    staleTime: 30_000,
  })
}

export function useSimilarQuestions(title: string) {
  return useQuery({
    queryKey: ["qa-similar", title],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QuestionSummary>>("/v1/qa/questions/similar", {
        params: { title, limit: 5 },
      })
      return res.data.data
    },
    enabled: title.length >= 10,
    staleTime: 60_000,
  })
}

export function useMyQuestions(limit = 20) {
  return useQuery({
    queryKey: ["qa-my-questions"],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QuestionSummary>>("/v1/qa/questions/my", { params: { limit } })
      return res.data.data
    },
    staleTime: 30_000,
  })
}

export function useUserQuestions(userId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["qa-user-questions", userId],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QuestionSummary>>(`/v1/qa/profile/${userId}/questions`, {
        params: { limit },
      })
      return res.data.data
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}

export function useCreateQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      title: string
      body: string
      body_html: string
      topic_ids: string[]
      tags: string[]
      visibility?: string
      language?: string
    }) => {
      const res = await api.post<QASingleResponse<Question>>("/v1/qa/questions", params)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-home"] })
      qc.invalidateQueries({ queryKey: ["qa-my-questions"] })
    },
  })
}

export function useUpdateQuestion(questionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { title?: string; body?: string; body_html?: string }) => {
      const res = await api.put<QASingleResponse<Question>>(`/v1/qa/questions/${questionId}`, params)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-question", questionId] })
    },
  })
}

export function useDeleteQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (questionId: string) => {
      await api.delete(`/v1/qa/questions/${questionId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-home"] })
      qc.invalidateQueries({ queryKey: ["qa-my-questions"] })
    },
  })
}

export function useVoteQuestion(questionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (voteType: "up" | "down") => {
      await api.post(`/v1/qa/questions/${questionId}/vote`, { vote_type: voteType })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-question", questionId] }),
  })
}

export function useRemoveQuestionVote(questionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/v1/qa/questions/${questionId}/vote`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-question", questionId] }),
  })
}

export function useFollowQuestion(questionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post(`/v1/qa/questions/${questionId}/follow`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-question", questionId] }),
  })
}

export function useUnfollowQuestion(questionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/v1/qa/questions/${questionId}/follow`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-question", questionId] }),
  })
}

export function useSaveQuestion(questionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => api.post(`/v1/qa/questions/${questionId}/save`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-question", questionId] }),
  })
}

export function useUnsaveQuestion(questionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => api.delete(`/v1/qa/questions/${questionId}/save`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-question", questionId] }),
  })
}

// ---- Answers ----

export function useAnswers(questionId: string | undefined, sort = "votes") {
  return useQuery({
    queryKey: ["qa-answers", questionId, sort],
    queryFn: async () => {
      const res = await api.get<QAListResponse<Answer>>(`/v1/qa/questions/${questionId}/answers`, {
        params: { sort },
      })
      return res.data.data
    },
    enabled: !!questionId,
    staleTime: 30_000,
  })
}

export function useCreateAnswer(questionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { body: string; body_html: string }) => {
      const res = await api.post<QASingleResponse<Answer>>(`/v1/qa/questions/${questionId}/answers`, params)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-answers", questionId] })
      qc.invalidateQueries({ queryKey: ["qa-question", questionId] })
    },
  })
}

export function useUpdateAnswer(answerId: string, questionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { body: string; body_html: string }) => {
      const res = await api.put<QASingleResponse<Answer>>(`/v1/qa/answers/${answerId}`, params)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-answers", questionId] }),
  })
}

export function useDeleteAnswer(questionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (answerId: string) => {
      await api.delete(`/v1/qa/answers/${answerId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-answers", questionId] }),
  })
}

export function useSelectBestAnswer(questionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (answerId: string) => {
      await api.post(`/v1/qa/questions/${questionId}/best-answer`, { answer_id: answerId })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-answers", questionId] })
      qc.invalidateQueries({ queryKey: ["qa-question", questionId] })
    },
  })
}

export function useVoteAnswer(answerId: string, questionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (voteType: "up" | "down") => {
      await api.post(`/v1/qa/answers/${answerId}/vote`, { vote_type: voteType })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-answers", questionId] }),
  })
}

// ---- Comments ----

export function useAnswerComments(answerId: string | undefined) {
  return useQuery({
    queryKey: ["qa-comments", answerId],
    queryFn: async () => {
      const res = await api.get<QAListResponse<AnswerComment>>(`/v1/qa/answers/${answerId}/comments`)
      return res.data.data
    },
    enabled: !!answerId,
    staleTime: 30_000,
  })
}

export function useCreateComment(answerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) => {
      const res = await api.post<QASingleResponse<AnswerComment>>(`/v1/qa/answers/${answerId}/comments`, { body })
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-comments", answerId] }),
  })
}

export function useDeleteComment(answerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => {
      await api.delete(`/v1/qa/comments/${commentId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-comments", answerId] }),
  })
}

// ---- Topics ----

export function useQATopics(featuredOnly = false, limit = 50) {
  return useQuery({
    queryKey: ["qa-topics", featuredOnly],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QATopic>>("/v1/qa/topics", {
        params: { featured: featuredOnly, limit },
      })
      return res.data.data
    },
    staleTime: 120_000,
  })
}

export function useQATopic(slug: string | undefined) {
  return useQuery({
    queryKey: ["qa-topic", slug],
    queryFn: async () => {
      const res = await api.get<QASingleResponse<QATopic>>(`/v1/qa/topics/slug/${slug}`)
      return res.data.data
    },
    enabled: !!slug,
    staleTime: 60_000,
  })
}

export function useTopicQuestions(topicId: string | undefined, sort = "newest", limit = 20) {
  return useQuery({
    queryKey: ["qa-topic-questions", topicId, sort],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QuestionSummary>>(`/v1/qa/topics/${topicId}/questions`, {
        params: { sort, limit },
      })
      return res.data.data
    },
    enabled: !!topicId,
    staleTime: 30_000,
  })
}

export function useTopicTopContributors(topicId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ["qa-topic-contributors", topicId],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QAProfile>>(`/v1/qa/topics/${topicId}/contributors`, {
        params: { limit },
      })
      return res.data.data
    },
    enabled: !!topicId,
    staleTime: 300_000,
  })
}

export function useFollowTopic(topicId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => api.post(`/v1/qa/topics/${topicId}/follow`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-topic"] })
      qc.invalidateQueries({ queryKey: ["qa-topics"] })
    },
  })
}

export function useUnfollowTopic(topicId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => api.delete(`/v1/qa/topics/${topicId}/follow`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-topic"] })
      qc.invalidateQueries({ queryKey: ["qa-topics"] })
    },
  })
}

// ---- Profile ----

export function useMyQAProfile() {
  return useQuery({
    queryKey: ["qa-my-profile"],
    queryFn: async () => {
      const res = await api.get<QASingleResponse<QAProfile>>("/v1/qa/profile")
      return res.data.data
    },
    staleTime: 60_000,
  })
}

export function useQAUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["qa-profile", userId],
    queryFn: async () => {
      const res = await api.get<QASingleResponse<QAProfile>>(`/v1/qa/profile/${userId}`)
      return res.data.data
    },
    enabled: !!userId,
    staleTime: 60_000,
  })
}

export function useQALeaderboard(topicId?: string, limit = 20) {
  return useQuery({
    queryKey: ["qa-leaderboard", topicId],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QAProfile>>("/v1/qa/leaderboard", {
        params: { limit, topic_id: topicId },
      })
      return res.data.data
    },
    staleTime: 300_000,
  })
}

export function useReputationHistory(userId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["qa-reputation", userId],
    queryFn: async () => {
      const res = await api.get<QAListResponse<ReputationEvent>>(`/v1/qa/profile/${userId}/reputation`, {
        params: { limit },
      })
      return res.data.data
    },
    enabled: !!userId,
    staleTime: 60_000,
  })
}

export function useContributorBadges(userId: string | undefined) {
  return useQuery({
    queryKey: ["qa-badges", userId],
    queryFn: async () => {
      const res = await api.get<QAListResponse<ContributorBadge>>(`/v1/qa/profile/${userId}/badges`)
      return res.data.data
    },
    enabled: !!userId,
    staleTime: 300_000,
  })
}

// ---- Reports ----

export function useCreateQAReport() {
  return useMutation({
    mutationFn: async (params: {
      target_type: string
      target_id: string
      reason: string
      details?: string
    }) => {
      const res = await api.post<QASingleResponse<ModerationReport>>("/v1/qa/reports", {
        ...params,
        details: params.details ?? "",
      })
      return res.data.data
    },
  })
}

// ---- Answer Requests ----

export function useMyAnswerRequests(limit = 20) {
  return useQuery({
    queryKey: ["qa-answer-requests"],
    queryFn: async () => {
      const res = await api.get<QAListResponse<AnswerRequest>>("/v1/qa/answer-requests", { params: { limit } })
      return res.data.data
    },
    staleTime: 60_000,
  })
}

export function useCreateAnswerRequest(questionId: string) {
  return useMutation({
    mutationFn: async (params: { target_user_id: string }) =>
      api.post(`/v1/qa/questions/${questionId}/request-answer`, params),
  })
}

export function useRespondToAnswerRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ requestId, response }: { requestId: string; response: "accept" | "decline" }) =>
      api.post(`/v1/qa/answer-requests/${requestId}/respond`, { response }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-answer-requests"] }),
  })
}

// ---- Local feed ----

export function useQALocalFeed(limit = 20) {
  return useQuery({
    queryKey: ["qa-local"],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QuestionSummary>>("/v1/qa/feed/local", { params: { limit } })
      return res.data.data
    },
    staleTime: 60_000,
  })
}

// ---- Followed topics ----

export function useFollowedTopics() {
  return useQuery({
    queryKey: ["qa-topics-following"],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QATopic>>("/v1/qa/topics/following")
      return res.data.data
    },
    staleTime: 60_000,
  })
}

// ---- Contributors ----

export function useFollowContributor(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => api.post(`/v1/qa/contributors/${userId}/follow`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-profile", userId] })
      qc.invalidateQueries({ queryKey: ["qa-following"] })
    },
  })
}

export function useUnfollowContributor(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => api.delete(`/v1/qa/contributors/${userId}/follow`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-profile", userId] })
      qc.invalidateQueries({ queryKey: ["qa-following"] })
    },
  })
}

// ---- Save answers + saved lists ----

export function useSaveAnswer(answerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => api.post(`/v1/qa/answers/${answerId}/save`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-saved-answers"] }),
  })
}

export function useUnsaveAnswer(answerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => api.delete(`/v1/qa/answers/${answerId}/save`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-saved-answers"] }),
  })
}

export function useSavedQuestions(limit = 20) {
  return useQuery({
    queryKey: ["qa-saved-questions"],
    queryFn: async () => {
      const res = await api.get<QAListResponse<QuestionSummary>>("/v1/qa/saved/questions", { params: { limit } })
      return res.data.data
    },
  })
}

export function useSavedAnswers(limit = 20) {
  return useQuery({
    queryKey: ["qa-saved-answers"],
    queryFn: async () => {
      const res = await api.get<QAListResponse<Answer>>("/v1/qa/saved/answers", { params: { limit } })
      return res.data.data
    },
  })
}

// ---- Comment voting ----

export function useVoteComment(answerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ commentId, value }: { commentId: string; value: 1 | -1 }) =>
      api.post(`/v1/qa/comments/${commentId}/vote`, { value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-comments", answerId] }),
  })
}

export function useRemoveCommentVote(answerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => api.delete(`/v1/qa/comments/${commentId}/vote`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-comments", answerId] }),
  })
}

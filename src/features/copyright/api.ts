import { useMutation, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/api"

import { decodeCopyrightReview, reviewRequestBody, reviewRequestIsStale, reviewRequestPath, type CopyrightReview } from "./model"

/** POST /v1/posts/:postId/copyright-review/request {note} → the author's review view (copyright_review.go:304). */
export async function requestCopyrightReview(postId: string, note: string): Promise<CopyrightReview> {
  const res = await api.post<{ data?: unknown }>(reviewRequestPath(postId), reviewRequestBody(note))
  const review = decodeCopyrightReview(res.data?.data)
  if (!review) throw new Error("The review came back in a shape we don't know.")
  return review
}

/**
  "Request review": on success the Creator Hub's copies of the video (its
  detail and the library rows) read again, so every surface shows
  "Review requested". A decided or vanished review refetches too.
*/
export function useRequestCopyrightReview(onReview?: (postId: string, review: CopyrightReview) => void) {
  const qc = useQueryClient()
  const refresh = (postId: string) => {
    void qc.invalidateQueries({ queryKey: ["hub", "post", postId] })
    void qc.invalidateQueries({ queryKey: ["hub", "library"] })
  }
  return useMutation({
    mutationFn: ({ postId, note }: { postId: string; note: string }) => requestCopyrightReview(postId, note),
    onSuccess: (review, { postId }) => {
      onReview?.(postId, review)
      refresh(postId)
    },
    onError: (err, { postId }) => {
      if (reviewRequestIsStale(err)) refresh(postId)
    },
  })
}

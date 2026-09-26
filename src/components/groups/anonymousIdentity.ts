/** Aliases are not user IDs. Keep them out of every profile lookup. */
export function publicPostAuthorIds(posts: { author_id: string; is_anonymous?: boolean }[]) {
  return [...new Set(posts.filter(p => p.is_anonymous !== true).map(p => p.author_id).filter(Boolean))]
}

export function publicCommentAuthorIds(comments: { user_id: string; is_anonymous?: boolean }[], alias?: string) {
  return [...new Set(comments.filter(c => c.is_anonymous !== true && c.user_id !== alias).map(c => c.user_id).filter(Boolean))]
}

export function canRevealGroupAuthor(anonymous: boolean, role?: string) {
  return anonymous && ['owner', 'admin', 'moderator'].includes(role || '')
}

export function anonymousAttachmentRefusal(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { error?: { message?: string } | string } } })?.response
  const detail = response?.data?.error
  const message = typeof detail === 'string' ? detail : detail?.message
  return response?.status === 500 && Boolean(message?.includes('attachments could not be made anonymous'))
}

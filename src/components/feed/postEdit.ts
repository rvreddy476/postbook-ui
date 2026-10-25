/*
  Edit a published feed post (PATCH /v1/posts/:postId, post-service
  internal/http/post_edit.go). Owner only.

  The route takes any subset of its fields and leaves an absent one alone,
  so the body carries ONLY what the sheet changed. That matters beyond
  tidiness: tier_required_id (members only) and action (the Action button)
  are raw fields where null CLEARS — the sheet never edits them, so it
  never names them, and an edit can't silently open a members-only post or
  drop its button.

  The sheet edits four things: text, who can see it, comments on/off and
  whether the like count shows. The server re-derives hashtags from new
  text (keeping the explicit ones), applies the create rules (5,000 code
  points, a post needs text or media), and refuses with a code; every code
  the route answers here gets a sentence.
*/

export type EditVisibility = 'public' | 'followers' | 'friends' | 'private' | 'unlisted'

/** Who can see the post, the composer's words. Unlisted only shows when the post already is. */
export const EDIT_VISIBILITY_OPTIONS: readonly { value: EditVisibility; label: string; detail: string }[] = [
  { value: 'public', label: 'Everyone', detail: 'Anyone can see it' },
  { value: 'followers', label: 'Followers', detail: 'People who follow you' },
  { value: 'friends', label: 'Friends', detail: 'Followers you follow back' },
  { value: 'private', label: 'Only you', detail: 'Nobody else can see it' },
  { value: 'unlisted', label: 'Unlisted', detail: 'Only people with the link' },
]

/** Server ceiling on post text, in Unicode code points (create_guards.go MaxPostTextRunes). */
export const MAX_POST_TEXT = 5000

export interface EditablePost {
  id: string
  text?: string | null
  visibility?: string | null
  no_comments?: boolean | null
  hide_like_count?: boolean | null
  media?: readonly unknown[] | null
}

export interface PostEditForm {
  text: string
  visibility: string
  allowComments: boolean
  hideLikeCount: boolean
}

export interface PostEditBody {
  text?: string
  visibility?: EditVisibility
  no_comments?: boolean
  hide_like_count?: boolean
}

export function postEditFormFrom(post: EditablePost): PostEditForm {
  return {
    text: post.text ?? '',
    visibility: post.visibility ?? 'public',
    allowComments: !post.no_comments,
    hideLikeCount: !!post.hide_like_count,
  }
}

/** The options the sheet offers: the four composer audiences, plus the post's own if it is another. */
export function visibilityOptionsFor(current: string): readonly { value: string; label: string; detail: string }[] {
  const base = EDIT_VISIBILITY_OPTIONS.filter((o) => o.value !== 'unlisted')
  if (base.some((o) => o.value === current)) return base
  const known = EDIT_VISIBILITY_OPTIONS.find((o) => o.value === current)
  return [...base, known ?? { value: current, label: 'Current setting', detail: 'Leave as it is' }]
}

function isEditVisibility(v: string): v is EditVisibility {
  return EDIT_VISIBILITY_OPTIONS.some((o) => o.value === v)
}

/** The PATCH body: only the fields that differ from the post as loaded. */
export function buildPostEditBody(post: EditablePost, form: PostEditForm): PostEditBody {
  const before = postEditFormFrom(post)
  const body: PostEditBody = {}
  if (form.text !== before.text) body.text = form.text
  if (form.visibility !== before.visibility && isEditVisibility(form.visibility)) body.visibility = form.visibility
  if (form.allowComments !== before.allowComments) body.no_comments = !form.allowComments
  if (form.hideLikeCount !== before.hideLikeCount) body.hide_like_count = form.hideLikeCount
  return body
}

export function hasEdits(body: PostEditBody): boolean {
  return Object.keys(body).length > 0
}

function codePoints(text: string): number {
  return Array.from(text).length
}

/** What stops the sheet saving before anything is sent; null when it may. */
export function postEditProblem(post: EditablePost, form: PostEditForm): string | null {
  if (codePoints(form.text) > MAX_POST_TEXT) {
    return `Posts can be up to ${MAX_POST_TEXT.toLocaleString('en-US')} characters. This one is ${codePoints(form.text).toLocaleString('en-US')}.`
  }
  if (!form.text.trim() && (post.media?.length ?? 0) === 0 && form.text !== (post.text ?? '')) {
    return 'A post without a photo or video needs some text.'
  }
  return null
}

const EDIT_ERROR_COPY: Record<string, string> = {
  COPYRIGHT_REVIEW: 'This post is in copyright review, so it can’t stay members-only. Nothing was changed. Remove members-only from the post, or wait for the review to finish.',
  EMPTY_POST: 'A post without a photo or video needs some text.',
  TEXT_TOO_LONG: `Posts can be up to ${MAX_POST_TEXT.toLocaleString('en-US')} characters. Shorten the text and try again.`,
  INVALID_VISIBILITY: 'Choose who can see this post from the list.',
  INVALID_HASHTAG: 'One of the hashtags can’t be used. Hashtags take letters, numbers and underscores.',
  TOO_MANY_HASHTAGS: 'This post has too many hashtags. Remove a few and try again.',
  FORBIDDEN: 'Only the person who posted this can edit it.',
  NOT_FOUND: 'This post no longer exists.',
  INVALID_TIER: 'The members-only level on this post isn’t one of your active levels any more. Nothing was changed.',
  MEMBERSHIP_TIERS_UNAVAILABLE: 'Membership levels couldn’t be checked right now, so nothing was saved. Try again in a moment.',
  STORE_UNAVAILABLE: 'Editing isn’t available right now. Nothing was saved. Try again in a moment.',
  RATE_LIMITED: 'Too many changes at once. Wait a moment and try again.',
  INVALID_REQUEST: 'Those changes couldn’t be read. Reload the page and try again.',
}

/** A sentence for a refused or failed PATCH. */
export function postEditErrorCopy(err: unknown): string {
  const e = err && typeof err === 'object' ? (err as { response?: { status?: number; data?: { error?: { code?: unknown } } }; isAxiosError?: boolean }) : null
  const code = e?.response?.data?.error?.code
  if (typeof code === 'string' && EDIT_ERROR_COPY[code]) return EDIT_ERROR_COPY[code]
  const status = e?.response?.status
  if (status === 404) return EDIT_ERROR_COPY.NOT_FOUND
  if (status === 403) return EDIT_ERROR_COPY.FORBIDDEN
  if (status === 429) return EDIT_ERROR_COPY.RATE_LIMITED
  if (status === 503) return EDIT_ERROR_COPY.STORE_UNAVAILABLE
  if (e?.isAxiosError && !e.response) return 'You seem to be offline. Nothing was saved. Check your connection and try again.'
  return 'Your changes couldn’t be saved. Please try again.'
}

/** The edited fields as they now read on a cached row (text, visibility, the two switches, and new hashtags). */
export function editedFields(body: PostEditBody, saved: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (body.text !== undefined) out.text = typeof saved?.text === 'string' ? saved.text : body.text
  if (body.visibility !== undefined) out.visibility = typeof saved?.visibility === 'string' ? saved.visibility : body.visibility
  if (body.no_comments !== undefined) out.no_comments = body.no_comments
  if (body.hide_like_count !== undefined) out.hide_like_count = body.hide_like_count
  if (body.text !== undefined && Array.isArray(saved?.hashtags)) out.hashtags = saved.hashtags
  return out
}

/**
 * Merges the edited fields into the post wherever an infinite post list
 * holds it. Same reference back when the post is not there, so untouched
 * lists don't re-render.
 */
export function mergePostEdit<C>(cache: C, postId: string, fields: Record<string, unknown>): C {
  const c = cache as unknown as { pages?: { data?: { id?: string }[] }[] } | undefined
  if (!c || !Array.isArray(c.pages)) return cache
  let changed = false
  const pages = c.pages.map((page) => {
    if (!page || !Array.isArray(page.data) || !page.data.some((p) => p?.id === postId)) return page
    changed = true
    return { ...page, data: page.data.map((p) => (p?.id === postId ? { ...p, ...fields } : p)) }
  })
  return changed ? ({ ...c, pages } as unknown as C) : cache
}

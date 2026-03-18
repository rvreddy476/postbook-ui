// Single source of truth for atpost engagement vocabulary.
// Backend stores generic terms. Frontend transforms at render time.
// If brand terms change, ONLY this file changes.

export const ENGAGEMENT_LABELS = {
  // Actions
  'liked': '✦ Sparked',
  'super_liked': '✦✦ Supernova',
  'disliked': 'Tuned',        // private, never shown to others
  'shared': '↺ Echoed',
  'saved': '⊞ Stashed',
  'commented': '💬 Commented',

  // Counts
  'like_count': 'Spark',
  'dislike_count': null,       // never displayed
  'share_count': 'Echo',
  'save_count': 'Stash',
  'comment_count': 'Comment',

  // Notification text transforms
  'liked your post': '✦ Sparked your post',
  'super liked your post': '✦✦ Supernova\'d your post!',
  'shared your post': '↺ Echoed your post',
  'saved your post': '⊞ Stashed your post',
  'commented on your post': '💬 Commented on your post',
} as const

// Transform a backend notification title to branded text
export function transformNotificationText(text: string): string {
  let result = text
  for (const [generic, branded] of Object.entries(ENGAGEMENT_LABELS)) {
    if (branded && typeof branded === 'string') {
      result = result.replace(generic, branded)
    }
  }
  return result
}

// Get the branded label for a count field
export function getCountLabel(backendField: string, count: number): string {
  const label = ENGAGEMENT_LABELS[backendField as keyof typeof ENGAGEMENT_LABELS]
  if (!label) return ''
  const plural = count === 1 ? '' : 's'
  return `${count} ${label}${plural}`
}

// Action button labels
export const ACTION_LABELS = {
  like: '✦ Spark',
  super_like: '✦✦ Supernova',
  comment: '💬',
  share: '↺ Echo',
  save: '⊞ Stash',
  tune: '⊘ Tune',  // in ⋯ menu only, never shown publicly
} as const

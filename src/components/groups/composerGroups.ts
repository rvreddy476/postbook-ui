import type { Group } from '@/types/groups'

export function groupSelectionUnavailable(group: Group, primaryId: string, anonymous: boolean): string | null {
  if (group.id === primaryId) return 'Current group · already included'
  if (group.is_archived || group.status === 'archived' || group.status === 'deleted') return 'Unavailable for new posts'
  if (anonymous && group.allow_anonymous_posts !== true) return 'Anonymous posting is not enabled'
  // The membership list may omit viewer_role; only a known role can explain a
  // local refusal. Server-side create authorization remains authoritative.
  if (group.viewer_role && group.who_can_post === 'admins_only' && !['owner', 'admin'].includes(group.viewer_role)) return 'Only admins can post'
  if (group.viewer_role && group.who_can_post === 'admins_mods' && !['owner', 'admin', 'moderator'].includes(group.viewer_role)) return 'Only admins and moderators can post'
  return null
}

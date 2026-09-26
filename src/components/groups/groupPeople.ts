import type { Candidate, AddPeopleResult } from '@/components/messenger/groupComposition'

export type GroupPerson = Candidate & { reason_codes?: string[] }
export const relatedReasons: Record<string, string> = {
  SAME_CITY: 'Same town or city', SAME_SCHOOL: 'School in common',
  SAME_COMPANY: 'Workplace in common', SAME_PROFESSION: 'Similar work',
  MUTUAL_FRIENDS: 'Mutual connections', COMMON_GROUPS: 'Groups in common',
}

// Labels come only from server-provided reason codes, never profile scraping
// or inferred location. Do not reveal institution names or raw explain_text.
export function personReason(person: GroupPerson): string {
  return person.reason_codes?.map(reason => relatedReasons[reason]).filter(Boolean).slice(0, 2).join(' · ') || 'Suggested for you'
}

export function availableGroupPeople(people: GroupPerson[], self: string | undefined, knownMembers: string[]): GroupPerson[] {
  const seen = new Set([...knownMembers, self])
  return people.filter(person => {
    if (!person.user_id || seen.has(person.user_id)) return false
    seen.add(person.user_id)
    return true
  })
}

export function parsePeopleSearch(body: unknown): GroupPerson[] {
  const root = body as { items?: unknown; data?: { items?: unknown }; error?: unknown } | null
  if (!root || root.error) throw new Error('People search unavailable')
  const items = root.items ?? root.data?.items
  if (!Array.isArray(items)) throw new Error('People search unavailable')
  return items.flatMap((item: Record<string, unknown>) => {
    if (!item || typeof item.user_id !== 'string' || !item.user_id) return []
    return [{ user_id: item.user_id, display_name: typeof item.display_name === 'string' ? item.display_name : '', username: typeof item.username === 'string' ? item.username : '', avatar_media_id: typeof item.avatar_media_id === 'string' ? item.avatar_media_id : undefined }]
  })
}

export function parseAddPeopleResult(body: unknown, requested: number): AddPeopleResult {
  const root = body as { data?: AddPeopleResult; error?: unknown } | null
  const result = root?.data
  if (root?.error || !result || ![result.added, result.invited, result.skipped].every(value => Number.isSafeInteger(value) && value >= 0) || result.added + result.invited + result.skipped !== requested) {
    throw new Error('Membership outcome could not be confirmed')
  }
  return result
}

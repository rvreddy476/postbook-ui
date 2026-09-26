import type { Group } from '@/types/groups'

// The service resets limits above 100 to 20. There is no total/has_more.
export const MY_GROUPS_PAGE_SIZE = 100

/** Return a complete membership list, or fail without exposing a partial list. */
export async function loadMyGroups(fetchPage: (offset: number, limit: number) => Promise<unknown>): Promise<Group[]> {
  const found = new Map<string, Group>()
  for (let offset = 0; ; offset += MY_GROUPS_PAGE_SIZE) {
    const response = await fetchPage(offset, MY_GROUPS_PAGE_SIZE)
    const data = response && typeof response === 'object' ? (response as { data?: unknown; error?: unknown }) : null
    if (!data || data.error || !Array.isArray(data.data)) throw new Error('Your groups could not be loaded.')
    const before = found.size
    for (const group of data.data) {
      if (!group || typeof group.id !== 'string' || !group.id || typeof group.name !== 'string') throw new Error('Invalid group response.')
      found.set(group.id, group)
    }
    if (data.data.length < MY_GROUPS_PAGE_SIZE) return [...found.values()]
    if (before === found.size) throw new Error('Group pagination did not advance. Please retry.')
  }
}

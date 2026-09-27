'use client'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchUsers } from '@/services/userService'

export interface MentionCandidate {
  id: string
  username: string
  name: string
  avatar: string
}

const DEBOUNCE_MS = 250
export const MENTION_LIMIT = 6

/** Debounced (250 ms) lookup against /v1/search/users, at most six people who have a username. */
export function useMentionSearch(query: string | null) {
  const [debounced, setDebounced] = useState<string | null>(null)
  useEffect(() => {
    if (!query) { setDebounced(null); return }
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const result = useQuery({
    queryKey: ['mention-search', debounced],
    queryFn: async (): Promise<MentionCandidate[]> => {
      const users = await searchUsers(debounced ?? '', MENTION_LIMIT * 2)
      return users
        .filter(user => typeof user.username === 'string' && user.username.length > 0)
        .slice(0, MENTION_LIMIT)
        .map(user => ({ id: user.id, username: user.username as string, name: user.name, avatar: user.avatar }))
    },
    enabled: !!debounced,
    staleTime: 60 * 1000,
    placeholderData: previous => previous,
  })

  return { candidates: debounced ? (result.data ?? []) : [], loading: !!query && (debounced !== query || result.isFetching), settled: debounced === query && result.isFetched }
}

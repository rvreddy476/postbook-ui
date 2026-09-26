'use client'

import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'

export interface RevealedProfile { id: string; name: string; avatar?: string }

// Deliberately no React Query/mutation cache: this audited result is private,
// transient component state. The subsequent profile read is uncached too.
export async function requestAuthorReveal(groupId: string, postId: string, signal: AbortSignal): Promise<RevealedProfile> {
  const config = { signal, headers: { 'Cache-Control': 'no-store' } }
  const result = await api.get(`/v1/groups/${groupId}/posts/v2/${postId}/author`, config)
  const author = result.data?.data
  if (author?.post_id !== postId || typeof author?.author_id !== 'string' || !author.author_id) throw new Error('Invalid reveal response')
  const profile = await api.get(`/v1/profiles/${encodeURIComponent(author.author_id)}`, config)
  const p = profile.data?.data
  if (!p) throw new Error('Profile unavailable')
  return { id: author.author_id, name: p.display_name || p.username || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Member', avatar: p.avatar_media_id ? `/v1/media/${p.avatar_media_id}/serve` : undefined }
}

export function useAuthorReveal(groupId: string, postId: string, viewerId: string | undefined, allowed: boolean) {
  const scope = `${viewerId || ''}:${groupId}:${postId}:${allowed}`
  const current = useRef(scope)
  current.current = scope
  const pending = useRef<AbortController | null>(null)
  const [state, setState] = useState<{ scope: string; profile?: RevealedProfile; busy?: boolean; error?: string } | null>(null)
  useEffect(() => {
    setState(null)
    return () => { pending.current?.abort(); pending.current = null }
  }, [scope])
  const reveal = async () => {
    if (!allowed || !viewerId || pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setState({ scope, busy: true })
    try {
      const profile = await requestAuthorReveal(groupId, postId, controller.signal)
      if (!controller.signal.aborted && current.current === scope) setState({ scope, profile })
    } catch (error) {
      if (controller.signal.aborted || current.current !== scope) return
      const status = (error as { response?: { status?: number } })?.response?.status
      setState({ scope, error: status === 403 ? 'You no longer have permission to reveal this author.' : status === 404 ? 'This post is unavailable in this group.' : 'Could not reveal the author. Try again.' })
    } finally {
      if (pending.current === controller) pending.current = null
    }
  }
  return { ...(state?.scope === scope ? state : {}), reveal, hide: () => { pending.current?.abort(); pending.current = null; setState(null) } }
}

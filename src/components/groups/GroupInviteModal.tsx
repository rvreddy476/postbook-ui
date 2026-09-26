'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, UserPlus, X } from 'lucide-react'
import { useAddPeopleToGroup, useGroupMembers } from '@/hooks/useGroups'
import { useFriends, useFriendSuggestions } from '@/hooks/useConnections'
import { useAuthUser } from '@/store/auth'
import api from '@/lib/api'
import { addPeopleSummary, MAX_PEOPLE } from '@/components/messenger/groupComposition'
import { availableGroupPeople, parsePeopleSearch, personReason, type GroupPerson } from './groupPeople'
import './group-people.css'

export default function GroupInviteModal({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const self = useAuthUser()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [source, setSource] = useState<'connections' | 'suggested'>('connections')
  const [selected, setSelected] = useState<string[]>([])
  const [submitted, setSubmitted] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const sending = useRef(false)
  const add = useAddPeopleToGroup()
  const connections = useFriends(self?.id, 100)
  const suggestions = useFriendSuggestions(self?.id, 30)
  const members = useGroupMembers(groupId)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(timeout)
  }, [search])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current
    element?.showModal()
    element?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
    return () => { element?.close(); previous?.focus() }
  }, [])
  const searchResults = useQuery({
    queryKey: ['group-people-search', self?.id, debounced],
    enabled: !!self?.id && debounced.length >= 2,
    queryFn: async ({ signal }) => {
      const response = await api.get('/v1/search/users', { params: { q: debounced, limit: 30 }, signal })
      return parsePeopleSearch(response.data)
    },
  })
  const searching = search.trim().length > 0
  const waiting = searching && (search.trim().length < 2 || search.trim() !== debounced)
  const activeQuery = searching ? searchResults : source === 'connections' ? connections : suggestions
  const raw: GroupPerson[] = searching ? searchResults.data ?? [] : source === 'connections' ? connections.data?.items ?? [] : (suggestions.data ?? []).map(person => ({ ...person, username: person.username ?? '' }))
  const people = waiting ? [] : availableGroupPeople(raw, self?.id, members.data?.map(member => member.user_id) ?? [])
  const send = async () => {
    if (sending.current || !selected.length) return
    sending.current = true
    setError('')
    setSummary('')
    const batch = [...selected]
    try {
      const result = await add.mutateAsync({ groupId, userIds: batch })
      setSummary(addPeopleSummary(result) ?? 'Members updated.')
      // Counts are deliberately not attributed to individuals.
      setSubmitted(previous => [...previous, ...batch])
      setSelected([])
    } catch {
      setError('We could not confirm the result. Check the member list before trying again.')
    } finally { sending.current = false }
  }
  if (typeof document === 'undefined') return null
  return createPortal(
    <dialog ref={dialog} className="group-people" aria-labelledby="group-people-title" aria-describedby="group-people-description" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="group-people__body">
        <header><div><h2 id="group-people-title">Add members</h2><p id="group-people-description">People are added or invited according to their privacy settings.</p></div><button aria-label="Close add members" onClick={onClose}><X size={20} /></button></header>
        <label className="group-people__search"><Search size={18} /><input autoFocus type="search" aria-label="Search people to add" placeholder="Search by name or username" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="group-people__sources" aria-label="People sources">
          <button aria-pressed={!searching && source === 'connections'} onClick={() => { setSource('connections'); setSearch('') }}>Connections</button>
          <button aria-pressed={!searching && source === 'suggested'} onClick={() => { setSource('suggested'); setSearch('') }}>Suggested for you</button>
        </div>
        <div className="group-people__list" aria-busy={!waiting && activeQuery.isFetching}>
          {waiting ? <p role="status">{search.trim().length < 2 ? 'Type at least two characters to search.' : 'Searching…'}</p> : activeQuery.isError ? <div role="alert"><p>People could not load.</p><button onClick={() => activeQuery.refetch()}>Try again</button></div> : activeQuery.isLoading ? <p role="status">Finding people…</p> : people.length === 0 ? <p>{searching ? 'No matching people. Try another name or username.' : source === 'connections' ? 'No connections to show. Search for someone or try suggestions.' : 'No suggestions available right now. You can still search.'}</p> : people.map(person => {
            const processed = submitted.includes(person.user_id)
            const checked = selected.includes(person.user_id)
            return <label key={person.user_id} className="group-people__person">
              <span className="group-people__avatar">{person.avatar_media_id ? <img src={`/v1/media/${person.avatar_media_id}/serve`} alt="" /> : (person.display_name || person.username || '?').slice(0, 1).toUpperCase()}</span>
              <span className="group-people__identity"><strong>{person.display_name || person.username || 'User'}</strong><small>{processed ? 'Request processed — see summary' : searching ? (person.username ? `@${person.username}` : 'Search result') : source === 'connections' ? 'Your connection' : personReason(person)}</small></span>
              <input type="checkbox" aria-label={`Select ${person.display_name || person.username || 'user'}`} checked={checked} disabled={processed || add.isPending || (!checked && selected.length >= MAX_PEOPLE)} onChange={() => setSelected(previous => previous.includes(person.user_id) ? previous.filter(id => id !== person.user_id) : [...previous, person.user_id])} />
            </label>
          })}
        </div>
        {!searching && source === 'connections' && connections.data?.meta.has_next && <p className="group-people__note">Showing your first 100 connections. Search by name to find more.</p>}
        {summary && <p className="group-people__status" role="status">{summary}</p>}
        {error && <p className="group-people__status" role="alert">{error}</p>}
        <footer><span>{selected.length} selected · up to {MAX_PEOPLE}</span><button onClick={send} disabled={!selected.length || add.isPending}><UserPlus size={17} />{add.isPending ? 'Submitting…' : 'Add / invite'}</button></footer>
      </div>
    </dialog>,
    document.body,
  )
}

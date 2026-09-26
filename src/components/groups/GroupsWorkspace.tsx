'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, Plus, Radio, Search, Users } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useMyGroups } from '@/hooks/useGroups'
import type { Group } from '@/types/groups'
import './groups-workspace.css'

export function GroupNavigation({ groups, activeGroup, query, onQuery, onFeedClick }: {
  groups: Group[]; activeGroup?: string; query: string; onQuery: (value: string) => void; onFeedClick?: () => void
}) {
  const matching = groups.filter(group => group.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  return (
    <nav aria-label="Group navigation">
      <Link className="groups-nav__feed" href="/groups?view=feed" aria-current={!activeGroup ? 'page' : undefined} onClick={event=>{if(onFeedClick){event.preventDefault();onFeedClick()}}}><Radio size={19} /> Feed</Link>
      <label className="groups-nav__search"><Search size={16} /><input type="search" aria-label="Find one of your groups" placeholder="Find your group" value={query} onChange={event => onQuery(event.target.value)} /></label>
      <p className="groups-nav__label">Your groups</p>
      <div className="groups-nav__list">
      {matching.map(group => (
        <Link key={group.id} href={`/groups/${group.handle || group.id}`} className="groups-nav__group" aria-current={activeGroup && (activeGroup === group.id || activeGroup === group.handle) ? 'page' : undefined}>
          <span className="groups-nav__avatar">{group.avatar_media_id ? <img src={`/v1/media/${group.avatar_media_id}/serve`} alt="" /> : group.name.slice(0, 1).toUpperCase()}</span>
          <span>{group.name}</span>
        </Link>
      ))}
      {!matching.length && <p className="groups-nav__empty">{query ? 'No matching groups.' : 'Groups you join will appear here.'}</p>}
      </div>
      <Link href="/groups/create" className="groups-nav__create"><Plus size={17} /> Create group</Link>
    </nav>
  )
}

export default function GroupsWorkspace({ children, activeGroup, onFeedClick, discovery = false }: { children: ReactNode; activeGroup?: string; onFeedClick?: () => void; discovery?: boolean }) {
  const groups = useMyGroups()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  return (
    <AppShell activeTab="Groups" hideSidebar>
      <div className={`groups-workspace ${discovery ? 'groups-workspace--discovery' : ''}`}>
        <aside className="groups-navigation" aria-label="Your groups" data-open={open}>
          <div className="groups-navigation__heading"><Link href="/groups"><Users size={22} /> Groups</Link><button aria-label="Toggle group navigation" aria-expanded={open} aria-controls="groups-navigation-body" onClick={() => setOpen(value => !value)}><ChevronDown size={19} /></button></div>
          <div id="groups-navigation-body">
            {groups.isLoading ? <p role="status" className="groups-nav__empty">Loading your groups…</p> : groups.isError ? <div className="groups-nav__empty"><p>Your groups could not load.</p><button onClick={() => groups.refetch()}>Try again</button><Link href="/groups">Group feed</Link></div> : <GroupNavigation groups={groups.data ?? []} activeGroup={activeGroup} query={query} onQuery={setQuery} onFeedClick={onFeedClick} />}
          </div>
        </aside>
        <div className="groups-workspace__content">{children}</div>
      </div>
    </AppShell>
  )
}

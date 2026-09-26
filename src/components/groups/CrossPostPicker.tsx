'use client'

import React, { useState } from 'react'
import { Globe, LockKeyhole, Plus, Search, Users, X } from 'lucide-react'
import { useMyGroups } from '@/hooks/useGroups'
import ComposerPopup from './ComposerPopup'
import { groupSelectionUnavailable } from './composerGroups'
import { MAX_ADDITIONAL_GROUPS, crossPostCapReason } from './groupComposer'

export interface CrossPostChoice { id: string; name: string }

interface CrossPostPickerProps {
  groupId: string
  selected: CrossPostChoice[]
  onChange: (next: CrossPostChoice[]) => void
  disabled?: boolean
  anonymous?: boolean
}

export default function CrossPostPicker({ groupId, selected, onChange, disabled, anonymous = false }: CrossPostPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<CrossPostChoice[]>([])
  const groups = useMyGroups(open)
  const launch = () => { setDraft([...selected]); setSearch(''); setOpen(true) }
  const visible = (groups.data ?? []).filter(group => group.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const toggle = (id: string, name: string) => setDraft(previous => previous.some(g => g.id === id)
    ? previous.filter(g => g.id !== id)
    : previous.length < MAX_ADDITIONAL_GROUPS ? [...previous, { id, name }] : previous)

  return <div className="composer-crosspost">
    <button className="composer-crosspost__trigger" type="button" onClick={launch} disabled={disabled} aria-haspopup="dialog" aria-expanded={open}>
      <Users size={19} aria-hidden="true" />
      <span className="composer-option-copy"><strong>Add groups</strong><small>{selected.length ? `${selected.length} additional selected` : 'Choose more destinations'}</small></span>
      <Plus size={17} aria-hidden="true" />
    </button>
    {selected.length > 0 && <div className="composer-crosspost__selected">{selected.map(group => <span key={group.id}>{group.name}<button type="button" disabled={disabled} aria-label={`Remove ${group.name}`} onClick={() => onChange(selected.filter(g => g.id !== group.id))}><X size={12} /></button></span>)}</div>}
    {open && <ComposerPopup title="Add groups" back onClose={() => setOpen(false)}>
      <label className="composer-group-search"><Search size={17} /><input autoFocus type="search" aria-label="Search your groups" placeholder="Search your groups" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="composer-popup__intro"><strong>Select groups</strong><p>Share with up to {MAX_ADDITIONAL_GROUPS + 1} groups you belong to. Your current group is included.</p></div>
      <div className="composer-popup__content composer-group-list" role="region" aria-label="Available groups" tabIndex={0} aria-busy={groups.isFetching}>
        {groups.isPending ? <p role="status">Loading your groups…</p> : groups.isError ? <div role="alert"><p>Your other groups could not load. You can still post to this group.</p><button type="button" onClick={() => groups.refetch()}>Try again</button></div> : visible.length === 0 ? <p>{search ? 'No groups match your search.' : 'No groups available.'}</p> : visible.map(group => {
          const current = group.id === groupId
          const chosen = draft.some(g => g.id === group.id)
          const unavailable = groupSelectionUnavailable(group, groupId, anonymous)
          const atCap = !chosen && draft.length >= MAX_ADDITIONAL_GROUPS
          const reason = unavailable || (atCap ? crossPostCapReason() : null)
          return <label key={group.id} className="composer-group-row" data-disabled={!!reason && !chosen}>
            <span className="composer-group-avatar">{group.avatar_media_id ? <img alt="" src={`/v1/media/${group.avatar_media_id}/serve`} /> : <Users size={21} />}</span>
            <span><strong>{group.name || 'Untitled group'}</strong><small>{(group.privacy_level || group.visibility) === 'public' ? <Globe size={13} aria-hidden="true" /> : <LockKeyhole size={13} aria-hidden="true" />}{reason || ((group.privacy_level || group.visibility) === 'public' ? 'Public group' : 'Private group')}</small></span>
            <input type="checkbox" aria-label={`Include ${group.name || 'group'}`} checked={current || chosen} disabled={current || !!disabled || (!chosen && !!reason)} onChange={() => toggle(group.id, group.name || 'Untitled group')} />
          </label>
        })}
      </div>
      <footer><span>{draft.length} of {MAX_ADDITIONAL_GROUPS} additional</span><div><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="composer-popup__primary" disabled={disabled || groups.isPending || groups.isError} onClick={() => { onChange(draft); setOpen(false) }}>Done</button></div></footer>
    </ComposerPopup>}
  </div>
}

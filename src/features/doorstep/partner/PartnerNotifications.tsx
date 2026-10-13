"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Bell, ArrowUpRight, RefreshCw } from 'lucide-react'
import { useNotificationInbox, useMarkNotificationRead } from '@/hooks/useNotificationInbox'
import { partnerDate } from './workspaceView'

export function PartnerNotifications() {
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const inbox = useNotificationInbox('all', cursors[cursors.length - 1])
  const mark = useMarkNotificationRead()
  const unread = inbox.data?.notifications.filter(n => !n.is_read) ?? []
  return <section className="ds-card dsp-notifications">
    <header className="ds-row"><div className="ds-grow"><p className="dsp-eyebrow">YOUR INBOX</p><h1 className="ds-title">Notifications</h1></div><button type="button" className="ds-button ds-button--secondary" disabled={inbox.isFetching} onClick={() => void inbox.refetch()}><RefreshCw size={16} aria-hidden />Refresh</button></header>
    {unread.length > 0 && <button type="button" className="ds-button ds-button--secondary" disabled={mark.isPending} onClick={() => mark.mutate(unread)}>Mark this page as read</button>}
    {mark.isError && <p role="alert" className="ds-error">Could not update read status. Please try again.</p>}
    {inbox.isPending ? <p role="status">Loading notifications…</p> : inbox.isError ? <p role="alert" className="ds-error">Notifications couldn’t be loaded. Please refresh to try again.</p> : inbox.data.notifications.length === 0 ? <div className="ds-empty"><Bell size={28} aria-hidden /><h2>You’re all caught up</h2><p>Application reviews and service updates will appear here.</p></div> : <ul className="dsp-notification-list">{inbox.data.notifications.map(n => <li key={n.id} data-unread={!n.is_read}>
      <div><strong>{n.title}</strong>{!n.is_read && <span className="dsp-unread-dot" aria-label="Unread" />}<p>{n.body}</p><time dateTime={n.created_at}>{partnerDate(n.created_at)}</time></div>
      {n.deep_link ? <Link className="ds-button ds-button--secondary" href={n.deep_link} onClick={() => { if (!n.is_read) mark.mutate([n]) }}>View<ArrowUpRight size={15} aria-hidden /></Link> : !n.is_read && <button type="button" className="ds-button ds-button--secondary" disabled={mark.isPending} onClick={() => mark.mutate([n])}>Mark read</button>}
    </li>)}</ul>}
    <footer className="ds-row">{cursors.length > 1 && <button type="button" className="ds-button ds-button--secondary" onClick={() => setCursors(v => v.slice(0, -1))}>Newer updates</button>}{inbox.data?.next_cursor && <button type="button" className="ds-button ds-button--secondary" onClick={() => setCursors(v => [...v, inbox.data!.next_cursor])}>Older updates</button>}</footer>
  </section>
}

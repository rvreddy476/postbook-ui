'use client'

import { useRef, type KeyboardEvent } from 'react'
import { INBOX_TABS, nextTabIndex, type InboxTab } from '@/lib/activityInbox'

export const ACTIVITY_PANEL_ID = 'activity-panel'
export const activityTabId = (tab: InboxTab) => `activity-tab-${tab}`

/**
 * The Activity filter tabs: one tab stop, arrow keys / Home / End move and
 * select (WAI-ARIA tabs, automatic activation).
 */
export function ActivityTabs({ active, onSelect }: { active: InboxTab; onSelect: (tab: InboxTab) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextTabIndex(index, event.key, INBOX_TABS.length)
    if (next === null) return
    event.preventDefault()
    onSelect(INBOX_TABS[next].key)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label="Filter activity" className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
      {INBOX_TABS.map((t, i) => {
        const selected = t.key === active
        return (
          <button
            key={t.key}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="tab"
            id={activityTabId(t.key)}
            aria-selected={selected}
            aria-controls={ACTIVITY_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(t.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selected ? 'border-primary text-primary-ink' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

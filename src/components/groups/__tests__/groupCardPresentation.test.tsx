import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import GroupPostCard from '../GroupPostCard'
import type { GroupPostV2 } from '@/types/groups'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

function renderCard(value: GroupPostV2) {
  return renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><GroupPostCard groupId="group" post={value} /></QueryClientProvider>)
}

const post: GroupPostV2 = {
  id: 'post', group_id: 'group', author_id: 'alias', content_type: 'text',
  body: 'Hello', needs_approval: false, is_pinned: false, is_announcement: false,
  status: 'published', spark_count: 0, comment_count: 0, echo_count: 0, view_count: 1,
  created_at: '2026-09-26T10:00:00Z', updated_at: '2026-09-26T10:00:00Z',
}

test('anonymous identity appears once in the author header, with no name or photo leakage', () => {
  const html = renderCard({ ...post, is_anonymous: true, author_name: 'Secret identity', author_avatar_url: '/private-avatar' })
  expect(html.match(/Anonymous member/g)).toHaveLength(1)
  expect(html).not.toContain('Secret identity')
  expect(html).not.toContain('/private-avatar')
  expect(html).toContain('group-post-anonymous-avatar')
})

test('named posts retain identity and all engagement controls have accessible names', () => {
  const html = renderCard({ ...post, author_name: 'Maya', author_avatar_url: '/maya-avatar' })
  expect(html).toContain('Maya')
  expect(html).toContain('/maya-avatar')
  for (const label of ['React with Like', 'Comments', 'Share post', 'Save post', '1 views']) {
    expect(html).toContain(`aria-label="${label}"`)
  }
  expect(html).toContain('group-post-actions')
})

test('group section tabs do not stick over posts; actions use five equal tracks', () => {
  const view = readFileSync(resolve(import.meta.dir, '../GroupView.tsx'), 'utf8')
  const tabs = view.slice(view.indexOf('role="tablist"'), view.indexOf('{TABS.map'))
  expect(tabs).not.toContain('sticky')
  const workspace = readFileSync(resolve(import.meta.dir, '../groups-workspace.css'), 'utf8')
  const tabRule = workspace.match(/\.groups-workspace__content \[role='tablist'\]\s*\{([^}]+)\}/)?.[1]
  expect(tabRule).toContain('position: static')
  expect(tabRule).not.toMatch(/\btop\s*:/)
  const css = readFileSync(resolve(import.meta.dir, '../group-post-card.css'), 'utf8')
  expect(css).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))')
})

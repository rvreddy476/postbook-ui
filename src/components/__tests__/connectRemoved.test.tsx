import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/*
  Founder, 24 Oct 2026: Connect is gone. No connection or friend requests
  anywhere; anyone can message anyone their settings allow, and Follow (with
  follow requests on a private account) stays.
*/

const ROOT = join(import.meta.dir, '..', '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

describe('the Connect surfaces are deleted, not hidden', () => {
  test('the Connections page, the Connect button and the connection settings pages are gone', () => {
    for (const file of [
      'src/app/connections/page.tsx',
      'src/components/connections/FriendsView.tsx',
      'src/components/connections/FriendRequestButton.tsx',
      'src/components/FriendCard.tsx',
      'src/app/settings/friend-requests/page.tsx',
      'src/app/settings/social-preferences/page.tsx',
    ]) expect(existsSync(join(ROOT, file)), file).toBe(false)
  })

  test('no connection-request hooks remain; the people lists messaging needs do', async () => {
    const hooks = await import('@/hooks/useConnections')
    for (const gone of ['usePendingFriendRequests', 'useAcceptFriendRequest', 'useRejectFriendRequest', 'useSendFriendRequest', 'useSentFriendRequests', 'useCancelFriendRequest', 'useFilteredFriendRequests', 'useUnfilterFriendRequest', 'useRemoveFriend', 'useMutualConnectionCounts']) {
      expect(gone in hooks, gone).toBe(false)
    }
    for (const kept of ['useFriends', 'useFriendSuggestions', 'useBatchRelationships', 'useInfiniteFollowers', 'useInfiniteFollowing']) expect(kept in hooks, kept).toBe(true)
  })

  test('the notification bells have no Accept / Decline for a connection request', () => {
    for (const file of ['src/components/Header.tsx', 'src/components/MinimalHeader.tsx']) {
      const src = read(file)
      expect(src).not.toContain('useAcceptFriendRequest')
      expect(src).not.toContain('useRejectFriendRequest')
      expect(src).not.toContain('isFriendReq')
    }
  })
})

describe('no way in to Connections is left', () => {
  test('rail, launcher, reels menu and the home shortcuts never link /connections', async () => {
    const { ALL_PRIMARY_ITEMS, ALL_MORE_ITEMS } = await import('@/components/sidebarNav')
    const { ALL_APP_LAUNCHER, APP_BRANDS } = await import('@/lib/appBrand')
    const { videoNav } = await import('@/features/video-shell/nav')
    const hrefs = [
      ...ALL_PRIMARY_ITEMS.map((i) => i.href),
      ...ALL_MORE_ITEMS.map((i) => i.href),
      ...ALL_APP_LAUNCHER.map((t) => t.href),
      ...APP_BRANDS.map((b) => b.href),
      ...videoNav('reels').flatMap((s) => s.items.map((i) => i.href)),
      ...videoNav('reels', 'sidebar').flatMap((s) => s.items.map((i) => i.href)),
    ]
    expect(hrefs.filter((h) => h?.startsWith('/connections'))).toEqual([])
    for (const file of ['src/components/home/CreativeHome.tsx', 'src/components/PeopleYouMayKnowStrip.tsx', 'src/components/RightPanel.tsx', 'src/app/discover/page.tsx', 'src/components/AppShell.tsx', 'src/features/postboek/PostBoekApp.tsx']) {
      expect(read(file), file).not.toContain("'/connections'")
      expect(read(file), file).not.toContain('"/connections"')
    }
  })

  test('settings: no "Who can connect with you", no "Friend requests", no connection-request switch', async () => {
    const { SETTINGS_GROUPS } = await import('@/app/settings/_lib/settingsHub')
    const rows = SETTINGS_GROUPS.flatMap((g) => g.rows)
    expect(rows.map((r) => r.label)).not.toContain('Who can connect with you')
    expect(rows.map((r) => r.label)).not.toContain('Friend requests')
    expect(rows.some((r) => 'href' in r && (r.href === '/settings/social-preferences' || r.href === '/settings/friend-requests'))).toBe(false)
    const { NOTIFICATION_CATEGORIES } = await import('@/app/settings/_lib/notificationPreferences')
    expect(NOTIFICATION_CATEGORIES.map((c) => c.key)).not.toContain('friend_requests')
    // Messaging keeps its one control.
    expect(rows.some((r) => 'href' in r && r.href === '/settings/messaging')).toBe(true)
  })

  test('the profile people tab lists Followers and Following; no Connections list, no pending requests', () => {
    const tab = read('src/components/profile/tabs/ConnectionsTab.tsx')
    expect(tab).not.toContain('PendingRequestsList')
    expect(tab).not.toContain('label: "Connections"')
    expect(tab).not.toContain('useFriends')
    expect(tab).toContain('label: "Followers"')
    expect(tab).toContain('label: "Following"')
    expect(read('src/components/profile/ProfileTabs.tsx')).toContain('{ key: "connections", label: "People", icon: Users }')
  })
})

describe('suggestions offer Follow instead of Connect', () => {
  test('Follow, Following', async () => {
    const { SuggestionFollowButton } = await import('@/components/PeopleYouMayKnowStrip')
    const qc = new QueryClient()
    const html = (following: boolean) => renderToStaticMarkup(<QueryClientProvider client={qc}><SuggestionFollowButton userId="u1" name="Ada" following={following} /></QueryClientProvider>)
    expect(html(false)).toContain('aria-label="Follow Ada"')
    expect(html(false)).toContain('>Follow</button>')
    expect(html(true)).toContain('aria-label="Following Ada"')
    for (const h of [html(false), html(true)]) expect(h).not.toMatch(/Connect/)
    const strip = read('src/components/PeopleYouMayKnowStrip.tsx')
    expect(strip).not.toContain('FriendRequestButton')
    expect(strip).toContain('<SuggestionFollowButton')
  })

  test('a group member who is not a connection gets Follow, not "Add friend"', () => {
    const src = read('src/components/groups/tabs/GroupMembersTab.tsx')
    expect(src).not.toContain('FriendRequestButton')
    expect(src).not.toContain('Add friend')
    expect(src).toContain('return followButton')
  })
})

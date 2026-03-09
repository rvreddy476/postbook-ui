'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Avatar, Btn, GRADS, MESSENGER_CSS, getGroupColor, getInitials, hashId } from './shared'
import DmChat from './DmChat'
import GroupPanel from './GroupPanel'
import CreateGroupPanel from './CreateGroupPanel'
import { fetchUsers } from '@/services/userService'
import { getSession } from '@/services/authService'
import { fetchConversations } from '@/services/messageService'
import { useMyGroups } from '@/hooks/useGroups'
import { useNotifications } from '@/contexts/NotificationContext'
import type { User } from '@/types'

/* ------------------------------------------------------------------ */
/*  Skeleton loader for sidebar                                        */
/* ------------------------------------------------------------------ */

function SidebarSkeleton() {
  const rows = Array.from({ length: 6 })
  return (
    <div style={{ padding: '4px 8px' }}>
      {rows.map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            marginBottom: 2,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              animation: 'fadeSlide 1.2s ease-in-out infinite alternate',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                width: '60%',
                height: 10,
                borderRadius: 4,
                background: 'rgba(255,255,255,0.06)',
                animation: 'fadeSlide 1.2s ease-in-out infinite alternate',
              }}
            />
            <div
              style={{
                width: '40%',
                height: 8,
                borderRadius: 4,
                background: 'rgba(255,255,255,0.04)',
                animation: 'fadeSlide 1.2s ease-in-out infinite alternate',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Feed placeholder (shown when no DM is selected)                    */
/* ------------------------------------------------------------------ */

function FeedPlaceholder({ friends }: { friends: User[] }) {
  const mockPosts = useMemo(() => {
    const pool = friends.slice(0, 3)

    const texts = [
      'Just finished a great book on system design. Highly recommend it to anyone building at scale!',
      'Beautiful sunset at the coast today. Sometimes you just need to unplug and enjoy nature.',
      'Working on a new side project this weekend. Excited to share the results soon!',
    ]
    const times = ['2h ago', '4h ago', '6h ago']

    return pool.map((u, i) => ({
      user: u,
      text: texts[i % texts.length],
      time: times[i % times.length],
      likes: Math.floor(Math.random() * 40) + 3,
      comments: Math.floor(Math.random() * 12) + 1,
    }))
  }, [friends])

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 24px',
        overflowY: 'auto',
      }}
    >
      <div style={{ color: '#6B7280', fontSize: 14, marginBottom: 28, fontWeight: 500 }}>
        Select a conversation to start messaging
      </div>

      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {mockPosts.map((post, i) => {
          const avatarUrl = post.user.avatar && (post.user.avatar.startsWith('http') || post.user.avatar.startsWith('/'))
            ? post.user.avatar
            : undefined
          return (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 16,
                padding: 18,
              }}
            >
              {/* Post header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Avatar
                  user={post.user}
                  size={36}
                  showStatus
                  avatarUrl={avatarUrl}
                />
                <div>
                  <div style={{ color: '#E5E7EB', fontSize: 13, fontWeight: 600 }}>{post.user.name}</div>
                  <div style={{ color: '#6B7280', fontSize: 10.5 }}>{post.time}</div>
                </div>
              </div>
              {/* Post body */}
              <div style={{ color: '#D1D5DB', fontSize: 13, lineHeight: '1.55', marginBottom: 14 }}>
                {post.text}
              </div>
              {/* Post actions */}
              <div
                style={{
                  display: 'flex',
                  gap: 20,
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  paddingTop: 10,
                }}
              >
                {[
                  { label: `Like (${post.likes})`, icon: '\u2661' },
                  { label: `Comment (${post.comments})`, icon: '\uD83D\uDCAC' },
                  { label: 'Share', icon: '\u2197' },
                ].map((action) => (
                  <button
                    key={action.label}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6B7280',
                      fontSize: 11.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: 'inherit',
                      padding: '4px 0',
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{action.icon}</span>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function PostbookMessenger() {
  /* ---- state ---- */
  const [contactTab, setContactTab] = useState<'friends' | 'groups'>('friends')
  const [search, setSearch] = useState('')
  const [activeDm, setActiveDm] = useState<User | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [friends, setFriends] = useState<User[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  /* ---- hooks ---- */
  const currentUser = getSession()
  const { data: myGroups } = useMyGroups()
  const { getUnreadCountForUser, totalUnread } = useNotifications()

  /* ---- effects ---- */

  // Fetch users on mount
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const users = await fetchUsers(50, 0)
        if (cancelled) return
        const filtered = currentUser
          ? users.filter((u) => u.id !== currentUser.id)
          : users
        setFriends(filtered)
      } catch (err) {
        console.error('Failed to fetch users:', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch conversations on mount
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const result = await fetchConversations(50)
        if (cancelled) return
        const convos = result.data ?? []
        setConversations(convos)
      } catch (err) {
        console.error('Failed to fetch conversations:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  /* ---- helpers ---- */

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  const getLastMessage = useCallback(
    (userId: string): { text: string; time: string; unread: number } | null => {
      const conv = conversations.find(
        (c: any) =>
          c.participants?.includes(userId) ||
          c.other_user_id === userId
      )
      if (!conv) return null

      const lastMsg = conv.last_message ?? conv.lastMessage
      if (!lastMsg) return null

      const msgTime = lastMsg.created_at || lastMsg.ts || ''
      let timeDisplay = ''
      if (msgTime) {
        try {
          const d = new Date(msgTime)
          const now = new Date()
          const diffMs = now.getTime() - d.getTime()
          const diffMin = Math.floor(diffMs / 60000)
          if (diffMin < 1) timeDisplay = 'now'
          else if (diffMin < 60) timeDisplay = `${diffMin}m`
          else if (diffMin < 1440) timeDisplay = `${Math.floor(diffMin / 60)}h`
          else timeDisplay = `${Math.floor(diffMin / 1440)}d`
        } catch {
          timeDisplay = ''
        }
      }

      const unread = getUnreadCountForUser(userId)
      return {
        text: lastMsg.text || '(media)',
        time: timeDisplay,
        unread,
      }
    },
    [conversations, getUnreadCountForUser]
  )

  /* ---- filtering & sorting ---- */

  const filteredFriends = useMemo(() => {
    let list = friends
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((f) => f.name.toLowerCase().includes(q))
    }
    // sort: unread first, then online first
    return [...list].sort((a, b) => {
      const aUnread = getUnreadCountForUser(a.id)
      const bUnread = getUnreadCountForUser(b.id)
      if (aUnread !== bUnread) return bUnread - aUnread
      const aOnline = a.isOnline ? 1 : 0
      const bOnline = b.isOnline ? 1 : 0
      return bOnline - aOnline
    })
  }, [friends, search, getUnreadCountForUser])

  const filteredGroups = useMemo(() => {
    let list = myGroups ?? []
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((g) => g.name.toLowerCase().includes(q))
    }
    return [...list]
  }, [myGroups, search])

  const selectedGroup = useMemo(
    () => (myGroups ?? []).find((g) => g.id === activeGroupId) ?? null,
    [myGroups, activeGroupId]
  )

  /* ---- click handlers ---- */

  const handleFriendClick = useCallback((friend: User) => {
    setActiveDm(friend)
    setActiveGroupId(null)
    setShowCreateGroup(false)
  }, [])

  const handleGroupClick = useCallback((groupId: string) => {
    setActiveGroupId(groupId)
    setActiveDm(null)
    setShowCreateGroup(false)
  }, [])

  const handleNewGroup = useCallback(() => {
    setShowCreateGroup(true)
    setActiveDm(null)
    setActiveGroupId(null)
  }, [])

  /* ---- render ---- */

  const friendsUnreadTotal = useMemo(
    () => friends.reduce((sum, f) => sum + getUnreadCountForUser(f.id), 0),
    [friends, getUnreadCountForUser]
  )

  // We don't have per-group unread yet, so groups badge uses 0
  const groupsUnreadTotal = 0

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MESSENGER_CSS }} />

      <div
        style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          background: '#0d0d1a',
          fontFamily: "'Outfit', sans-serif",
          color: '#E5E7EB',
          overflow: 'hidden',
        }}
      >
        {/* ============================================================ */}
        {/*  LEFT SIDEBAR                                                 */}
        {/* ============================================================ */}
        <div
          style={{
            width: 320,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.01)',
          }}
        >
          {/* ---- Current user header ---- */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {currentUser && (
              <>
                <Avatar
                  user={currentUser}
                  size={38}
                  showStatus
                  avatarUrl={
                    currentUser.avatar &&
                    (currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('/'))
                      ? currentUser.avatar
                      : undefined
                  }
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: '#E5E7EB' }}>
                    {currentUser.name}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#6B7280' }}>Active now</div>
                </div>
              </>
            )}
          </div>

          {/* ---- Search ---- */}
          <div style={{ padding: '10px 14px', position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 24,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 14,
                color: '#6B7280',
                pointerEvents: 'none',
              }}
            >
              {'\u2315'}
            </span>
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 10px 9px 32px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.04)',
                color: '#E5E7EB',
                fontSize: 12.5,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          {/* ---- Tab switcher ---- */}
          <div
            style={{
              padding: '0 14px 8px',
              display: 'flex',
              gap: 6,
            }}
          >
            {(['friends', 'groups'] as const).map((tab) => {
              const isActive = contactTab === tab
              const badgeCount = tab === 'friends' ? friendsUnreadTotal : groupsUnreadTotal
              const badgeBg = tab === 'friends' ? '#6366F1' : '#EC4899'
              return (
                <button
                  key={tab}
                  onClick={() => setContactTab(tab)}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    borderRadius: 10,
                    border: 'none',
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: isActive ? '#E5E7EB' : '#6B7280',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'friends' ? 'Friends' : 'Groups'}
                  {badgeCount > 0 && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        background: badgeBg,
                        color: '#fff',
                        borderRadius: 6,
                        padding: '0 5px',
                        lineHeight: '16px',
                        minWidth: 16,
                        textAlign: 'center',
                      }}
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ---- Contact list ---- */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '4px 8px',
            }}
          >
            {isLoading ? (
              <SidebarSkeleton />
            ) : contactTab === 'friends' ? (
              /* ---- Friends list ---- */
              filteredFriends.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
                  {search ? 'No friends match your search' : 'No friends found'}
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const isActive = activeDm?.id === friend.id
                  const avatarUrl =
                    friend.avatar &&
                    (friend.avatar.startsWith('http') || friend.avatar.startsWith('/'))
                      ? friend.avatar
                      : undefined
                  const lastMsg = getLastMessage(friend.id)
                  const unread = getUnreadCountForUser(friend.id)

                  return (
                    <div
                      key={friend.id}
                      onClick={() => handleFriendClick(friend)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 2,
                        transition: 'background 0.15s',
                        background: isActive
                          ? 'rgba(99,102,241,0.08)'
                          : 'transparent',
                        border: isActive
                          ? '1px solid rgba(99,102,241,0.15)'
                          : '1px solid transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <Avatar user={friend} size={40} showStatus avatarUrl={avatarUrl} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              color: '#E5E7EB',
                              fontSize: 13,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {friend.name}
                          </span>
                          {lastMsg?.time && (
                            <span style={{ color: '#6B7280', fontSize: 10, flexShrink: 0, marginLeft: 6 }}>
                              {lastMsg.time}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: 2,
                          }}
                        >
                          <span
                            style={{
                              color: '#6B7280',
                              fontSize: 11.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                            }}
                          >
                            {lastMsg?.text ?? (friend.isOnline ? 'Online' : 'Offline')}
                          </span>
                          {unread > 0 && (
                            <span
                              style={{
                                background: '#6366F1',
                                color: '#fff',
                                borderRadius: 10,
                                minWidth: 18,
                                height: 18,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '0 5px',
                                flexShrink: 0,
                                marginLeft: 6,
                              }}
                            >
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )
            ) : (
              /* ---- Groups list ---- */
              <>
                {filteredGroups.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
                    {search ? 'No groups match your search' : 'No groups yet'}
                  </div>
                ) : (
                  filteredGroups.map((group) => {
                    const isActive = activeGroupId === group.id
                    const groupColor = getGroupColor(group.id)
                    const groupAvatarUrl = group.avatar_media_id
                      ? `/v1/media/${group.avatar_media_id}/serve`
                      : null

                    return (
                      <div
                        key={group.id}
                        onClick={() => handleGroupClick(group.id)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          marginBottom: 2,
                          transition: 'background 0.15s',
                          background: isActive
                            ? 'rgba(99,102,241,0.08)'
                            : 'transparent',
                          border: isActive
                            ? '1px solid rgba(99,102,241,0.15)'
                            : '1px solid transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        {/* Group icon */}
                        {groupAvatarUrl ? (
                          <img
                            src={groupAvatarUrl}
                            alt={group.name}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              objectFit: 'cover',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              background: groupColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 16,
                              fontWeight: 700,
                              color: '#fff',
                              flexShrink: 0,
                            }}
                          >
                            {group.name.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 600,
                                color: '#E5E7EB',
                                fontSize: 13,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {group.name}
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginTop: 2,
                            }}
                          >
                            <span
                              style={{
                                color: '#6B7280',
                                fontSize: 11.5,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                              }}
                            >
                              {group.description
                                ? group.description.length > 40
                                  ? group.description.slice(0, 40) + '...'
                                  : group.description
                                : `${group.member_count} members`}
                            </span>
                            <span
                              style={{
                                color: '#6B7280',
                                fontSize: 10,
                                flexShrink: 0,
                                marginLeft: 6,
                              }}
                            >
                              {group.member_count} members
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}

                {/* New Group button */}
                <div style={{ marginTop: 8, padding: '0 2px' }}>
                  <Btn variant="ghost" full size="sm" onClick={handleNewGroup}>
                    {'\uFF0B'} New Group
                  </Btn>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/*  MAIN CONTENT                                                  */}
        {/* ============================================================ */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            background: '#0d0d1a',
          }}
        >
          {activeDm ? (
            <DmChat
              userId={activeDm.id}
              userName={activeDm.name}
              userAvatar={activeDm.avatar}
              userOnline={activeDm.isOnline ?? false}
              onBack={() => setActiveDm(null)}
            />
          ) : (
            <FeedPlaceholder friends={friends} />
          )}
        </div>

        {/* ============================================================ */}
        {/*  RIGHT PANEL (conditional)                                     */}
        {/* ============================================================ */}
        {activeGroupId && !showCreateGroup && selectedGroup && (
          <GroupPanel
            groupId={activeGroupId}
            groupName={selectedGroup.name}
            groupColor={getGroupColor(activeGroupId)}
            groupAvatarUrl={
              selectedGroup.avatar_media_id
                ? `/v1/media/${selectedGroup.avatar_media_id}/serve`
                : null
            }
            onClose={() => setActiveGroupId(null)}
          />
        )}

        {showCreateGroup && (
          <CreateGroupPanel
            onClose={() => setShowCreateGroup(false)}
            onCreated={() => {
              setShowCreateGroup(false)
              showToast('Group created! \uD83C\uDF89')
            }}
          />
        )}
      </div>

      {/* ============================================================ */}
      {/*  TOAST                                                         */}
      {/* ============================================================ */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 24px',
            borderRadius: 12,
            background: '#6366F1',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 24px rgba(99,102,241,0.3)',
            animation: 'fadeSlide 0.25s ease',
            zIndex: 9999,
            fontFamily: "'Outfit', sans-serif",
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}
    </>
  )
}

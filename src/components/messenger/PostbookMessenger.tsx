'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Avatar, GRADS, getGroupColor, getInitials, hashId } from './shared'
import DmChat from './DmChat'
import GroupPanel from './GroupPanel'
import CreateGroupPanel from './CreateGroupPanel'
import { fetchUsers } from '@/services/userService'
import { getSession } from '@/services/authService'
import { fetchConversations, subscribeToPresenceUpdates } from '@/services/messageService'
import { useMyGroups } from '@/hooks/useGroups'
import { useNotifications } from '@/contexts/NotificationContext'
import type { User } from '@/types'
import {
  Search, Users, MessageCircle, Plus, Settings, Hash,
  Globe, Lock, Shield, ChevronRight, Send
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */
function SidebarSkeleton() {
  return (
    <div className="space-y-1 px-3 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-brand-secondary shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-brand-secondary rounded" />
            <div className="h-2.5 w-16 bg-brand-secondary rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty state (shown when no DM is selected)                         */
/* ------------------------------------------------------------------ */
function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#D8103F]/10 to-[#D8103F]/5 flex items-center justify-center mb-5">
        <Send className="w-8 h-8 text-[#D8103F]/40" />
      </div>
      <h3 className="text-lg font-bold text-slate-700 mb-1">Your Messages</h3>
      <p className="text-sm text-brand-text/60 max-w-xs text-center">
        Select a conversation to start messaging or pick a group to chat with your community.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function PostbookMessenger() {
  const [contactTab, setContactTab] = useState<'friends' | 'groups'>('friends')
  const [search, setSearch] = useState('')
  const [activeDm, setActiveDm] = useState<User | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [friends, setFriends] = useState<User[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const currentUser = getSession()
  const { data: myGroups } = useMyGroups()
  const { getUnreadCountForUser } = useNotifications()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const users = await fetchUsers(50, 0)
        if (cancelled) return
        const filtered = currentUser ? users.filter((u) => u.id !== currentUser.id) : users
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

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const result = await fetchConversations(50)
        if (cancelled) return
        setConversations(result.data ?? [])
      } catch (err) {
        console.error('Failed to fetch conversations:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Real-time presence updates
  useEffect(() => {
    return subscribeToPresenceUpdates((evt) => {
      setFriends(prev =>
        prev.map(f => f.id === evt.user_id ? { ...f, isOnline: evt.online } : f)
      )
    })
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  const getLastMessage = useCallback(
    (userId: string): { text: string; time: string; unread: number } | null => {
      const conv = conversations.find(
        (c: any) => c.participants?.includes(userId) || c.other_user_id === userId
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
          const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
          if (diffMin < 1) timeDisplay = 'now'
          else if (diffMin < 60) timeDisplay = `${diffMin}m`
          else if (diffMin < 1440) timeDisplay = `${Math.floor(diffMin / 60)}h`
          else timeDisplay = `${Math.floor(diffMin / 1440)}d`
        } catch { timeDisplay = '' }
      }
      return { text: lastMsg.text || '(media)', time: timeDisplay, unread: getUnreadCountForUser(userId) }
    },
    [conversations, getUnreadCountForUser]
  )

  const filteredFriends = useMemo(() => {
    let list = friends
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((f) => f.name.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      const aU = getUnreadCountForUser(a.id), bU = getUnreadCountForUser(b.id)
      if (aU !== bU) return bU - aU
      return (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0)
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

  const friendsUnreadTotal = useMemo(
    () => friends.reduce((sum, f) => sum + getUnreadCountForUser(f.id), 0),
    [friends, getUnreadCountForUser]
  )

  return (
    <div className="flex h-screen w-screen font-sans text-brand-text overflow-hidden">
      {/* ============================================================ */}
      {/*  LEFT SIDEBAR                                                 */}
      {/* ============================================================ */}
      <div className="w-[340px] shrink-0 flex flex-col border-r border-brand-divider">
        {/* Current user header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-3 mb-4">
            {currentUser && (
              <>
                <Avatar
                  user={currentUser}
                  size={42}
                  showStatus
                  avatarUrl={
                    currentUser.avatar && (currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('/'))
                      ? currentUser.avatar : undefined
                  }
                />
                <div className="flex-1 min-w-0">
                  <h1 className="text-[17px] font-bold text-slate-800 tracking-tight">Messenger</h1>
                  <p className="text-[11px] text-brand-text/60 font-medium">{currentUser.name}</p>
                </div>
                <button className="w-8 h-8 rounded-lg bg-brand-secondary hover:bg-brand-secondary flex items-center justify-center text-brand-text/60 hover:text-brand-highlight transition-all">
                  <Settings className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-brand-secondary border border-brand-divider rounded-xl text-[13px] text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#D8103F]/10 focus:border-[#D8103F]/20 transition-all"
            />
          </div>

          {/* Tab switcher */}
          <div className="flex p-1 rounded-xl bg-brand-secondary">
            {(['friends', 'groups'] as const).map((tab) => {
              const isActive = contactTab === tab
              const badge = tab === 'friends' ? friendsUnreadTotal : 0
              return (
                <button
                  key={tab}
                  onClick={() => setContactTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-all ${
                    isActive
                      ? 'bg-brand-accent text-brand-bg shadow-sm'
                      : 'text-brand-text/60 hover:text-brand-text'
                  }`}
                >
                  {tab === 'friends' ? (
                    <MessageCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Users className="w-3.5 h-3.5" />
                  )}
                  {tab === 'friends' ? 'Messages' : 'Groups'}
                  {badge > 0 && (
                    <span className="text-[9px] font-bold bg-[#D8103F] text-white rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {isLoading ? (
            <SidebarSkeleton />
          ) : contactTab === 'friends' ? (
            /* Friends list */
            filteredFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <MessageCircle className="w-10 h-10 text-slate-200 mb-2" />
                <p className="text-[13px] font-medium text-brand-text/60">
                  {search ? 'No friends match your search' : 'No conversations yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredFriends.map((friend) => {
                  const isActive = activeDm?.id === friend.id
                  const avatarUrl = friend.avatar && (friend.avatar.startsWith('http') || friend.avatar.startsWith('/'))
                    ? friend.avatar : undefined
                  const lastMsg = getLastMessage(friend.id)
                  const unread = getUnreadCountForUser(friend.id)

                  return (
                    <button
                      key={friend.id}
                      onClick={() => handleFriendClick(friend)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all group ${
                        isActive
                          ? 'bg-brand-accent/5 border border-brand-divider'
                          : 'hover:bg-brand-accent/5 border border-transparent hover:border-brand-divider'
                      }`}
                    >
                      <Avatar user={friend} size={42} showStatus avatarUrl={avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold truncate ${isActive ? 'text-brand-accent' : 'text-brand-text'} group-hover:text-brand-accent transition-colors`}>
                            {friend.name}
                          </span>
                          {lastMsg?.time && (
                            <span className="text-[9px] text-brand-text/40 font-bold uppercase shrink-0 ml-2">{lastMsg.time}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[10px] text-brand-text/60 truncate flex-1 tracking-wide leading-tight">
                            {lastMsg?.text ?? (friend.isOnline ? 'Online' : 'Offline')}
                          </span>
                          {unread > 0 && (
                            <span className="bg-[#D8103F] text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold px-1 shrink-0 ml-2">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          ) : (
            /* Groups list */
            <>
              {filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Users className="w-10 h-10 text-slate-200 mb-2" />
                  <p className="text-[13px] font-medium text-brand-text/60">
                    {search ? 'No groups match your search' : 'No groups yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredGroups.map((group) => {
                    const isActive = activeGroupId === group.id
                    const groupColor = getGroupColor(group.id)
                    const groupAvatarUrl = group.avatar_media_id
                      ? `/v1/media/${group.avatar_media_id}/serve`
                      : null
                    const privacy = group.privacy_level ?? 'public'

                    return (
                      <button
                        key={group.id}
                        onClick={() => handleGroupClick(group.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all group ${
                          isActive
                            ? 'bg-brand-accent/5 border border-brand-divider'
                            : 'hover:bg-brand-accent/5 border border-transparent hover:border-brand-divider'
                        }`}
                      >
                        {/* Group avatar */}
                        {groupAvatarUrl ? (
                          <img
                            src={groupAvatarUrl}
                            alt={group.name}
                            className="w-[42px] h-[42px] rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0"
                            style={{ background: groupColor }}
                          >
                            {group.name.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold truncate ${isActive ? 'text-brand-accent' : 'text-brand-text'} group-hover:text-brand-accent transition-colors`}>
                              {group.name}
                            </span>
                            {privacy === 'private' && <Lock className="w-3 h-3 text-slate-300 shrink-0" />}
                            {privacy === 'restricted' && <Shield className="w-3 h-3 text-slate-300 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-brand-text/60 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {group.member_count}
                            </span>
                            {group.handle && (
                              <span className="text-[11px] text-slate-300">@{group.handle}</span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-200 shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}

              {/* New Group button */}
              <button
                onClick={handleNewGroup}
                className="w-full mt-2 py-4 text-[10px] font-black tracking-widest uppercase rounded-2xl bg-brand-accent text-brand-bg flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                New Group
              </button>
            </>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  MAIN CONTENT                                                  */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col min-w-0 bg-brand-secondary">
        {activeDm ? (
          <DmChat
            userId={activeDm.id}
            userName={activeDm.name}
            userAvatar={activeDm.avatar}
            userOnline={activeDm.isOnline ?? false}
            onBack={() => setActiveDm(null)}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* ============================================================ */}
      {/*  RIGHT PANEL                                                   */}
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
          onCreated={(groupId) => {
            setShowCreateGroup(false)
            setActiveGroupId(groupId)
            showToast('Group created!')
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 bg-brand-text text-white text-[13px] font-semibold rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast}
        </div>
      )}
    </div>
  )
}

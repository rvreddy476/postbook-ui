'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Avatar, getInitials, getGroupColor } from './shared'
import CreatePortal from '@/components/CreatePortal'
import { useGroupDetails, useGroupMembers, useGroupFeed } from '@/hooks/useGroups'
import { createGroupConversation, toggleReaction, updateConversation, leaveConversation, addMemberToConversation } from '@/services/messageService'
import { getSession } from '@/services/authService'
import { useChat, type ChatMessage, type ContextMenuState } from '@/hooks/useChat'
import { MessageSquare, FileText, Users, ArrowLeft, Send, Phone, Video, Search, MoreVertical, Plus, RefreshCw, Pencil, LogOut, UserPlus } from 'lucide-react'
import type { GroupMember, GroupPost } from '@/types/groups'
import type { Message } from '@/services/messageService'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GroupPanelProps {
  groupId: string
  groupName?: string
  groupColor?: string
  groupAvatarUrl?: string | null
  onClose?: () => void
}

type PanelMode = 'chat' | 'posts' | 'members'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const relativeTime = (iso: string) => {
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  } catch {
    return ''
  }
}


const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

// ---------------------------------------------------------------------------
// Chat Mode
// ---------------------------------------------------------------------------
function ChatView({
  conversationId: initialConversationId,
  groupColor,
  members,
  groupName,
}: {
  conversationId: string | undefined
  groupColor: string
  members: GroupMember[]
  groupName: string
}) {
  const me = getSession()
  const myId = me?.id ?? ''
  const [activeConvId, setActiveConvId] = useState<string | undefined>(initialConversationId)
  const [creatingChat, setCreatingChat] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const chat = useChat(activeConvId ?? null, myId)

  // Sync if parent passes a new conversationId
  useEffect(() => {
    if (initialConversationId) setActiveConvId(initialConversationId)
  }, [initialConversationId])

  // Try to create the conversation
  const attemptCreateChat = async () => {
    if (activeConvId || creatingChat) return
    if (!members.length) return
    setCreatingChat(true)
    setChatError(null)
    try {
      const memberIds = members.map(m => m.user_id)
      const res = await createGroupConversation(groupName, memberIds)
      const newId = res.data?.id || res.id
      if (newId) {
        setActiveConvId(newId)
      } else {
        setChatError('No conversation ID returned')
      }
    } catch (err: any) {
      console.error('Failed to create group conversation:', err)
      setChatError(err?.message || 'Failed to set up chat')
    } finally {
      setCreatingChat(false)
    }
  }

  // Auto-create conversation once if missing
  const didAttempt = useRef(false)
  useEffect(() => {
    if (activeConvId || didAttempt.current) return
    if (!members.length) return
    didAttempt.current = true
    attemptCreateChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId, members])

  const memberMap = useRef<Map<string, GroupMember>>(new Map())
  useEffect(() => {
    const m = new Map<string, GroupMember>()
    members.forEach(mb => m.set(mb.user_id, mb))
    memberMap.current = m
  }, [members])

  const resolveSender = (senderId: string) => {
    const mb = memberMap.current.get(senderId)
    const name = mb?.display_name || mb?.username || 'Unknown'
    return { name, avatar: getInitials(name) }
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chat.messages])

  // Typing indicator text
  const typingText = (() => {
    if (chat.typingUsers.size === 0) return null
    const names = Array.from(chat.typingUsers).map(uid => {
      const mb = memberMap.current.get(uid)
      return mb?.display_name || mb?.username || 'Someone'
    })
    if (names.length === 1) return `${names[0]} is typing...`
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`
    return `${names.length} people are typing...`
  })()

  // Media upload
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: formData })
      const uploadJson = await uploadRes.json()
      const mediaId = uploadJson.data?.id || uploadJson.id
      if (!mediaId) throw new Error('Upload failed')
      let messageType = 'file'
      if (file.type.startsWith('image/')) messageType = 'image'
      else if (file.type.startsWith('video/')) messageType = 'video'
      else if (file.type.startsWith('audio/')) messageType = 'audio'
      await chat.handleSendMedia(mediaId, messageType)
    } catch (err) {
      console.error('[GroupChat] media upload failed:', err)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!activeConvId) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4 px-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          {creatingChat ? (
            <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
          ) : (
            <MessageSquare className="w-8 h-8 text-slate-300" />
          )}
        </div>
        <div className="text-center">
          <p className="text-[14px] font-medium text-slate-500">
            {creatingChat ? 'Setting up group chat...' : 'Could not set up chat'}
          </p>
          {!creatingChat && chatError && (
            <p className="text-[12px] text-slate-400 mt-1 mb-3">{chatError}</p>
          )}
          {!creatingChat && (
            <button
              onClick={() => { didAttempt.current = false; attemptCreateChat() }}
              className="px-5 py-2 text-[13px] font-semibold text-white rounded-lg transition-all hover:opacity-90 active:scale-95"
              style={{ background: groupColor }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  const isMe = (id: string) => id === myId

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 flex flex-col gap-1 scrollbar-hide bg-slate-50/30">
        {chat.loading ? (
          <div className="flex flex-col gap-6 py-8 max-w-3xl mx-auto w-full">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-3 items-end">
                <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex flex-col gap-2">
                  <div className="w-24 h-3 rounded bg-slate-100 animate-pulse" />
                  <div className="h-12 rounded-2xl bg-slate-100/60 animate-pulse" style={{ width: 180 + i * 30 }} />
                </div>
              </div>
            ))}
          </div>
        ) : chat.messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium text-slate-500">No messages yet</p>
              <p className="text-[12px] text-slate-400 mt-1">Start the conversation!</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full">
            <div className="text-center py-6">
              <span className="text-[11px] font-medium text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100">Today</span>
            </div>
            {chat.messages.map((msg, idx) => {
              if (msg.type === 'system') {
                return (
                  <div key={msg.id} className="text-center py-3">
                    <span className="text-[11px] font-medium text-slate-400 bg-white px-4 py-1.5 rounded-full border border-slate-100">
                      {msg.text || 'System message'}
                    </span>
                  </div>
                )
              }

              const mine = isMe(msg.senderId)
              const prevMsg = idx > 0 ? chat.messages[idx - 1] : null
              const showAv = !prevMsg || prevMsg.senderId !== msg.senderId || prevMsg.type === 'system'
              const sender = resolveSender(msg.senderId)
              const replyTarget = msg.replyToId ? chat.findMessage(msg.replyToId) : null

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${mine ? 'flex-row-reverse' : 'flex-row'}`}
                  style={{ marginTop: showAv ? 24 : 4 }}
                  onContextMenu={(e) => chat.handleContextMenu(e, msg)}
                >
                  {!mine && (
                    <div className="w-9 flex-shrink-0 flex justify-center mt-6">
                      {showAv && (
                        <Avatar
                          user={{ id: msg.senderId, name: sender.name, avatar: sender.avatar }}
                          size={34}
                        />
                      )}
                    </div>
                  )}

                  <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} max-w-[55%]`}>
                    {showAv && !mine && (
                      <span className="text-[12px] font-medium text-slate-400 mb-1 ml-1">
                        {sender.name}
                      </span>
                    )}

                    {/* Forwarded label */}
                    {msg.forwardedFromId && !msg.isDeleted && (
                      <span className="text-[10px] text-slate-400 italic mb-0.5 ml-1">Forwarded</span>
                    )}

                    {/* Reply preview */}
                    {replyTarget && !msg.isDeleted && (
                      <div className="text-[11px] text-slate-400 px-3 py-1 border-l-2 rounded-r-lg mb-1 ml-1 max-w-full truncate"
                        style={{ borderColor: groupColor, background: `${groupColor}08` }}>
                        {replyTarget.isDeleted ? 'This message was deleted' : replyTarget.text}
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={`px-4 py-2.5 text-[14px] leading-relaxed break-words ${msg.isDeleted ? 'italic' : ''}`}
                      style={{
                        borderRadius: 18,
                        borderTopLeftRadius: !mine && showAv ? 4 : 18,
                        borderBottomRightRadius: mine && showAv ? 4 : 18,
                        background: msg.isDeleted ? '#f8fafc' : mine ? groupColor : '#fff',
                        color: msg.isDeleted ? '#94a3b8' : mine ? '#fff' : '#1e293b',
                        border: msg.isDeleted ? '1px solid #e2e8f0' : mine ? 'none' : '1px solid #e2e8f0',
                      }}
                    >
                      {msg.isDeleted ? (
                        'This message was deleted'
                      ) : msg.type === 'image' && msg.mediaId ? (
                        <img src={`/api/media/${msg.mediaId}/serve`} alt="Image" className="max-w-full rounded-xl" />
                      ) : msg.type === 'video' && msg.mediaId ? (
                        <video src={`/api/media/${msg.mediaId}/serve`} controls className="max-w-full rounded-xl" />
                      ) : msg.type === 'audio' && msg.mediaId ? (
                        <audio src={`/api/media/${msg.mediaId}/serve`} controls className="max-w-full" />
                      ) : msg.type === 'file' && msg.mediaId ? (
                        <a href={`/api/media/${msg.mediaId}/serve`} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">📎 Attachment</a>
                      ) : (
                        msg.text
                      )}
                    </div>

                    {/* Edited indicator */}
                    {msg.isEdited && !msg.isDeleted && (
                      <span className="text-[10px] text-slate-400 mt-0.5 px-1">(edited)</span>
                    )}

                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {msg.reactions.map(r => (
                          <button
                            key={r.emoji}
                            onClick={() => chat.handleToggleReaction(msg.id, r.emoji)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] transition-colors hover:bg-slate-100"
                            style={{
                              border: r.user_ids.includes(myId) ? `1px solid ${groupColor}80` : '1px solid #e2e8f0',
                              background: r.user_ids.includes(myId) ? `${groupColor}10` : '#fff',
                            }}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-[10px] text-slate-400">{r.user_ids.length}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Time + read receipt */}
                    <div className="flex items-center gap-1 mt-1 px-1">
                      <span className="text-[11px] text-slate-400">{msg.time}</span>
                      {mine && msg.id === chat.lastSentMsgId && chat.readReceipts.has(msg.id) && (
                        <span className="text-[10px] font-medium" style={{ color: groupColor }}>Seen</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {chat.contextMenu?.visible && (
        <div
          className="fixed z-[1000] bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 min-w-[160px]"
          style={{ left: chat.contextMenu.x, top: chat.contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick emoji row */}
          <div className="flex gap-1 px-3 py-2 border-b border-slate-100">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => chat.handleToggleReaction(chat.contextMenu!.messageId, emoji)}
                className="text-[18px] p-1 rounded-md hover:bg-slate-50 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            onClick={() => { const m = chat.messages.find(m => m.id === chat.contextMenu!.messageId); if (m) chat.handleReply(m) }}
            className="w-full text-left px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Reply
          </button>
          {chat.contextMenu.senderId === myId && (
            <>
              <button
                onClick={() => { const m = chat.messages.find(m => m.id === chat.contextMenu!.messageId); if (m) chat.handleEditStart(m) }}
                className="w-full text-left px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => chat.handleDelete(chat.contextMenu!.messageId)}
                className="w-full text-left px-4 py-2 text-[13px] text-red-500 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Typing indicator */}
      {typingText && (
        <div className="px-6 lg:px-10 py-1.5">
          <div className="max-w-3xl mx-auto">
            <span className="text-[12px] text-slate-400 italic">{typingText}</span>
          </div>
        </div>
      )}

      {/* Reply bar */}
      {chat.replyingTo && (
        <div className="px-6 lg:px-10 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <div className="max-w-3xl mx-auto w-full flex items-center gap-3">
            <div className="flex-1 text-[12px] text-slate-400 border-l-2 pl-3 truncate" style={{ borderColor: groupColor }}>
              <span className="font-medium" style={{ color: groupColor }}>Replying to </span>
              {chat.replyingTo.senderId === myId ? 'yourself' : resolveSender(chat.replyingTo.senderId).name}
              <span className="ml-2 text-slate-400">{chat.replyingTo.text.slice(0, 50)}{chat.replyingTo.text.length > 50 ? '...' : ''}</span>
            </div>
            <button onClick={() => chat.setReplyingTo(null)} className="text-slate-400 hover:text-slate-600 text-[14px]">✕</button>
          </div>
        </div>
      )}

      {/* Edit bar or Input */}
      {chat.editingMsgId ? (
        <div className="px-6 lg:px-10 py-4 bg-white border-t border-slate-100 flex-shrink-0">
          <div className="max-w-3xl mx-auto w-full flex gap-3 items-center">
            <input
              value={chat.editText}
              onChange={e => chat.setEditText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') chat.handleSaveEdit()
                if (e.key === 'Escape') { chat.setEditingMsgId(null); chat.setEditText('') }
              }}
              placeholder="Edit message..."
              className="flex-1 py-3 px-5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-[14px] outline-none focus:bg-white focus:ring-2 focus:ring-slate-100"
              autoFocus
            />
            <button
              onClick={chat.handleSaveEdit}
              className="px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all"
              style={{ background: groupColor }}
            >
              Save
            </button>
            <button
              onClick={() => { chat.setEditingMsgId(null); chat.setEditText('') }}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-500 text-[13px] hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="px-6 lg:px-10 py-4 bg-white border-t border-slate-100 flex-shrink-0">
          <div className="max-w-3xl mx-auto w-full relative flex gap-2 items-center">
            {/* Media upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip"
              onChange={handleMediaUpload}
              className="hidden"
            />

            <div className="flex-1 relative">
              <input
                value={chat.input}
                onChange={e => chat.handleInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') chat.handleSend(); if (e.key === 'Escape' && chat.replyingTo) chat.setReplyingTo(null) }}
                placeholder="Type a message..."
                className="w-full py-3.5 pl-5 pr-14 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-[14px] outline-none transition-all focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
              />
              <button
                onClick={chat.handleSend}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100"
                disabled={!chat.input.trim()}
                style={{
                  background: chat.input.trim() ? groupColor : '#f1f5f9',
                  color: chat.input.trim() ? '#fff' : '#94a3b8',
                  cursor: chat.input.trim() ? 'pointer' : 'default',
                }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Posts Mode
// ---------------------------------------------------------------------------
function PostsView({
  groupId,
  groupColor,
  members,
}: {
  groupId: string
  groupColor: string
  members: GroupMember[]
}) {
  const me = getSession()
  const { data: feedData, isLoading } = useGroupFeed(groupId)
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [commentOpen, setCommentOpen] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [showCreatePost, setShowCreatePost] = useState(false)

  const memberMap = new Map<string, GroupMember>()
  members.forEach(m => memberMap.set(m.user_id, m))

  const resolveAuthor = (authorId: string) => {
    const mb = memberMap.get(authorId)
    const name = mb?.display_name || mb?.username || 'Unknown'
    return { name, avatar: getInitials(name) }
  }

  const allPosts: GroupPost[] = feedData?.pages?.flatMap(p => p.data) ?? []

  const toggleLike = (postId: string) => {
    setLikedPosts(prev => { const n = new Set(prev); n.has(postId) ? n.delete(postId) : n.add(postId); return n })
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 flex flex-col gap-5 scrollbar-hide bg-slate-50/30 relative">
      {/* CreatePortal modal for group posts */}
      {showCreatePost && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <CreatePortal onClose={() => setShowCreatePost(false)} groupId={groupId} />
        </div>
      )}

      {/* Floating new post button */}
      <button
        onClick={() => setShowCreatePost(true)}
        className="fixed bottom-8 right-8 xl:right-12 z-[100] w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
        style={{ backgroundColor: groupColor }}
        title="New post"
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
      </button>

      <div className="max-w-3xl mx-auto w-full flex flex-col gap-5">
        {isLoading ? (
          <>
            {[1, 2].map(i => (
              <div key={i} className="p-5 bg-white border border-slate-100 rounded-2xl">
                <div className="flex gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
                  <div className="flex flex-col justify-center gap-2">
                    <div className="w-28 h-3 rounded-full bg-slate-100 animate-pulse" />
                    <div className="w-16 h-2 rounded-full bg-slate-50 animate-pulse" />
                  </div>
                </div>
                <div className="w-full h-4 rounded-full bg-slate-50 animate-pulse" />
                <div className="w-3/4 h-4 rounded-full bg-slate-50 mt-2 animate-pulse" />
              </div>
            ))}
          </>
        ) : allPosts.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-medium text-slate-500">No posts yet</p>
            <p className="text-[12px] mt-1 text-slate-400">Be the first to share something!</p>
          </div>
        ) : (
          allPosts.map(post => {
            const author = resolveAuthor(post.author_id)
            const liked = likedPosts.has(post.post_id)

            return (
              <div key={post.post_id} className="p-5 rounded-2xl bg-white border border-slate-100 hover:shadow-sm transition-shadow">
                <div className="flex gap-3 mb-4">
                  <Avatar user={{ id: post.author_id, name: author.name, avatar: author.avatar }} size={40} showStatus />
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="font-semibold text-slate-900 text-[14px]">{author.name}</div>
                    <div className="text-slate-400 text-[12px] font-normal">{relativeTime(post.created_at)}</div>
                  </div>
                </div>
                <p className="text-slate-700 text-[14px] leading-relaxed whitespace-pre-wrap">
                  Shared a post
                </p>
                <div className="flex gap-6 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => toggleLike(post.post_id)}
                    className={`flex items-center gap-2 text-[13px] font-medium transition-colors ${liked ? 'text-red-500' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <span className="text-base leading-none">{liked ? '❤️' : '🤍'}</span>
                    Like
                  </button>
                  <button
                    onClick={() => setCommentOpen(commentOpen === post.post_id ? null : post.post_id)}
                    className="flex items-center gap-2 text-[13px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
                    style={commentOpen === post.post_id ? { color: groupColor } : {}}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Comment
                  </button>
                </div>
                {commentOpen === post.post_id && (
                  <div className="mt-4 flex gap-3 items-center bg-slate-50 p-3 rounded-xl">
                    {me && <Avatar user={{ id: me.id, name: me.name, avatar: getInitials(me.name) }} size={32} />}
                    <input
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      onKeyDown={e => { if (e.key === 'Enter' && commentText.trim()) { setCommentText(''); setCommentOpen(null) } }}
                      className="flex-1 w-full py-2 px-3 rounded-lg bg-transparent border-none text-slate-900 text-[13px] outline-none placeholder:text-slate-400"
                    />
                    <button
                      onClick={() => { if (commentText.trim()) { setCommentText(''); setCommentOpen(null); } }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-white transition-transform active:scale-95 disabled:opacity-50"
                      disabled={!commentText.trim()}
                      style={{ backgroundColor: groupColor }}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Members Mode
// ---------------------------------------------------------------------------
function MembersView({
  members,
  isLoading,
  groupColor,
}: {
  members: GroupMember[]
  isLoading: boolean
  groupColor: string
}) {
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-3 bg-white">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex gap-3 py-3 px-2 flex-col justify-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="w-32 h-3 rounded-full bg-slate-100 animate-pulse" />
                <div className="w-20 h-2.5 rounded-full bg-slate-50 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const online = members
  const offline: GroupMember[] = []

  const renderMember = (m: GroupMember) => {
    const name = m.display_name || m.username || 'User'
    const isAdmin = m.role === 'admin'
    const isMod = m.role === 'moderator'

    return (
      <div
        key={m.user_id}
        className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
      >
        <Avatar
          user={{ id: m.user_id, name, avatar: getInitials(name), isOnline: true }}
          size={38}
          showStatus
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-[13px] group-hover:text-slate-700 transition-colors">{name}</span>
            {isAdmin && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider" style={{ color: groupColor, background: `${groupColor}15` }}>Admin</span>
            )}
            {isMod && (
              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Mod</span>
            )}
          </div>
          {m.username && (
            <div className="text-slate-400 text-[11px] font-medium mt-0.5">@{m.username}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide bg-white">
      <div className="flex items-center gap-2 px-3 mb-2">
        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
        <div className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">
          Online ({online.length})
        </div>
      </div>
      <div className="flex flex-col gap-0.5 mb-6">
        {online.map(renderMember)}
      </div>

      {offline.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-3 mb-2 mt-4">
            <div className="w-2 h-2 rounded-full bg-slate-300" />
            <div className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">
              Offline ({offline.length})
            </div>
          </div>
          <div className="flex flex-col gap-0.5 opacity-60">
            {offline.map(m => (
              renderMember(m)
            ))}
          </div>
        </>
      )}

      {members.length === 0 && (
        <div className="text-center py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 border-dashed mx-3">
          <Users className="w-12 h-12 mb-3 text-slate-300" strokeWidth={1.5} />
          <div className="text-[13px] font-medium text-slate-500">No members found</div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main GroupPanel
// ---------------------------------------------------------------------------
const MODE_TABS: { mode: PanelMode; icon: React.FC<any>; label: string }[] = [
  { mode: 'chat', icon: MessageSquare, label: 'Chat' },
  { mode: 'posts', icon: FileText, label: 'Posts' },
]

export default function GroupPanel(props: GroupPanelProps) {
  const { groupId } = props
  const router = useRouter()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<PanelMode>('chat')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)
  const [addMemberId, setAddMemberId] = useState('')

  const { data: group, isLoading: groupLoading } = useGroupDetails(groupId)
  const { data: members, isLoading: membersLoading } = useGroupMembers(groupId)

  useEffect(() => { setMode('chat') }, [groupId])

  // Close more menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return
    const handler = () => setShowMoreMenu(false)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [showMoreMenu])

  // Auto-retry if chat_conversation_id is missing (backend creates it async)
  useEffect(() => {
    if (group && !group.chat_conversation_id) {
      const timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['group', groupId] })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [group, groupId, queryClient])

  // Derive from props or fetched data
  const groupName = props.groupName ?? group?.name ?? 'Group'
  const groupColor = props.groupColor ?? getGroupColor(groupId)
  const groupAvatarUrl = props.groupAvatarUrl !== undefined
    ? props.groupAvatarUrl
    : (group?.avatar_media_id ? `/v1/media/${group.avatar_media_id}/serve` : undefined)

  const memberCount = group?.member_count ?? members?.length ?? 0
  const onlineCount = members?.length ?? 0
  const postCount = group?.post_count ?? 0

  return (
    <div className="w-full flex flex-col h-full bg-white font-sans border-l border-slate-100">
      {/* ── Header ── */}
      <div className="px-8 py-5 border-b border-slate-100 flex-shrink-0 bg-white z-20">
        <div className="flex items-center justify-between">
          {/* Left: icon · name · info */}
          <div className="flex items-center gap-4">
            <button
              onClick={props.onClose}
              className="md:hidden p-2 -ml-2 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Group icon */}
            <div
              className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{
                background: groupAvatarUrl ? '#fff' : groupColor,
                border: groupAvatarUrl ? '1px solid #e2e8f0' : 'none',
              }}
            >
              {groupAvatarUrl ? (
                <img src={groupAvatarUrl} alt={groupName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[18px] font-bold text-white">{groupName.charAt(0).toUpperCase()}</span>
              )}
            </div>

            {/* Name + info */}
            <div className="flex flex-col justify-center">
              <h1
                className="font-semibold text-slate-900 text-[16px] tracking-tight leading-tight cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => router.push(`/groups/${groupId}`)}
              >{groupName}</h1>
              <p className="text-slate-400 text-[12px] font-medium mt-0.5">
                {groupLoading ? '...' : `${memberCount} members`}
              </p>
            </div>
          </div>

          {/* Center: mode toggle */}
          <div className="flex bg-slate-50 rounded-lg p-1 border border-slate-100">
            {MODE_TABS.map(tab => {
              const active = mode === tab.mode
              const Icon = tab.icon
              return (
                <button
                  key={tab.mode}
                  onClick={() => setMode(tab.mode)}
                  className={`py-2 px-5 rounded-md text-[13px] font-medium transition-all duration-200 flex items-center justify-center gap-2 ${active
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={active ? 2 : 1.5} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            <button className="w-9 h-9 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
              <Phone className="w-[18px] h-[18px]" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
              <Video className="w-[18px] h-[18px]" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
              <Search className="w-[18px] h-[18px]" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="w-9 h-9 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <MoreVertical className="w-[18px] h-[18px]" />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50">
                  <button
                    onClick={() => { setEditingName(true); setNewGroupName(groupName); setShowMoreMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-slate-400" />
                    Edit group name
                  </button>
                  <button
                    onClick={() => { setShowAddMember(true); setShowMoreMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <UserPlus className="w-4 h-4 text-slate-400" />
                    Add member
                  </button>
                  <button
                    onClick={async () => {
                      setShowMoreMenu(false)
                      if (confirm('Are you sure you want to leave this group?')) {
                        try {
                          if (group?.chat_conversation_id) {
                            await leaveConversation(group.chat_conversation_id)
                          }
                          props.onClose?.()
                        } catch (err) {
                          console.error('Leave failed:', err)
                        }
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Leave group
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit name modal ── */}
      {editingName && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-[360px] shadow-xl">
            <h3 className="text-[16px] font-semibold text-slate-900 mb-4">Edit group name</h3>
            <input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-[14px] outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100 mb-4"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && newGroupName.trim()) {
                  if (group?.chat_conversation_id) {
                    updateConversation(group.chat_conversation_id, newGroupName.trim()).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['group', groupId] })
                    }).catch(console.error)
                  }
                  setEditingName(false)
                }
                if (e.key === 'Escape') setEditingName(false)
              }}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditingName(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-500 text-[13px] hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => {
                  if (group?.chat_conversation_id && newGroupName.trim()) {
                    updateConversation(group.chat_conversation_id, newGroupName.trim()).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['group', groupId] })
                    }).catch(console.error)
                  }
                  setEditingName(false)
                }}
                className="px-4 py-2 rounded-lg text-white text-[13px] font-semibold"
                style={{ background: groupColor }}
              >Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add member modal ── */}
      {showAddMember && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-[360px] shadow-xl">
            <h3 className="text-[16px] font-semibold text-slate-900 mb-4">Add member</h3>
            <input
              value={addMemberId}
              onChange={e => setAddMemberId(e.target.value)}
              placeholder="Enter user ID"
              className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-[14px] outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100 mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAddMember(false); setAddMemberId('') }} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-500 text-[13px] hover:bg-slate-50">Cancel</button>
              <button
                onClick={async () => {
                  if (group?.chat_conversation_id && addMemberId.trim()) {
                    try {
                      await addMemberToConversation(group.chat_conversation_id, addMemberId.trim())
                      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] })
                    } catch (err) {
                      console.error('Add member failed:', err)
                    }
                  }
                  setShowAddMember(false)
                  setAddMemberId('')
                }}
                className="px-4 py-2 rounded-lg text-white text-[13px] font-semibold"
                style={{ background: groupColor }}
                disabled={!addMemberId.trim()}
              >Add</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {mode === 'chat' && <ChatView conversationId={group?.chat_conversation_id} groupColor={groupColor} members={members ?? []} groupName={groupName} />}
        {mode === 'posts' && <PostsView groupId={groupId} groupColor={groupColor} members={members ?? []} />}
        {mode === 'members' && <MembersView members={members ?? []} isLoading={membersLoading} groupColor={groupColor} />}
      </div>
    </div>
  )
}

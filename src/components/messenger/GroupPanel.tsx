'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { Avatar, getInitials, getGroupColor } from './shared'
import CreatePortal from '@/components/CreatePortal'
import GroupCreateModal from '@/components/groups/GroupCreateModal'
import {
  useGroupDetails,
  useGroupMembers,
  useGroupFeedV2,
  useSparkGroupPostV2,
  useUnsparkGroupPostV2,
  useEchoGroupPostV2,
  useUnechoGroupPostV2,
  useGroupPostComments,
  useAddGroupPostComment,
  useDeleteGroupPostComment,
  useRecordGroupPostView,
  useDeleteGroupPostV2,
} from '@/hooks/useGroups'
import { useConversationPresence, useSetTyping } from '@/hooks/usePresence'
import { createGroupConversation, toggleReaction, updateConversation, leaveConversation, addMemberToConversation } from '@/services/messageService'
import { getSession } from '@/services/authService'
import { useChat, type ChatMessage, type ContextMenuState } from '@/hooks/useChat'
import { MessageSquare, FileText, Users, ArrowLeft, Send, Phone, Video, Search, MoreVertical, Plus, RefreshCw, Pencil, LogOut, UserPlus, Heart, MessageCircle, Repeat2, Eye, Pin, Megaphone, Trash2 } from 'lucide-react'
import type { GroupMember, GroupPostV2 } from '@/types/groups'
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
  onCreateGroup?: (groupId: string) => void
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
  // M1: track who's actively viewing this group chat + drive
  // conversation.enter/heartbeat/leave + typing.start.
  useConversationPresence(activeConvId ?? null)
  const setTyping = useSetTyping(activeConvId ?? null)

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
        <div className="w-16 h-16 rounded-2xl bg-brand-secondary flex items-center justify-center">
          {creatingChat ? (
            <RefreshCw className="w-8 h-8 text-brand-text/30 animate-spin" />
          ) : (
            <MessageSquare className="w-8 h-8 text-brand-text/30" />
          )}
        </div>
        <div className="text-center">
          <p className="text-[14px] font-medium text-brand-highlight">
            {creatingChat ? 'Setting up group chat...' : 'Could not set up chat'}
          </p>
          {!creatingChat && chatError && (
            <p className="text-[12px] text-brand-text/60 mt-1 mb-3">{chatError}</p>
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

  // Scroll to a specific message
  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`gmsg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.style.background = `${groupColor}15`
      setTimeout(() => { el.style.background = '' }, 1500)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Pinned message banner */}
      {chat.pinnedMessage && (
        <div
          className="flex items-center gap-3 px-6 lg:px-10 py-2.5 border-b border-brand-divider cursor-pointer shrink-0 hover:bg-brand-secondary/80 transition-colors"
          style={{ background: `${groupColor}06` }}
          onClick={() => scrollToMessage(chat.pinnedMessage!.message_id)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={groupColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold tracking-wider" style={{ color: groupColor }}>
              Pinned Message
            </div>
            <div className="text-[12px] text-brand-highlight truncate">
              {chat.pinnedMessage.message?.text || 'Click to view'}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); chat.handleUnpinMessage() }}
            title="Unpin message"
            className="text-brand-text/60 hover:text-brand-highlight hover:bg-brand-secondary rounded-md p-1 transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 flex flex-col gap-1 scrollbar-hide bg-brand-secondary/30">
        {chat.loading ? (
          <div className="flex flex-col gap-6 py-8 max-w-3xl mx-auto w-full">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-3 items-end">
                <div className="w-9 h-9 rounded-full bg-brand-secondary animate-pulse" />
                <div className="flex flex-col gap-2">
                  <div className="w-24 h-3 rounded-sm bg-brand-secondary animate-pulse" />
                  <div className="h-12 rounded-2xl bg-brand-secondary/60 animate-pulse" style={{ width: 180 + i * 30 }} />
                </div>
              </div>
            ))}
          </div>
        ) : chat.messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-secondary flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-brand-text/30" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium text-brand-highlight">No messages yet</p>
              <p className="text-[12px] text-brand-text/60 mt-1">Start the conversation!</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full">
            <div className="text-center py-6">
              <span className="text-[11px] font-medium text-brand-text/60 bg-brand-card px-3 py-1 rounded-full border border-brand-divider">Today</span>
            </div>
            {chat.messages.map((msg, idx) => {
              if (msg.type === 'system') {
                return (
                  <div key={msg.id} id={`gmsg-${msg.id}`} className="text-center py-3" style={{ transition: 'background 0.3s' }}>
                    <span className="text-[11px] font-medium text-brand-text/60 bg-brand-card px-4 py-1.5 rounded-full border border-brand-divider">
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
              // The live message wins (it reflects a later edit or delete);
              // the server's send-time snapshot is all that is left when the
              // original is outside the loaded page. Navigation is offered
              // only when the original is actually on screen.
              const quote = msg.replyToId
                ? {
                    text: replyTarget
                      ? (replyTarget.isDeleted ? 'This message was deleted' : replyTarget.text)
                      : (msg.replyToPreview || 'Original message'),
                    senderId: replyTarget?.senderId ?? msg.replyToSenderId,
                    canNavigate: Boolean(replyTarget),
                  }
                : null

              return (
                <div
                  key={msg.id}
                  id={`gmsg-${msg.id}`}
                  className={`flex gap-3 ${mine ? 'flex-row-reverse' : 'flex-row'}`}
                  style={{ marginTop: showAv ? 24 : 4, transition: 'background 0.3s' }}
                  onContextMenu={(e) => chat.handleContextMenu(e, msg)}
                >
                  {!mine && (
                    <div className="w-9 shrink-0 flex justify-center mt-6">
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
                      <span className="text-[12px] font-medium text-brand-text/60 mb-1 ml-1">
                        {sender.name}
                      </span>
                    )}

                    {/* Forwarded label */}
                    {msg.forwardedFromId && !msg.isDeleted && (
                      <span className="text-[10px] text-brand-text/60 italic mb-0.5 ml-1">Forwarded</span>
                    )}

                    {/* Bubble */}
                    <div
                      className={`px-4 py-2.5 text-[14px] leading-relaxed wrap-break-word ${msg.isDeleted ? 'italic' : ''}`}
                      style={{
                        borderRadius: 18,
                        borderTopLeftRadius: !mine && showAv ? 4 : 18,
                        borderBottomRightRadius: mine && showAv ? 4 : 18,
                        background: msg.isDeleted ? '#f8fafc' : mine ? groupColor : '#fff',
                        color: msg.isDeleted ? '#94a3b8' : mine ? '#fff' : '#1e293b',
                        border: msg.isDeleted ? '1px solid #e2e8f0' : mine ? 'none' : '1px solid #e2e8f0',
                      }}
                    >
                      {/*
                        The quoted message sits INSIDE the reply as a quiet
                        card, so a reply reads as one message with context
                        rather than as two messages. It used to render as a
                        sibling above the bubble.
                      */}
                      {quote && !msg.isDeleted && (
                        <div
                          role={quote.canNavigate ? 'button' : undefined}
                          tabIndex={quote.canNavigate ? 0 : undefined}
                          aria-label={quote.canNavigate ? 'Go to the quoted message' : undefined}
                          onClick={(e) => {
                            if (!quote.canNavigate) return
                            e.stopPropagation()
                            scrollToMessage(msg.replyToId!)
                          }}
                          onKeyDown={(e) => {
                            if (!quote.canNavigate) return
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              scrollToMessage(msg.replyToId!)
                            }
                          }}
                          className={`mb-2 flex gap-2 rounded-lg px-2 py-1.5 text-left ${quote.canNavigate ? 'cursor-pointer' : ''}`}
                          style={{ background: mine ? 'rgba(255,255,255,0.16)' : `${groupColor}0f` }}
                        >
                          <span
                            className="w-[3px] shrink-0 self-stretch rounded-full"
                            style={{ background: mine ? 'rgba(255,255,255,0.7)' : groupColor }}
                          />
                          <span className="min-w-0">
                            {quote.senderId && (
                              <span
                                className="block text-[11px] font-semibold leading-tight"
                                style={{ color: mine ? 'rgba(255,255,255,0.85)' : groupColor }}
                              >
                                {quote.senderId === myId ? 'You' : resolveSender(quote.senderId).name}
                              </span>
                            )}
                            <span
                              className="block line-clamp-2 text-[12px] leading-snug"
                              style={{ color: mine ? 'rgba(255,255,255,0.75)' : '#64748b' }}
                            >
                              {quote.text}
                            </span>
                          </span>
                        </div>
                      )}

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
                      <span className="text-[10px] text-brand-text/60 mt-0.5 px-1">(edited)</span>
                    )}

                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {msg.reactions.map(r => (
                          <button
                            key={r.emoji}
                            onClick={() => chat.handleToggleReaction(msg.id, r.emoji)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] transition-colors hover:bg-brand-secondary"
                            style={{
                              border: r.user_ids.includes(myId) ? `1px solid ${groupColor}80` : '1px solid #e2e8f0',
                              background: r.user_ids.includes(myId) ? `${groupColor}10` : '#fff',
                            }}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-[10px] text-brand-text/60">{r.user_ids.length}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Time + read receipt */}
                    <div className="flex items-center gap-1 mt-1 px-1">
                      <span className="text-[11px] text-brand-text/60">{msg.time}</span>
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
          className="fixed z-1000 bg-brand-card border border-brand-divider rounded-xl shadow-xl py-1.5 min-w-[160px]"
          style={{ left: chat.contextMenu.x, top: chat.contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick emoji row */}
          <div className="flex gap-1 px-3 py-2 border-b border-brand-divider">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => chat.handleToggleReaction(chat.contextMenu!.messageId, emoji)}
                className="text-[18px] p-1 rounded-md hover:bg-brand-secondary transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            onClick={() => { const m = chat.messages.find(m => m.id === chat.contextMenu!.messageId); if (m) chat.handleReply(m) }}
            className="w-full text-left px-4 py-2 text-[13px] text-brand-text hover:bg-brand-secondary transition-colors"
          >
            Reply
          </button>
          <button
            onClick={() => {
              if (chat.pinnedMessage?.message_id === chat.contextMenu!.messageId) {
                chat.handleUnpinMessage()
              } else {
                chat.handlePinMessage(chat.contextMenu!.messageId)
              }
            }}
            className="w-full text-left px-4 py-2 text-[13px] text-brand-text hover:bg-brand-secondary transition-colors"
          >
            {chat.pinnedMessage?.message_id === chat.contextMenu!.messageId ? 'Unpin' : 'Pin'}
          </button>
          {chat.contextMenu.senderId === myId && (
            <>
              <button
                onClick={() => { const m = chat.messages.find(m => m.id === chat.contextMenu!.messageId); if (m) chat.handleEditStart(m) }}
                className="w-full text-left px-4 py-2 text-[13px] text-brand-text hover:bg-brand-secondary transition-colors"
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
            <span className="text-[12px] text-brand-text/60 italic">{typingText}</span>
          </div>
        </div>
      )}

      {/* Reply bar */}
      {chat.replyingTo && (
        <div className="px-6 lg:px-10 py-2 bg-brand-secondary border-t border-brand-divider flex items-center gap-3">
          <div className="max-w-3xl mx-auto w-full flex items-center gap-3">
            <div className="flex-1 text-[12px] text-brand-text/60 border-l-2 pl-3 truncate" style={{ borderColor: groupColor }}>
              <span className="font-medium" style={{ color: groupColor }}>Replying to </span>
              {chat.replyingTo.senderId === myId ? 'yourself' : resolveSender(chat.replyingTo.senderId).name}
              <span className="ml-2 text-brand-text/60">{chat.replyingTo.text.slice(0, 50)}{chat.replyingTo.text.length > 50 ? '...' : ''}</span>
            </div>
            <button onClick={() => chat.setReplyingTo(null)} className="text-brand-text/60 hover:text-brand-highlight text-[14px]">✕</button>
          </div>
        </div>
      )}

      {/* Edit bar or Input */}
      {chat.editingMsgId ? (
        <div className="px-6 lg:px-10 py-4 border-t border-brand-divider shrink-0">
          <div className="max-w-3xl mx-auto w-full flex gap-3 items-center">
            <input
              value={chat.editText}
              onChange={e => chat.setEditText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') chat.handleSaveEdit()
                if (e.key === 'Escape') { chat.setEditingMsgId(null); chat.setEditText('') }
              }}
              placeholder="Edit message..."
              className="flex-1 py-3 px-5 rounded-xl border border-brand-text/30 bg-brand-secondary text-brand-text text-[14px] outline-hidden focus:bg-brand-card focus:ring-2 focus:ring-brand-secondary"
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
              className="px-4 py-2.5 rounded-lg border border-brand-divider text-brand-highlight text-[13px] hover:bg-brand-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="px-6 lg:px-10 py-4 border-t border-brand-divider shrink-0">
          <div className="max-w-3xl mx-auto w-full relative flex gap-2 items-center">
            {/* Media upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-brand-text/60 hover:bg-brand-secondary hover:text-brand-highlight transition-colors"
              title="Upload media"
            >
              <Plus className="w-5 h-5" />
            </button>
            {/* Paperclip attachment */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-brand-text/60 hover:bg-brand-secondary hover:text-brand-highlight transition-colors"
              title="Attach file"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip"
              onChange={handleMediaUpload}
              className="hidden"
            />

            {/* Same composer shape as the other two: the field and send share
                one rounded bar. The send colour came from an inline style
                using the group's colour plus two hardcoded hex values, so it
                could not follow the theme and disagreed with every other
                send button in the app. */}
            <div className="flex flex-1 items-center gap-1 rounded-full bg-brand-secondary px-1.5 ring-1 ring-transparent transition-colors focus-within:ring-brand-divider">
              <input
                value={chat.input}
                onChange={e => { chat.handleInputChange(e.target.value); setTyping(); }}
                onKeyDown={e => { if (e.key === 'Enter') chat.handleSend(); if (e.key === 'Escape' && chat.replyingTo) chat.setReplyingTo(null) }}
                placeholder="Write a message"
                className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm text-brand-text outline-hidden placeholder:text-brand-text/40"
              />
              <button
                onClick={chat.handleSend}
                disabled={!chat.input.trim()}
                aria-label="Send message"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200 active:scale-90 ${chat.input.trim()
                    ? 'bg-send text-white hover:bg-send-hover'
                    : 'text-brand-text/30'
                  }`}
              >
                <Send className="h-[18px] w-[18px] -ml-px" strokeWidth={1.75} />
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

type AuthorInfo = { name: string; avatar: string }

/** One page of GET /v1/groups/{id}/feed/v2 as useGroupFeedV2 stores it. */
type FeedPage = { data: GroupPostV2[]; offset: number }

const formatCount = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ── One post card ──
// Apple-ish: one hairline border, rounded-2xl, quiet secondary text,
// tabular-nums counts, and hover/active states that only tint.
function PostCard({
  post,
  groupId,
  groupColor,
  myId,
  resolveAuthor,
  sparked,
  echoed,
  onToggleSpark,
  onToggleEcho,
  onDelete,
}: {
  post: GroupPostV2
  groupId: string
  groupColor: string
  myId: string
  resolveAuthor: (userId: string) => AuthorInfo
  sparked: boolean
  echoed: boolean
  onToggleSpark: (post: GroupPostV2) => void
  onToggleEcho: (post: GroupPostV2) => void
  onDelete: (post: GroupPostV2) => void
}) {
  const [showComments, setShowComments] = useState(false)
  const [draft, setDraft] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)
  const viewRecorded = useRef(false)

  // Comments are only fetched once the thread is expanded — passing
  // undefined keeps the query disabled (see useGroupPostComments).
  const { data: comments, isLoading: commentsLoading } = useGroupPostComments(
    groupId,
    showComments ? post.id : undefined,
  )
  const addComment = useAddGroupPostComment()
  const deleteComment = useDeleteGroupPostComment()
  const recordView = useRecordGroupPostView()

  // A view is counted once per card per mount, when it is actually on screen.
  useEffect(() => {
    const el = cardRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && !viewRecorded.current) {
            viewRecorded.current = true
            recordView.mutate({ groupId, postId: post.id })
            obs.disconnect()
          }
        }
      },
      { threshold: 0.5 },
    )
    obs.observe(el)
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, post.id])

  const author = resolveAuthor(post.author_id)
  const isMine = !!myId && post.author_id === myId
  const attachments = (post.attachments ?? []).filter(a => typeof a === 'string' && a.length > 0)
  const bodyText = post.body?.trim() || post.title?.trim() || ''

  const submitComment = () => {
    const body = draft.trim()
    if (!body || addComment.isPending) return
    addComment.mutate(
      { groupId, postId: post.id, body },
      { onSuccess: () => setDraft('') },
    )
  }

  const pillBase =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors active:scale-95'

  return (
    <div
      ref={cardRef}
      className="group rounded-2xl border border-brand-divider bg-brand-card px-5 py-5 sm:px-6 transition-colors hover:border-brand-text/15"
    >
      {/* Badges */}
      {(post.is_pinned || post.is_announcement) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {post.is_pinned && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary-outline bg-primary-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-ink">
              <Pin className="h-3 w-3" strokeWidth={2} />
              Pinned
            </span>
          )}
          {post.is_announcement && (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: groupColor, background: `${groupColor}14`, borderColor: `${groupColor}33` }}
            >
              <Megaphone className="h-3 w-3" strokeWidth={2} />
              Announcement
            </span>
          )}
        </div>
      )}

      {/* Author */}
      <div className="flex items-start gap-3">
        <Avatar user={{ id: post.author_id, name: author.name, avatar: author.avatar }} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-brand-text">{author.name}</div>
          <div className="mt-0.5 text-[12px] text-brand-text/50">{relativeTime(post.created_at)}</div>
        </div>
        {isMine && (
          <button
            onClick={() => onDelete(post)}
            title="Delete post"
            aria-label="Delete post"
            className="rounded-full p-1.5 text-brand-text/30 opacity-0 transition-all hover:bg-brand-secondary hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 active:scale-95"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Title + body */}
      {post.title && post.body && (
        <h3 className="mt-4 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-brand-text">{post.title}</h3>
      )}
      <p
        className={`mt-3 text-[14px] leading-[1.6] wrap-break-word whitespace-pre-wrap ${
          bodyText ? 'text-brand-text' : 'italic text-brand-text/40'
        }`}
      >
        {bodyText || 'No text'}
      </p>

      {/* Attachments (media ids from the post itself) */}
      {attachments.length > 0 && (
        <div className={`mt-4 grid gap-1.5 overflow-hidden rounded-xl ${attachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {attachments.slice(0, 4).map(id => (
            <img
              key={id}
              src={`/v1/media/${id}/serve`}
              alt=""
              className={`w-full rounded-lg bg-brand-secondary object-cover ${attachments.length === 1 ? 'max-h-72' : 'h-36'}`}
            />
          ))}
        </div>
      )}

      {/* Engagement bar */}
      <div className="mt-4 flex items-center gap-1 border-t border-brand-divider pt-3">
        <button
          onClick={() => onToggleSpark(post)}
          aria-pressed={sparked}
          className={`${pillBase} ${sparked ? 'bg-brand-secondary text-danger' : 'text-brand-text/50 hover:bg-brand-secondary hover:text-brand-text'}`}
        >
          <Heart className={`h-4 w-4 ${sparked ? 'fill-current' : ''}`} strokeWidth={1.75} />
          <span className="tabular-nums">{formatCount(post.spark_count)}</span>
        </button>

        <button
          onClick={() => setShowComments(v => !v)}
          aria-expanded={showComments}
          className={`${pillBase} ${showComments ? 'bg-brand-secondary text-brand-text' : 'text-brand-text/50 hover:bg-brand-secondary hover:text-brand-text'}`}
        >
          <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
          <span className="tabular-nums">{formatCount(post.comment_count)}</span>
        </button>

        <button
          onClick={() => onToggleEcho(post)}
          aria-pressed={echoed}
          title={echoed ? 'Undo echo' : 'Echo to your feed'}
          className={`${pillBase} ${echoed ? 'bg-primary-tint text-primary-ink' : 'text-brand-text/50 hover:bg-brand-secondary hover:text-brand-text'}`}
        >
          <Repeat2 className="h-4 w-4" strokeWidth={1.75} />
          <span className="tabular-nums">{formatCount(post.echo_count)}</span>
        </button>

        <span className="ml-auto inline-flex items-center gap-1.5 pr-1 text-[12px] text-brand-text/40">
          <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="tabular-nums">{formatCount(post.view_count)}</span>
        </span>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-4 flex flex-col gap-3 border-t border-brand-divider pt-4">
          {commentsLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map(i => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="h-7 w-7 animate-pulse rounded-full bg-brand-secondary" />
                  <div className="flex flex-1 flex-col gap-1.5 pt-1">
                    <div className="h-2.5 w-24 animate-pulse rounded-full bg-brand-secondary" />
                    <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-brand-secondary" />
                  </div>
                </div>
              ))}
            </div>
          ) : (comments?.length ?? 0) === 0 ? (
            <p className="text-[12px] text-brand-text/40">No comments yet.</p>
          ) : (
            comments!.map(comment => {
              const cAuthor = resolveAuthor(comment.user_id)
              const mine = !!myId && comment.user_id === myId
              return (
                <div key={comment.id} className="flex items-start gap-2.5">
                  <Avatar user={{ id: comment.user_id, name: cAuthor.name, avatar: cAuthor.avatar }} size={28} />
                  <div className="min-w-0 flex-1 rounded-2xl bg-brand-secondary px-3.5 py-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[12px] font-semibold text-brand-text">{cAuthor.name}</span>
                      <span className="text-[11px] text-brand-text/40">{relativeTime(comment.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-[13px] leading-[1.55] wrap-break-word whitespace-pre-wrap text-brand-text/80">
                      {comment.body}
                    </p>
                  </div>
                  {mine && (
                    <button
                      onClick={() => deleteComment.mutate({ groupId, postId: post.id, commentId: comment.id })}
                      disabled={deleteComment.isPending}
                      title="Delete comment"
                      aria-label="Delete comment"
                      className="mt-1 rounded-full p-1.5 text-brand-text/30 transition-colors hover:bg-brand-secondary hover:text-danger active:scale-95 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              )
            })
          )}

          {/* Composer */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex flex-1 items-center gap-1 rounded-full bg-brand-secondary px-1.5 ring-1 ring-transparent transition-colors focus-within:ring-brand-divider">
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitComment() }}
                placeholder="Write a comment"
                disabled={addComment.isPending}
                className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[13px] text-brand-text outline-hidden placeholder:text-brand-text/40"
              />
              <button
                onClick={submitComment}
                disabled={!draft.trim() || addComment.isPending}
                aria-label="Post comment"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-90 disabled:opacity-40"
                style={{ backgroundColor: groupColor }}
              >
                <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
          {addComment.isError && (
            <p className="text-[12px] text-danger">Could not post that comment. Try again.</p>
          )}
        </div>
      )}
    </div>
  )
}

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
  const myId = me?.id ?? ''
  const qc = useQueryClient()
  const { data: feedData, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useGroupFeedV2(groupId)
  const sparkMut = useSparkGroupPostV2()
  const unsparkMut = useUnsparkGroupPostV2()
  const echoMut = useEchoGroupPostV2()
  const unechoMut = useUnechoGroupPostV2()
  const deletePostMut = useDeleteGroupPostV2()
  const [showCreatePost, setShowCreatePost] = useState(false)

  // No local "did I react" state. The feed carries `viewer_sparked` and
  // `viewer_echoed`, so it survives a reload and is right in a second tab;
  // optimistic toggles are written into the cached feed itself, below.

  const memberMap = useMemo(() => {
    const m = new Map<string, GroupMember>()
    members.forEach(mb => m.set(mb.user_id, mb))
    return m
  }, [members])

  const resolveAuthor = (userId: string): AuthorInfo => {
    const mb = memberMap.get(userId)
    const name = mb?.display_name || mb?.username || 'Unknown'
    return { name, avatar: getInitials(name) }
  }

  const allPosts = feedData?.pages?.flatMap(p => p.data) ?? []
  // Pinned first, otherwise the server's order is kept.
  const posts = [...allPosts.filter(p => p.is_pinned), ...allPosts.filter(p => !p.is_pinned)]

  /**
   * Optimistic patch straight into the cached feed: the count AND the
   * viewer's own flag move together, so the number and the filled icon
   * never disagree, and the next refetch overwrites both with the truth.
   *
   * Writing the flag into the cache rather than holding it in component
   * state is what makes this survive: the card reads one source, and a
   * refetch replaces it wholesale instead of fighting a local override.
   */
  const patchEngagement = (
    postId: string,
    kind: 'spark' | 'echo',
    delta: number,
    viewerFlag: boolean,
  ) => {
    qc.setQueryData<InfiniteData<FeedPage, number>>(['group-feed-v2', groupId], prev => {
      if (!prev) return prev
      return {
        ...prev,
        pages: prev.pages.map(page => ({
          ...page,
          data: page.data.map(p => {
            if (p.id !== postId) return p
            return kind === 'spark'
              ? { ...p, spark_count: Math.max(0, (p.spark_count ?? 0) + delta), viewer_sparked: viewerFlag }
              : { ...p, echo_count: Math.max(0, (p.echo_count ?? 0) + delta), viewer_echoed: viewerFlag }
          }),
        })),
      }
    })
  }

  const handleToggleSpark = (post: GroupPostV2) => {
    // `=== true` rather than `?? true`: Go sends `false` for a viewer who
    // has not reacted and omits the field entirely for an anonymous one,
    // and both have to read as "not reacted".
    const was = post.viewer_sparked === true
    const delta = was ? -1 : 1
    patchEngagement(post.id, 'spark', delta, !was)
    const mut = was ? unsparkMut : sparkMut
    mut.mutate(
      { groupId, postId: post.id },
      { onError: () => patchEngagement(post.id, 'spark', -delta, was) },
    )
  }

  const handleToggleEcho = (post: GroupPostV2) => {
    const was = post.viewer_echoed === true
    const delta = was ? -1 : 1
    patchEngagement(post.id, 'echo', delta, !was)
    const mut = was ? unechoMut : echoMut
    mut.mutate(
      { groupId, postId: post.id },
      { onError: () => patchEngagement(post.id, 'echo', -delta, was) },
    )
  }

  const handleDeletePost = (post: GroupPostV2) => {
    if (!confirm('Delete this post?')) return
    deletePostMut.mutate({ groupId, postId: post.id })
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 flex flex-col gap-5 scrollbar-hide bg-brand-secondary/30 relative">
      {/* CreatePortal modal for group posts */}
      {showCreatePost && (
        <div className="fixed inset-0 z-2000 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <CreatePortal onClose={() => setShowCreatePost(false)} groupId={groupId} />
        </div>
      )}

      {/* Floating new post button */}
      <button
        onClick={() => setShowCreatePost(true)}
        className="fixed bottom-8 right-8 xl:right-12 z-100 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
        style={{ backgroundColor: groupColor }}
        title="New post"
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
      </button>

      <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
        {isLoading ? (
          <>
            {[1, 2].map(i => (
              <div key={i} className="rounded-2xl border border-brand-divider bg-brand-card px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-brand-secondary" />
                  <div className="flex flex-col gap-2">
                    <div className="h-3 w-28 animate-pulse rounded-full bg-brand-secondary" />
                    <div className="h-2 w-16 animate-pulse rounded-full bg-brand-secondary" />
                  </div>
                </div>
                <div className="mt-5 h-3 w-full animate-pulse rounded-full bg-brand-secondary" />
                <div className="mt-2.5 h-3 w-3/4 animate-pulse rounded-full bg-brand-secondary" />
                <div className="mt-5 flex gap-3 border-t border-brand-divider pt-4">
                  <div className="h-6 w-14 animate-pulse rounded-full bg-brand-secondary" />
                  <div className="h-6 w-14 animate-pulse rounded-full bg-brand-secondary" />
                  <div className="h-6 w-14 animate-pulse rounded-full bg-brand-secondary" />
                </div>
              </div>
            ))}
          </>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-divider bg-brand-card py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-secondary">
              <FileText className="h-7 w-7 text-brand-text/30" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-semibold tracking-[-0.01em] text-brand-text">No posts yet</p>
            <p className="mt-1 text-[12px] text-brand-text/50">Be the first to share something.</p>
          </div>
        ) : (
          <>
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                groupId={groupId}
                groupColor={groupColor}
                myId={myId}
                resolveAuthor={resolveAuthor}
                sparked={post.viewer_sparked === true}
                echoed={post.viewer_echoed === true}
                onToggleSpark={handleToggleSpark}
                onToggleEcho={handleToggleEcho}
                onDelete={handleDeletePost}
              />
            ))}
            {hasNextPage && (
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="mx-auto mt-1 rounded-full border border-brand-divider bg-brand-card px-5 py-2 text-[13px] font-medium text-brand-text/70 transition-colors hover:bg-brand-secondary hover:text-brand-text active:scale-95 disabled:opacity-50"
              >
                {isFetchingNextPage ? 'Loading…' : 'Show older posts'}
              </button>
            )}
          </>
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
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex gap-3 py-3 px-2 flex-col justify-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-secondary animate-pulse" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="w-32 h-3 rounded-full bg-brand-secondary animate-pulse" />
                <div className="w-20 h-2.5 rounded-full bg-brand-secondary animate-pulse" />
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
        className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-brand-secondary transition-colors cursor-pointer group"
      >
        <Avatar
          user={{ id: m.user_id, name, avatar: getInitials(name), isOnline: false }}
          size={38}
          showStatus
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-brand-text text-[13px] group-hover:text-brand-text transition-colors">{name}</span>
            {isAdmin && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md tracking-wider" style={{ color: groupColor, background: `${groupColor}15` }}>Admin</span>
            )}
            {isMod && (
              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md tracking-wider">Mod</span>
            )}
          </div>
          {m.username && (
            <div className="text-brand-text/60 text-[11px] font-medium mt-0.5">@{m.username}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide">
      <div className="flex items-center gap-2 px-3 mb-2">
        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
        <div className="text-brand-highlight text-[11px] font-bold tracking-widest">
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
            <div className="text-brand-text/60 text-[11px] font-bold tracking-widest">
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
        <div className="text-center py-12 flex flex-col items-center justify-center text-brand-text/60 bg-brand-secondary rounded-2xl border border-brand-divider border-dashed mx-3">
          <Users className="w-12 h-12 mb-3 text-brand-text/30" strokeWidth={1.5} />
          <div className="text-[13px] font-medium text-brand-highlight">No members found</div>
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
  { mode: 'members', icon: Users, label: 'Members' },
]

export default function GroupPanel(props: GroupPanelProps) {
  const { groupId } = props
  const router = useRouter()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<PanelMode>('chat')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
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
  const handleGroupCreated = (newGroupId: string) => {
    setShowCreateGroupModal(false)
    if (props.onCreateGroup) {
      props.onCreateGroup(newGroupId)
      return
    }
    router.push(`/groups/${newGroupId}`)
  }

  return (
    <div className="w-full min-w-0 flex flex-col h-full font-sans">
      {/* ── Header ── */}
      <div className="px-8 py-5 border-b border-brand-divider shrink-0 z-20">
        <div className="flex items-center justify-between">
          {/* Left: icon · name · info */}
          <div className="flex items-center gap-4">
            <button
              onClick={props.onClose}
              className="md:hidden p-2 -ml-2 flex items-center justify-center text-brand-highlight hover:bg-brand-secondary hover:text-brand-text rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Group icon */}
            <div
              className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-xs"
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
              {/* Plain heading. This used to navigate to /groups/<id>,
                  which threw you out of the messenger onto another page —
                  everything the group needs (chat, posts, members, rename,
                  add member, leave) is already on this panel. */}
              <h1 className="font-semibold text-brand-text text-[16px] tracking-tight leading-tight">
                {groupName}
              </h1>
              <p className="text-brand-text/60 text-[12px] font-medium mt-0.5">
                {groupLoading ? '...' : `${memberCount} members`}
              </p>
            </div>
          </div>

          {/* Center: mode toggle */}
          <div className="flex bg-brand-secondary rounded-lg p-1 border border-brand-divider">
            {MODE_TABS.map(tab => {
              const active = mode === tab.mode
              const Icon = tab.icon
              return (
                <button
                  key={tab.mode}
                  onClick={() => setMode(tab.mode)}
                  className={`py-2 px-5 rounded-md text-[13px] font-medium transition-all duration-200 flex items-center justify-center gap-2 ${active
                    ? 'bg-brand-card shadow-xs text-brand-text'
                    : 'text-brand-text/60 hover:text-brand-highlight'
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
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="hidden h-9 items-center gap-1.5 rounded-lg border border-brand-divider px-3 text-[12px] font-semibold text-brand-text transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 lg:inline-flex"
              title="Create a new group"
            >
              <Plus className="h-4 w-4" />
              New Group
            </button>
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="w-9 h-9 flex items-center justify-center text-brand-text/60 hover:bg-brand-secondary hover:text-brand-text rounded-lg transition-colors lg:hidden"
              title="Create a new group"
            >
              <Plus className="w-[18px] h-[18px]" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center hover:bg-brand-secondary text-brand-text/60 hover:text-brand-highlight rounded-lg transition-colors">
              <Phone className="w-[18px] h-[18px]" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center hover:bg-brand-secondary text-brand-text/60 hover:text-brand-highlight rounded-lg transition-colors">
              <Video className="w-[18px] h-[18px]" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center hover:bg-brand-secondary text-brand-text/60 hover:text-brand-highlight rounded-lg transition-colors">
              <Search className="w-[18px] h-[18px]" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="w-9 h-9 flex items-center justify-center hover:bg-brand-secondary text-brand-text/60 hover:text-brand-highlight rounded-lg transition-colors"
              >
                <MoreVertical className="w-[18px] h-[18px]" />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-brand-card border border-brand-divider rounded-xl shadow-xl py-1.5 z-50">
                  <button
                    onClick={() => { setShowCreateGroupModal(true); setShowMoreMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-brand-text hover:bg-brand-secondary transition-colors"
                  >
                    <Plus className="w-4 h-4 text-brand-text/60" />
                    Create new group
                  </button>
                  <button
                    onClick={() => { setEditingName(true); setNewGroupName(groupName); setShowMoreMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-brand-text hover:bg-brand-secondary transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-brand-text/60" />
                    Edit group name
                  </button>
                  <button
                    onClick={() => { setShowAddMember(true); setShowMoreMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-brand-text hover:bg-brand-secondary transition-colors"
                  >
                    <UserPlus className="w-4 h-4 text-brand-text/60" />
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
      <AnimatePresence>
        {showCreateGroupModal && (
          <GroupCreateModal
            onClose={() => setShowCreateGroupModal(false)}
            onCreated={handleGroupCreated}
          />
        )}
      </AnimatePresence>

      {editingName && (
        <div className="fixed inset-0 z-2000 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-brand-card rounded-2xl p-6 w-[360px] shadow-xl">
            <h3 className="text-[16px] font-semibold text-brand-text mb-4">Edit group name</h3>
            <input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              className="w-full py-3 px-4 rounded-xl border border-brand-divider bg-brand-secondary text-brand-text text-[14px] outline-hidden focus:border-brand-text/30 focus:ring-2 focus:ring-brand-secondary mb-4"
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
              <button onClick={() => setEditingName(false)} className="px-4 py-2 rounded-lg border border-brand-divider text-brand-highlight text-[13px] hover:bg-brand-secondary">Cancel</button>
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
        <div className="fixed inset-0 z-2000 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-brand-card rounded-2xl p-6 w-[360px] shadow-xl">
            <h3 className="text-[16px] font-semibold text-brand-text mb-4">Add member</h3>
            <input
              value={addMemberId}
              onChange={e => setAddMemberId(e.target.value)}
              placeholder="Enter user ID"
              className="w-full py-3 px-4 rounded-xl border border-brand-divider bg-brand-secondary text-brand-text text-[14px] outline-hidden focus:border-brand-text/30 focus:ring-2 focus:ring-brand-secondary mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAddMember(false); setAddMemberId('') }} className="px-4 py-2 rounded-lg border border-brand-divider text-brand-highlight text-[13px] hover:bg-brand-secondary">Cancel</button>
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

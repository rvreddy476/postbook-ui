'use client';

import React, { useState, useRef, useEffect, lazy, Suspense, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../types';
import { getSession } from '../services/authService';
import {
  fetchMessages,
  sendMessage,
  toggleReaction,
  subscribeToMessages,
  subscribeToReactions,
  subscribeToTyping,
  sendTypingIndicator,
  getOrCreateDirectConversation,
  Message as BackendMessage,
  ReactionUpdate,
  TypingEvent
} from '../services/messageService';

import { initiateCall } from '../services/callService';
import { sendMediaMessage } from '../services/messageService';
import { uploadMedia } from '@/lib/mediaUpload';
import { useNotifications } from '@/contexts/NotificationContext';
import { useConversationPresence, useSetTyping } from '@/hooks/usePresence';
import { Phone, Video, Send, Smile, MessageCircle, MoreHorizontal, Link2, Image, Mic, Camera, X, Minus, Maximize2, ArrowDownToLine } from 'lucide-react';
import data from '@emoji-mart/data';
const EmojiPicker = lazy(() => import('@emoji-mart/react'));

interface ChatWindowProps {
  contact: User;
  onClose: () => void;
}

interface DisplayMessage {
  id: string;
  text: string;
  type: string;
  media_id?: string;
  sender: 'me' | 'contact';
  time: string;
  bucket: string;
  ts: string;
  conversationId: string;
  reactions: { emoji: string; user_ids: string[] }[];
}

const QUICK_REACTIONS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F525}'];

const ChatWindow: React.FC<ChatWindowProps> = ({ contact, onClose }) => {
  const currentUser = getSession();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const { markConversationAsViewed, unmarkConversationAsViewed, markConversationRead, registerConversationMapping } = useNotifications();
  const convIdRef = useRef<string | null>(null);
  // Mirror convIdRef into state so the M1 presence hook can react when
  // initChat resolves the real conversation id. The ref is what the
  // synchronous event handlers compare against; the state is what the
  // hook subscribes to.
  const [conversationId, setConversationId] = useState<string | null>(null);
  useConversationPresence(conversationId);
  const setTyping = useSetTyping(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentRef = useRef<number>(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myAvatar = currentUser?.avatar || '';

  const mapMessage = useCallback((m: BackendMessage): DisplayMessage => ({
    id: m.id,
    text: m.text || '',
    type: m.type || 'text',
    media_id: m.media_id,
    sender: m.sender_id === currentUser?.id ? 'me' : 'contact',
    bucket: m.bucket || '',
    ts: m.ts || m.created_at || '',
    conversationId: m.conversation_id,
    reactions: m.reactions || [],
    time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  }), [currentUser?.id]);

  const handleToggleReaction = async (msg: DisplayMessage, emoji: string) => {
    if (!currentUser || !convIdRef.current) return;

    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      const reactions = [...m.reactions];
      const idx = reactions.findIndex(r => r.emoji === emoji);

      if (idx > -1) {
        const userIdx = reactions[idx].user_ids.indexOf(currentUser.id);
        if (userIdx > -1) {
          const newUserIds = reactions[idx].user_ids.filter(id => id !== currentUser.id);
          if (newUserIds.length === 0) {
            reactions.splice(idx, 1);
          } else {
            reactions[idx] = { ...reactions[idx], user_ids: newUserIds };
          }
        } else {
          reactions[idx] = { ...reactions[idx], user_ids: [...reactions[idx].user_ids, currentUser.id] };
        }
      } else {
        reactions.push({ emoji, user_ids: [currentUser.id] });
      }

      return { ...m, reactions };
    }));

    try {
      await toggleReaction(convIdRef.current, msg.id, emoji, msg.bucket, msg.ts);
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!currentUser) return;

    const initChat = async () => {
      try {
        const convResult = await getOrCreateDirectConversation(contact.id);
        const convId = convResult.data.conversation_id || convResult.data.id;
        convIdRef.current = convId;
        setConversationId(convId);

        registerConversationMapping(contact.id, convId);
        markConversationAsViewed(convId);

        const historyResult = await fetchMessages(convId);
        const history: BackendMessage[] = historyResult.data;
        setMessages(history.map(mapMessage).reverse());

        if (history.length > 0) {
          const latestTs = history[0].created_at;
          markConversationRead(convId, latestTs);
        }
      } catch (err) {
        console.error("Failed to initialize chat:", err);
      }
    };

    initChat();

    const unsubMsg = subscribeToMessages((newMsg: BackendMessage) => {
      if (newMsg.conversation_id === convIdRef.current ||
        (newMsg.sender_id === contact.id && !convIdRef.current)) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, mapMessage(newMsg)];
        });
      }
    });

    const unsubTyping = subscribeToTyping((evt: TypingEvent) => {
      if (evt.conversation_id !== convIdRef.current) return;
      if (evt.user_id === currentUser?.id) return;
      if (evt.is_typing) {
        setIsTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setIsTyping(false), 3000);
      } else {
        setIsTyping(false);
      }
    });

    const unsubRxn = subscribeToReactions((update: ReactionUpdate) => {
      if (update.conversation_id !== convIdRef.current) return;
      setMessages(prev => prev.map(m => {
        if (m.id !== update.message_id) return m;
        const reactions = [...m.reactions];
        const idx = reactions.findIndex(r => r.emoji === update.emoji);

        if (update.added) {
          if (idx > -1) {
            if (!reactions[idx].user_ids.includes(update.user_id)) {
              reactions[idx] = { ...reactions[idx], user_ids: [...reactions[idx].user_ids, update.user_id] };
            }
          } else {
            reactions.push({ emoji: update.emoji, user_ids: [update.user_id] });
          }
        } else {
          if (idx > -1) {
            const newUserIds = reactions[idx].user_ids.filter(id => id !== update.user_id);
            if (newUserIds.length === 0) {
              reactions.splice(idx, 1);
            } else {
              reactions[idx] = { ...reactions[idx], user_ids: newUserIds };
            }
          }
        }

        return { ...m, reactions };
      }));
    });

    return () => {
      unsubMsg();
      unsubTyping();
      unsubRxn();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (convIdRef.current) {
        unmarkConversationAsViewed(convIdRef.current);
      }
    };
  }, [contact.id, currentUser?.id, mapMessage, markConversationAsViewed, unmarkConversationAsViewed, markConversationRead, registerConversationMapping]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const convId = convIdRef.current;
    if (!input.trim() || !currentUser || !convId) return;

    const text = input;
    setInput('');
    setShowEmojiPicker(false);

    try {
      const result = await sendMessage(convId, text);
      const newMsg = result.data;
      const displayMsg = mapMessage(newMsg);
      setMessages(prev => {
        if (prev.some(m => m.id === displayMsg.id)) return prev;
        return [...prev, displayMsg];
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    setInput(prev => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !convIdRef.current) return;
    e.target.value = '';
    try {
      const mediaId = await uploadMedia(file, 'image');
      const result = await sendMediaMessage(convIdRef.current, mediaId, 'image');
      const displayMsg = mapMessage(result.data);
      setMessages(prev => prev.some(m => m.id === displayMsg.id) ? prev : [...prev, displayMsg]);
    } catch (err) {
      console.error('Failed to send image:', err);
    }
  };

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-t-2xl bg-brand-bg shadow-2xl transition-all duration-300 w-[320px] sm:w-[360px] ${isMinimized ? 'h-16' : 'h-[460px] sm:h-[500px]'}`}>
      {/* Chat Header */}
      <header
        className="flex h-16 shrink-0 items-center justify-between border-b border-brand-divider px-5 cursor-pointer"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-3.5">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-transparent transition-all hover:ring-brand-secondary">
            <img src={contact.avatar} alt={contact.name} className="h-full w-full object-cover" />
            {contact.isOnline && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            )}
          </div>
          <div className="flex flex-col">
            <h3 className="text-[15px] font-extrabold tracking-tight text-brand-text">{contact.name}</h3>
            <p className="text-[11px] font-semibold tracking-wide text-brand-text/60">
              {contact.isOnline ? <span className="text-emerald-500">Active now</span> : 'Offline'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-brand-text/60">
          <button onClick={() => initiateCall(contact, 'audio')} className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-brand-secondary hover:text-brand-text active:scale-95">
            <Phone className="h-4 w-4" />
          </button>
          <button onClick={() => initiateCall(contact, 'video')} className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-brand-secondary hover:text-brand-text active:scale-95">
            <Video className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-brand-secondary hover:text-brand-highlight active:scale-95">
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-brand-secondary hover:text-red-500 active:scale-95">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {!isMinimized && (
        <>
          {/* Messages Area */}
          <div ref={scrollRef} className="scrollbar-hide flex-1 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
                  <MessageCircle className="h-8 w-8 text-indigo-500/70" />
                </div>
                <p className="text-sm font-extrabold text-brand-text">Start a conversation</p>
                <p className="mt-1 text-[12px] font-medium text-brand-text/60">Say hello to {contact.name}</p>
              </div>
            )}

            <div className="space-y-2">
              {messages.map((msg) => {
                const isMe = msg.sender === 'me';
                const isHovered = hoveredMessage === msg.id;
                const hasReactions = msg.reactions.length > 0;
                const avatarUrl = isMe ? myAvatar : contact.avatar;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="group/msg"
                    onMouseEnter={() => setHoveredMessage(msg.id)}
                    onMouseLeave={() => setHoveredMessage(null)}
                  >
                    <div className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar */}
                      <div className="mt-1 h-8 w-8 flex-shrink-0 overflow-hidden rounded-full">
                        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                      </div>

                      {/* Content */}
                      <div className={`relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Quick reactions on hover */}
                        <AnimatePresence>
                          {isHovered && (
                            <motion.div
                              initial={{ opacity: 0, y: 4, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className={`absolute -top-8 z-20 flex gap-0.5 rounded-full border border-brand-divider bg-brand-card p-1 shadow-lg ${isMe ? 'right-0' : 'left-0'}`}
                            >
                              {QUICK_REACTIONS.map(e => (
                                <button
                                  key={e}
                                  onClick={() => handleToggleReaction(msg, e)}
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-[13px] transition-all hover:scale-125 hover:bg-brand-secondary active:scale-90"
                                >
                                  {e}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Message Bubble */}
                        {msg.media_id ? (
                          <div className={`group/media relative max-w-[220px] overflow-hidden rounded-2xl shadow-sm ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                            <img
                              src={`/v1/media/${msg.media_id}/serve`}
                              alt=""
                              className="h-auto w-full object-cover"
                              loading="lazy"
                            />
                            <a
                              href={`/v1/media/${msg.media_id}/serve`}
                              download
                              onClick={(e) => e.stopPropagation()}
                              className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/media:opacity-100 hover:bg-black/70"
                              title="Download"
                            >
                              <ArrowDownToLine className="h-3.5 w-3.5" />
                            </a>
                            {msg.text && (
                              <div className={`px-3 py-1.5 text-[13px] leading-snug ${isMe ? 'bg-indigo-600 text-white' : 'border border-brand-divider bg-brand-card text-brand-text'}`}>
                                {msg.text}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={`max-w-[220px] break-words rounded-2xl px-3 py-1.5 text-[13px] leading-snug shadow-sm ${isMe
                            ? 'rounded-tr-sm bg-indigo-600 text-white'
                            : 'rounded-tl-sm border border-brand-divider bg-brand-card text-brand-text'
                            }`}>
                            {msg.text}
                          </div>
                        )}

                        {/* Time */}
                        <span className="mt-0.5 px-1 text-[9px] text-brand-text/60">{msg.time}</span>

                        {/* Reaction pills */}
                        {hasReactions && (
                          <div className={`mt-1 flex flex-wrap gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {msg.reactions.map(({ emoji, user_ids }) => (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(msg, emoji)}
                                className={`flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-sm transition-all hover:scale-110 ${user_ids.includes(currentUser?.id || '')
                                  ? 'border border-indigo-200 bg-indigo-50 text-indigo-700'
                                  : 'border border-brand-divider bg-brand-card text-brand-highlight'
                                  }`}
                              >
                                <span>{emoji}</span>
                                {user_ids.length > 1 && <span className="text-[9px] opacity-70">{user_ids.length}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {isTyping && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex items-start gap-3">
                <div className="mt-1 h-8 w-8 flex-shrink-0 overflow-hidden rounded-full">
                  <img src={contact.avatar} alt="" className="h-full w-full object-cover" />
                </div>
                <div>
                  <div className="mb-1 px-1">
                    <span className="text-[10px] font-bold text-brand-text">{contact.name}</span>
                  </div>
                  <div className="flex gap-1.5 rounded-2xl rounded-tl-none border border-brand-secondary bg-brand-card px-5 py-3.5 shadow-sm">
                    {[0, 1, 2].map(d => (
                      <motion.span
                        key={d}
                        animate={{ y: [0, -3, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: d * 0.15 }}
                        className="h-1.5 w-1.5 rounded-full bg-brand-text/30"
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Emoji Picker — rendered outside footer so it's not clipped */}
          <AnimatePresence>
            {showEmojiPicker && (
              <div ref={emojiPickerRef} className="absolute bottom-16 right-3 z-50">
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                >
                  <div className="overflow-hidden rounded-2xl border border-brand-divider shadow-xl">
                    <Suspense fallback={
                      <div className="flex h-[435px] w-[352px] items-center justify-center bg-brand-card">
                        <span className="text-xs font-medium text-brand-text/30">Loading emojis...</span>
                      </div>
                    }>
                      <EmojiPicker
                        data={data}
                        onEmojiSelect={handleEmojiSelect}
                        theme="light"
                        previewPosition="none"
                        skinTonePosition="none"
                        perLine={9}
                        maxFrequentRows={2}
                      />
                    </Suspense>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <footer className="border-t border-brand-divider p-3">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-2xl bg-brand-secondary px-4 py-2 ring-1 ring-brand-secondary transition-all focus-within:ring-slate-200">
                <input
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setTyping();
                    const now = Date.now();
                    if (convIdRef.current && now - lastTypingSentRef.current > 2000) {
                      lastTypingSentRef.current = now;
                      sendTypingIndicator(convIdRef.current).catch(() => { });
                    }
                  }}
                  placeholder="Write a message..."
                  className="flex-1 bg-transparent py-1 text-[13px] font-medium text-brand-text outline-none placeholder:text-brand-text/60"
                />
                <div className="flex items-center gap-1 text-brand-text/60">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-brand-secondary hover:text-brand-text ${showEmojiPicker ? 'bg-brand-secondary text-brand-text' : ''}`}
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-brand-secondary hover:text-brand-text"
                  >
                    <Image className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-700 active:scale-90 disabled:opacity-30 disabled:shadow-none"
              >
                <Send className="h-4 w-4 -ml-0.5" />
              </button>
            </form>
          </footer>
        </>
      )}
    </div>
  );
};

export default ChatWindow;

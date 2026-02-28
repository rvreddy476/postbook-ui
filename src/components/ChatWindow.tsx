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
import { useNotifications } from '@/contexts/NotificationContext';
import data from '@emoji-mart/data';
const EmojiPicker = lazy(() => import('@emoji-mart/react'));

interface ChatWindowProps {
  contact: User;
  onClose: () => void;
}

interface DisplayMessage {
  id: string;
  text: string;
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

  const { markConversationAsViewed, unmarkConversationAsViewed, markConversationRead, registerConversationMapping } = useNotifications();
  const convIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const lastTypingSentRef = useRef<number>(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapMessage = useCallback((m: BackendMessage): DisplayMessage => ({
    id: m.id,
    text: m.text || '',
    sender: m.sender_id === currentUser?.id ? 'me' : 'contact',
    bucket: m.bucket || '',
    ts: m.ts || m.created_at || '',
    conversationId: m.conversation_id,
    reactions: m.reactions || [],
    time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }), [currentUser?.id]);

  const handleToggleReaction = async (msg: DisplayMessage, emoji: string) => {
    if (!currentUser || !convIdRef.current) return;

    // Optimistic update
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

  // Close emoji picker when clicking outside
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

        registerConversationMapping(contact.id, convId);
        markConversationAsViewed(convId);

        const historyResult = await fetchMessages(convId);
        const history: BackendMessage[] = historyResult.data;
        setMessages(history.map(mapMessage).reverse());

        // Mark conversation as read using the latest message timestamp
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

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-t-[2rem] border-x border-t border-slate-200/50 bg-white/90 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15)] backdrop-blur-3xl transition-all duration-500">
      {/* Header */}
      <div className="relative flex items-center justify-between border-b border-slate-100/60 bg-white/40 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="relative group">
            <div className="w-10 h-10 rounded-2xl overflow-hidden ring-2 ring-white shadow-sm transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3">
              <img src={contact.avatar} className="w-full h-full object-cover" alt="" />
            </div>
            {contact.isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
              </span>
            )}
          </div>
          <div>
            <h3 className="text-[13px] font-black text-slate-900 tracking-tight leading-none">{contact.name}</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest flex items-center gap-1.5">
              <span className={`w-1 h-1 rounded-full ${contact.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {contact.isOnline ? 'Active Now' : 'Disconnected'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => initiateCall(contact, 'audio')}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500 transition-all duration-300 shadow-sm border border-slate-100/50"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
            </svg>
          </button>
          <button
            onClick={() => initiateCall(contact, 'video')}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/50 text-slate-400 hover:bg-violet-50 hover:text-violet-500 transition-all duration-300 shadow-sm border border-slate-100/50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="group flex items-center justify-center w-8 h-8 rounded-xl bg-white/50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all duration-300 shadow-sm border border-slate-100/50"
          >
            <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="scrollbar-hide flex-1 space-y-1.5 overflow-y-auto bg-slate-50/20 px-5 py-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-violet-50 to-fuchsia-50 flex items-center justify-center shadow-inner relative group overflow-hidden">
              <div className="absolute inset-0 bg-violet-400/5 scale-0 group-hover:scale-150 transition-transform duration-1000 rounded-full" />
              <svg className="w-8 h-8 text-violet-400 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Ethereal Silence</p>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Transmit a pulse to begin</p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.sender === 'me';
          const isLastInCluster = idx === messages.length - 1 || messages[idx + 1].sender !== msg.sender;
          const showAvatar = isLastInCluster && !isMe;
          const isHovered = hoveredMessage === msg.id;
          const hasReactions = msg.reactions.length > 0;

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: isMe ? 10 : -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-end gap-2 group relative ${isMe ? 'justify-end pl-10' : 'justify-start pr-10'} ${hasReactions ? 'mb-3' : ''}`}
              onMouseEnter={() => setHoveredMessage(msg.id)}
              onMouseLeave={() => setHoveredMessage(null)}
            >
              {!isMe && (
                <div className="w-7 h-7 shrink-0 mb-1">
                  {showAvatar && (
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="w-full h-full rounded-[0.6rem] overflow-hidden shadow-sm border border-white ring-1 ring-slate-100">
                      <img src={contact.avatar} className="w-full h-full object-cover" alt="" />
                    </motion.div>
                  )}
                </div>
              )}

              <div className={`flex flex-col gap-1 max-w-full relative ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Quick reaction bar on hover */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.8, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                      className={`absolute -top-10 z-20 flex gap-0.5 p-1 bg-white/90 backdrop-blur-xl rounded-full shadow-xl border border-slate-100/50 ${isMe ? 'right-0' : 'left-0'}`}
                    >
                      {QUICK_REACTIONS.map(e => (
                        <button
                          key={e}
                          onClick={() => handleToggleReaction(msg, e)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all text-[14px] hover:scale-125 active:scale-90"
                        >
                          {e}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Message Bubble */}
                <div className={`px-4 py-3 rounded-[1.3rem] text-[13px] font-medium leading-[1.6] transition-all duration-300 relative ${isMe
                  ? 'orchid-gradient text-white rounded-br-none shadow-[0_8px_20px_-8px_rgba(124,58,237,0.3)]'
                  : 'bg-white text-slate-800 rounded-bl-none border border-slate-200/40 shadow-sm hover:border-slate-300/60'
                  }`}>
                  {msg.text}

                  {/* Reaction pills */}
                  {hasReactions && (
                    <div className={`absolute -bottom-3.5 flex gap-1 ${isMe ? 'right-1' : 'left-1'}`}>
                      {msg.reactions.map(({ emoji, user_ids }) => (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(msg, emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 bg-white/90 backdrop-blur-md rounded-full border shadow-sm text-[10px] font-black transition-all hover:scale-110 ${user_ids.includes(currentUser?.id || '') ? 'border-violet-200 bg-violet-50 text-violet-600' : 'border-slate-100 text-slate-500'}`}
                        >
                          <span>{emoji}</span>
                          {user_ids.length > 1 && <span className="text-[8px]">{user_ids.length}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div className={`flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className="text-[8px] font-black tracking-widest text-slate-300 uppercase italic">{msg.time}</span>
                  {isMe && <div className="w-1 h-1 bg-violet-300 rounded-full" />}
                </div>
              </div>
            </motion.div>
          );
        })}

        {isTyping && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start pl-9 py-2">
            <div className="flex gap-1.5 bg-white/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
              {[0, 2, 4].map(d => (
                <motion.span
                  key={d}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: d * 0.1 }}
                  className="w-1.5 h-1.5 bg-violet-400/40 rounded-full"
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Input area as a floating capsule */}
      <div className="px-5 pb-5 pt-3 bg-gradient-to-t from-white/90 to-transparent backdrop-blur-sm">
        <form onSubmit={handleSend} className="flex items-center gap-2 bg-white p-1.5 rounded-[2rem] border border-slate-200/60 shadow-[0_15px_35px_-12px_rgba(0,0,0,0.08)] focus-within:ring-4 focus-within:ring-violet-500/5 focus-within:border-violet-200 transition-all duration-300">
          <div className="relative" ref={emojiPickerRef}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showEmojiPicker ? 'bg-violet-50 text-violet-600 shadow-inner' : 'bg-transparent text-slate-400 hover:bg-slate-50'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>

            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.9, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: 15, scale: 0.9, filter: 'blur(8px)' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="absolute bottom-full left-0 mb-4 z-50"
                >
                  <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-100 ring-1 ring-black/5">
                    <Suspense fallback={<div className="w-[352px] h-[435px] bg-white flex items-center justify-center"><span className="text-slate-300 font-black text-[10px] uppercase tracking-widest animate-pulse">Initializing Interface...</span></div>}>
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
              )}
            </AnimatePresence>
          </div>

          <div className="relative flex-1">
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const now = Date.now();
                if (convIdRef.current && now - lastTypingSentRef.current > 2000) {
                  lastTypingSentRef.current = now;
                  sendTypingIndicator(convIdRef.current).catch(() => {});
                }
              }}
              placeholder="Transmit signal..."
              className="w-full bg-transparent px-3 py-2 text-[13px] font-medium text-slate-900 outline-none placeholder:text-slate-300 italic"
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim()}
            className="w-10 h-10 orchid-gradient text-white rounded-full flex items-center justify-center shadow-[0_8px_15px_-5px_rgba(219,39,119,0.3)] disabled:scale-95 disabled:grayscale disabled:opacity-40 transition-all hover:scale-105 active:scale-95 group"
          >
            <svg className="w-[18px] h-[18px] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;

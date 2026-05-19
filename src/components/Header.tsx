'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, NavItem } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useMyProfile } from '@/hooks/useEditProfile';
import { useNotifications } from '@/contexts/NotificationContext';
import { searchUsers } from '@/services/userService';
import { Sun, Moon } from 'lucide-react';
import {
  useActivityNotifications,
  useNotificationStream,
  useActorProfiles,
  useUnreadCount,
  useMarkAllRead,
  useMarkNotificationRead,
  useDeleteNotification,
  type ActivityNotification,
} from '@/hooks/useActivityNotifications';
import { useAcceptFriendRequest, useRejectFriendRequest } from '@/hooks/useConnections';
import NotificationPostPopup from '@/components/NotificationPostPopup';
import { playNotificationSound } from '@/hooks/useNotificationSound';
import { useGlobalToast } from '@/contexts/ToastContext';

interface HeaderProps {
  currentUser: User;
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  onCreateClick: () => void;
  onLogout: () => void;
  onToggleContactList: () => void;
  navExpanded?: boolean;
}

const Header: React.FC<HeaderProps> = ({ currentUser, activeTab, setActiveTab, onCreateClick, onLogout, onToggleContactList, navExpanded = false }) => {
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { data: profile } = useMyProfile();
  const { totalUnread } = useNotifications();
  const { data: activityData } = useActivityNotifications(20);
  const activityNotifs = activityData?.items ?? [];
  const { data: unreadData } = useUnreadCount();
  const unreadNotifCount = unreadData?.count ?? activityNotifs.filter(n => !n.is_read).length;
  const markAllRead = useMarkAllRead();
  const markRead = useMarkNotificationRead();
  const deleteNotification = useDeleteNotification();

  const toast = useGlobalToast();
  const acceptFriend = useAcceptFriendRequest();
  const rejectFriend = useRejectFriendRequest();
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());

  // Theme toggle state
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('postbook_theme') || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('postbook_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Notification popup state
  const [popupPostId, setPopupPostId] = useState<string | null>(null);
  const [popupFocusCommentId, setPopupFocusCommentId] = useState<string | undefined>();
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  // Actor profiles for display names
  const actorIds = activityNotifs.map(n => n.actor_user_id);
  const actorProfiles = useActorProfiles(actorIds);

  const getActorName = (id: string) => {
    const p = actorProfiles.get(id);
    return p?.display_name || id.slice(0, 8);
  };

  const getActorAvatar = (id: string) => {
    const p = actorProfiles.get(id);
    return p?.avatar_media_id
      ? `/v1/media/${p.avatar_media_id}/serve`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`;
  };

  // Real-time SSE stream — just increment badge count (no popup toast)
  useNotificationStream(() => {});

  const avatarSrc = profile?.avatar_media_id
    ? `/v1/media/${profile.avatar_media_id}/serve`
    : currentUser.avatar;

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (
        searchRef.current && !searchRef.current.contains(event.target as Node) &&
        mobileSearchRef.current && !mobileSearchRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      } else if (searchRef.current && !searchRef.current.contains(event.target as Node) && !mobileSearchRef.current) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setShowResults(true);
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchUsers(value, 8);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
  }, []);

  const handleSelectUser = (user: User) => {
    const target = user.username || user.id;
    router.push(`/u/${target}`);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setIsSearchOpen(false);
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  };

  // Parse deep_link like "/post/{postId}?focusComment={commentId}"
  const parseDeepLink = (link: string): { postId?: string; commentId?: string } => {
    const match = link.match(/^\/post\/([^?/]+)/);
    if (!match) return {};
    const postId = match[1];
    const urlParams = new URLSearchParams(link.split('?')[1] || '');
    return { postId, commentId: urlParams.get('focusComment') || undefined };
  };

  const isPostNotification = (type: string) =>
    ['comment', 'reaction', 'comment_reaction'].includes(type);

  const handleNotificationClick = (notif: ActivityNotification) => {
    const actorUsername = actorProfiles.get(notif.actor_user_id)?.username;

    // Mark as read
    if (!notif.is_read && notif.bucket != null && notif.ts != null) {
      markRead.mutate({ bucket: notif.bucket, ts: notif.ts });
    }

    // Start dismiss animation
    setDismissingIds(prev => new Set(prev).add(notif.notification_id));
    setTimeout(() => {
      setDismissingIds(prev => {
        const next = new Set(prev);
        next.delete(notif.notification_id);
        return next;
      });
    }, 300);

    if (isPostNotification(notif.type) && notif.deep_link) {
      // Open popup for post-related notifications
      const { postId, commentId } = parseDeepLink(notif.deep_link);
      if (postId) {
        setPopupPostId(postId);
        setPopupFocusCommentId(commentId);
        setIsNotifOpen(false);
      }
    } else {
      // Navigate for user-related notifications (follow, friend_request, etc.)
      const target = notif.deep_link || `/u/${actorUsername || notif.actor_user_id}`;
      router.push(target);
      setIsNotifOpen(false);
    }
  };

  // Search results dropdown (shared between desktop and mobile)
  const renderSearchResults = () => {
    if (!showResults || (!searchQuery.trim())) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        className="absolute top-full left-0 right-0 mt-2 bg-brand-card rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-brand-divider overflow-hidden z-[200]"
      >
        {isSearching ? (
          <div className="px-4 py-6 flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-brand-text/30 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-bold text-brand-text/60 uppercase tracking-widest">Searching...</span>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[11px] font-bold text-brand-text/60 uppercase tracking-widest">No users found</p>
          </div>
        ) : (
          <div className="py-1.5 max-h-[320px] overflow-y-auto">
            {searchResults.map(user => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brand-secondary transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl overflow-hidden border border-brand-divider flex-shrink-0">
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-brand-text truncate">{user.name}</p>
                  {user.username && (
                    <p className="text-[10px] text-brand-text/60 font-medium truncate">@{user.username}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <header className={`fixed top-0 z-[100] h-20 bg-brand-text text-brand-bg border-b border-brand-divider dark:bg-brand-bg dark:text-brand-text px-6 flex items-center justify-between transition-all duration-500 ${navExpanded ? 'md:left-64' : 'md:left-16'} left-0 right-0`}>
      {/* Desktop Search */}
      <div className="hidden md:flex items-center" ref={searchRef}>
        <div className="relative w-64 group">
          <input
            type="text"
            placeholder="Search network..."
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => { if (searchQuery.trim()) setShowResults(true); }}
            className="w-full bg-white/10 border border-white/20 text-white placeholder-white/40 focus:ring-brand-accent focus:bg-white/20 dark:bg-brand-secondary dark:border-brand-divider dark:text-brand-text dark:placeholder-brand-text/30 dark:focus:ring-brand-accent rounded-full py-2 pl-10 pr-4 text-sm outline-none transition-all"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-white/70 dark:text-brand-text/40 dark:group-focus-within:text-brand-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-white/70 hover:bg-white/30 dark:bg-brand-secondary dark:text-brand-highlight dark:hover:bg-brand-secondary/80 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
          <AnimatePresence>
            {renderSearchResults()}
          </AnimatePresence>
        </div>
      </div>

      {/* Mac-Style Navigation Group */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Mobile Search Toggle */}
        <button
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl text-white/60 hover:text-white dark:text-brand-text/60 dark:hover:text-brand-accent transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </button>

        {/* 1. Post/Manifest */}
        <button
          onClick={onCreateClick}
          className="group relative flex items-center justify-center w-10 h-10 rounded-xl hover:scale-110 active:scale-95 transition-all duration-300"
          title="Create Post"
        >
          <div className="w-5 h-5 text-violet-400 group-hover:text-violet-300 transition-colors">
            <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <span className="absolute -bottom-10 bg-brand-text text-brand-bg text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all font-black uppercase tracking-widest whitespace-nowrap z-[200]">Create</span>
        </button>

        {/* 2. Chat/Messenger */}
        <button
          onClick={onToggleContactList}
          className="group relative flex items-center justify-center w-10 h-10 rounded-xl hover:scale-110 active:scale-95 transition-all duration-300"
          title="Messenger"
        >
          <div className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 transition-colors">
            <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          {totalUnread > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-brand-accent text-white text-[9px] font-black rounded-full shadow-sm">
              {totalUnread > 99 ? '99+' : totalUnread}
            </div>
          )}
          <span className="absolute -bottom-10 bg-brand-text text-brand-bg text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all font-black uppercase tracking-widest whitespace-nowrap z-[200]">Messages</span>
        </button>

        {/* 3. Reels */}
        <button
          onClick={() => setActiveTab('Reels')}
          className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 ${activeTab === 'Reels' ? 'text-white dark:text-brand-accent' : ''}`}
          title="Reels"
        >
          <div className={`w-5 h-5 transition-colors ${activeTab === 'Reels' ? 'text-fuchsia-300' : 'text-fuchsia-400 group-hover:text-fuchsia-300'}`}>
            <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <span className="absolute -bottom-10 bg-brand-text text-brand-bg text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all font-black uppercase tracking-widest whitespace-nowrap z-[200]">Reels</span>
        </button>

        {/* 4. TV — opens PostTube in new tab */}
        <Link
          href="/posttube"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative hidden sm:flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95"
          title="TV"
        >
          <div className="w-5 h-5 text-orange-400 group-hover:text-orange-300 transition-colors">
            <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="absolute -bottom-10 bg-brand-text text-brand-bg text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all font-black uppercase tracking-widest whitespace-nowrap z-[200]">TV</span>
        </Link>

        {/* 5. Events */}
        <button
          className="group relative hidden sm:flex items-center justify-center w-10 h-10 rounded-xl hover:scale-110 active:scale-95 transition-all duration-300"
          title="Events"
        >
          <div className="w-5 h-5 text-amber-400 group-hover:text-amber-300 transition-colors">
            <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="absolute -bottom-10 bg-brand-text text-brand-bg text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all font-black uppercase tracking-widest whitespace-nowrap z-[200]">Events</span>
        </button>

        {/* 5b. Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="group relative hidden sm:flex items-center justify-center w-10 h-10 rounded-xl hover:scale-110 active:scale-95 transition-all duration-300"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <div className="w-5 h-5 text-sky-300 group-hover:text-sky-200 transition-colors">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </div>
        </button>

        {/* 6. Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 ${isNotifOpen ? 'text-white dark:text-brand-accent' : ''}`}
            title="Notifications"
          >
            <div className={`w-5 h-5 transition-colors ${isNotifOpen ? 'text-rose-300' : 'text-rose-400 group-hover:text-rose-300'}`}>
              <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            {unreadNotifCount > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-brand-accent text-white text-[9px] font-black rounded-full shadow-sm">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </div>
            )}
            {unreadNotifCount === 0 && activityNotifs.length > 0 && (
              <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-brand-accent" />
            )}
          </button>

          <AnimatePresence>
            {isNotifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "circOut" }}
                className="absolute right-0 mt-3 w-[340px] bg-brand-card border border-brand-divider rounded-2xl shadow-xl overflow-hidden z-[1000]"
              >
                <div className="p-4 border-b border-brand-divider/60 flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-brand-text/60 uppercase tracking-widest">Notifications</h3>
                  {unreadNotifCount > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      disabled={markAllRead.isPending}
                      className="flex items-center gap-1 text-[9px] font-black text-brand-text/50 hover:text-brand-text uppercase tracking-widest transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {activityNotifs.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <div className="text-2xl mb-2">&#128276;</div>
                      <p className="text-[10px] font-bold text-brand-text/60 uppercase tracking-widest">No notifications yet</p>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {activityNotifs.filter(n => !dismissingIds.has(n.notification_id)).map(notif => {
                        const isHandled = handledIds.has(notif.notification_id);
                        const isFriendReq = notif.type === 'friend_request' && !isHandled;
                        const actorName = getActorName(notif.actor_user_id);
                        const actorAvatar = getActorAvatar(notif.actor_user_id);
                        const actorUsername = actorProfiles.get(notif.actor_user_id)?.username;

                        return (
                          <motion.div
                            key={notif.notification_id}
                            layout
                            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                            transition={{ duration: 0.3 }}
                            className={`group/notif flex items-start gap-3 px-4 py-3 hover:bg-brand-secondary/60 transition-colors ${!notif.is_read ? 'bg-brand-text/30' : ''}`}
                          >
                            {/* Avatar — click to go to profile */}
                            <button
                              onClick={() => {
                                router.push(`/u/${actorUsername || notif.actor_user_id}`);
                                setIsNotifOpen(false);
                              }}
                              className="w-10 h-10 rounded-xl overflow-hidden border border-brand-divider flex-shrink-0 mt-0.5 shadow-sm"
                            >
                              <img src={actorAvatar} alt={actorName} className="w-full h-full object-cover" />
                            </button>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => handleNotificationClick(notif)}
                                className="text-left w-full"
                              >
                                <p className="text-[11px] font-bold text-brand-text/80 leading-snug">
                                  <span className="font-black text-brand-text">{actorName}</span>
                                  {' '}
                                  {notif.type === 'friend_request' && 'sent you a friend request'}
                                  {notif.type === 'friend_accepted' && 'accepted your friend request'}
                                  {notif.type === 'follow' && 'started following you'}
                                  {notif.type === 'reaction' && 'sparked your post \u2726'}
                                  {notif.type === 'comment_reaction' && 'sparked your comment \u2726'}
                                  {notif.type === 'comment' && 'commented on your post'}
                                </p>
                                <p className="text-[9px] text-brand-text/60 font-bold uppercase tracking-widest mt-0.5">
                                  {formatTimeAgo(notif.created_at)}
                                </p>
                              </button>

                              {/* Accept / Reject buttons for friend requests */}
                              {isFriendReq && (
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    onClick={() => {
                                      // graph-service accept is keyed by the requester's
                                      // user_id — actor_user_id is exactly that.
                                      acceptFriend.mutate(notif.actor_user_id, {
                                        onSuccess: () => {
                                          setHandledIds(prev => new Set(prev).add(notif.notification_id));
                                          toast({ type: 'success', title: 'Friend request accepted' });
                                        },
                                      });
                                    }}
                                    disabled={acceptFriend.isPending}
                                    className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider orchid-gradient text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => {
                                      rejectFriend.mutate(notif.actor_user_id, {
                                        onSuccess: () => {
                                          setHandledIds(prev => new Set(prev).add(notif.notification_id));
                                          toast({ type: 'info', title: 'Friend request declined' });
                                        },
                                      });
                                    }}
                                    disabled={rejectFriend.isPending}
                                    className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-brand-secondary text-brand-highlight hover:bg-brand-secondary/80 active:scale-95 transition-all"
                                  >
                                    Decline
                                  </button>
                                </div>
                              )}

                              {/* Show "Accepted" / "Declined" after handling */}
                              {notif.type === 'friend_request' && isHandled && (
                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1.5">Responded</p>
                              )}
                            </div>

                            {/* Unread dot + delete button */}
                            <div className="flex flex-col items-center gap-1.5 flex-shrink-0 mt-1">
                              {!notif.is_read && (
                                <div className="w-2 h-2 rounded-full bg-brand-text/50" />
                              )}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  if (notif.bucket != null && notif.ts != null) {
                                    deleteNotification.mutate({ bucket: notif.bucket, ts: notif.ts });
                                  }
                                }}
                                className="opacity-0 group-hover/notif:opacity-100 w-5 h-5 flex items-center justify-center rounded-full text-brand-text/30 hover:text-rose-500 hover:bg-rose-50 transition-all"
                                title="Delete notification"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 7. Profile */}
        <div className="relative ml-1 sm:ml-2" ref={dropdownRef}>
          <div className="flex items-center gap-2">
            <Link href="/profile">
              <button
                className="p-0.5 bg-brand-accent rounded-full hover:scale-105 active:scale-95 transition-all duration-500"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden bg-brand-bg">
                  <img src={avatarSrc} alt={currentUser.name} className="w-full h-full object-cover" />
                </div>
              </button>
            </Link>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-6 h-10 flex items-center justify-center text-white/60 hover:text-white dark:text-brand-text/60 dark:hover:text-brand-accent transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>

          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "circOut" }}
                className="absolute right-0 mt-3 w-64 bg-brand-card border border-brand-divider rounded-2xl shadow-xl p-1.5 z-[1000]"
              >
                {/* 1. Identity Segment - Ultra Compact */}
                <div className="p-3 border-b border-brand-divider/60 mb-1">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-brand-card shadow-md ring-1 ring-brand-divider">
                        <img src={avatarSrc} alt={currentUser.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[11px] font-black text-brand-text uppercase tracking-widest truncate">{profile?.display_name || currentUser.name}</h4>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-1 h-1 rounded-full bg-emerald-500" />
                        <span className="text-[8px] font-bold text-brand-text/60 uppercase tracking-widest">Online</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Slim Menu Navigation */}
                <div className="space-y-0.5">
                  <Link href="/profile" onClick={() => setIsProfileOpen(false)}>
                    <div className="group w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-brand-secondary transition-all cursor-pointer">
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-secondary text-brand-text/60 group-hover:bg-brand-text/5 group-hover:text-brand-text transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-black text-brand-highlight uppercase tracking-widest group-hover:text-brand-text">Profile</span>
                    </div>
                  </Link>

                  <Link href="/settings/profile" onClick={() => setIsProfileOpen(false)}>
                    <div className="group w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-brand-secondary transition-all cursor-pointer">
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-secondary text-brand-text/60 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-black text-brand-highlight uppercase tracking-widest group-hover:text-brand-text">Settings</span>
                    </div>
                  </Link>
                </div>

                {/* 3. Session Section */}
                <div className="mt-1 pt-1 border-t border-brand-divider/60">
                  <button
                    onClick={onLogout}
                    className="group w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-rose-50/50 transition-all text-rose-500"
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-500 group-hover:bg-rose-100 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Logout</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Search Panel */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -80 }}
            className="fixed top-20 left-0 w-full px-4 py-3 bg-brand-card border-b border-brand-divider z-[90] md:hidden shadow-lg"
            ref={mobileSearchRef}
          >
            <div className="relative">
              <input
                autoFocus
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                className="w-full bg-brand-secondary border border-brand-divider rounded-2xl py-3 px-12 text-xs font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-brand-text/10 transition-all"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-brand-secondary text-brand-highlight hover:bg-brand-secondary/80 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
              <AnimatePresence>
                {renderSearchResults()}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Notification Post Popup */}
      {popupPostId && (
        <NotificationPostPopup
          postId={popupPostId}
          focusCommentId={popupFocusCommentId}
          onClose={() => { setPopupPostId(null); setPopupFocusCommentId(undefined); }}
        />
      )}
    </header>
  );
};

export default Header;

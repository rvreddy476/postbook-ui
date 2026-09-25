'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, NavItem } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useMyProfile } from '@/hooks/useEditProfile';
import { useNotifications } from '@/contexts/NotificationContext';
import { searchUsers } from '@/services/userService';
import { Sun, Moon, ChevronLeft } from 'lucide-react';
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

/**
 * The sentence shown beside the actor's name.
 *
 * This was a chain of inline `type === '…' && '…'` expressions covering
 * follow, reaction, comment, comment_reaction, friend_request and
 * friend_accepted — and nothing else. A `dm` notification, which is most of
 * a real inbox, matched none of them and rendered a name followed by
 * NOTHING: a count in the badge and rows that said nothing. Anything
 * unrecognised now falls back to a sentence rather than to emptiness.
 */
function describeNotification(type: string): string {
  switch (type) {
    case 'friend_request':
      return 'sent you a connection request'
    case 'friend_accepted':
      return 'accepted your connection request'
    case 'follow':
      return 'started following you'
    case 'reaction':
      return 'sparked your post ✦'
    case 'comment_reaction':
      return 'sparked your comment ✦'
    case 'comment':
      return 'commented on your post'
    case 'dm':
      return 'sent you a message'
    case 'message_request':
      return 'wants to send you a message'
    case 'mention':
      return 'mentioned you'
    case 'creator_uploaded_video':
      return 'uploaded a new video'
    case 'creator_uploaded_flick':
      return 'uploaded a new flick'
    case 'incoming_call':
      return 'called you'
    case 'incoming_video_call':
      return 'video called you'
    case 'missed_call':
      return 'tried to call you'
    default:
      return 'sent you a notification'
  }
}

/**
 * Where a notification should take you.
 *
 * Message notifications were written with a `/messages/<conversationId>`
 * deep link, and `/messages` is not a route in this app — only `/messenger`
 * is — so tapping one navigated to a 404. The server emits the right link
 * now, but every row already in the database still carries the old one, so
 * they are translated here too.
 */
function notificationHref(deepLink: string | undefined, actorId: string, actorUsername?: string): string {
  if (deepLink) {
    const legacyRequests = deepLink === '/messages/requests'
    if (legacyRequests) return '/messenger?lane=requests'
    if (deepLink.startsWith('/messages/') || deepLink.startsWith('/call/')) {
      // Neither /messages/<id> nor /call/<id> (nor /call/history) is a
      // route in this app. The actor is the peer either way, and the
      // messenger's ?user= opens the conversation with them — which is
      // where a call is placed from.
      return `/messenger?user=${encodeURIComponent(actorId)}`
    }
    if (deepLink.startsWith('/channels/')) {
      // channel-service still emits /channels/<id>, and it must keep doing so
      // — the mobile app routes on it. The web dropped that page, so the link
      // is translated to the messenger's channel panel, which is the only
      // channel surface on the web. Anything after the id (a ?update= query,
      // say) is carried across so a "new update" notification still lands on
      // the right channel.
      const rest = deepLink.slice('/channels/'.length)
      const [id, query] = [rest.split(/[?#]/)[0], rest.slice(rest.split(/[?#]/)[0].length)]
      if (id) {
        return `/messenger?lane=channels&channel=${encodeURIComponent(id)}${query.startsWith('?') ? `&${query.slice(1)}` : ''}`
      }
      return '/messenger?lane=channels'
    }
    return deepLink
  }
  return `/u/${actorUsername || actorId}`
}

interface HeaderProps {
  currentUser: User;
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  onCreateClick: () => void;
  onLogout: () => void;
  /** Span the full viewport width (pages that hide the icon rail). */
  fullWidth?: boolean;
  onToggleContactList: () => void;
  navExpanded?: boolean;
}

const Header: React.FC<HeaderProps> = ({ currentUser, activeTab, setActiveTab, onCreateClick, onLogout, onToggleContactList, navExpanded = false, fullWidth = false }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  /** Notifications that were unread when this panel was opened. Opening
   *  clears the badge, but these stay highlighted until it closes. */
  const [justReadIds, setJustReadIds] = useState<Set<string>>(new Set());
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
  const qc = useQueryClient();

  /**
   * Accept / Decline used to have onSuccess and nothing else. A failure —
   * the founder hit six 500s in a row from a notification whose request
   * had already been cancelled — showed no message, re-enabled the button,
   * and invited the next click. "Nothing is happening" was exactly right.
   *
   * Now the server's reason is shown, and if the request is simply gone
   * (already accepted, declined or cancelled elsewhere) the row is settled
   * and the lists refreshed, so a stale notification cannot be clicked
   * forever.
   */
  const settleRequestFailure = (err: unknown, notif: ActivityNotification) => {
    const message =
      (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
        ?.message ?? (err instanceof Error ? err.message : 'Request failed');
    const gone = /no pending connection request/i.test(message);
    if (gone) {
      setHandledIds(prev => new Set(prev).add(notif.notification_id));
      if (notif.bucket != null && notif.ts != null) {
        markRead.mutate({ bucket: notif.bucket, ts: notif.ts });
      }
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
      qc.invalidateQueries({ queryKey: ['activity-notifications'] });
      toast({ type: 'info', title: 'This request is no longer pending' });
      return;
    }
    toast({ type: 'error', title: "Couldn't update the request", description: message });
  };

  // Theme toggle state
  const [theme, setTheme] = useState<string>('light');

  useEffect(() => {
    const stored = localStorage.getItem('postbook_theme') || 'light';
    setTheme(stored);
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('postbook_theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
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
      // Navigate for user-related notifications (follow, friend_request, dm…)
      router.push(notificationHref(notif.deep_link, notif.actor_user_id, actorUsername));
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
        className="absolute top-full left-0 right-0 mt-2 bg-brand-card rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border border-brand-divider overflow-hidden z-200"
      >
        {isSearching ? (
          <div className="px-4 py-6 flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-brand-text/30 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-bold text-brand-text/60 tracking-widest">Searching...</span>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[11px] font-bold text-brand-text/60 tracking-widest">No users found</p>
          </div>
        ) : (
          <div className="py-1.5 max-h-[320px] overflow-y-auto">
            {searchResults.map(user => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brand-secondary transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl overflow-hidden border border-brand-divider shrink-0">
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
    // Translucent chrome: content scrolls UNDER the bar, which is what tells
    // you the page is behind it. Falls back to the solid token where
    // backdrop-filter is unsupported.
    // Three columns, not a flex row with space-between: the outer columns are
    // both 1fr, so the middle one is centred on the BAR regardless of how wide
    // the logo or the action rail happen to be. With space-between the search
    // only ever sat next to the logo and drifted whenever either side changed.
    <header className={`fixed top-0 z-100 h-16 bg-brand-bg/80 supports-[backdrop-filter]:bg-brand-bg/70 backdrop-blur-xl backdrop-saturate-150 text-brand-text border-b border-brand-divider px-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 transition-[left] duration-300 ease-out ${fullWidth ? '' : navExpanded ? 'md:left-64' : 'md:left-16'} left-0 right-0`}>
      {/* Column 1 — brand mark, constant on every route */}
      <div className="flex items-center gap-2 justify-self-start">
        {/* Back, on phones only. A phone's browser has no app back button
            in reach and the sidebar is collapsed, so a page like a profile
            or a conversation had no visible way out except the address bar.
            Hidden from md up — desktop has the sidebar and a browser back
            button under the mouse. Hidden on the home route too, where
            "back" would only leave the app. Falls back to home when there
            is no history to go back to (a link opened in a fresh tab). */}
        {pathname !== '/' && (
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) router.back();
              else router.push('/');
            }}
            aria-label="Back"
            title="Back"
            className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-brand-text/70 transition-colors hover:bg-brand-secondary hover:text-brand-text active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {/*
          The "VC" badge lived here and is now the wordmark on the left rail,
          spelled out. Two marks for one product, one of them an abbreviation
          nobody had been taught, was a name doing less work than the space it
          took.
        */}
      </div>

      {/* Column 2 — search, centred on the bar */}
      <div className="hidden md:flex items-center justify-self-center" ref={searchRef}>
        <div className="relative w-72 group">
          <input
            type="text"
            placeholder="Search network..."
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => { if (searchQuery.trim()) setShowResults(true); }}
            className="w-full bg-brand-secondary border border-brand-divider text-brand-text placeholder-brand-text/40 focus:ring-brand-accent focus:bg-brand-secondary dark:bg-brand-secondary dark:border-brand-divider dark:text-brand-text dark:placeholder-brand-text/30 dark:focus:ring-brand-accent rounded-full py-2 pl-10 pr-4 text-sm outline-hidden transition-all"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/40 group-focus-within:text-brand-text/70 dark:text-brand-text/40 dark:group-focus-within:text-primary-ink transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-brand-secondary text-brand-text/70 hover:bg-brand-secondary dark:bg-brand-secondary dark:text-brand-highlight dark:hover:bg-brand-secondary/80 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
          <AnimatePresence>
            {renderSearchResults()}
          </AnimatePresence>
        </div>
      </div>

      {/* Column 3 — action rail.
          The icons sit in a recessed track, the same material as the
          segmented control, so they read as ONE group of peers rather than
          six loose glyphs floating on the bar. The account avatar stays
          outside it — it is not a peer of these actions, it is who you are. */}
      <div className="flex items-center gap-2 justify-self-end">
        {/* Mobile Search Toggle */}
        <button
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          className="md:hidden w-10 h-10 flex items-center justify-center rounded-full text-brand-text/60 hover:text-brand-text transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </button>

        <div className="flex items-center gap-1 rounded-full bg-brand-secondary px-2 py-1.5">

        {/* 1. Post/Manifest */}
        <button
          onClick={onCreateClick}
          className="group relative flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-200 hover:bg-brand-bg active:scale-95"
          title="Create Post"
        >
          <div className="w-5 h-5 text-brand-text/70 group-hover:text-primary-ink transition-colors">
            <svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <span className="absolute -bottom-10 bg-brand-text text-brand-bg text-[9px] px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 pointer-events-none transition-all font-black tracking-widest whitespace-nowrap z-200">Create</span>
        </button>

        {/* 2. Chat/Messenger */}
        <button
          onClick={onToggleContactList}
          className="group relative flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-200 hover:bg-brand-bg active:scale-95"
          title="Messenger"
        >
          <div className="w-5 h-5 text-brand-text/70 group-hover:text-primary-ink transition-colors">
            <svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          {totalUnread > 0 && (
            <div className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 flex items-center justify-center bg-primary-ink text-white text-[10px] font-semibold tabular-nums rounded-full ring-2 ring-brand-secondary">
              {totalUnread > 99 ? '99+' : totalUnread}
            </div>
          )}
          <span className="absolute -bottom-10 bg-brand-text text-brand-bg text-[9px] px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 pointer-events-none transition-all font-black tracking-widest whitespace-nowrap z-200">Messages</span>
        </button>

        {/* 3. Reels */}
        <button
          onClick={() => setActiveTab('Reels')}
          className={`group relative flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-200 hover:bg-brand-bg active:scale-95 ${activeTab === 'Reels' ? 'text-primary-ink' : ''}`}
          title="Reels"
        >
          <div className={`w-5 h-5 transition-colors ${activeTab === 'Reels' ? 'text-primary-ink' : 'text-brand-text/70 group-hover:text-primary-ink'}`}>
            <svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <span className="absolute -bottom-10 bg-brand-text text-brand-bg text-[9px] px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 pointer-events-none transition-all font-black tracking-widest whitespace-nowrap z-200">Reels</span>
        </button>

        {/* 4. TV — opens PostTube in new tab */}
        <Link
          href="/posttube"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative hidden sm:flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-200 hover:bg-brand-bg active:scale-95"
          title="TV"
        >
          <div className="w-5 h-5 text-brand-text/70 group-hover:text-primary-ink transition-colors">
            <svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="absolute -bottom-10 bg-brand-text text-brand-bg text-[9px] px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 pointer-events-none transition-all font-black tracking-widest whitespace-nowrap z-200">TV</span>
        </Link>

        {/* 5. Events */}
        <button
          className="group relative hidden sm:flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-200 hover:bg-brand-bg active:scale-95"
          title="Events"
        >
          <div className="w-5 h-5 text-brand-text/70 group-hover:text-primary-ink transition-colors">
            <svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="absolute -bottom-10 bg-brand-text text-brand-bg text-[9px] px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 pointer-events-none transition-all font-black tracking-widest whitespace-nowrap z-200">Events</span>
        </button>



        {/* 6. Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              const opening = !isNotifOpen;
              setIsNotifOpen(opening);
              // Opening the panel IS reading them, so the badge clears.
              // It used to clear only when you clicked each row or pressed
              // "Mark all as read", so reading the list left the number
              // standing.
              //
              // The rows keep their unread styling until the panel closes
              // — justReadIds remembers which ones were new — so clearing
              // the badge does not also erase what you had not seen.
              if (opening && unreadNotifCount > 0) {
                setJustReadIds(
                  new Set(
                    activityNotifs.filter(n => !n.is_read).map(n => n.notification_id),
                  ),
                );
                markAllRead.mutate();
              } else if (!opening) {
                setJustReadIds(new Set());
              }
            }}
            className={`group relative flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-200 hover:bg-brand-bg active:scale-95 ${isNotifOpen ? 'text-primary-ink' : ''}`}
            title="Notifications"
          >
            <div className={`w-5 h-5 transition-colors ${isNotifOpen ? 'text-primary-ink' : 'text-brand-text/70 group-hover:text-primary-ink'}`}>
              <svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            {unreadNotifCount > 0 && (
              <div className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 flex items-center justify-center bg-primary-ink text-white text-[10px] font-semibold tabular-nums rounded-full ring-2 ring-brand-secondary">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </div>
            )}
            {unreadNotifCount === 0 && activityNotifs.length > 0 && (
              <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary-ink" />
            )}
          </button>

          <AnimatePresence>
            {isNotifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "circOut" }}
                className="absolute right-0 mt-3 w-[340px] bg-brand-card border border-brand-divider rounded-2xl shadow-xl overflow-hidden z-1000"
              >
                <div className="p-4 border-b border-brand-divider/60 flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-brand-text/60 tracking-widest">Notifications</h3>
                  {unreadNotifCount > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      disabled={markAllRead.isPending}
                      className="flex items-center gap-1 text-[9px] font-black text-brand-text/50 hover:text-brand-text tracking-widest transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
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
                      <p className="text-[10px] font-bold text-brand-text/60 tracking-widest">No notifications yet</p>
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
                            className={`group/notif flex items-start gap-3 px-4 py-3 hover:bg-brand-secondary/60 transition-colors ${!notif.is_read || justReadIds.has(notif.notification_id) ? "bg-brand-text/30" : ""}`}
                          >
                            {/* Avatar — click to go to profile */}
                            <button
                              onClick={() => {
                                router.push(`/u/${actorUsername || notif.actor_user_id}`);
                                setIsNotifOpen(false);
                              }}
                              className="w-10 h-10 rounded-xl overflow-hidden border border-brand-divider shrink-0 mt-0.5 shadow-xs"
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
                                  {describeNotification(notif.type)}
                                </p>
                                <p className="text-[9px] text-brand-text/60 font-bold tracking-widest mt-0.5">
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
                                          if (notif.bucket != null && notif.ts != null) {
                                            markRead.mutate({ bucket: notif.bucket, ts: notif.ts });
                                          }
                                          toast({ type: 'success', title: 'Connection request accepted' });
                                        },
                                        onError: (err) => settleRequestFailure(err, notif),
                                      });
                                    }}
                                    disabled={acceptFriend.isPending}
                                    className="px-3 py-1.5 rounded-lg text-[9px] font-black tracking-wider bg-primary-ink hover:bg-primary-hover text-white shadow-xs active:scale-95 transition-all"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => {
                                      rejectFriend.mutate(notif.actor_user_id, {
                                        onSuccess: () => {
                                          setHandledIds(prev => new Set(prev).add(notif.notification_id));
                                          if (notif.bucket != null && notif.ts != null) {
                                            markRead.mutate({ bucket: notif.bucket, ts: notif.ts });
                                          }
                                          toast({ type: 'info', title: 'Connection request declined' });
                                        },
                                        onError: (err) => settleRequestFailure(err, notif),
                                      });
                                    }}
                                    disabled={rejectFriend.isPending}
                                    className="px-3 py-1.5 rounded-lg text-[9px] font-black tracking-wider bg-brand-secondary text-brand-highlight hover:bg-brand-secondary/80 active:scale-95 transition-all"
                                  >
                                    Decline
                                  </button>
                                </div>
                              )}

                              {/* Show "Accepted" / "Declined" after handling */}
                              {notif.type === 'friend_request' && isHandled && (
                                <p className="text-[9px] font-black text-success tracking-widest mt-1.5">Responded</p>
                              )}
                            </div>

                            {/* Unread dot + delete button */}
                            <div className="flex flex-col items-center gap-1.5 shrink-0 mt-1">
                              {(!notif.is_read || justReadIds.has(notif.notification_id)) && (
                                <div className="w-2 h-2 rounded-full bg-brand-text/50" />
                              )}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  if (notif.bucket != null && notif.ts != null) {
                                    deleteNotification.mutate({ bucket: notif.bucket, ts: notif.ts });
                                  }
                                }}
                                className="opacity-0 group-hover/notif:opacity-100 w-5 h-5 flex items-center justify-center rounded-full text-brand-text/30 hover:text-danger hover:bg-danger/10 transition-all"
                                title="Delete notification"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
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

        </div>
        {/* end of the action rail */}

        {/* Appearance moved into the profile menu — see below. The top bar is
            for things you reach constantly; theme is a preference you set once,
            so it belongs with the other account settings rather than competing
            with the actions beside it. */}

        {/* 7. Profile — outside the rail on purpose. */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center gap-2">
            <Link href="/profile">
              <button
                className="p-0.5 bg-primary-ink rounded-full transition-transform duration-200 ease-out active:scale-95"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden bg-brand-bg">
                  <img src={avatarSrc} alt={currentUser.name} className="w-full h-full object-cover" />
                </div>
              </button>
            </Link>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="w-6 h-10 flex items-center justify-center text-brand-text/60 hover:text-brand-text dark:text-brand-text/60 dark:hover:text-primary-ink transition-colors"
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
                className="absolute right-0 mt-3 w-64 bg-brand-card border border-brand-divider rounded-2xl shadow-xl p-1.5 z-1000"
              >
                {/* 1. Identity Segment - Ultra Compact */}
                <div className="p-3 border-b border-brand-divider/60 mb-1">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-brand-card shadow-md ring-1 ring-brand-divider">
                        <img src={avatarSrc} alt={currentUser.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-brand-bg" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[11px] font-black text-brand-text tracking-widest truncate">{profile?.display_name || currentUser.name}</h4>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-1 h-1 rounded-full bg-success" />
                        <span className="text-[8px] font-bold text-brand-text/60 tracking-widest">Online</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Slim Menu Navigation */}
                <div className="space-y-0.5">
                  <Link href="/profile" onClick={() => setIsProfileOpen(false)}>
                    <div className="group w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-brand-secondary transition-all cursor-pointer">
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-secondary text-brand-text/60 group-hover:bg-brand-text/5 group-hover:text-brand-text transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-black text-brand-highlight tracking-widest group-hover:text-brand-text">Profile</span>
                    </div>
                  </Link>

                  <Link href="/settings/profile" onClick={() => setIsProfileOpen(false)}>
                    <div className="group w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-brand-secondary transition-all cursor-pointer">
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-secondary text-brand-text/60 group-hover:bg-primary-tint group-hover:text-primary-ink transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-black text-brand-highlight tracking-widest group-hover:text-brand-text">Settings</span>
                    </div>
                  </Link>

                  {/* Appearance. A preference, not an action, so it lives with
                      the account items and keeps its state visible rather than
                      making you guess what the icon will do. */}
                  <button
                    onClick={toggleTheme}
                    className="group w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-brand-secondary transition-colors cursor-pointer"
                    aria-pressed={theme === 'dark'}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-secondary text-brand-text/60 group-hover:bg-primary-tint group-hover:text-primary-ink transition-colors">
                        {theme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
                      </div>
                      <span className="text-[10px] font-black text-brand-highlight tracking-widest group-hover:text-brand-text">
                        Dark mode
                      </span>
                    </div>
                    {/* Switch: the track fills with the accent when on, and the
                        knob slides rather than jumping between two states. */}
                    <span
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
                        theme === 'dark' ? 'bg-primary-ink' : 'bg-brand-text/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-200 ease-out ${
                          theme === 'dark' ? 'translate-x-[18px]' : 'translate-x-0.5'
                        }`}
                      />
                    </span>
                  </button>
                </div>

                {/* 3. Session Section */}
                <div className="mt-1 pt-1 border-t border-brand-divider/60">
                  <button
                    onClick={onLogout}
                    className="group w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-danger/5 transition-all text-danger"
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-danger/10 text-danger group-hover:bg-danger/15 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </div>
                    <span className="text-[10px] font-black tracking-widest">Logout</span>
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
            className="fixed top-20 left-0 w-full px-4 py-3 bg-brand-card border-b border-brand-divider z-90 md:hidden shadow-lg"
            ref={mobileSearchRef}
          >
            <div className="relative">
              <input
                autoFocus
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                className="w-full bg-brand-secondary border border-brand-divider rounded-2xl py-3 px-12 text-xs font-black tracking-widest outline-hidden focus:ring-4 focus:ring-brand-text/10 transition-all"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-brand-secondary text-brand-highlight hover:bg-brand-secondary/80 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
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

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Lock, MessageCircle, Plus, Search, Users, MessagesSquare, Minus, SquarePen } from 'lucide-react';

import CreateGroupPanel from '@/components/messenger/CreateGroupPanel';
import NewMessageSheet from '@/components/messenger/NewMessageSheet';
import { useNotifications } from '@/contexts/NotificationContext';
import { useMyGroups } from '@/hooks/useGroups';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { getSession } from '@/services/authService';
import { subscribeToPresenceUpdates } from '@/services/messageService';
import { fetchCircleMembers } from '@/services/userService';
import { User } from '@/types';

enum ChatTab {
  Direct = 'direct',
  Groups = 'groups',
}

const TAB_CONFIG = [
  { key: ChatTab.Direct, label: 'Direct', icon: <MessageCircle className="h-3.5 w-3.5" /> },
  { key: ChatTab.Groups, label: 'Groups', icon: <MessagesSquare className="h-3.5 w-3.5" /> },
] as const;

interface ContactListProps {
  onContactClick: (contact: User) => void;
  activeChatIds?: string[];
  onGroupClick?: (groupId: string) => void;
  activeGroupId?: string | null;
  onClearGroup?: () => void;
  onCreateGroup?: (groupId: string) => void;
  onClose?: () => void;
}

const ContactSkeleton = () => (
  <div className="flex items-center gap-3 p-3">
    <div className="h-10 w-10 animate-pulse rounded-full bg-brand-secondary" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-24 animate-pulse rounded-md bg-brand-secondary" />
      <div className="h-2.5 w-32 animate-pulse rounded-md bg-brand-secondary" />
    </div>
  </div>
);

const ContactList: React.FC<ContactListProps> = ({
  onContactClick,
  activeChatIds = [],
  onGroupClick,
  activeGroupId,
  onClearGroup,
  onCreateGroup,
  onClose,
}) => {
  const [contacts, setContacts] = useState<User[]>([]);
  /** Avatars whose URL was present but 404'd — a URL is not a working image. */
  const [brokenAvatars, setBrokenAvatars] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeListTab, setActiveListTab] = useState<ChatTab>(ChatTab.Direct);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);

  const { getUnreadCountForUser } = useNotifications();
  const { data: myGroups, isLoading: groupsLoading } = useMyGroups();

  useEffect(() => {
    const loadCircle = async () => {
      setIsLoading(true);
      try {
        const me = getSession();
        if (!me) {
          setContacts([]);
          return;
        }
        const members = await fetchCircleMembers(me.id, 50);
        setContacts(members);
      } catch (err) {
        console.error('Failed to load circle:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadCircle();
  }, []);

  // Real-time presence updates via WebSocket
  useEffect(() => {
    return subscribeToPresenceUpdates((evt) => {
      setContacts(prev =>
        prev.map(c => c.id === evt.user_id ? { ...c, isOnline: evt.online } : c)
      );
    });
  }, []);

  const filteredContacts = useMemo(
    () =>
      contacts.filter((contact) =>
        `${contact.name} ${contact.loginId ?? ''}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [contacts, search],
  );

  const filteredGroups = useMemo(
    () => (myGroups ?? []).filter((group) => group.name.toLowerCase().includes(search.toLowerCase())),
    [myGroups, search],
  );

  const handleGroupCreated = (groupId: string) => {
    setShowCreateGroupModal(false);
    setActiveListTab(ChatTab.Groups);
    setSearch('');
    if (onCreateGroup) {
      onCreateGroup(groupId);
      return;
    }
    onGroupClick?.(groupId);
  };

  return (
    <div className="relative flex h-full flex-col">
      <AnimatePresence>
        {showNewMessage && (
          <NewMessageSheet
            onClose={() => setShowNewMessage(false)}
            onOpened={(user) => onContactClick(user)}
          />
        )}
      </AnimatePresence>
      <div className="flex flex-col h-full p-4">
        {/* Section header. The title is the only heavy thing here; a panel
            title competing with the conversation names is what made this read
            as noisy. */}
        <div className="mb-3 flex items-center justify-between px-2">
          <h2 className="text-base font-semibold -tracking-[0.014em] text-brand-text">Chat</h2>
          <div className="flex items-center gap-1">
            {/* Start a conversation with anyone — the list below only shows
                people already in your circle. */}
            <button
              onClick={() => setShowNewMessage(true)}
              aria-label="New message"
              title="New message"
              className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/60 transition-colors hover:bg-brand-secondary hover:text-brand-text"
            >
              <SquarePen className="h-4 w-4" strokeWidth={1.75} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Collapse chat"
                className="flex h-7 w-7 items-center justify-center rounded-full text-brand-text/50 transition-colors hover:bg-brand-secondary hover:text-brand-text"
              >
                <Minus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Same control as the rest of the app. Direct/Groups is a choice, not
            an action, so it does not take the accent. */}
        <div className="mb-3 px-2">
          <SegmentedControl
            layoutId="chat-scope"
            aria-label="Conversations"
            size="sm"
            fullWidth
            value={activeListTab}
            onChange={(id) => {
              setActiveListTab(id as ChatTab);
              if (id === ChatTab.Direct) onClearGroup?.();
            }}
            segments={TAB_CONFIG.map((t) => ({ id: t.key, label: t.label }))}
          />
        </div>

        {/* Search */}
        <div className="relative mb-3 px-2">
          <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text/40" />
          <input
            type="text"
            placeholder="Search chats"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-transparent bg-brand-secondary py-2 pl-10 pr-4 text-sm text-brand-text outline-hidden transition-colors placeholder:text-brand-text/40 focus:border-primary-outline focus:bg-brand-bg"
          />
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-hide">
          <AnimatePresence mode="wait">
            {activeListTab === ChatTab.Direct ? (
              <motion.div
                key="direct"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-1.5 px-1 py-1"
              >
                {isLoading ? (
                  <>
                    {[...Array(8)].map((_, i) => (
                      <ContactSkeleton key={`skeleton-${i}`} />
                    ))}
                  </>
                ) : (
                  <>
                    {filteredContacts.map((contact) => {
                      const isActive = activeChatIds.includes(contact.id);
                      const unreadCount = getUnreadCountForUser(contact.id);
                      // A list row must not grow when selected: scaling nudges
                      // every row below it and makes the list feel unstable
                      // while you scan. Selection is a fill, nothing more.
                      return (
                        <button
                          key={contact.id}
                          onClick={() => onContactClick(contact)}
                          className={`group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 ${isActive
                            ? 'bg-primary-ink/8'
                            : 'hover:bg-brand-secondary'
                            }`}
                        >

                          <div className="relative shrink-0">
                            <div className={`h-9 w-9 overflow-hidden rounded-full ring-2 transition-colors ${isActive ? 'ring-primary-outline' : 'ring-transparent'
                              }`}>
                              {/*
                                The old fallback pointed at /default-avatar.png,
                                which does not exist in public/ — so a contact
                                without a picture got a BROKEN image icon plus
                                their name as alt text. Fall back to initials,
                                the same treatment posts already use.
                              */}
                              {contact.avatar && !brokenAvatars.has(contact.id) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={contact.avatar}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  onError={() => setBrokenAvatars((prev) => new Set(prev).add(contact.id))}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-brand-secondary text-[11px] font-semibold text-brand-text/60">
                                  {(contact.name || '?').trim().charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            {contact.isOnline && (
                              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-brand-bg bg-success" />
                            )}
                          </div>

                          <div className="flex flex-1 flex-col overflow-hidden text-left">
                            <div className="flex items-center justify-between gap-2">
                              {/* The NAME is the thing you are scanning for, so
                                  it carries the weight. Status was bold and the
                                  name was not, which inverted the hierarchy. */}
                              <h3 className={`truncate text-sm -tracking-[0.006em] ${unreadCount > 0 ? 'font-semibold text-brand-text' : 'font-medium text-brand-text'}`}>
                                {contact.name}
                              </h3>
                              {unreadCount > 0 && (
                                <span className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary-ink px-1.5 text-[11px] font-semibold tabular-nums text-white">
                                  {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                              )}
                            </div>
                            {/* Presence is secondary information: muted, and
                                only coloured when it actually means "here". */}
                            <p className={`mt-0.5 truncate text-xs ${contact.isOnline ? 'text-success' : 'text-muted-foreground'}`}>
                              {contact.isOnline ? 'Active now' : 'Offline'}
                            </p>
                          </div>
                        </button>
                      );
                    })}

                    {filteredContacts.length === 0 && (
                      <div className="px-2 py-12 text-center">
                        <MessageCircle className="mx-auto mb-3 h-8 w-8 text-brand-secondary" />
                        <p className="text-[11px] font-bold text-brand-text/60">
                          {search ? 'No matching friends' : 'No circle members yet'}
                        </p>
                        <p className="mt-1 text-[10px] text-brand-text/60">
                          {search ? 'Try a different search term' : 'Add friends to start chatting'}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="groups"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-1.5 px-1 py-1"
              >
                {groupsLoading ? (
                  <>
                    {[...Array(6)].map((_, i) => (
                      <ContactSkeleton key={`group-skeleton-${i}`} />
                    ))}
                  </>
                ) : (
                  <>
                    {filteredGroups.map((group) => {
                      const isActive = activeGroupId === group.id;
                      const avatarSrc = group.avatar_media_id ? `/v1/media/${group.avatar_media_id}/serve` : null;
                      return (
                        <button
                          key={group.id}
                          onClick={() => onGroupClick?.(group.id)}
                          className={`group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 ${isActive
                            ? 'bg-primary-ink/8'
                            : 'hover:bg-brand-secondary'
                            }`}
                        >

                          <div className={`h-8 w-8 shrink-0 overflow-hidden rounded-xl ring-2 transition-all ${isActive ? 'ring-brand-secondary' : 'ring-transparent group-hover:ring-brand-secondary'
                            }`}>
                            {avatarSrc ? (
                              <img src={avatarSrc} alt={group.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-indigo-500 to-purple-600 text-[12px] font-bold text-white shadow-inner">
                                {group.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-1 flex-col overflow-hidden text-left justify-center">
                            <h3 className="truncate text-[14px] font-normal tracking-tight text-brand-text">
                              {group.name}
                            </h3>
                          </div>
                        </button>
                      );
                    })}

                    {filteredGroups.length === 0 && (
                      <div className="px-2 py-12 text-center">
                        <Users className="mx-auto mb-3 h-8 w-8 text-brand-secondary" />
                        <p className="text-[11px] font-bold text-brand-text/60">
                          {search ? 'No matching groups' : 'No groups yet'}
                        </p>
                        <p className="mt-1 text-[10px] text-brand-text/60">
                          {search ? 'Try a different search' : 'Create a group to get started'}
                        </p>
                      </div>
                    )}

                    {/* Create Group */}
                    <button
                      onClick={() => setShowCreateGroupModal(true)}
                      className="group mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-divider bg-brand-secondary/50 p-4 text-sm font-bold text-brand-highlight transition-all hover:border-brand-text/20 hover:bg-brand-text/5 hover:text-brand-text"
                    >
                      <Plus className="h-5 w-5 transition-transform duration-200 ease-out group-active:scale-90" />
                      New Group
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {showCreateGroupModal && (
        <CreateGroupPanel
          onClose={() => setShowCreateGroupModal(false)}
          onCreated={(groupId) => handleGroupCreated(groupId)}
        />
      )}
    </div>
  );
};

function SidebarIcon({ icon, active = false }: { icon: React.ReactNode; active?: boolean }) {
  return (
    <button className={`p-1 transition-all ${active ? 'text-brand-text' : 'text-brand-text/60 hover:text-brand-highlight'} [&_svg]:w-4 [&_svg]:h-4`}>
      {icon}
    </button>
  );
}

function TabButton({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  // Removed, logic now inline.
  return null;
}

export default ContactList;

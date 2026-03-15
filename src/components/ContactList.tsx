'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Lock, MessageCircle, Plus, Search, Users, MessagesSquare, Minus } from 'lucide-react';

import CreateGroupPanel from '@/components/messenger/CreateGroupPanel';
import { useNotifications } from '@/contexts/NotificationContext';
import { useMyGroups } from '@/hooks/useGroups';
import { getSession } from '@/services/authService';
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
    <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-24 animate-pulse rounded-md bg-slate-100" />
      <div className="h-2.5 w-32 animate-pulse rounded-md bg-slate-50" />
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
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeListTab, setActiveListTab] = useState<ChatTab>(ChatTab.Direct);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

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
    <div className="relative flex h-full flex-col bg-white">
      <div className="flex flex-col h-full p-4">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-800 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-indigo-500 fill-indigo-50" />
            Chat
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95"
            >
              <Minus className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Tabs — with sliding underline for professional look */}
        <div className="relative mb-4 flex gap-1 px-2">
          <div className="flex w-full rounded-xl bg-slate-100/70 p-1">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveListTab(tab.key);
                  if (tab.key === ChatTab.Direct) onClearGroup?.();
                }}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-semibold transition-all duration-200 ${activeListTab === tab.key
                  ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4 px-2">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-transparent bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-slate-200 focus:bg-white focus:ring-4 focus:ring-slate-100/50"
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
                      return (
                        <button
                          key={contact.id}
                          onClick={() => onContactClick(contact)}
                          className={`group relative flex w-full items-center gap-2.5 rounded-xl p-2.5 transition-all duration-300 ${isActive
                            ? 'z-10 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] ring-1 ring-slate-200 scale-[1.02]'
                            : 'z-0 bg-white border border-slate-100 shadow-sm hover:border-slate-200 hover:shadow-md'
                            }`}
                        >
                          {/* Removed Active Indicator Bar per user request */}

                          <div className="relative flex-shrink-0">
                            <div className={`h-8 w-8 overflow-hidden rounded-full ring-2 transition-all ${isActive ? 'ring-indigo-100' : 'ring-transparent group-hover:ring-slate-100'
                              }`}>
                              <img src={contact.avatar || '/default-avatar.png'} alt={contact.name} className="h-full w-full object-cover" />
                            </div>
                            {contact.isOnline && (
                              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                            )}
                          </div>

                          <div className="flex flex-1 flex-col overflow-hidden text-left">
                            <div className="flex items-center justify-between">
                              <h3 className="truncate text-[14px] font-normal tracking-tight text-slate-800">
                                {contact.name}
                              </h3>
                              {unreadCount > 0 && (
                                <span className="ml-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white shadow-sm">
                                  {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                              )}
                            </div>
                            <p className="truncate text-[11px] font-bold text-slate-500 mt-0.5">
                              {contact.isOnline ? 'Active now' : 'Offline'}
                            </p>
                          </div>
                        </button>
                      );
                    })}

                    {filteredContacts.length === 0 && (
                      <div className="px-2 py-12 text-center">
                        <MessageCircle className="mx-auto mb-3 h-8 w-8 text-slate-200" />
                        <p className="text-[11px] font-bold text-slate-400">
                          {search ? 'No matching friends' : 'No circle members yet'}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
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
                          className={`group relative flex w-full items-center gap-2.5 rounded-xl p-2.5 transition-all duration-300 ${isActive
                            ? 'z-10 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] ring-1 ring-slate-200 scale-[1.02]'
                            : 'z-0 bg-white border border-slate-100 shadow-sm hover:border-slate-200 hover:shadow-md'
                            }`}
                        >
                          {/* Removed Active Indicator Bar per user request */}

                          <div className={`h-8 w-8 flex-shrink-0 overflow-hidden rounded-xl ring-2 transition-all ${isActive ? 'ring-indigo-100' : 'ring-transparent group-hover:ring-slate-100'
                            }`}>
                            {avatarSrc ? (
                              <img src={avatarSrc} alt={group.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-[12px] font-bold text-white shadow-inner">
                                {group.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-1 flex-col overflow-hidden text-left justify-center">
                            <h3 className="truncate text-[14px] font-normal tracking-tight text-slate-800">
                              {group.name}
                            </h3>
                          </div>
                        </button>
                      );
                    })}

                    {filteredGroups.length === 0 && (
                      <div className="px-2 py-12 text-center">
                        <Users className="mx-auto mb-3 h-8 w-8 text-slate-200" />
                        <p className="text-[11px] font-bold text-slate-400">
                          {search ? 'No matching groups' : 'No groups yet'}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {search ? 'Try a different search' : 'Create a group to get started'}
                        </p>
                      </div>
                    )}

                    {/* Create Group */}
                    <button
                      onClick={() => setShowCreateGroupModal(true)}
                      className="group mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm font-bold text-slate-500 transition-all hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-600"
                    >
                      <Plus className="h-5 w-5 transition-transform group-hover:scale-110" />
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
    <button className={`p-1 transition-all ${active ? 'text-[#D8103F]' : 'text-slate-400 hover:text-slate-600'} [&_svg]:w-4 [&_svg]:h-4`}>
      {icon}
    </button>
  );
}

function TabButton({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  // Removed, logic now inline.
  return null;
}

export default ContactList;

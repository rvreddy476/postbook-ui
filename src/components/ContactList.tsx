'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Globe, Lock, MessageCircle, Plus, Search, Users } from 'lucide-react';

import GroupCreateModal from '@/components/groups/GroupCreateModal';
import { useNotifications } from '@/contexts/NotificationContext';
import { useMyGroups } from '@/hooks/useGroups';
import { getSession } from '@/services/authService';
import { fetchCircleMembers } from '@/services/userService';
import { User } from '@/types';

interface ContactListProps {
  onContactClick: (contact: User) => void;
  activeChatIds?: string[];
  onGroupClick?: (groupId: string) => void;
  activeGroupId?: string | null;
  onClearGroup?: () => void;
  onCreateGroup?: (groupId: string) => void;
}

const ContactSkeleton = () => (
  <div className="flex items-center gap-3 rounded-2xl border border-slate-100/80 px-3 py-2.5">
    <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
    <div className="flex-1 space-y-2">
      <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
      <div className="h-2 w-16 animate-pulse rounded bg-slate-50" />
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
}) => {
  const [contacts, setContacts] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeListTab, setActiveListTab] = useState<'friends' | 'groups'>('friends');
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
    setActiveListTab('groups');
    setSearch('');
    if (onCreateGroup) {
      onCreateGroup(groupId);
      return;
    }
    onGroupClick?.(groupId);
  };

  const subtitle =
    activeListTab === 'friends'
      ? `${contacts.length} ${contacts.length === 1 ? 'friend' : 'friends'}`
      : `${(myGroups ?? []).length} ${(myGroups ?? []).length === 1 ? 'group' : 'groups'}`;

  return (
    <div className="relative flex h-full flex-col bg-white">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-4 pb-3 pt-4 backdrop-blur-xl">
        <div className="mb-3">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-slate-900">Inbox</h2>
            <p className="mt-0.5 text-[11px] font-medium text-slate-400">{subtitle}</p>
          </div>
        </div>

        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => {
                setActiveListTab('friends');
                onClearGroup?.();
              }}
              className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition ${
                activeListTab === 'friends'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              My Circle
            </button>
            <button
              onClick={() => setActiveListTab('groups')}
              className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition ${
                activeListTab === 'groups'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Group Chat
            </button>
          </div>
        </div>

        <div className="group relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" />
          <input
            type="text"
            placeholder={activeListTab === 'groups' ? 'Search groups...' : 'Search friends...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[12px] text-slate-700 outline-none transition focus:border-blue-200 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="scrollbar-hide flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {activeListTab === 'friends' ? (
          <>
            {isLoading ? (
              <>
                {[...Array(8)].map((_, i) => (
                  <ContactSkeleton key={`friend-skeleton-${i}`} />
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
                      className={`w-full rounded-2xl border px-3 py-2.5 text-left transition ${
                        isActive
                          ? 'border-violet-200 bg-violet-50/70 shadow-sm'
                          : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div
                            className={`h-10 w-10 overflow-hidden rounded-xl border ${
                              isActive ? 'border-violet-200' : 'border-slate-200'
                            }`}
                          >
                            <img src={contact.avatar} alt={contact.name} className="h-full w-full object-cover" />
                          </div>
                          {contact.isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-[12px] font-semibold ${
                              isActive ? 'text-violet-700' : 'text-slate-900'
                            }`}
                          >
                            {contact.name}
                          </p>
                          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                            {contact.isOnline ? 'Online' : 'Offline'}
                          </p>
                        </div>

                        {unreadCount > 0 && (
                          <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}

                {filteredContacts.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
                    <MessageCircle className="mx-auto mb-2 h-5 w-5 text-slate-300" />
                    <p className="text-[12px] font-medium text-slate-500">
                      {search ? 'No matching friends' : 'No circle members yet'}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
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
                      className={`w-full rounded-2xl border px-3 py-2.5 text-left transition ${
                        isActive
                          ? 'border-blue-200 bg-blue-50/70 shadow-sm'
                          : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          {avatarSrc ? (
                            <img src={avatarSrc} alt={group.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-600">
                              {group.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p
                              className={`truncate text-[13px] font-semibold ${
                                isActive ? 'text-blue-700' : 'text-slate-900'
                              }`}
                            >
                              {group.name}
                            </p>
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                              {group.visibility}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] font-medium text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {group.member_count} members
                            </span>
                            <span className="inline-flex items-center gap-1">
                              {group.visibility === 'private' ? (
                                <Lock className="h-3 w-3" />
                              ) : (
                                <Globe className="h-3 w-3" />
                              )}
                              {group.visibility}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {filteredGroups.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
                    <Users className="mx-auto mb-2 h-5 w-5 text-slate-300" />
                    <p className="text-[12px] font-medium text-slate-500">
                      {search ? 'No matching groups' : 'No groups yet'}
                    </p>
                  </div>
                )}
              </>
            )}
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="mt-1 w-full rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-3 py-3 text-[12px] font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                Create Group
              </span>
            </button>
          </>
        )}
      </div>

      <AnimatePresence>
        {showCreateGroupModal && (
          <GroupCreateModal
            onClose={() => setShowCreateGroupModal(false)}
            onCreated={handleGroupCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContactList;

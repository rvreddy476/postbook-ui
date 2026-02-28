'use client';

import React, { useState, useEffect } from 'react';
import { fetchCircleMembers } from '../services/userService';
import { getSession } from '../services/authService';
import { User } from '../types';
import { useNotifications } from '@/contexts/NotificationContext';
import { useMyGroups } from '@/hooks/useGroups';
import type { Group } from '@/types/groups';

interface ContactListProps {
  onContactClick: (contact: User) => void;
  activeChatIds?: string[];
  onGroupClick?: (groupId: string) => void;
  activeGroupId?: string | null;
  onClearGroup?: () => void;
}

const ContactSkeleton = () => (
  <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl animate-pulse opacity-40">
    <div className="w-9 h-9 rounded-lg bg-slate-200 flex-shrink-0"></div>
    <div className="flex-1 space-y-2">
      <div className="h-2 w-20 bg-slate-200 rounded"></div>
      <div className="h-1.5 w-12 bg-slate-100 rounded"></div>
    </div>
  </div>
);

const ContactList: React.FC<ContactListProps> = ({ onContactClick, activeChatIds = [], onGroupClick, activeGroupId, onClearGroup }) => {
  const [contacts, setContacts] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeListTab, setActiveListTab] = useState<'friends' | 'groups'>('friends');
  const { getUnreadCountForUser } = useNotifications();
  const { data: myGroups, isLoading: groupsLoading } = useMyGroups();

  useEffect(() => {
    const loadCircle = async () => {
      setIsLoading(true);
      try {
        const me = getSession();
        if (!me) { setContacts([]); return; }
        const members = await fetchCircleMembers(me.id, 50);
        setContacts(members);
      } catch (err) {
        console.error("Failed to load circle:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadCircle();
  }, []);

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGroups = (myGroups ?? []).filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-100">
      <div className="px-4 pt-5 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
        {/* Header: Messages + New button */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">Messages</h2>
          <button className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>

        {/* Friends / Groups Tab Switcher */}
        <div className="flex items-center border-b border-slate-100 -mx-4 px-4">
          <button
            onClick={() => { setActiveListTab('friends'); onClearGroup?.(); }}
            className={`flex-1 pb-2.5 text-[13px] font-semibold transition-all border-b-2 ${
              activeListTab === 'friends'
                ? 'text-blue-600 border-blue-500'
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            My Circle
          </button>
          <button
            onClick={() => setActiveListTab('groups')}
            className={`flex-1 pb-2.5 text-[13px] font-semibold transition-all border-b-2 ${
              activeListTab === 'groups'
                ? 'text-blue-600 border-blue-500'
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            Groups
          </button>
        </div>

        {/* Search */}
        <div className="relative group mt-3">
          <input
            type="text"
            placeholder={activeListTab === 'groups' ? 'Search groups...' : 'Search...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 pl-9 pr-3 text-[12px] text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white focus:border-blue-200 transition-all placeholder:text-slate-400"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-2 py-4 space-y-1">
        {activeListTab === 'friends' ? (
          <>
            {isLoading ? (
              <>
                {[...Array(8)].map((_, i) => <ContactSkeleton key={i} />)}
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
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group ${isActive
                        ? 'bg-violet-50 shadow-sm ring-1 ring-violet-100'
                        : 'hover:bg-slate-50/80'
                        }`}
                    >
                      <div className="relative flex-shrink-0">
                        <div className={`w-9 h-9 rounded-lg overflow-hidden border transition-all ${isActive ? 'border-violet-500 shadow-md' : 'border-white shadow-sm'}`}>
                          <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                        </div>
                        {contact.isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></div>
                        )}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <h4 className={`text-[11px] font-black italic tracking-tight truncate ${isActive ? 'orchid-text-gradient' : 'text-slate-900'}`}>
                          {contact.name}
                        </h4>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
                          {contact.isOnline ? 'Online' : 'Offline'}
                        </p>
                      </div>
                      {unreadCount > 0 && (
                        <div className="ml-auto min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-rose-500 text-white text-[9px] font-black rounded-full shadow-sm flex-shrink-0">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                      )}
                    </button>
                  );
                })}

                {filteredContacts.length === 0 && (
                  <div className="py-12 text-center opacity-40">
                    <p className="text-[9px] font-black uppercase tracking-widest italic">
                      {search ? 'None found' : 'No circle members yet'}
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
                {[...Array(5)].map((_, i) => <ContactSkeleton key={i} />)}
              </>
            ) : (
              <>
                {filteredGroups.map((group) => {
                  const isActive = activeGroupId === group.id;
                  const avatarSrc = group.avatar_media_id
                    ? `/v1/media/${group.avatar_media_id}/serve`
                    : null;
                  return (
                    <button
                      key={group.id}
                      onClick={() => onGroupClick?.(group.id)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative ${
                        isActive
                          ? 'bg-blue-50/60 border-l-2 border-l-blue-500'
                          : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 rounded-xl overflow-hidden shadow-sm border border-slate-100">
                          {avatarSrc ? (
                            <img src={avatarSrc} alt={group.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-600 text-[14px] font-bold">
                              {group.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-[13px] font-semibold truncate ${
                            isActive ? 'text-blue-700' : 'text-slate-900'
                          }`}>
                            {group.name}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                        </p>
                      </div>
                    </button>
                  );
                })}

                {filteredGroups.length === 0 && (
                  <div className="py-12 text-center opacity-40">
                    <p className="text-[9px] font-black uppercase tracking-widest italic">No groups found</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

    </div>
  );
};

export default ContactList;
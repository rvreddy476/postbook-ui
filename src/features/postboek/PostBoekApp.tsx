'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import CallOverlay from '@/components/CallOverlay';
import ChatWindow from '@/components/ChatWindow';
import ContactList from '@/components/ContactList';
import CreatePortal from '@/components/CreatePortal';
import Feed from '@/components/Feed';
import Header from '@/components/Header';
import LandingPage from '@/components/LandingPage';
import MobileBottomNav from '@/components/MobileBottomNav';
import RightPanel from '@/components/RightPanel';
import ShortsGallery from '@/components/ShortsGallery';
import Sidebar from '@/components/Sidebar';
import TVGallery from '@/components/TVGallery';
import GroupPanel from '@/components/messenger/GroupPanel';
import { getSession, logoutUser } from '@/services/authService';
import { connectToHub } from '@/services/messageService';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NavItem, User } from '@/types';

import { motion, AnimatePresence } from 'framer-motion';

const PostBoekApp: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<NavItem>('Home');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeChats, setActiveChats] = useState<User[]>([]);
  const [isContactListOpen, setIsContactListOpen] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupRefreshKey, setGroupRefreshKey] = useState(0);

  // Intercept Profile/Friends tabs — navigate to dedicated routes instead of rendering inline
  const handleNavChange = useCallback((tab: NavItem) => {
    setActiveGroupId(null);
    if (tab === 'Profile' && currentUser) {
      router.push(`/u/${currentUser.id}`);
      return;
    }
    if (tab === 'Friends') {
      router.push('/circle');
      return;
    }
    if (tab === 'Reels') {
      router.push('/reels');
      return;
    }
    setActiveTab(tab);
  }, [currentUser, router]);

  const handleGroupClick = useCallback((groupId: string) => {
    setActiveGroupId(groupId);
    setIsContactListOpen(true);
    setGroupRefreshKey(k => k + 1);
  }, []);

  const handleClearGroup = useCallback(() => {
    setActiveGroupId(null);
  }, []);

  const handleCreateGroupFromChat = useCallback((groupId: string) => {
    setActiveTab('Home');
    setIsContactListOpen(true);
    setActiveGroupId(groupId);
    setGroupRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    const user = getSession();
    setCurrentUser(user);
    setIsSessionLoaded(true);
    if (user) {
      connectToHub(() => { }); // Global connection managed by BroadcastChannel inside service
    }
  }, []);

  const handleLogout = () => {
    logoutUser();
    try { localStorage.removeItem('postbook_unread_state'); } catch {}
    setCurrentUser(null);
    setActiveChats([]);
    setActiveTab('Home');
    setActiveGroupId(null);
    setIsCreateOpen(false);
    setIsContactListOpen(false);
  };

  const handleContactClick = useCallback((contact: User | { id: string; name: string; avatar: string }) => {
    const user: User = 'isOnline' in contact
      ? contact as User
      : { id: contact.id, name: contact.name, avatar: contact.avatar, isOnline: false };

    setActiveChats((prev) => {
      if (prev.find((c) => c.id === user.id)) {
        return prev;
      }

      const next = [user, ...prev];
      return next.length > 2 ? next.slice(0, 2) : next;
    });
  }, []);

  const closeChat = (userId: string) => {
    setActiveChats((prev) => prev.filter((c) => c.id !== userId));
  };

  const renderContent = () => {
    if (activeGroupId) {
      return (
        <motion.div
          key={`group-${activeGroupId}-${groupRefreshKey}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="h-full w-full"
        >
          <GroupPanel groupId={activeGroupId} onCreateGroup={handleCreateGroupFromChat} />
        </motion.div>
      );
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="h-full w-full"
        >
          {(() => {
            switch (activeTab) {
              case 'Home':
                return <Feed onCreateClick={() => setIsCreateOpen(true)} />;
              case 'Reels':
                return <ShortsGallery />;
              case 'TV':
                return <TVGallery />;

              default:
                return <Feed onCreateClick={() => setIsCreateOpen(true)} />;
            }
          })()}
        </motion.div>
      </AnimatePresence>
    );
  };

  if (!isSessionLoaded) {
    return <div className="min-h-screen bg-[#fcfaff]" aria-hidden="true" />;
  }

  if (!currentUser) {
    return <LandingPage />;
  }

  const isReelsMode = activeTab === 'Reels';
  const isGroupMode = !!activeGroupId;

  return (
    <NotificationProvider currentUserId={currentUser.id} onOpenChat={handleContactClick}>
    <div className="h-screen min-h-screen overflow-hidden bg-gradient-to-b from-[#fcfaff] to-[#f8f7ff] font-sans selection:bg-rose-100 selection:text-rose-900">
      <Header
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={handleNavChange}
        onCreateClick={() => setIsCreateOpen(true)}
        onLogout={handleLogout}
        onToggleContactList={() => setIsContactListOpen(!isContactListOpen)}
      />

      <div className="relative flex h-full flex-1 overflow-hidden pt-20">
        <aside className="hidden md:flex">
          <Sidebar activeTab={activeTab} setActiveTab={handleNavChange} />
        </aside>

        <aside
          className={`${isReelsMode ? 'hidden 2xl:flex' : 'hidden lg:flex'} z-[90] w-[280px] flex-col border-r border-slate-100 bg-white/90 shadow-sm relative backdrop-blur-xl`}
        >
          <AnimatePresence mode="wait">
            {isContactListOpen ? (
              <motion.div
                key="contacts-open"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full w-full"
              >
                <ContactList onContactClick={handleContactClick} activeChatIds={activeChats.map((chat) => chat.id)} onGroupClick={handleGroupClick} activeGroupId={activeGroupId} onClearGroup={handleClearGroup} onCreateGroup={handleCreateGroupFromChat} />
              </motion.div>
            ) : (
              <motion.div
                key="contacts-closed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full flex items-center justify-center bg-slate-50/30"
              >
                <div className="transform -rotate-90 whitespace-nowrap opacity-20 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></div>
                  <span className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-900 italic">Contacts</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        <main
          className={`relative flex-1 overflow-y-auto bg-slate-50/5 ${
            isReelsMode
              ? 'snap-y snap-mandatory scroll-smooth p-0'
              : isGroupMode
                ? 'p-0 overflow-hidden'
                : 'scrollbar-hide px-3 pb-28 pt-4 sm:px-4 md:pb-8 lg:px-6 lg:pt-6 xl:px-10'
          }`}
        >
          <div className={`mx-auto ${
            isReelsMode || isGroupMode
              ? 'h-full max-w-none w-full'
              : 'max-w-[960px]'
          }`}>
            {renderContent()}
          </div>
        </main>

        {!isReelsMode && !isGroupMode && (
          <aside className="hidden w-[360px] flex-col overflow-y-auto border-l border-slate-100 bg-white/50 p-5 backdrop-blur-2xl xl:flex">
            <RightPanel onContactClick={handleContactClick} />
          </aside>
        )}
      </div>

      <AnimatePresence>
        {isCreateOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <CreatePortal onClose={() => setIsCreateOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      <MobileBottomNav activeTab={activeTab} onChange={handleNavChange} />

      <div className="pointer-events-none fixed bottom-0 right-3 z-[1000] flex flex-row-reverse items-end gap-3 sm:right-6 md:right-5 md:gap-4 xl:right-[380px]">
        <AnimatePresence>
          {activeChats.map((chat) => (
            <motion.div
              key={chat.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="pointer-events-auto h-[460px] w-[320px] transition-all sm:h-[500px] sm:w-[360px]"
            >
              <ChatWindow contact={chat} onClose={() => closeChat(chat.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <CallOverlay />
    </div>
    </NotificationProvider>
  );
};

export default PostBoekApp;

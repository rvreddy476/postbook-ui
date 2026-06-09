'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
  // Landing-page Direct Message card links to "/?tab=Chat"; respect that
  // so the user lands on the chat surface instead of the default Home
  // feed. Falls back to 'Home' when the param is missing or invalid.
  const searchParams = useSearchParams();
  const initialTab = (() => {
    const raw = searchParams?.get('tab');
    const allowed: NavItem[] = ['Home', 'Chat', 'Reels', 'Friends', 'Profile', 'Messenger', 'Shop', 'Ask', 'Pages'];
    return raw && (allowed as string[]).includes(raw) ? (raw as NavItem) : 'Home';
  })();
  const [activeTab, setActiveTab] = useState<NavItem>(initialTab);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeChats, setActiveChats] = useState<User[]>([]);
  const [isContactListOpen, setIsContactListOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupRefreshKey, setGroupRefreshKey] = useState(0);
  const [navExpanded, setNavExpanded] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    if (tab === 'Messenger') {
      if (isMobile) {
        router.push('/messenger');
      } else {
        setIsContactListOpen(!isContactListOpen);
      }
      return;
    }
    if (tab === 'Shop') {
      router.push('/commerce');
      return;
    }
    if (tab === 'Ask') {
      router.push('/qa');
      return;
    }
    if (tab === 'Pages') {
      router.push('/pages');
      return;
    }
    setActiveTab(tab);
  }, [currentUser, router, isContactListOpen, isMobile]);

  const handleGroupClick = useCallback((groupId: string) => {
    setActiveGroupId(groupId);
    setActiveChats([]); // Close individual chat windows when a group is opened
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
    setActiveChats([]); // Close individual chat windows when a group is created/opened
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
    try { localStorage.removeItem('postbook_unread_state'); } catch { }
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
    return <div className="min-h-screen" aria-hidden="true" />;
  }

  if (!currentUser) {
    return <LandingPage />;
  }

  const isReelsMode = activeTab === 'Reels';
  const isGroupMode = !!activeGroupId;

  return (
    <NotificationProvider currentUserId={currentUser.id} onOpenChat={handleContactClick}>
      <div className="h-screen min-h-screen overflow-hidden font-sans selection:bg-brand-accent selection:text-brand-bg">
        <Header
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={handleNavChange}
          onCreateClick={() => setIsCreateOpen(true)}
          onLogout={handleLogout}
          onToggleContactList={() => {
            if (isMobile) {
              router.push('/messenger');
            } else {
              setIsContactListOpen(!isContactListOpen);
            }
          }}
          navExpanded={navExpanded}
        />

        {/* Fixed sidebar — renders itself as position:fixed */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleNavChange}
          onChatClick={() => {
            if (isMobile) {
              router.push('/messenger');
            } else {
              setIsContactListOpen(!isContactListOpen);
            }
          }}
          onNotificationsClick={() => { }}
          expanded={navExpanded}
          setExpanded={setNavExpanded}
        />

        <div className={`relative flex h-full flex-1 overflow-hidden pt-20 transition-all duration-500 ${navExpanded ? 'md:pl-64' : 'md:pl-16'}`}>

          {isContactListOpen && (
            <aside
              className={`${isReelsMode ? 'hidden 2xl:flex' : 'hidden lg:flex'} z-[90] w-[240px] flex-col border-r border-brand-divider relative transition-all duration-300`}
            >
              <ContactList onContactClick={handleContactClick} activeChatIds={activeChats.map((chat) => chat.id)} onGroupClick={handleGroupClick} activeGroupId={activeGroupId} onClearGroup={handleClearGroup} onCreateGroup={handleCreateGroupFromChat} onClose={() => setIsContactListOpen(false)} />
            </aside>
          )}

          <main
            className={`relative flex-1 overflow-y-auto ${isReelsMode
              ? 'snap-y snap-mandatory scroll-smooth p-0'
              : isGroupMode
                ? 'p-0 overflow-hidden'
                : 'scrollbar-hide px-2 pb-28 pt-4 sm:px-3 md:pb-8 lg:px-4 lg:pt-6'
              }`}
          >
            <div className={`mx-auto ${isReelsMode || isGroupMode
              ? 'h-full max-w-none w-full'
              : 'w-full'
              }`}>
              {renderContent()}
            </div>
          </main>

          {!isReelsMode && !isGroupMode && (
            <aside className="hidden w-[360px] flex-col overflow-y-auto border-l border-brand-divider p-4 lg:flex">
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
                className="pointer-events-auto transition-all"
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

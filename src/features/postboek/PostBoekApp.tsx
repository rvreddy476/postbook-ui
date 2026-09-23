'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useNavExpanded } from '@/hooks/useNavExpanded';
import { useRouter, useSearchParams } from 'next/navigation';

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
  // Expanded by default, and remembered. See useNavExpanded.
  const [navExpanded, setNavExpanded] = useNavExpanded();

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
      router.push('/connections');
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
    // The cookies are cleared by a navigation, not a background fetch that a
    // route change can abandon. See AppShell.handleLogout.
    window.location.assign('/api/auth/logout');
  };

  /**
   * Picking someone opens the full messenger on their conversation.
   *
   * This used to push them onto `activeChats`, which the floating dock
   * rendered. That dock is commented out below, so keeping the old body
   * would have made every contact click do NOTHING visible — a worse result
   * than the window it replaced. The messenger reads the id from the query
   * string, so the conversation opens directly rather than landing on an
   * empty list.
   */
  const handleContactClick = useCallback((contact: User | { id: string; name: string; avatar: string }) => {
    router.push(`/messenger?user=${encodeURIComponent(contact.id)}`);
  }, [router]);

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
      <div className="h-screen min-h-screen overflow-hidden font-sans selection:bg-primary-ink selection:text-brand-bg">
        <Header
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={handleNavChange}
          onCreateClick={() => setIsCreateOpen(true)}
          onLogout={handleLogout}
          // The chat icon opens the full messenger everywhere, not only on
          // mobile. Two chat surfaces behind one icon — a side panel with a
          // floating window on desktop, the full page on mobile — meant the
          // same control led somewhere different depending on the window
          // width, and the desktop half was the smaller of the two.
          onToggleContactList={() => router.push('/messenger')}
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

        <div className={`relative flex h-full flex-1 overflow-hidden pt-16 transition-all duration-500 ${navExpanded ? 'md:pl-64' : 'md:pl-16'}`}>

          {isContactListOpen && (
            <aside
              className={`${isReelsMode ? 'hidden 2xl:flex' : 'hidden lg:flex'} z-90 w-[240px] flex-col border-r border-brand-divider relative transition-all duration-300`}
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
            {/*
              A reading column, not the whole viewport.

              This was w-full, so with the left rail collapsed and the right
              rail hidden below lg, a post card stretched the entire window and
              a line of text ran for hundreds of characters. Capping it keeps
              the measure readable and matches the reference: one centred
              column with the rails either side of it.
            */}
            <div className={`mx-auto ${isReelsMode || isGroupMode
              ? 'h-full max-w-none w-full'
              : 'w-full max-w-[680px]'
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
              className="fixed inset-0 z-2000 flex items-center justify-center bg-black/40 backdrop-blur-xs"
            >
              <CreatePortal onClose={() => setIsCreateOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>
        <MobileBottomNav activeTab={activeTab} onChange={handleNavChange} />

        {/*
          Floating chat dock — COMMENTED OUT at the founder's request
          (21 Sep), not deleted, so it can come back in one step.

          The chat icon now opens the full messenger on every screen size, so
          this was the second chat surface on the same page: a smaller window
          competing with the three-column messenger, and the reason chat work
          kept looking "unchanged" — the two surfaces are different code.

          Everything it needs is still here: `activeChats`, `closeChat` and
          the ChatWindow import are untouched, and ContactList still calls
          openChat. Uncomment this block to restore it.

          The SAME component is still live on two other pages, deliberately,
          because nobody asked for those to change: the Circle friends list
          (src/components/connections/FriendsView.tsx) and a group's members tab
          (src/components/groups/tabs/GroupMembersTab.tsx), where messaging
          someone in place is the point and navigating away would lose the
          list you were working through.

        <div className="pointer-events-none fixed bottom-0 right-3 z-1000 flex flex-row-reverse items-end gap-3 sm:right-6 md:right-5 md:gap-4 xl:right-[380px]">
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
        */}

        {/* CallOverlay is mounted app-wide in providers.tsx now; a second
            copy here would render two overlays for one call. */}
      </div>
    </NotificationProvider>
  );
};

export default PostBoekApp;

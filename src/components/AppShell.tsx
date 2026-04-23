'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { getSession, logoutUser } from '@/services/authService';
import { connectToHub } from '@/services/messageService';
import { NavItem, User } from '@/types';

interface AppShellProps {
  children: React.ReactNode;
  activeTab?: NavItem;
}

function routeForTab(tab: NavItem, currentUser: User | null): string | null {
  switch (tab) {
    case 'Profile':
      return currentUser ? `/u/${currentUser.id}` : '/profile';
    case 'Home':
      return '/';
    case 'TV':
      return '/live';
    case 'Reels':
    case 'Flicks':
      return '/reels';
    case 'Memories':
      return '/memories';
    case 'Messenger':
    case 'Chat':
      return '/messenger';
    case 'Friends':
    case 'My Circle':
      return '/circle';
    case 'Ask':
      return '/qa';
    case 'Pages':
      return '/pages';
    case 'Shop':
      return '/commerce';
    case 'PostMatch':
      return '/postmatch';
    default:
      return null;
  }
}

export default function AppShell({ children, activeTab: activeTabOverride }: AppShellProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<NavItem>(activeTabOverride ?? 'Home');
  const [navExpanded, setNavExpanded] = useState(false);

  useEffect(() => {
    const syncSession = () => {
      const user = getSession();
      if (!user) {
        setCurrentUser(null);
        router.replace('/login');
        return;
      }

      setCurrentUser(user);
      void connectToHub(() => {});
    };

    syncSession();
    window.addEventListener('postbook:session-changed', syncSession);
    return () => window.removeEventListener('postbook:session-changed', syncSession);
  }, [router]);

  useEffect(() => {
    if (activeTabOverride) {
      setActiveTab(activeTabOverride);
    }
  }, [activeTabOverride]);

  const handleNavChange = useCallback(
    (tab: NavItem) => {
      setActiveTab(tab);
      const target = routeForTab(tab, currentUser);
      if (target) {
        router.push(target);
      }
    },
    [currentUser, router],
  );

  const handleCreateClick = useCallback(() => {
    router.push('/create/post');
  }, [router]);

  const handleChatOpen = useCallback(() => {
    setActiveTab('Messenger');
    router.push('/messenger');
  }, [router]);

  const handleNotificationsOpen = useCallback(() => {
    router.push('/settings/notifications');
  }, [router]);

  const handleLogout = useCallback(() => {
    logoutUser();
    try {
      localStorage.removeItem('postbook_unread_state');
    } catch {}
    setCurrentUser(null);
    router.push('/login');
  }, [router]);

  if (!currentUser) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="h-screen min-h-screen overflow-hidden font-sans">
      <Header
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={handleNavChange}
        onCreateClick={handleCreateClick}
        onLogout={handleLogout}
        onToggleContactList={handleChatOpen}
        navExpanded={navExpanded}
      />

      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleNavChange}
        onChatClick={handleChatOpen}
        onNotificationsClick={handleNotificationsOpen}
        expanded={navExpanded}
        setExpanded={setNavExpanded}
      />

      <div
        className={`relative h-full overflow-y-auto pt-20 transition-all duration-500 ${
          navExpanded ? 'md:pl-64' : 'md:pl-16'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

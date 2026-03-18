'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { getSession, logoutUser } from '@/services/authService';
import { NavItem, User } from '@/types';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<NavItem>('Home');
  const [navExpanded, setNavExpanded] = useState(false);

  useEffect(() => {
    const user = getSession();
    if (!user) {
      router.replace('/login');
      return;
    }
    setCurrentUser(user);
  }, [router]);

  const handleNavChange = useCallback((tab: NavItem) => {
    if (tab === 'Profile' && currentUser) {
      router.push(`/u/${currentUser.id}`);
      return;
    }
    if (tab === 'Flicks') { router.push('/reels'); return; }
    if (tab === 'Home') { router.push('/'); return; }
    setActiveTab(tab);
  }, [currentUser, router]);

  const handleLogout = () => {
    logoutUser();
    try { localStorage.removeItem('postbook_unread_state'); } catch {}
    setCurrentUser(null);
    router.push('/login');
  };

  if (!currentUser) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="h-screen min-h-screen overflow-hidden font-sans">
      <Header
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={handleNavChange}
        onCreateClick={() => {}}
        onLogout={handleLogout}
        onToggleContactList={() => {}}
        navExpanded={navExpanded}
      />

      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleNavChange}
        onChatClick={() => {}}
        onNotificationsClick={() => {}}
        expanded={navExpanded}
        setExpanded={setNavExpanded}
      />

      <div className={`relative h-full overflow-y-auto pt-20 transition-all duration-500 ${navExpanded ? 'md:pl-64' : 'md:pl-16'}`}>
        {children}
      </div>
    </div>
  );
}

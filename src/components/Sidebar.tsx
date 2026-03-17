'use client';

import { NavItem } from '../types';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Home, Compass, Tv, MessageSquare, ShoppingBag, Bell, Bookmark, Users, User, Menu } from 'lucide-react';

interface SidebarProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  onChatClick?: () => void;
  onNotificationsClick?: () => void;
  expanded?: boolean;
  setExpanded?: (v: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onChatClick, onNotificationsClick, expanded = false, setExpanded }) => {
  const navItems: {
    id: string;
    label: string;
    icon: typeof Home;
    href?: string;
    action?: () => void;
  }[] = [
    { id: 'Home', label: 'Home', icon: Home, href: '/' },
    { id: 'Explore', label: 'Explore', icon: Compass, action: () => setActiveTab('Home') },
    { id: 'TV', label: 'TV', icon: Tv, action: () => setActiveTab('TV') },
    { id: 'Chat', label: 'Chat', icon: MessageSquare, action: () => onChatClick?.() },
    { id: 'Store', label: 'Store', icon: ShoppingBag, href: '/shop' },
    { id: 'Notifications', label: 'Notifications', icon: Bell, action: () => onNotificationsClick?.() },
    { id: 'Bookmarks', label: 'Bookmarks', icon: Bookmark, href: '/bookmarks' },
  ];

  return (
    <nav className={`fixed left-0 top-0 h-full border-r border-brand-divider flex flex-col py-6 z-[60] hidden md:flex transition-all duration-500 ease-in-out
      ${expanded ? 'w-64 px-4' : 'w-16 px-0 items-center'}
      bg-brand-text text-brand-bg dark:bg-brand-bg dark:text-brand-text`}>

      {/* Toggle button */}
      <div className={`flex items-center mb-10 ${expanded ? 'px-2 justify-between' : 'justify-center'}`}>
        <button
          onClick={() => setExpanded?.(!expanded)}
          className="p-2 rounded-lg transition-colors text-white/60 hover:text-white hover:bg-white/10 dark:text-brand-text/60 dark:hover:text-brand-accent dark:hover:bg-brand-accent/10"
        >
          <Menu size={20} strokeWidth={2.5} />
        </button>
      </div>

      {!expanded && <div className="h-8" />}

      {/* Nav items */}
      <div className="flex-1 flex flex-col gap-4 w-full">
        {navItems.map((item) => {
          const isActive = activeTab === item.label || activeTab === item.id;
          const Icon = item.icon;

          const btnClass = `relative flex items-center transition-all duration-300 group rounded-xl
            ${expanded ? 'px-4 py-3 gap-4 w-full' : 'p-3 justify-center'}
            ${isActive
              ? 'text-white dark:text-brand-accent'
              : 'text-white/60 hover:text-white hover:bg-white/5 dark:text-brand-text/60 dark:hover:text-brand-accent dark:hover:bg-brand-accent/5'
            }`;

          const inner = (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2.2} className="flex-shrink-0" />

              {expanded && (
                <span className="text-sm font-bold tracking-wide">{item.label}</span>
              )}

              {/* Tooltip — only when collapsed */}
              {!expanded && (
                <div className="absolute left-full ml-4 px-3 py-1 text-[10px] font-black tracking-widest uppercase rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl bg-white text-black dark:bg-brand-text dark:text-brand-bg">
                  {item.label}
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 rotate-45 bg-white dark:bg-brand-text" />
                </div>
              )}

              {/* Active indicator — only when collapsed */}
              {isActive && !expanded && (
                <motion.div
                  layoutId="rail-active"
                  className="absolute -left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-white dark:bg-brand-accent"
                />
              )}
            </>
          );

          if (item.href) {
            return (
              <Link key={item.id} href={item.href} className={btnClass}>
                {inner}
              </Link>
            );
          }

          return (
            <button key={item.id} onClick={item.action} className={btnClass}>
              {inner}
            </button>
          );
        })}
      </div>

      {/* Account button at bottom */}
      <button className={`flex items-center gap-4 transition-colors ${expanded ? 'px-4 py-3 w-full' : 'p-3'}
        text-white/60 hover:text-white dark:text-brand-text/60 dark:hover:text-brand-accent`}>
        <User size={20} strokeWidth={2.2} />
        {expanded && <span className="text-sm font-bold">Account</span>}
      </button>
    </nav>
  );
};

export default Sidebar;

'use client';

import { NavItem } from '../types';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Bell,
  BookOpen,
  Bookmark,
  Briefcase,
  Globe2,
  HelpCircle,
  Home,
  Menu,
  MessageSquare,
  Radio,
  Search,
  ShoppingBag,
  Heart,
  User,
  UserRoundPlus,
  Users,
} from 'lucide-react';

interface SidebarProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  onChatClick?: () => void;
  onNotificationsClick?: () => void;
  expanded?: boolean;
  setExpanded?: (v: boolean) => void;
}

const navItems: {
  id: string;
  label: string;
  icon: typeof Home;
  href?: string;
  action?: () => void;
}[] = [
  { id: 'Home', label: 'Home', icon: Home, href: '/' },
  { id: 'Circle', label: 'Circle', icon: UserRoundPlus, href: '/circle' },
  { id: 'Search', label: 'Search', icon: Search, href: '/search' },
  { id: 'Groups', label: 'Groups', icon: Users, href: '/groups' },
  { id: 'Channels', label: 'Channels', icon: Radio, href: '/channels' },
  { id: 'Communities', label: 'Communities', icon: Globe2, href: '/communities' },
  { id: 'Ask', label: 'Ask', icon: HelpCircle, href: '/qa' },
  { id: 'Pages', label: 'Pages', icon: Briefcase, href: '/pages' },
  { id: 'Shop', label: 'Shop', icon: ShoppingBag, href: '/commerce' },
  { id: 'PostMatch', label: 'PostMatch', icon: Heart, href: '/postmatch' },
  { id: 'Messenger', label: 'Messenger', icon: MessageSquare },
  { id: 'Notifications', label: 'Notifications', icon: Bell },
  { id: 'Saved', label: 'Saved', icon: Bookmark, href: '/saved' },
  { id: 'Memories', label: 'Memories', icon: BookOpen, href: '/memories' },
];

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChatClick,
  onNotificationsClick,
  expanded = false,
  setExpanded,
}) => {
  return (
    <nav
      className={`fixed left-0 top-0 z-[60] hidden h-full flex-col border-r border-brand-divider bg-brand-text py-6 text-brand-bg transition-all duration-500 ease-in-out dark:bg-brand-bg dark:text-brand-text md:flex ${
        expanded ? 'w-64 px-4' : 'w-16 items-center px-0'
      }`}
    >
      <div className={`mb-10 flex items-center ${expanded ? 'justify-between px-2' : 'justify-center'}`}>
        <button
          onClick={() => setExpanded?.(!expanded)}
          className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white dark:text-brand-text/60 dark:hover:bg-brand-accent/10 dark:hover:text-brand-accent"
        >
          <Menu size={20} strokeWidth={2.5} />
        </button>
      </div>

      {!expanded && <div className="h-8" />}

      <div className="flex flex-1 flex-col gap-4 w-full overflow-y-auto scrollbar-none">
        {navItems.map((item) => {
          const isActive = activeTab === item.label || activeTab === item.id;
          const Icon = item.icon;
          const buttonClass = `relative flex items-center rounded-xl transition-all duration-300 group ${
            expanded ? 'w-full gap-4 px-4 py-3' : 'justify-center p-3'
          } ${
            isActive
              ? 'text-white dark:text-brand-accent'
              : 'text-white/60 hover:bg-white/5 hover:text-white dark:text-brand-text/60 dark:hover:bg-brand-accent/5 dark:hover:text-brand-accent'
          }`;

          const inner = (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2.2} className="flex-shrink-0" />
              {expanded && <span className="text-sm font-bold tracking-wide">{item.label}</span>}
              {!expanded && (
                <div className="pointer-events-none absolute left-full z-50 ml-4 whitespace-nowrap rounded-md bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black opacity-0 shadow-xl transition-opacity group-hover:opacity-100 dark:bg-brand-text dark:text-brand-bg">
                  {item.label}
                  <div className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rotate-45 bg-white dark:bg-brand-text" />
                </div>
              )}
              {isActive && !expanded && (
                <motion.div
                  layoutId="rail-active"
                  className="absolute -left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white dark:bg-brand-accent"
                />
              )}
            </>
          );

          if (item.href) {
            return (
              <Link key={item.id} href={item.href} className={buttonClass}>
                {inner}
              </Link>
            );
          }

          const action = item.id === 'Messenger' ? onChatClick : onNotificationsClick;
          return (
            <button key={item.id} onClick={action} className={buttonClass}>
              {inner}
            </button>
          );
        })}
      </div>

      <Link
        href="/profile"
        className={`flex items-center gap-4 text-white/60 transition-colors hover:text-white dark:text-brand-text/60 dark:hover:text-brand-accent ${
          expanded ? 'w-full px-4 py-3' : 'p-3'
        }`}
      >
        <User size={20} strokeWidth={2.2} />
        {expanded && <span className="text-sm font-bold">Account</span>}
      </Link>
    </nav>
  );
};

export default Sidebar;

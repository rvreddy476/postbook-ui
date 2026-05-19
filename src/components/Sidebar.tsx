'use client';

import { useState } from 'react';
import { NavItem } from '../types';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Bell,
  BookOpen,
  Bookmark,
  Briefcase,
  Film,
  Globe2,
  HelpCircle,
  Home,
  LayoutGrid,
  Menu,
  MessageSquare,
  Radio,
  ShoppingBag,
  Tv,
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
  /** Render in document flow (a flex child) instead of position:fixed —
   *  lets a feature page (e.g. Reels) embed the same rail in its layout. */
  inFlow?: boolean;
}

type Item = {
  id: string;
  label: string;
  icon: typeof Home;
  href?: string;
  /** Tailwind text-color class for the icon — each nav item is colour-coded. */
  color: string;
  /** Opens in a new browser tab (used for PostTube — a separate surface). */
  newTab?: boolean;
};

// Primary rail — always visible. Sized so the rail never scrolls.
const primaryItems: Item[] = [
  { id: 'Home', label: 'Home', icon: Home, href: '/', color: 'text-sky-400' },
  { id: 'Reels', label: 'Reels', icon: Film, href: '/reels', color: 'text-fuchsia-400' },
  { id: 'Circle', label: 'Circle', icon: UserRoundPlus, href: '/circle', color: 'text-emerald-400' },
  { id: 'Groups', label: 'Groups', icon: Users, href: '/groups', color: 'text-amber-400' },
  { id: 'Channels', label: 'Channels', icon: Radio, href: '/channels', color: 'text-rose-400' },
  { id: 'Communities', label: 'Communities', icon: Globe2, href: '/communities', color: 'text-violet-400' },
];

// Everything else opens from the "More" button instead of overflowing.
const moreItems: Item[] = [
  { id: 'Messenger', label: 'Messenger', icon: MessageSquare, color: 'text-emerald-400' },
  { id: 'Notifications', label: 'Notifications', icon: Bell, color: 'text-rose-400' },
  { id: 'PostTube', label: 'PostTube', icon: Tv, href: '/posttube', newTab: true, color: 'text-orange-400' },
  { id: 'Ask', label: 'Ask', icon: HelpCircle, href: '/qa', color: 'text-blue-400' },
  { id: 'Pages', label: 'Pages', icon: Briefcase, href: '/pages', color: 'text-amber-400' },
  { id: 'Shop', label: 'Shop', icon: ShoppingBag, href: '/commerce', color: 'text-green-400' },
  { id: 'PostMatch', label: 'PostMatch', icon: Heart, href: '/postmatch', color: 'text-pink-400' },
  { id: 'Saved', label: 'Saved', icon: Bookmark, href: '/saved', color: 'text-indigo-400' },
  { id: 'Memories', label: 'Memories', icon: BookOpen, href: '/memories', color: 'text-teal-400' },
];

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChatClick,
  onNotificationsClick,
  expanded = false,
  setExpanded,
  inFlow = false,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);

  const isItemActive = (item: Item) =>
    activeTab === item.label || activeTab === item.id;
  const moreActive = moreItems.some(isItemActive);

  const widthCls = expanded ? 'w-64 px-4' : 'w-16 items-center px-0';
  const navClass = inFlow
    ? `relative flex h-full shrink-0 flex-col border-r border-brand-divider bg-brand-text py-6 text-brand-bg dark:bg-brand-bg dark:text-brand-text ${widthCls}`
    : `fixed left-0 top-0 z-[60] hidden h-full flex-col border-r border-brand-divider bg-brand-text py-6 text-brand-bg transition-all duration-500 ease-in-out dark:bg-brand-bg dark:text-brand-text md:flex ${widthCls}`;

  // ---- One primary rail entry (link) ----
  const renderRailItem = (item: Item) => {
    const isActive = isItemActive(item);
    const Icon = item.icon;
    const cls = `relative flex items-center rounded-xl transition-all duration-300 group ${
      expanded ? 'w-full gap-4 px-4 py-3' : 'justify-center p-3'
    } ${isActive ? 'bg-white/[0.08] dark:bg-brand-accent/10' : 'hover:bg-white/5 dark:hover:bg-brand-accent/5'}`;
    return (
      <Link key={item.id} href={item.href ?? '#'} className={cls}>
        <Icon
          size={21}
          strokeWidth={isActive ? 2.6 : 2.2}
          className={`flex-shrink-0 ${item.color} transition-transform duration-300 group-hover:scale-110 ${
            isActive ? 'scale-110 drop-shadow-[0_0_6px_currentColor]' : ''
          }`}
        />
        {expanded && (
          <span
            className={`text-sm font-bold tracking-wide ${
              isActive ? 'text-white dark:text-brand-text' : 'text-white/70 dark:text-brand-text/70'
            }`}
          >
            {item.label}
          </span>
        )}
        {!expanded && (
          <div className="pointer-events-none absolute left-full z-[80] ml-4 whitespace-nowrap rounded-md bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black opacity-0 shadow-xl transition-opacity group-hover:opacity-100 dark:bg-brand-text dark:text-brand-bg">
            {item.label}
            <div className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rotate-45 bg-white dark:bg-brand-text" />
          </div>
        )}
        {isActive && !expanded && (
          <motion.div
            layoutId="rail-active"
            className="absolute -left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-brand-accent"
          />
        )}
      </Link>
    );
  };

  return (
    <nav className={navClass}>
      {/* Collapse toggle */}
      <div className={`mb-4 flex items-center ${expanded ? 'justify-between px-2' : 'justify-center'}`}>
        <button
          onClick={() => setExpanded?.(!expanded)}
          aria-label="Toggle menu"
          className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white dark:text-brand-text/60 dark:hover:bg-brand-accent/10 dark:hover:text-brand-accent"
        >
          <Menu size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Nav items — spread to fill the rail, no scrollbar */}
      <div
        className={`flex w-full flex-1 flex-col ${
          expanded ? 'gap-1' : 'items-center justify-evenly'
        }`}
      >
        {primaryItems.map(renderRailItem)}

        {/* More — opens the rest of the services */}
        <div className="relative flex w-full justify-center">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="More services"
            aria-expanded={moreOpen}
            className={`relative flex items-center rounded-xl transition-all duration-300 group ${
              expanded ? 'w-full gap-4 px-4 py-3' : 'justify-center p-3'
            } ${moreOpen || moreActive ? 'bg-white/[0.08] dark:bg-brand-accent/10' : 'hover:bg-white/5 dark:hover:bg-brand-accent/5'}`}
          >
            <LayoutGrid
              size={21}
              strokeWidth={moreOpen || moreActive ? 2.6 : 2.2}
              className={`flex-shrink-0 text-cyan-400 transition-transform duration-300 group-hover:scale-110 ${
                moreOpen || moreActive ? 'scale-110 drop-shadow-[0_0_6px_currentColor]' : ''
              }`}
            />
            {expanded && (
              <span
                className={`text-sm font-bold tracking-wide ${
                  moreOpen || moreActive ? 'text-white dark:text-brand-text' : 'text-white/70 dark:text-brand-text/70'
                }`}
              >
                More
              </span>
            )}
            {!expanded && !moreOpen && (
              <div className="pointer-events-none absolute left-full z-[80] ml-4 whitespace-nowrap rounded-md bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black opacity-0 shadow-xl transition-opacity group-hover:opacity-100 dark:bg-brand-text dark:text-brand-bg">
                More
                <div className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rotate-45 bg-white dark:bg-brand-text" />
              </div>
            )}
          </button>

          {/* Flyout — the rest of the services */}
          {moreOpen && (
            <div className="absolute bottom-0 left-full z-[80] ml-3 w-56 overflow-hidden rounded-2xl border border-white/10 bg-brand-text shadow-2xl dark:border-brand-divider dark:bg-brand-card">
              <div className="px-3 pb-1.5 pt-2.5 text-[10px] font-black uppercase tracking-widest text-white/40 dark:text-brand-text/40">
                More on VChat
              </div>
              <div className="space-y-0.5 p-1.5 pt-0.5">
                {moreItems.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item);
                  const itemCls = `group/mi flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-white/10 text-white dark:bg-brand-accent/10 dark:text-brand-accent'
                      : 'text-white/75 hover:bg-white/10 hover:text-white dark:text-brand-text/70 dark:hover:bg-brand-accent/5 dark:hover:text-brand-accent'
                  }`;
                  const inner = (
                    <>
                      <Icon
                        size={18}
                        strokeWidth={2.3}
                        className={`flex-shrink-0 ${item.color} transition-transform duration-200 group-hover/mi:scale-110`}
                      />
                      <span>{item.label}</span>
                    </>
                  );
                  if (item.href) {
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        target={item.newTab ? '_blank' : undefined}
                        rel={item.newTab ? 'noopener noreferrer' : undefined}
                        onClick={() => setMoreOpen(false)}
                        className={itemCls}
                      >
                        {inner}
                      </Link>
                    );
                  }
                  const action = item.id === 'Messenger' ? onChatClick : onNotificationsClick;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setMoreOpen(false);
                        action?.();
                      }}
                      className={itemCls}
                    >
                      {inner}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account — pinned to the bottom */}
      <Link
        href="/profile"
        className={`group mt-2 flex items-center gap-4 rounded-xl transition-all hover:bg-white/5 dark:hover:bg-brand-accent/5 ${
          expanded ? 'w-full px-4 py-3' : 'justify-center p-3'
        }`}
      >
        <User
          size={21}
          strokeWidth={2.2}
          className="flex-shrink-0 text-slate-300 transition-transform duration-300 group-hover:scale-110"
        />
        {expanded && <span className="text-sm font-bold text-white/70 dark:text-brand-text/70">Account</span>}
      </Link>

      {/* Click-away backdrop for the More flyout */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[70]"
          onClick={() => setMoreOpen(false)}
          aria-hidden
        />
      )}
    </nav>
  );
};

export default Sidebar;

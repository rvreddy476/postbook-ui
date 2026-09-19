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
  Flame,
  // Globe2, // Communities feature disabled
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
  Video,
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
  /**
   * Icon colour class. Every item now inherits the rail's own colour so the
   * nav reads as ONE surface: eight different hues down the rail was the
   * "stitched" look the founder objected to. The ACTIVE item is the only
   * thing that takes the accent, which is what makes it findable.
   */
  color: string;
  /** Opens in a new browser tab (used for PostTube — a separate surface). */
  newTab?: boolean;
};

// Primary rail — always visible. Sized so the rail never scrolls.
const primaryItems: Item[] = [
  { id: 'Home', label: 'Home', icon: Home, href: '/', color: 'text-current' },
  { id: 'Reels', label: 'Reels', icon: Film, href: '/reels', color: 'text-current' },
  { id: 'Circle', label: 'Circle', icon: UserRoundPlus, href: '/circle', color: 'text-current' },
  { id: 'Groups', label: 'MySpace', icon: Users, href: '/groups', color: 'text-current' },
  { id: 'Channels', label: 'Channels', icon: Radio, href: '/channels', color: 'text-current' },
  // Communities feature disabled — consolidated into Groups ("MySpace").
  // Service + pages kept; only the entry points are hidden.
  // { id: 'Communities', label: 'Communities', icon: Globe2, href: '/communities', color: 'text-current' },
];

// Everything else opens from the "More" button instead of overflowing.
//
// Go Live sits right after PostTube — the post composer no longer hosts a
// "go live" button, so this is the canonical entry point for creators.
const moreItems: Item[] = [
  { id: 'Trending', label: 'Trending', icon: Flame, href: '/trending', color: 'text-current' },
  { id: 'Messenger', label: 'Messenger', icon: MessageSquare, color: 'text-current' },
  { id: 'Notifications', label: 'Notifications', icon: Bell, color: 'text-current' },
  { id: 'PostTube', label: 'PostTube', icon: Tv, href: '/posttube', newTab: true, color: 'text-current' },
  { id: 'GoLive', label: 'Go Live', icon: Video, href: '/live/new', color: 'text-current' },
  { id: 'Ask', label: 'Ask', icon: HelpCircle, href: '/qa', color: 'text-current' },
  { id: 'Pages', label: 'Pages', icon: Briefcase, href: '/pages', color: 'text-current' },
  { id: 'Shop', label: 'Shop', icon: ShoppingBag, href: '/commerce', color: 'text-green-400' },
  { id: 'PostMatch', label: 'PostMatch', icon: Heart, href: '/postmatch', color: 'text-current' },
  { id: 'Saved', label: 'Saved', icon: Bookmark, href: '/saved', color: 'text-current' },
  { id: 'Memories', label: 'Memories', icon: BookOpen, href: '/memories', color: 'text-current' },
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
    ? `relative flex h-full shrink-0 flex-col border-r border-brand-divider bg-brand-bg py-6 text-brand-text ${widthCls}`
    : `fixed left-0 top-0 z-60 hidden h-full flex-col border-r border-brand-divider bg-brand-bg py-6 text-brand-text transition-all duration-500 ease-in-out md:flex ${widthCls}`;

  // ---- One primary rail entry (link) ----
  const renderRailItem = (item: Item) => {
    const isActive = isItemActive(item);
    const Icon = item.icon;
    // One weight, one colour, accent only when active. Craft: things that
    // behave the same look the same, so the eye can find the active item.
    const cls = `relative flex items-center rounded-xl transition-colors duration-200 group ${
      expanded ? 'w-full gap-4 px-4 py-3' : 'justify-center p-3'
    } ${isActive ? 'bg-primary-ink/10 text-primary-ink' : 'text-brand-text/70 hover:bg-primary-ink/5 hover:text-brand-text'}`;
    return (
      <Link key={item.id} href={item.href ?? '#'} className={cls}>
        <Icon
          size={20}
          strokeWidth={isActive ? 2.25 : 1.75}
          className={`shrink-0 ${item.color} transition-transform duration-200 ease-out group-active:scale-90`}
        />
        {expanded && (
          <span
            className={`text-sm font-bold tracking-wide ${
              isActive ? 'text-primary-ink' : 'text-brand-text/70 dark:text-brand-text/70'
            }`}
          >
            {item.label}
          </span>
        )}
        {!expanded && (
          <div className="pointer-events-none absolute left-full z-80 ml-3 whitespace-nowrap rounded-lg bg-brand-text px-2.5 py-1.5 text-[11px] font-semibold tracking-normal text-brand-bg opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
            {item.label}
            <div className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rotate-45 bg-brand-text" />
          </div>
        )}
        {isActive && !expanded && (
          <motion.div
            layoutId="rail-active"
            className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-primary-ink"
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
          className="rounded-lg p-2 text-brand-text/60 transition-colors hover:bg-primary-ink/10 hover:text-primary-ink"
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
            className={`relative flex items-center rounded-xl transition-colors duration-200 group ${
              expanded ? 'w-full gap-4 px-4 py-3' : 'justify-center p-3'
            } ${moreOpen || moreActive ? 'bg-primary-ink/10 text-primary-ink' : 'text-brand-text/70 hover:bg-primary-ink/5 hover:text-brand-text'}`}
          >
            <LayoutGrid
              size={20}
              strokeWidth={moreOpen || moreActive ? 2.25 : 1.75}
              className="shrink-0 transition-transform duration-200 ease-out group-active:scale-90"
            />
            {expanded && (
              <span
                className={`text-sm font-bold tracking-wide ${
                  moreOpen || moreActive ? 'text-primary-ink' : 'text-brand-text/70 dark:text-brand-text/70'
                }`}
              >
                More
              </span>
            )}
            {!expanded && !moreOpen && (
              <div className="pointer-events-none absolute left-full z-80 ml-4 whitespace-nowrap rounded-lg bg-brand-text px-2.5 py-1.5 text-[11px] font-semibold tracking-normal text-brand-bg opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                More
                <div className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rotate-45 bg-brand-text" />
              </div>
            )}
          </button>

          {/* Flyout — the rest of the services */}
          {moreOpen && (
            <div className="absolute bottom-0 left-full z-80 ml-3 w-56 overflow-hidden rounded-2xl border border-white/10 bg-brand-text shadow-2xl dark:border-brand-divider dark:bg-brand-card">
              <div className="px-3 pb-1.5 pt-2.5 text-[10px] font-black uppercase tracking-widest text-brand-text/40 dark:text-brand-text/40">
                More on VChat
              </div>
              <div className="space-y-0.5 p-1.5 pt-0.5">
                {moreItems.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item);
                  const itemCls = `group/mi flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-primary-ink/10 text-primary-ink'
                      : 'text-brand-text/70 hover:bg-primary-ink/10 hover:text-primary-ink'
                  }`;
                  const inner = (
                    <>
                      <Icon
                        size={18}
                        strokeWidth={2.3}
                        className={`shrink-0 ${item.color} transition-transform duration-200 group-hover/mi:scale-110`}
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
        className={`group mt-2 flex items-center gap-4 rounded-xl transition-all hover:bg-primary-ink/5 ${
          expanded ? 'w-full px-4 py-3' : 'justify-center p-3'
        }`}
      >
        <User
          size={21}
          strokeWidth={2.2}
          className="shrink-0 text-slate-300 transition-transform duration-300 group-hover:scale-110"
        />
        {expanded && <span className="text-sm font-bold text-brand-text/70 dark:text-brand-text/70">Account</span>}
      </Link>

      {/* Click-away backdrop for the More flyout */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-70"
          onClick={() => setMoreOpen(false)}
          aria-hidden
        />
      )}
    </nav>
  );
};

export default Sidebar;

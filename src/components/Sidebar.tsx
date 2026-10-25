'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { resolveAppBrand, resolveAppNavigation } from '@/lib/appBrand';
import { NavItem } from '../types';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import { useMyProfile } from '@/hooks/useEditProfile';
import { LayoutGrid, Menu, User } from 'lucide-react';
import { ALL_MORE_ITEMS, ALL_PRIMARY_ITEMS, launchedItems, type SidebarItem } from '@/components/sidebarNav';
import { useHiddenProducts } from '@/hooks/useProductFeatures';

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

// The entries themselves, and the list of parked products kept out of them,
// live in components/sidebarNav.ts.
type Item = SidebarItem;

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChatClick,
  onNotificationsClick,
  expanded = false,
  setExpanded,
  inFlow = false,
}) => {
  const { data: myProfile } = useMyProfile();
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  // Parked products and whatever GET /v1/features closes (hooks/useProductFeatures).
  const hidden = useHiddenProducts();
  const primaryItems = launchedItems(ALL_PRIMARY_ITEMS, hidden.navIds);
  const moreItems = launchedItems(ALL_MORE_ITEMS, hidden.navIds);
  const appItems = resolveAppNavigation(pathname, hidden.navIds, hidden.appKeys);
  const brand = resolveAppBrand(pathname);
  const contextualItems: readonly Item[] = appItems?.map(item => ({ ...item, id: item.label, color: 'text-current' })) ?? primaryItems;

  const isItemActive = (item: Item) => appItems
    ? item.href?.split('?')[0] === pathname && !item.href?.includes('?')
    : activeTab === item.label || activeTab === item.id;
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
      <Link key={item.id} href={item.href ?? '#'} aria-label={item.label} aria-current={isActive ? 'page' : undefined} className={cls}>
        <Icon
          size={20}
          strokeWidth={isActive ? 2.25 : 1.75}
          className={`shrink-0 ${item.color} transition-transform duration-200 ease-out group-active:scale-90`}
        />
        {expanded && (
          <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
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
            transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
            className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary-ink"
          />
        )}
      </Link>
    );
  };

  return (
    <nav className={navClass} aria-label={`${brand.name} navigation`} data-app-navigation={brand.key}>
      {/*
        The wordmark, and the collapse toggle.

        The product's name used to appear only as a "VC" badge in the header —
        an abbreviation of a name the reader had never been shown. It is
        written out here instead, at the top of the rail, which is where a
        product says what it is. Collapsed, the rail keeps the toggle alone;
        there is no room for a word and a truncated one is worse than none.
      */}
      <div className={`mb-4 flex items-center ${expanded ? 'justify-between px-2' : 'justify-center'}`}>
        {expanded && (
          <Link
            href={brand.href}
            className="rounded-lg px-2 py-1 text-[20px] font-bold -tracking-[0.02em] text-primary-ink transition-opacity hover:opacity-80"
            title={brand.name}
          >
            {brand.name}
          </Link>
        )}
        {setExpanded ? <button
          onClick={() => setExpanded?.(!expanded)}
          aria-label="Toggle menu"
          className="rounded-lg p-2 text-brand-text/60 transition-colors hover:bg-primary-ink/10 hover:text-primary-ink"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button> : null}
      </div>

      {/* Nav items.
          Previously justify-evenly, which stretched the icons down the whole
          rail so the spacing changed with viewport height and nothing read as
          a group. A fixed rhythm anchored at the top keeps the relationship
          between items constant at any size. */}
      <div
        className={`flex w-full flex-col ${
          expanded ? 'gap-1' : 'items-center gap-1.5'
        }`}
      >
        {contextualItems.map(renderRailItem)}

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
            <div className="absolute bottom-0 left-full z-80 ml-3 w-56 overflow-hidden rounded-2xl border border-border bg-brand-card shadow-2xl">
              <div className="px-3 pb-1.5 pt-2.5 text-[10px] font-black tracking-widest text-brand-text/40 dark:text-brand-text/40">
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
                  if (!action) return <Link key={item.id} href={item.id === 'Messenger' ? '/messenger' : '/notifications'} onClick={() => setMoreOpen(false)} className={itemCls}>{inner}</Link>;
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

      {/* Account — pinned to the bottom, with a hairline above it so it reads
          as a different kind of destination from the navigation. The icon was
          text-slate-300: a raw palette value so pale it looked disabled, and
          one that could not follow the theme. */}
      <Link
        href="/profile"
        className={`group mt-auto flex items-center gap-3 rounded-xl text-brand-text/70 transition-colors hover:bg-primary-ink/5 hover:text-brand-text ${
          expanded ? 'w-full px-3 py-2.5' : 'w-full justify-center p-3'
        }`}
      >
        {/* Expanded, this is you: face, name and handle, which is what makes
            a sidebar feel like an account rather than a menu. Collapsed, it
            falls back to the same icon as before. */}
        {expanded ? (
          <>
            <Avatar
              src={myProfile?.avatar_media_id ? `/v1/media/${myProfile.avatar_media_id}/serve` : undefined}
              name={myProfile?.display_name || 'You'}
              className="h-9 w-9"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-brand-text">
                {myProfile?.display_name || 'Your profile'}
              </span>
              {myProfile?.username && (
                <span className="block truncate text-xs text-muted-foreground">@{myProfile.username}</span>
              )}
            </span>
          </>
        ) : (
          <User
            size={20}
            strokeWidth={1.75}
            className="shrink-0 transition-transform duration-200 ease-out group-active:scale-90"
          />
        )}
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

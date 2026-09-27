"use client";

import Link from "next/link";
import { Search, Bell, MessageCircle, Menu } from "lucide-react";
import { useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CreateButton } from "@/features/reels/components/CreateButton";
import { ProfileDropdown } from "@/features/reels/components/ProfileDropdown";
import { brandSearchHref, resolveAppBrand } from "@/lib/appBrand";
import { useUnreadCount } from '@/hooks/useActivityNotifications';
import { useVideoShell } from "@/features/video-shell/useVideoShell";
import './app-bar.css';

interface HeaderBarProps {
  /**
   * Overrides the wordmark. Normally left unset: the header names the app
   * the current route belongs to (see src/lib/appBrand.ts).
   */
  sectionLabel?: string;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  onSearchSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}

/*
  The app header. The small "VC" badge is the product and always goes home;
  beside it the wordmark is the APP the viewer is in — Reels, PostTube,
  Groups… — with that app's icon and search hint, so each app reads as its
  own place instead of every page wearing the same generic bar.
*/
export function HeaderBar({
  sectionLabel,
  searchValue: externalSearch,
  onSearchValueChange: externalOnChange,
  onSearchSubmit: externalOnSubmit,
}: HeaderBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const brand = resolveAppBrand(pathname);
  const BrandIcon = brand.icon;
  const [internalSearch, setInternalSearch] = useState("");
  const unread = useUnreadCount();
  // Outside a VideoShell these are no-ops and inShell is false: no hamburger.
  const shell = useVideoShell();

  const searchValue = externalSearch ?? internalSearch;
  const onSearchValueChange = externalOnChange ?? setInternalSearch;
  // Each app's box submits to its own results page (appBrand.searchHref); the rest go to /search.
  const onSearchSubmit = externalOnSubmit ?? ((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(brandSearchHref(brand, searchValue));
  });

  return (
    <header
      data-app={brand.key}
      className="context-app-bar"
    >
      <div className="context-app-bar__inner">
        {/* Left: product badge → home, then the app wordmark */}
        <div className="context-app-bar__brand">
          {shell.inShell ? (
            <button
              type="button"
              className="context-app-bar__menu"
              onClick={shell.toggleSidebar}
              aria-label="Menu"
              aria-expanded={shell.sidebarOpen}
              aria-controls="video-shell-sidebar"
            >
              <Menu size={22} strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
          <Link href="/" aria-label="VChat home" className="context-app-bar__home group flex shrink-0 items-center">
            <div className="text-xl font-extrabold tracking-tight text-primary-ink">
              <span>VC</span>
            </div>
          </Link>
          <div className="h-5 border-l border-border" />
          <Link href={brand.href} className="flex min-w-0 items-center gap-2 text-brand-text">
            <BrandIcon className="h-5 w-5 shrink-0 text-primary-ink" />
            <span className="truncate text-lg font-bold tracking-tight">{sectionLabel ?? brand.name}</span>
          </Link>
        </div>

        {/* Center: Search */}
        <div className="context-app-bar__search">
          <form onSubmit={onSearchSubmit} role="search" className="w-full">
            <div className="group relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={searchValue}
                onChange={(event) => onSearchValueChange(event.target.value)}
                placeholder={brand.searchPlaceholder}
                aria-label={brand.searchPlaceholder}
                className="context-app-bar__input"
              />
            </div>
          </form>
        </div>

        {/* Right: Create + Notifications + Profile */}
        <div className="context-app-bar__actions">
          <CreateButton variant="pill" />
          <Link href={brandSearchHref(brand)} className="context-app-bar__mobile-search" aria-label="Search"><Search size={19}/></Link>
          <Link href="/messenger" className="context-app-bar__action" aria-label="Messenger"><MessageCircle size={20}/></Link>
          <Link href="/notifications" className="context-app-bar__action" aria-label="Notifications">
            <Bell className="h-[18px] w-[18px]" />
            {(unread.data?.count ?? 0) > 0 ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary-ink" /> : null}
          </Link>

          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
}

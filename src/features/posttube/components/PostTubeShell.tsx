"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell, Home, TrendingUp, Clock, Radio, Compass, Library, Bookmark, Upload, Settings, Tv2, Moon, Sun } from "lucide-react";
import { useState, useEffect, useCallback, type FormEvent, type ReactNode } from "react";
import { CreateButton } from "@/features/reels/components/CreateButton";
import { ProfileDropdown } from "@/features/reels/components/ProfileDropdown";

/* ── Dark mode hook ───────────────────────────────────── */

function useDarkMode() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("posttube-dark", "true");
  }, []);

  const toggle = useCallback(() => {
    // Locked to dark mode for B&W theme
  }, []);

  return { dark, toggle };
}

/* ── Sidebar Nav Item ─────────────────────────────────── */

interface NavIconProps {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
}

function NavIcon({ href, icon, label, active }: NavIconProps) {
  return (
    <Link
      href={href}
      className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 ${
        active
          ? "bg-gradient-to-br from-brand-text to-black text-white shadow-[0_4px_12px_-2px_rgba(0,0,0,0.4)]"
          : "text-[#8B8B9E] dark:text-[#6B6980] hover:bg-brand-secondary dark:hover:bg-[#2A2740] hover:text-brand-text"
      }`}
      aria-label={label}
    >
      {icon}
      <span className="pointer-events-none absolute left-full ml-3.5 whitespace-nowrap rounded-xl bg-[#1A1625] dark:bg-[#3A3650] px-3.5 py-2 text-[11px] font-semibold text-white opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100">
        {label}
        <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-[#1A1625] dark:bg-[#3A3650]" />
      </span>
    </Link>
  );
}

/* ── PostTube Header ──────────────────────────────────── */

function PostTubeHeader({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  return (
    <header className="sticky top-0 z-50 h-[68px] border-b border-[#EEEDF5] dark:border-[#2A2740] bg-brand-card/80 dark:bg-[#13111C]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1440px] items-center px-6">
        {/* Left: PostTube Logo */}
        <div className="flex w-[200px] shrink-0 items-center">
          <Link
            href="/posttube"
            className="group flex items-center gap-2.5 transition-all hover:opacity-90"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-text to-black shadow-[0_2px_8px_-1px_rgba(0,0,0,0.35)]">
              <Tv2 className="h-[18px] w-[18px] text-white" />
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#F59E0B] ring-2 ring-white dark:ring-[#13111C]" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-extrabold tracking-tight text-[#0F0D15] dark:text-[#EEEDF5]">PostTube</span>
              <span className="text-[9px] font-semibold tracking-widest text-[#B0ADBE] dark:text-[#6B6980] uppercase">Studio</span>
            </div>
          </Link>
        </div>

        {/* Center: Search */}
        <div className="flex flex-1 justify-center">
          <form onSubmit={onSubmit} className="w-[min(540px,48vw)]">
            <div className={`relative rounded-2xl transition-all duration-300 ${searchFocused ? "shadow-[0_0_0_3px_rgba(0,0,0,0.12)]" : ""}`}>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#B0ADBE] dark:text-[#6B6980]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search videos, creators, topics..."
                className="h-11 w-full rounded-2xl border border-[#EEEDF5] dark:border-[#2A2740] bg-[#F8F7FC] dark:bg-[#1C1A28] pl-11 pr-4 text-[13px] text-[#0F0D15] dark:text-[#EEEDF5] placeholder:text-[#B0ADBE] dark:placeholder:text-[#6B6980] outline-none transition-all duration-300 focus:border-brand-text/30 focus:bg-brand-card dark:focus:bg-[#221F32]"
              />
            </div>
          </form>
        </div>

        {/* Right: Dark toggle + Create + Notifications + Profile */}
        <div className="flex w-[240px] shrink-0 items-center justify-end gap-1.5">


          <CreateButton />

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-2xl text-[#8B8B9E] dark:text-[#6B6980] transition-all hover:bg-brand-secondary dark:hover:bg-[#2A2740] hover:text-brand-text"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#F59E0B] ring-2 ring-white dark:ring-[#13111C]" />
          </button>

          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
}

/* ── PostTube Sidebar ─────────────────────────────────── */

function PostTubeSideNav() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[68px] shrink-0 flex-col items-center border-r border-[#EEEDF5] dark:border-[#2A2740] bg-[#FCFBFF] dark:bg-[#16141F] py-4 gap-1.5">
      <NavIcon
        href="/posttube"
        icon={<Home className="h-[18px] w-[18px]" />}
        label="Home"
        active={pathname === "/posttube"}
      />
      <NavIcon
        href="/posttube?tab=trending"
        icon={<TrendingUp className="h-[18px] w-[18px]" />}
        label="Trending"
      />
      <NavIcon
        href="/posttube?tab=explore"
        icon={<Compass className="h-[18px] w-[18px]" />}
        label="Explore"
      />
      <NavIcon
        href="/posttube?tab=live"
        icon={<Radio className="h-[18px] w-[18px]" />}
        label="Live"
      />

      <div className="my-1.5 h-px w-7 rounded-full bg-[#E8E6F0] dark:bg-[#2A2740]" />

      <NavIcon
        href="/posttube?tab=library"
        icon={<Library className="h-[18px] w-[18px]" />}
        label="Library"
      />
      <NavIcon
        href="/posttube?tab=history"
        icon={<Clock className="h-[18px] w-[18px]" />}
        label="History"
      />
      <NavIcon
        href="/posttube?tab=saved"
        icon={<Bookmark className="h-[18px] w-[18px]" />}
        label="Saved"
      />

      <div className="my-1.5 h-px w-7 rounded-full bg-[#E8E6F0] dark:bg-[#2A2740]" />

      <NavIcon
        href="/posttube/upload"
        icon={<Upload className="h-[18px] w-[18px]" />}
        label="Upload"
        active={pathname.startsWith("/posttube/upload")}
      />

      <div className="mt-auto">
        <NavIcon
          href="/settings/channel"
          icon={<Settings className="h-[18px] w-[18px]" />}
          label="Settings"
        />
      </div>
    </aside>
  );
}

/* ── Shell ─────────────────────────────────────────────── */

export function PostTubeShell({ children }: { children: ReactNode }) {
  const { dark, toggle } = useDarkMode();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#FAFAFE] dark:bg-[#0F0D15]">
      <PostTubeHeader dark={dark} onToggleDark={toggle} />
      <div className="flex flex-1 min-h-0">
        <PostTubeSideNav />
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

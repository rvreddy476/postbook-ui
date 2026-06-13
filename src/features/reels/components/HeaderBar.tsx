"use client";

import Link from "next/link";
import { Search, Bell } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CreateButton } from "@/features/reels/components/CreateButton";
import { ProfileDropdown } from "@/features/reels/components/ProfileDropdown";

interface HeaderBarProps {
  /** Section label shown next to logo (e.g. "Reels", "Upload", "Live") */
  sectionLabel?: string;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  onSearchSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}

// Styled to match the main app header (MinimalHeader): the dark VChat bar,
// the orchid-gradient "VC" badge + "VChat" wordmark — so Reels and the rest
// of the app share one header identity.
export function HeaderBar({
  sectionLabel = "Reels",
  searchValue: externalSearch,
  onSearchValueChange: externalOnChange,
  onSearchSubmit: externalOnSubmit,
}: HeaderBarProps) {
  const router = useRouter();
  const [internalSearch, setInternalSearch] = useState("");

  const searchValue = externalSearch ?? internalSearch;
  const onSearchValueChange = externalOnChange ?? setInternalSearch;
  const onSearchSubmit = externalOnSubmit ?? ((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = searchValue.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
    else router.push("/search");
  });

  return (
    <header className="sticky top-0 z-50 h-16 bg-brand-text text-brand-bg dark:bg-brand-bg dark:text-brand-text dark:border-b dark:border-brand-divider">
      <div className="flex h-full items-center px-4 sm:px-10">
        {/* Left: Logo — identical to MinimalHeader */}
        <div className="flex w-[200px] shrink-0 items-center gap-3">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[0.7rem] orchid-gradient shadow-lg shadow-brand-text/20 transition-all duration-500 group-hover:scale-105 group-hover:rotate-6">
              <span className="text-base font-black tracking-tighter text-white">VC</span>
            </div>
            <span className="hidden text-xl font-black italic tracking-tighter text-brand-bg dark:text-brand-text sm:block">
              VChat
            </span>
          </Link>
          <div className="h-5 w-px bg-white/20 dark:bg-brand-divider" />
          <span className="text-[12px] font-bold uppercase tracking-widest text-white/50 dark:text-brand-text/50">
            {sectionLabel}
          </span>
        </div>

        {/* Center: Search */}
        <div className="flex flex-1 justify-center">
          <form onSubmit={onSearchSubmit} className="w-[min(560px,50vw)] max-w-full">
            <div className="group relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-white/70 dark:text-brand-text/40" />
              <input
                value={searchValue}
                onChange={(event) => onSearchValueChange(event.target.value)}
                placeholder="Search reels, creators, hashtags..."
                className="h-[40px] w-full rounded-full border border-white/20 bg-white/10 pl-11 pr-4 text-[13px] text-white placeholder:text-white/40 outline-none transition-all focus:border-white/30 focus:bg-white/20 dark:border-brand-divider dark:bg-brand-secondary dark:text-brand-text dark:placeholder:text-brand-text/30"
              />
            </div>
          </form>
        </div>

        {/* Right: Create + Notifications + Profile */}
        <div className="flex w-[240px] shrink-0 items-center justify-end gap-2">
          <CreateButton />

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white dark:text-brand-text/60 dark:hover:bg-brand-accent/10 dark:hover:text-brand-accent"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-accent" />
          </button>

          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
}

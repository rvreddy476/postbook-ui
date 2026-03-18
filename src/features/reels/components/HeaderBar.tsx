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
    <header className="sticky top-0 z-50 h-[72px] bg-brand-card border-b border-[#EDEDEF]">
      <div className="mx-auto flex h-full max-w-[1400px] items-center px-6">
        {/* Left: Logo / Home */}
        <div className="flex w-[200px] shrink-0 items-center gap-3">
          <Link
            href="/"
            className="group flex items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-text to-fuchsia-500 shadow-sm">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12h8l-4-8v16l4-8H4z" />
                <path d="M12 12h8l-4-8v16l4-8h-8z" />
              </svg>
            </div>
            <span className="text-[15px] font-bold tracking-tight text-brand-text">
              atpost
            </span>
          </Link>
          <div className="mx-1 h-5 w-px bg-brand-secondary" />
          <span className="text-[13px] font-semibold tracking-wide text-brand-text/60 uppercase">
            {sectionLabel}
          </span>
        </div>

        {/* Center: Search */}
        <div className="flex flex-1 justify-center">
          <form onSubmit={onSearchSubmit} className="w-[min(560px,50vw)] max-w-full">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-brand-text/60" />
              <input
                value={searchValue}
                onChange={(event) => onSearchValueChange(event.target.value)}
                placeholder="Search reels, creators, hashtags..."
                className="h-[42px] w-full rounded-full border border-transparent bg-[#F5F5F7] pl-11 pr-4 text-[13px] text-brand-text placeholder:text-brand-text/60 outline-none transition-all duration-200 focus:border-brand-divider focus:bg-brand-card focus:shadow-[0_0_0_4px_rgba(0,0,0,0.03)]"
              />
            </div>
          </form>
        </div>

        {/* Right: Create + Notifications + Profile */}
        <div className="flex w-[240px] shrink-0 items-center justify-end gap-2">
          <CreateButton />

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-brand-text/60 transition-colors hover:bg-brand-secondary hover:text-brand-highlight"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
          </button>

          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  TrendingUp,
  Clock,
  Bookmark,
  Heart,
  Users,
  Film,
  Plus,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";

interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  count?: number;
}

function NavItem({ href, icon, label, active, count }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-brand-highlight hover:bg-brand-secondary hover:text-brand-text"
      }`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
        active
          ? "bg-brand-card/15"
          : "bg-transparent group-hover:bg-brand-secondary"
      }`}>
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {typeof count === "number" && count > 0 ? (
        <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
          active ? "bg-brand-card/20 text-white" : "bg-brand-secondary text-brand-highlight"
        }`}>
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function NavSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-1">
      <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-text/30">
        {label}
      </p>
      <nav className="flex flex-col gap-0.5">{children}</nav>
    </div>
  );
}

export function ReelsLeftNav() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-[#EDEDEF] bg-brand-card py-5 px-3">
      {/* Create */}
      <div className="mb-3 px-1">
        <Link
          href="/reels/create"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-brand-text"
        >
          <Plus className="h-4 w-4" />
          Create Reel
        </Link>
      </div>

      {/* Main nav */}
      <NavSection label="Browse">
        <NavItem
          href="/reels"
          icon={<Film className="h-[16px] w-[16px]" />}
          label="For You"
          active={pathname === "/reels"}
        />
        <NavItem
          href="/reels?tab=explore"
          icon={<Compass className="h-[16px] w-[16px]" />}
          label="Explore"
        />
        <NavItem
          href="/reels?tab=trending"
          icon={<TrendingUp className="h-[16px] w-[16px]" />}
          label="Trending"
          count={12}
        />
      </NavSection>

      <div className="my-3 mx-3 h-px bg-brand-secondary" />

      {/* Library */}
      <NavSection label="Library">
        <NavItem
          href="/reels?tab=following"
          icon={<Users className="h-[16px] w-[16px]" />}
          label="Following"
        />
        <NavItem
          href="/reels?tab=liked"
          icon={<Heart className="h-[16px] w-[16px]" />}
          label="Liked"
        />
        <NavItem
          href="/reels?tab=saved"
          icon={<Bookmark className="h-[16px] w-[16px]" />}
          label="Saved"
        />
        <NavItem
          href="/reels?tab=history"
          icon={<Clock className="h-[16px] w-[16px]" />}
          label="Watch History"
        />
      </NavSection>

      <div className="my-3 mx-3 h-px bg-brand-secondary" />

      {/* Suggested Creators */}
      <div className="mb-1 px-3">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-text/30">
          Suggested Creators
        </p>
        <div className="flex flex-col gap-2.5">
          {[
            { name: "Ari Vale", handle: "@arivale", avatar: "https://api.dicebear.com/9.x/lorelei/svg?seed=AriVale" },
            { name: "Nova Raye", handle: "@novaraye", avatar: "https://api.dicebear.com/9.x/lorelei/svg?seed=NovaRaye" },
            { name: "Kian Vox", handle: "@kianvox", avatar: "https://api.dicebear.com/9.x/lorelei/svg?seed=KianVox" },
          ].map((creator) => (
            <div key={creator.handle} className="flex items-center gap-2.5">
              <img
                src={creator.avatar}
                alt={creator.name}
                className="h-8 w-8 rounded-full bg-brand-secondary object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="truncate text-[12px] font-semibold text-brand-text">{creator.name}</p>
                <p className="truncate text-[11px] text-brand-text/60">{creator.handle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom spacer + settings */}
      <div className="mt-auto pt-3">
        <div className="mx-3 mb-3 h-px bg-brand-secondary" />
        <NavItem
          href="/"
          icon={<Home className="h-[16px] w-[16px]" />}
          label="Back to Home"
        />
        <NavItem
          href="/settings"
          icon={<Settings className="h-[16px] w-[16px]" />}
          label="Settings"
        />
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  Users,
  Library,
  Upload,
  Film,
  Clock,
  Heart,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";

interface NavIconProps {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  newTab?: boolean;
}

function NavIcon({ href, icon, label, active, newTab }: NavIconProps) {
  return (
    <Link
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className={`group relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-150 ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-brand-highlight hover:bg-brand-secondary hover:text-brand-text"
      }`}
      aria-label={label}
    >
      {icon}
      {/* Tooltip */}
      <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {label}
        <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-slate-900" />
      </span>
    </Link>
  );
}

export function ReelIconSideNav() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col items-center border-r border-[#E8E8EE] bg-brand-card py-4 gap-1">
      <NavIcon
        href="/"
        icon={<Home className="h-[18px] w-[18px]" />}
        label="Home"
      />
      <NavIcon
        href="/reels"
        icon={<Film className="h-[18px] w-[18px]" />}
        label="Reels"
        active={pathname === "/reels"}
      />
      <NavIcon
        href="/posttube"
        icon={<Compass className="h-[18px] w-[18px]" />}
        label="PostTube"
        newTab
      />
      <NavIcon
        href="/discover"
        icon={<Users className="h-[18px] w-[18px]" />}
        label="Subscriptions"
      />

      <div className="my-2 h-px w-8 bg-brand-secondary" />

      <NavIcon
        href="/saved"
        icon={<Library className="h-[18px] w-[18px]" />}
        label="Library"
      />
      <NavIcon
        href="/reels?tab=history"
        icon={<Clock className="h-[18px] w-[18px]" />}
        label="History"
      />
      <NavIcon
        href="/reels?tab=liked"
        icon={<Heart className="h-[18px] w-[18px]" />}
        label="Liked"
      />

      <div className="my-2 h-px w-8 bg-brand-secondary" />

      <NavIcon
        href="/reels/create"
        icon={<Upload className="h-[18px] w-[18px]" />}
        label="Upload"
      />

      {/* Bottom */}
      <div className="mt-auto">
        <NavIcon
          href="/settings"
          icon={<Settings className="h-[18px] w-[18px]" />}
          label="Settings"
        />
      </div>
    </aside>
  );
}

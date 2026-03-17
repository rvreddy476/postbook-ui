"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { User, Settings, Bookmark, LogOut } from "lucide-react";
import { Avatar } from "@/components/LetterAvatar";
import { useMyProfile } from "@/hooks/useEditProfile";

export function ProfileDropdown() {
  const { data: profile } = useMyProfile();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = profile?.display_name || "User";
  const handle = profile?.username || "";
  const avatarUrl = profile?.avatar_media_id
    ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/v1/media/${profile.avatar_media_id}/serve`
    : undefined;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  const pathname = usePathname();
  const isPosttube = pathname?.startsWith("/posttube") || pathname?.startsWith("/reels");

  const menuItems = [
    {
      label: isPosttube ? "My Channel" : "Profile",
      href: isPosttube ? "/posttube/channel" : "/profile",
      icon: User,
      hoverColor: "group-hover:bg-[#D8103F]/5 group-hover:text-[#D8103F]",
    },
    { label: "Channel Settings", href: "/settings/channel", icon: Settings, hoverColor: "group-hover:bg-blue-50 group-hover:text-blue-600" },
    { label: "Saved", href: "/saved", icon: Bookmark, hoverColor: "group-hover:bg-amber-50 group-hover:text-amber-600" },
  ];

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:ring-4 hover:ring-[#D8103F]/10"
      >
        <Avatar
          src={avatarUrl}
          name={displayName}
          seed={profile?.id}
          size="sm"
          className="border-2 border-white shadow-sm"
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "circOut" }}
            className="absolute right-0 mt-3 w-64 rounded-[1.5rem] border border-brand-divider/50 bg-brand-card/95 p-1.5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12)] backdrop-blur-3xl z-[1000]"
          >
            {/* Identity */}
            <div className="border-b border-brand-divider/60 p-3 mb-1">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <Avatar
                    src={avatarUrl}
                    name={displayName}
                    seed={profile?.id}
                    size="lg"
                    className="border-2 border-white shadow-md ring-1 ring-slate-100"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-[11px] font-black uppercase tracking-widest text-brand-text">
                    {displayName}
                  </h4>
                  {handle ? (
                    <p className="truncate text-[10px] text-brand-text/60">@{handle}</p>
                  ) : null}
                  <div className="mt-0.5 flex items-center gap-1">
                    <div className="h-1 w-1 rounded-full bg-emerald-500" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-brand-text/60">
                      Online
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu */}
            <div className="space-y-0.5">
              {menuItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                  <div className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-all hover:bg-brand-secondary">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-brand-secondary text-brand-text/60 transition-colors ${item.hoverColor}`}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-highlight group-hover:text-brand-text">
                      {item.label}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Logout */}
            <div className="mt-1 border-t border-brand-divider/60 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  // Logout logic handled by auth context
                  window.location.href = "/auth/login";
                }}
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-rose-500 transition-all hover:bg-rose-50/50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500 transition-colors group-hover:bg-rose-100">
                  <LogOut className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Logout
                </span>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

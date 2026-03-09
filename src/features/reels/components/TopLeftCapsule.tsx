"use client";

import Link from "next/link";
import { Search } from "lucide-react";

import { uiTokens } from "@/ui/tokens";

export function TopLeftCapsule() {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-[20px] border border-slate-200/80 bg-white/90 px-2 py-2 text-slate-700 shadow-lg backdrop-blur-md"
      style={{ backdropFilter: `blur(${uiTokens.blur.medium}px)` }}
    >
      <Link
        href="/"
        className="rounded-[16px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide transition hover:bg-slate-50"
      >
        Home
      </Link>
      <Link
        href="/search"
        className="inline-flex items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide transition hover:bg-slate-50"
        aria-label="Search reels"
      >
        <Search className="h-3.5 w-3.5" />
        Search
      </Link>
    </div>
  );
}

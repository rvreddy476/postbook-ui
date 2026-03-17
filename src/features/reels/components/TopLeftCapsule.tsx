"use client";

import Link from "next/link";
import { Search } from "lucide-react";

import { uiTokens } from "@/ui/tokens";

export function TopLeftCapsule() {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-[20px] border border-brand-divider/80 bg-brand-card/90 px-2 py-2 text-slate-700 shadow-lg backdrop-blur-md"
      style={{ backdropFilter: `blur(${uiTokens.blur.medium}px)` }}
    >
      <Link
        href="/"
        className="rounded-[16px] border border-brand-divider bg-brand-card px-3 py-1.5 text-xs font-semibold tracking-wide transition hover:bg-brand-secondary"
      >
        Home
      </Link>
      <Link
        href="/search"
        className="inline-flex items-center gap-2 rounded-[16px] border border-brand-divider bg-brand-card px-3 py-1.5 text-xs font-semibold tracking-wide transition hover:bg-brand-secondary"
        aria-label="Search reels"
      >
        <Search className="h-3.5 w-3.5" />
        Search
      </Link>
    </div>
  );
}

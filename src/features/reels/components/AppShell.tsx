"use client";

import { HeaderBar } from "@/features/reels/components/HeaderBar";
import { ReelIconSideNav } from "@/features/reels/components/ReelIconSideNav";

interface AppShellProps {
  sectionLabel?: string;
  children: React.ReactNode;
}

/**
 * Shared app shell with HeaderBar (logo + search + create + profile)
 * and left icon sidebar. Used by all content pages.
 */
export function AppShell({ sectionLabel, children }: AppShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <HeaderBar sectionLabel={sectionLabel} />
      <div className="flex flex-1 min-h-0">
        <ReelIconSideNav />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

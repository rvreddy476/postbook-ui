"use client";

import { Suspense } from "react";

import { ReelsScreen } from "@/features/reels/components/ReelsScreen";

function ReelsLoading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-divider border-t-brand-text/60" />
        <p className="text-[13px] text-brand-text/60">Loading reels…</p>
      </div>
    </div>
  );
}

export default function ReelsRoutePage() {
  return (
    <Suspense fallback={<ReelsLoading />}>
      <ReelsScreen />
    </Suspense>
  );
}

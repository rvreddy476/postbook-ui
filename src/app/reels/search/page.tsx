"use client";

import { Suspense } from "react";

import { ReelSearchScreen } from "@/features/reels/components/ReelSearchScreen";

function Loading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-canvas">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-divider border-t-brand-text/60" />
    </div>
  );
}

export default function ReelSearchPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ReelSearchScreen />
    </Suspense>
  );
}

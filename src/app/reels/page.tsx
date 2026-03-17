import { Suspense } from "react";
import { ReelsPage } from "@/features/reels/components/ReelsPage";

function ReelsLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-brand-card">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-divider border-t-slate-500" />
        <p className="text-[13px] text-brand-text/60">Loading reels...</p>
      </div>
    </div>
  );
}

export default function ReelsRoutePage() {
  return (
    <Suspense fallback={<ReelsLoading />}>
      <ReelsPage />
    </Suspense>
  );
}

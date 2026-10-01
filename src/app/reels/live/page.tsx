import { Suspense } from "react";
import type { Metadata } from "next";

import { ReelsLiveScreen } from "@/features/reels/live/components/ReelsLiveScreen";

export const metadata: Metadata = {
  title: "Live | Reels",
  description: "Vertical live streams on Reels.",
};

/** The Reels Live tab: live portrait streams, one at a time. `?feed=following` is the Following tab. */
export default function ReelsLivePage() {
  return (
    <Suspense fallback={null}>
      <ReelsLiveScreen />
    </Suspense>
  );
}

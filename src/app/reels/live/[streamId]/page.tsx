import { Suspense } from "react";
import type { Metadata } from "next";

import { ReelsLiveScreen } from "@/features/reels/live/components/ReelsLiveScreen";

export const metadata: Metadata = {
  title: "Live | Reels",
  description: "A live stream on Reels.",
};

type Props = { params: Promise<{ streamId: string }> };

/** The stage opened on one stream: live, a waiting card while it is scheduled, the reason and the recording once it is over. */
export default async function ReelsLiveStreamPage({ params }: Props) {
  const { streamId } = await params;
  const id = decodeURIComponent(streamId);
  return (
    <Suspense fallback={null}>
      <ReelsLiveScreen key={id} streamId={id} />
    </Suspense>
  );
}

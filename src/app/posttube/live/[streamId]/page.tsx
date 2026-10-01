import type { Metadata } from "next";

import { LiveWatchPage } from "@/features/posttube/live/LiveWatchPage";

export const metadata: Metadata = {
  title: "Live · PostTube",
  description: "A live stream on PostTube.",
};

type Props = { params: Promise<{ streamId: string }> };

/** The wide watch page: player and chat, the waiting card for a scheduled stream, the reason and the recording once it is over. */
export default async function PostTubeLiveWatchRoute({ params }: Props) {
  const { streamId } = await params;
  return <LiveWatchPage streamId={decodeURIComponent(streamId)} />;
}

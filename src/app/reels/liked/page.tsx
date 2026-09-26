import type { Metadata } from "next";

import { LikedReelsScreen } from "@/features/reels/components/LikedReelsScreen";

export const metadata: Metadata = {
  title: "Liked reels | VChat",
  description: "The reels you liked on VChat.",
};

export default function LikedReelsPage() {
  return <LikedReelsScreen />;
}

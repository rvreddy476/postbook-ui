import type { Metadata } from "next";

import { SoundReelsScreen } from "@/features/reels/components/SoundReelsScreen";

export const metadata: Metadata = {
  title: "Sound | VChat",
  description: "The reels that play this sound on VChat.",
};

// One sound and the reels that play it. The screen reads the sound itself;
// a sound this viewer may not hear reads as not available.
export default async function SoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SoundReelsScreen soundId={id} />;
}

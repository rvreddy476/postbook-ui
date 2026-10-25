import type { Metadata } from "next";

import { SoundReelsScreen } from "@/features/reels/components/SoundReelsScreen";
import { soundPageMetadata } from "@/features/share/routeMetadata";

type Props = { params: Promise<{ id: string }> };

/*
  The link preview: GET /v1/audio/:id read signed out — the sound's title
  and artist, how many reels use it, and the cover of the reel it came
  from when that reel is public. A sound the public may not hear gets the
  neutral card.
*/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return soundPageMetadata(id);
}

// One sound and the reels that play it. The screen reads the sound itself;
// a sound this viewer may not hear reads as not available.
export default async function SoundPage({ params }: Props) {
  const { id } = await params;
  return <SoundReelsScreen soundId={id} />;
}

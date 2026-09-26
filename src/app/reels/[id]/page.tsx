import { redirect } from "next/navigation";

// Single-reel permalink → the stage, pinned on that reel. The stage reads
// `reelId` (it also accepts the older `reel` and `postId` spellings other
// pages still emit).
export default async function ReelPermalinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/reels?reelId=${encodeURIComponent(id)}`);
}

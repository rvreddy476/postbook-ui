import { redirect } from 'next/navigation'

// Single-reel permalink: redirects to the main reels feed with ?reel=<id>,
// which ReelsPage already handles (see src/features/reels/components/ReelsPage.tsx).
export default async function ReelPermalinkPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/reels?reel=${encodeURIComponent(id)}`)
}

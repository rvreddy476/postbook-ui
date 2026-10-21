import type { Metadata } from "next";

import { postPageMetadata } from "@/features/share/routeMetadata";

import { PostDetailScreen } from "./PostDetailClient";

type Props = { params: Promise<{ postId: string }> };

/*
  /post/<id> — a post's public permalink: what Copy link and Share hand out
  for posts AND reels (the reels stage is gated; this page plays a reel
  signed out), and the address the Android app's App Link opens.

  The link preview (OpenGraph + Twitter card) is built on the server from
  GET /v1/posts/:id read signed out: caption, cover, and og:video where a
  public MP4 exists. A post a stranger may not see (404, members-only,
  age-restricted, not public) gets the neutral card and names nothing.
*/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  return postPageMetadata(postId, `/post/${encodeURIComponent(postId)}`);
}

export default function PostDetailPage() {
  return <PostDetailScreen />;
}

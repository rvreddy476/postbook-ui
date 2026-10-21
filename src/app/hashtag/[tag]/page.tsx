import type { Metadata } from "next";

import { hashtagPageMetadata } from "@/features/share/routeMetadata";

import { HashtagScreen } from "./HashtagClient";

type Props = { params: Promise<{ tag: string }> };

/*
  /hashtag/<tag> — a tag's page, the address its Share sheet hands out.
  Public (middleware PUBLIC_PREFIXES, 21 Oct 2026): a stranger gets what
  post-service gives the public, with the minimal header instead of the
  app shell — see HashtagClient.

  The link preview comes from GET /v1/hashtags/:tag/posts?limit=1 read
  signed out: the tag, its count when the server sends one, and the first
  public post's cover as the picture.
*/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  return hashtagPageMetadata(tag);
}

export default function HashtagPage() {
  return <HashtagScreen />;
}

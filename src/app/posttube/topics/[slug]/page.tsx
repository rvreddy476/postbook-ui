import type { Metadata } from "next";

import { TopicPage } from "@/features/posttube/discovery/components/TopicPage";

export const metadata: Metadata = {
  title: "Topic · PostTube",
};

/** `GET /v1/feed/videos?category=<slug>&sort=recent|popular` for one topic. */
export default async function PostTubeTopicRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TopicPage slug={decodeURIComponent(slug).toLowerCase()} />;
}

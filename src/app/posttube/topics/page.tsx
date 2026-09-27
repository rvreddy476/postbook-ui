import type { Metadata } from "next";

import { TopicsPage } from "@/features/posttube/discovery/components/TopicsPage";

export const metadata: Metadata = {
  title: "Topics · PostTube",
  description: "Every subject on PostTube, one page each.",
};

/** `GET /v1/posts/categories` (kind long | all) as a grid of topic cards. */
export default function PostTubeTopicsRoute() {
  return <TopicsPage />;
}

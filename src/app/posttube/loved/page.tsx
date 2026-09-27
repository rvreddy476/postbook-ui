"use client";

import { CollectionScreen } from "@/features/posttube/library";

/* /posttube/loved — the viewer's Loved list (system playlist `liked`). */
export default function PosttubeLovedPage() {
  return <CollectionScreen source={{ kind: "system", system: "liked" }} />;
}

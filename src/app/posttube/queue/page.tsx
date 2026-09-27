"use client";

import { CollectionScreen } from "@/features/posttube/library";

/* /posttube/queue — the viewer's Queue (system playlist `watch_later`). */
export default function PosttubeQueuePage() {
  return <CollectionScreen source={{ kind: "system", system: "watch_later" }} />;
}

/*
  Up next: the related list under the comments column (or the details
  card) with the pills All / <topic> / Fresh / Seen. Each pill is one
  `chip=` on GET /v1/feed/videos/:postId/related — `topic:<slug>`,
  `fresh`, `seen`; All sends none. Pure.
*/

export type UpNextChip = "all" | "topic" | "fresh" | "seen";

export interface UpNextPill {
  id: UpNextChip;
  label: string;
}

export interface UpNextTopic {
  slug: string;
  label: string;
}

/** The pills in order; the topic one only when the video has a topic. */
export function upNextPills(topic: UpNextTopic | null | undefined): UpNextPill[] {
  const pills: UpNextPill[] = [{ id: "all", label: "All" }];
  if (topic && topic.slug) pills.push({ id: "topic", label: topic.label || topic.slug });
  pills.push({ id: "fresh", label: "Fresh" }, { id: "seen", label: "Seen" });
  return pills;
}

/** The query the chip maps to. A topic pill without a slug degrades to All. */
export function upNextChipQuery(chip: UpNextChip, topicSlug?: string | null): Record<string, string> {
  switch (chip) {
    case "topic":
      return topicSlug ? { chip: `topic:${topicSlug}` } : {};
    case "fresh":
      return { chip: "fresh" };
    case "seen":
      return { chip: "seen" };
    default:
      return {};
  }
}

export function isUpNextChip(value: unknown): value is UpNextChip {
  return value === "all" || value === "topic" || value === "fresh" || value === "seen";
}

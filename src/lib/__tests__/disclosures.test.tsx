import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DisclosureBadges } from "@/components/DisclosureBadges";
import { disclosureLabels, disclosuresFromWire } from "@/lib/disclosures";
import { toReelItem, type FeedReelPost } from "@/features/reels/model";
import { normalizeWatchDetail, type WatchPostRow } from "@/features/posttube/watch/watchApi";
import type { PostTubeVideo } from "@/features/posttube/types";

describe("creator disclosures", () => {
  test("only a literal true counts, in one fixed order", () => {
    expect(disclosuresFromWire({ ai_generated: "true", paid_promotion: 1 })).toEqual({ aiGenerated: false, paidPromotion: false, alteredContent: false });
    expect(disclosureLabels({ alteredContent: true, aiGenerated: true, paidPromotion: true }).map((l) => l.label)).toEqual([
      "AI-generated",
      "Paid promotion",
      "Altered content",
    ]);
    expect(disclosureLabels(null)).toEqual([]);
  });

  test("the badge renders the AI label and nothing when undisclosed", () => {
    const html = renderToStaticMarkup(<DisclosureBadges disclosures={{ aiGenerated: true }} onMedia />);
    expect(html).toContain('data-disclosure="ai"');
    expect(html).toContain("AI-generated");
    expect(renderToStaticMarkup(<DisclosureBadges disclosures={{}} />)).toBe("");
  });

  test("a reel row carries its disclosures to the overlay", () => {
    const row: FeedReelPost = {
      id: "r1",
      author_id: "a1",
      content_type: "flick",
      media: [{ media_id: "m1", kind: "video", duration_ms: 10_000, width: 1080, height: 1920 } as never],
      ai_generated: true,
      paid_promotion: false,
    };
    expect(toReelItem(row)?.disclosures).toEqual({ aiGenerated: true, paidPromotion: false, alteredContent: false });
  });

  test("the watch page reads them from the post detail", () => {
    const detail = normalizeWatchDetail({ id: "v1", ai_generated: true, altered_content: true } as WatchPostRow, { like_count: 0 } as PostTubeVideo);
    expect(detail.disclosures).toEqual({ aiGenerated: true, paidPromotion: false, alteredContent: true });
  });
});

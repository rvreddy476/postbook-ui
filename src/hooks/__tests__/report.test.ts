import { describe, expect, test } from "bun:test";

import { reportRequestBody } from "@/hooks/useReport";

describe("POST /v1/reports body", () => {
  test("a profile report is entity_type user with the account's id (T-03)", () => {
    expect(
      reportRequestBody({ targetType: "user", targetId: "user-123", reason: "harassment", description: "rude" }),
    ).toEqual({ entity_type: "user", entity_id: "user-123", reason: "harassment", details: "rude" });
  });

  test("details default to empty; reels and videos are still posts", () => {
    expect(reportRequestBody({ targetType: "user", targetId: "u", reason: "spam" }).details).toBe("");
    expect(reportRequestBody({ targetType: "reel", targetId: "p", reason: "spam" }).entity_type).toBe("post");
    expect(reportRequestBody({ targetType: "video", targetId: "p", reason: "spam" }).entity_type).toBe("post");
    expect(reportRequestBody({ targetType: "comment", targetId: "c", reason: "spam" }).entity_type).toBe("comment");
  });
});

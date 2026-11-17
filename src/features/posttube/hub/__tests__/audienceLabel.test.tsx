import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { normalizeVisibility } from "../hubApi";
import { VISIBILITY_LABEL } from "../hubModel";
import { VisibilityPill } from "../components/Pills";

/*
  The hub showed followers-only and friends-only videos as "Public"
  (normalizeVisibility fell through to "public"), so a creator could
  "fix" a followers video to public by mistake.
*/

describe("the hub shows the real audience", () => {
  test("followers and friends keep their own value; narrower circles read as friends", () => {
    expect(normalizeVisibility("followers")).toBe("followers");
    expect(normalizeVisibility("FRIENDS")).toBe("friends");
    expect(normalizeVisibility("close_friends")).toBe("friends");
    expect(normalizeVisibility("trusted")).toBe("friends");
    expect(normalizeVisibility("followers", "2026-12-01T00:00:00Z")).toBe("followers");
  });

  test("the row's pill says Followers / Friends, not Public", () => {
    const followers = renderToStaticMarkup(<VisibilityPill value={normalizeVisibility("followers")} onChange={() => undefined} />);
    expect(followers).toContain("Followers");
    expect(followers).not.toContain("Public");
    expect(followers).toContain('data-vis="followers"');
    const friends = renderToStaticMarkup(<VisibilityPill value={normalizeVisibility("friends")} onChange={() => undefined} />);
    expect(friends).toContain("Friends");
    expect(friends).not.toContain("Public");
    expect(VISIBILITY_LABEL.followers).toBe("Followers");
  });
});

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  GRAPH_ROUTES,
  blockFlagsFromGraph,
  blockedByViewer,
  graphUserIdBody,
  idsFromGraphList,
  relationshipFromGraph,
} from "@/lib/graphApi";

describe("graph routes", () => {
  test("follow, unfollow and block are graph-service routes, never profile-service", () => {
    expect(GRAPH_ROUTES.follow).toBe("/v1/graph/follow");
    // Unfollow is its own POST path; DELETE /v1/graph/follow is not a route.
    expect(GRAPH_ROUTES.unfollow).toBe("/v1/graph/unfollow");
    expect(GRAPH_ROUTES.block).toBe("/v1/graph/block");
    expect(GRAPH_ROUTES.followers("u-1")).toBe("/v1/graph/followers/u-1");
    expect(GRAPH_ROUTES.following("u-1")).toBe("/v1/graph/following/u-1");
    expect(GRAPH_ROUTES.blockedAndMuted).toBe("/v1/graph/blocked-and-muted");
  });

  test("the body names the target as user_id, the field graph-service binds", () => {
    expect(graphUserIdBody("abc")).toEqual({ user_id: "abc" });
  });
});

describe("idsFromGraphList", () => {
  test("offset path: a bare array of ids", () => {
    expect(idsFromGraphList(["a", "b"])).toEqual({ ids: ["a", "b"], nextCursor: "" });
  });
  test("cursor path: items plus next_cursor", () => {
    expect(idsFromGraphList({ items: ["a"], next_cursor: "c1" })).toEqual({ ids: ["a"], nextCursor: "c1" });
  });
  test("an owner who blocked the caller gets a bare empty array on either path", () => {
    expect(idsFromGraphList([])).toEqual({ ids: [], nextCursor: "" });
    expect(idsFromGraphList(null)).toEqual({ ids: [], nextCursor: "" });
  });
});

describe("relationshipFromGraph (GET /v1/graph/relationship)", () => {
  test("follow fields are renamed", () => {
    const rel = relationshipFromGraph({ follows: true, followed_by: false });
    expect(rel?.following).toBe(true);
    expect(rel?.followed_by).toBe(false);
  });

  test("block flags are crossed on this route and swapped back for the UI", () => {
    // Route: blocked_by = the VIEWER blocked the target.
    const iBlockedThem = relationshipFromGraph({ blocked: false, blocked_by: true });
    expect(iBlockedThem?.blocked).toBe(true);
    expect(iBlockedThem?.blocked_by).toBe(false);
    // Route: blocked = the TARGET blocked the viewer.
    const theyBlockedMe = relationshipFromGraph({ blocked: true, blocked_by: false });
    expect(theyBlockedMe?.blocked).toBe(false);
    expect(theyBlockedMe?.blocked_by).toBe(true);
  });

  test("messaging is ruled out only by a block either way", () => {
    expect(relationshipFromGraph({})?.can_dm).toBe(true);
    expect(relationshipFromGraph({ blocked: true })?.can_dm).toBe(false);
    expect(relationshipFromGraph({ blocked_by: true })?.can_dm).toBe(false);
  });

  test("connection and follow-request state pass through", () => {
    const rel = relationshipFromGraph({ is_connection: true, follow_request_status: "pending_sent" });
    expect(rel?.connection_status).toBe("accepted");
    expect(rel?.can_add_to_group).toBe(true);
    expect(rel?.follow_request_status).toBe("pending_sent");
    expect(relationshipFromGraph({ connection_status: "pending_received" })?.connection_status).toBe("pending_received");
  });

  test("nothing in, nothing out", () => {
    expect(relationshipFromGraph(null)).toBeNull();
  });

  test("the explicit block fields win over the crossed legacy pair when present", () => {
    // New graph-service: explicit fields agree with the legacy pair.
    const iBlockedThem = relationshipFromGraph({
      blocked: false, blocked_by: true, viewer_blocked_target: true, target_blocked_viewer: false,
    });
    expect(iBlockedThem?.blocked).toBe(true);
    expect(iBlockedThem?.blocked_by).toBe(false);

    // If they ever disagree, the explicit fields are authoritative — false included.
    const explicitOnly = relationshipFromGraph({
      blocked: true, blocked_by: true, viewer_blocked_target: false, target_blocked_viewer: false,
    });
    expect(explicitOnly?.blocked).toBe(false);
    expect(explicitOnly?.blocked_by).toBe(false);
    expect(explicitOnly?.can_dm).toBe(true);

    const theyBlockedMe = relationshipFromGraph({ viewer_blocked_target: false, target_blocked_viewer: true });
    expect(theyBlockedMe?.blocked).toBe(false);
    expect(theyBlockedMe?.blocked_by).toBe(true);
    expect(theyBlockedMe?.can_dm).toBe(false);
  });

  test("an older graph-service without the explicit fields falls back to the legacy pair", () => {
    expect(blockFlagsFromGraph({ blocked_by: true })).toEqual({ viewerBlockedTarget: true, targetBlockedViewer: false });
    expect(blockFlagsFromGraph({ blocked: true })).toEqual({ viewerBlockedTarget: false, targetBlockedViewer: true });
    expect(blockFlagsFromGraph({})).toEqual({ viewerBlockedTarget: false, targetBlockedViewer: false });
    // A non-boolean explicit value is not trusted; the legacy field decides.
    expect(blockFlagsFromGraph({ viewer_blocked_target: null, blocked_by: true }).viewerBlockedTarget).toBe(true);
  });
});

describe("blockedByViewer (POST /v1/graph/relationships/batch)", () => {
  test("keeps only the accounts the viewer blocked, not mutes or blocks the other way", () => {
    const batch = {
      "id-blocked": { blocked: true, blocked_by: false, is_muted: false },
      "id-muted": { blocked: false, blocked_by: false, is_muted: true },
      "id-blocked-me": { blocked: false, blocked_by: true },
    };
    expect(blockedByViewer(batch)).toEqual(["id-blocked"]);
  });
  test("tolerates a wrapped { relationships } shape and empty input", () => {
    expect(blockedByViewer({ relationships: { a: { blocked: true } } })).toEqual(["a"]);
    expect(blockedByViewer(null)).toEqual([]);
  });
});

// profile-service answers these with 410 ROUTE_RETIRED. A web call to any of
// them silently does nothing, which is how follow, block and the follower
// lists were broken. This fails the build if one comes back.
describe("no web code calls the retired profile-service graph routes", () => {
  const retired = [
    /\/v1\/profiles\/\$\{[^}]+\}\/(follow|block|followers|following|relationship)\b/,
    /\/v1\/profiles\/me\/blocks\b/,
  ];

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name === "__tests__" || name === "node_modules") continue;
        out.push(...sourceFiles(path));
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        out.push(path);
      }
    }
    return out;
  }

  test("src/ is clean", () => {
    const root = join(import.meta.dir, "..", "..");
    const offenders: string[] = [];
    for (const file of sourceFiles(root)) {
      const text = readFileSync(file, "utf8");
      for (const re of retired) {
        if (re.test(text)) offenders.push(`${file.slice(root.length + 1)} matches ${re}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

import { expect, test } from "bun:test";

import { muteRequestBody } from "@/hooks/useMuting";

test("mute and unmute send the target as user_id, the field graph-service reads", () => {
  expect(muteRequestBody("abc")).toEqual({ user_id: "abc" });
  expect(Object.keys(muteRequestBody("abc"))).not.toContain("muted_id");
});

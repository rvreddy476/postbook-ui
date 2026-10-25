import { describe, expect, test } from "bun:test";

import { publishFailure } from "../studioApi";

function axiosError(status: number, data: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });
}

describe("publishFailure", () => {
  test("shows the server's message and code, not axios's status line", () => {
    const err = axiosError(403, { error: { code: "CHANNEL_REQUIRED", message: "Create your channel before posting a video" } });
    expect(publishFailure(err)).toEqual({ code: "CHANNEL_REQUIRED", message: "Create your channel before posting a video." });
  });

  test("keeps a message that already ends a sentence", () => {
    expect(publishFailure(axiosError(400, { error: { code: "TITLE_REQUIRED", message: "Add a title." } }))?.message).toBe("Add a title.");
  });

  test("falls back to the error's own message without an envelope", () => {
    expect(publishFailure(new Error("No video selected"))).toEqual({ code: null, message: "No video selected" });
    expect(publishFailure(axiosError(502, "<html>bad gateway</html>"))?.message).toBe("Request failed with status code 502");
  });

  test("no error, nothing to show", () => {
    expect(publishFailure(null)).toBeNull();
  });
});

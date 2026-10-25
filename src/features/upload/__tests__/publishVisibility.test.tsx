import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PublishStep } from "../steps/PublishStep";
import { INITIAL_FORM_STATE, type StudioFormState } from "../types";

const render = (patch: Partial<StudioFormState> = {}) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <PublishStep form={{ ...INITIAL_FORM_STATE, contentType: "long", ...patch } as StudioFormState} patch={() => undefined} />
    </QueryClientProvider>,
  );

describe("Publish step visibility", () => {
  test("offers Followers and Friends with honest descriptions, not a 'close friends' label that posts to followers", () => {
    const html = render();
    expect(html).toContain("Followers");
    expect(html).toContain("People who follow you");
    expect(html).toContain("Friends");
    expect(html).toContain("Followers you follow back");
    expect(html).not.toContain("Close friends only");
  });

  test("friends is a selectable value", () => {
    const html = render({ visibility: "friends" });
    expect(html).toMatch(/<input[^>]*checked=""[^>]*>[\s\S]{0,400}Friends|Friends[\s\S]{0,400}<input[^>]*checked=""/);
  });
});

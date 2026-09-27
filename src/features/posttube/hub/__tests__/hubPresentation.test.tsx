import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HUB_NAV, isHubItemCurrent } from "../hubNav";
import { CaptionsEmpty, InboxEmpty, InsightsEmpty, LibraryEmpty, OverviewEmpty } from "../components/HubEmpty";
import { LiveBars, RetentionCurve, Sparkline } from "../components/Charts";

describe("empty states", () => {
  test("overview empty state points at the upload studio and uses our words", () => {
    const html = renderToStaticMarkup(<OverviewEmpty />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Your channel is quiet");
    expect(html).toContain('href="/posttube/upload"');
    expect(html).not.toContain("Dashboard");
    expect(html).not.toContain("Studio");
  });

  test("library empty states per tab", () => {
    expect(renderToStaticMarkup(<LibraryEmpty kind="videos" />)).toContain("No videos yet");
    expect(renderToStaticMarkup(<LibraryEmpty kind="flicks" />)).toContain('href="/reels/create"');
    expect(renderToStaticMarkup(<LibraryEmpty kind="live" />)).toContain("No live recordings");
    expect(renderToStaticMarkup(<LibraryEmpty kind="collections" />)).toContain('href="/posttube/playlists"');
    expect(renderToStaticMarkup(<LibraryEmpty kind="collections" />)).not.toContain("Playlists");
  });

  test("inbox, captions and insights empties", () => {
    expect(renderToStaticMarkup(<InboxEmpty unanswered />)).toContain("Nothing waiting for a reply");
    expect(renderToStaticMarkup(<InboxEmpty unanswered={false} />)).toContain("No conversations yet");
    expect(renderToStaticMarkup(<CaptionsEmpty status="draft" />)).toContain("No caption drafts");
    expect(renderToStaticMarkup(<InsightsEmpty />)).toContain("No views in this period");
  });
});

describe("charts", () => {
  test("sparkline draws an area and a line; an all-zero series is flagged empty", () => {
    const html = renderToStaticMarkup(<Sparkline values={[1, 3, 2]} />);
    expect(html).toContain('class="area"');
    expect(html).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<Sparkline values={[0, 0]} />)).toContain("is-empty");
  });

  test("live bars render one rect per hour and mark the latest", () => {
    const html = renderToStaticMarkup(<LiveBars values={new Array(48).fill(1)} />);
    expect(html.match(/<rect/g)?.length).toBe(48);
    expect(html).toContain("is-last");
  });

  test("retention curve carries axis words, no colours inline", () => {
    const html = renderToStaticMarkup(<RetentionCurve points={[100, 80, 60]} />);
    expect(html).toContain("Start");
    expect(html).toContain("End");
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});

describe("hub nav", () => {
  test("the sections and their words are ours; Branding leaves to the channel settings", () => {
    expect(HUB_NAV.map((i) => i.label)).toEqual(["Overview", "Library", "Insights", "Conversations", "Captions", "Branding", "Preferences"]);
    expect(HUB_NAV.find((i) => i.key === "branding")?.href).toBe("/settings/channel");
    expect(HUB_NAV.find((i) => i.key === "branding")?.external).toBe(true);
  });

  test("current section: the overview only on the exact root, the rest by prefix", () => {
    const [overview, library] = HUB_NAV;
    expect(isHubItemCurrent(overview, "/posttube/hub")).toBe(true);
    expect(isHubItemCurrent(overview, "/posttube/hub/library")).toBe(false);
    expect(isHubItemCurrent(library, "/posttube/hub/library")).toBe(true);
    expect(isHubItemCurrent(library, "/posttube/hub/library/x")).toBe(true);
    expect(isHubItemCurrent(library, null)).toBe(false);
  });
});

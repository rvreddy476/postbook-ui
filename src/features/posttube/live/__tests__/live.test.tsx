import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { EMPTY_STREAM_FORM, formatLocalDateTime, parseStream, rowStatusView, watchState, type StreamRow } from "@/features/live/discovery";
import { visibleTabs } from "../../channel/channelModel";
import { HUB_NAV } from "../../hub/hubNav";
import { HubLiveTable, ScheduleGateView, StreamFormView, publishRecordingHref, topicsFor } from "../../hub/components/HubLivePage";
import { ChannelLiveView, LiveRing } from "../ChannelLive";
import { LiveChip, LiveStreamCard } from "../LiveCards";
import { LiveWatchView } from "../LiveWatchPage";
import { landscapeLive, liveEmptyCopy, splitHero } from "../liveModel";

const NOW = new Date(2026, 9, 2, 12, 0).getTime();
const iso = (t: number) => new Date(t).toISOString();
const HOUR = 3_600_000;

const row = (id: string, extra: Record<string, unknown> = {}): StreamRow =>
  parseStream({
    id,
    creator_user_id: "u1",
    title: `Show ${id}`,
    description: "What it is about",
    status: "live",
    visibility: "public",
    orientation: "landscape",
    category: "gaming",
    viewer_count: 12,
    viewer_peak: 90,
    heart_count: 5,
    creator: { user_id: "u1", name: "Raghu Builds", handle: "raghu.builds", badges: ["founding_creator"] },
    created_at: iso(NOW),
    ...extra,
  }) as StreamRow;

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("live page rules", () => {
  test("PostTube lists landscape streams that are live, nothing else", () => {
    const rows = [row("a"), row("p", { orientation: "portrait" }), row("r", { status: "reconnecting" }), row("s", { status: "scheduled" })];
    expect(landscapeLive(rows).map((r) => r.id)).toEqual(["a"]);
  });

  test("the hero is the most watched and leaves the grid", () => {
    const { hero, rest } = splitHero([row("a", { viewer_count: 5 }), row("b", { viewer_count: 50 }), row("c", { viewer_count: 9 })]);
    expect(hero?.id).toBe("b");
    expect(rest.map((r) => r.id)).toEqual(["a", "c"]);
    expect(splitHero([])).toEqual({ hero: null, rest: [] });
  });

  test("empty copy: invite a signed-in viewer to go live, only tell a signed-out one, ask Following for sign-in", () => {
    expect(liveEmptyCopy({ filter: "all", signedIn: true })).toMatchObject({ title: "Nobody is live right now", actionHref: "/live/new", actionLabel: "Go live" });
    expect(liveEmptyCopy({ filter: "all", signedIn: false }).actionHref).toBeUndefined();
    expect(liveEmptyCopy({ filter: "following", signedIn: true }).title).toBe("Nobody you follow is live right now");
    expect(liveEmptyCopy({ filter: "following", signedIn: false })).toMatchObject({ actionLabel: "Sign in", actionHref: "/login?next=%2Fposttube%2Flive" });
  });
});

describe("tiles", () => {
  test("the LIVE chip renders for status live only", () => {
    expect(renderToStaticMarkup(<LiveChip row={row("a")} />)).toContain('data-live="true"');
    for (const status of ["scheduled", "starting", "reconnecting", "ended", "failed", "nonsense"]) {
      expect(renderToStaticMarkup(<LiveChip row={row("a", { status })} />)).toBe("");
    }
  });

  test("a live tile: the name with the Founding creator mark, the topic, the current audience", () => {
    const html = renderToStaticMarkup(<LiveStreamCard row={row("a")} topic="Gaming" />);
    expect(html).toContain('href="/posttube/live/a"');
    expect(html).toContain(">Raghu Builds<");
    expect(html).toContain('aria-label="Founding creator: One of the first creators to go live here"');
    expect(html).toContain("Gaming");
    expect(html).toContain('aria-label="12 watching"');
    expect(html).not.toContain("tube-live-card__foot");
  });

  test("an upcoming tile: the time in the viewer's zone, the reminder count and the action; no audience", () => {
    const at = NOW + 26 * HOUR;
    const html = renderToStaticMarkup(<LiveStreamCard row={row("u", { status: "scheduled", scheduled_at: iso(at), reminder_count: 1 })} now={NOW} action={<button>Notify me</button>} />);
    expect(html).toContain(formatLocalDateTime(iso(at)));
    expect(html).toContain("1 reminder set");
    expect(html).toContain(">Notify me<");
    expect(html).toContain("is-upcoming");
    expect(html).not.toContain("watching");
    expect(html).not.toContain("disco-live__dot");
  });

  test("a creator card with only an id shows Creator, never the id", () => {
    const html = renderToStaticMarkup(<LiveStreamCard row={row("a", { creator: { user_id: "u-secret-id" } })} />);
    expect(html).toContain(">Creator<");
    expect(text(html)).not.toContain("u-secret-id");
    expect(html).not.toContain("Founding creator");
  });
});

describe("watch page", () => {
  const view = (r: StreamRow, extra: Partial<React.ComponentProps<typeof LiveWatchView>> = {}) =>
    renderToStaticMarkup(
      <LiveWatchView
        row={r}
        state={watchState(r, NOW)}
        view={rowStatusView(r)}
        creator={r.creator}
        topic="Gaming"
        isHost={false}
        signedIn
        stage={<div data-stage />}
        hearts={<span data-hearts />}
        subscribe={<button>Subscribe</button>}
        reminder={<button>Notify me</button>}
        supporters={<div data-supporters />}
        chat={watchState(r, NOW).chat ? <aside data-chat /> : null}
        {...extra}
      />,
    );

  test("live: the player with the chat beside it, title, creator row with Subscribe, viewers, hearts, topic chip, description", () => {
    const html = view(row("a"));
    expect(html).toContain('data-state="live"');
    expect(html).toContain("data-stage");
    expect(html).toContain("data-chat");
    expect(html).toContain('class="live-layout"');
    expect(html).toContain('<h1 class="tube-live-watch__title">Show a</h1>');
    expect(html).toContain('href="/posttube/channel/raghu.builds"');
    expect(html).toContain(">Raghu Builds<");
    expect(html).toContain("@raghu.builds");
    expect(html).toContain(">Founding creator<");
    expect(html).toContain(">Subscribe<");
    expect(html).toContain("12 watching");
    expect(html).toContain("data-hearts");
    expect(html).toContain('href="/posttube/topics/gaming"');
    expect(html).toContain("What it is about");
    expect(html).toContain('data-status="live"');
    expect(html).not.toContain("data-wait");
  });

  test("reconnecting keeps the player, says Reconnecting, and is not badged Live", () => {
    const html = view(row("a", { status: "reconnecting" }));
    expect(html).toContain("data-stage");
    expect(html).toContain('data-status="reconnecting"');
    expect(html).not.toContain('data-status="live"');
    expect(html).toContain("We&#x27;ll pick up as soon as they&#x27;re back.");
  });

  test("scheduled: the waiting card with the countdown label, the local time and Notify me; no player, no chat, no Live", () => {
    const at = NOW + 3 * HOUR;
    const html = view(row("a", { status: "scheduled", scheduled_at: iso(at), cover_media_id: "c1", reminder_count: 9, viewer_count: 0 }));
    expect(html).toContain('data-state="waiting"');
    expect(html).toContain('data-wait="scheduled"');
    expect(html).toContain("Starts in");
    expect(html).toContain(formatLocalDateTime(iso(at)));
    expect(html).toContain("9 reminders set");
    expect(html).toContain(">Notify me<");
    expect(html).toContain("tube-live-wait__cover");
    expect(html).not.toContain("data-stage");
    expect(html).not.toContain("data-chat");
    expect(html).not.toContain('data-status="live"');
    expect(html).not.toContain("watching");
  });

  test("scheduled and late: Starting soon instead of a countdown", () => {
    const html = view(row("a", { status: "scheduled", scheduled_at: iso(NOW - HOUR) }));
    expect(html).toContain("Starting soon");
    expect(html).not.toContain("Starts in");
  });

  test("the host of a scheduled stream gets the host screen, not Notify me", () => {
    const html = view(row("a", { status: "scheduled", scheduled_at: iso(NOW + HOUR) }), { isHost: true });
    expect(html).toContain('href="/live/a/broadcast"');
    expect(html).not.toContain(">Notify me<");
  });

  test("ended with a recording that became a video: the reason and a link to it; supporters shown", () => {
    const html = view(row("a", { status: "ended", ended_reason: "host_ended", recording_post_id: "p9" }));
    expect(html).toContain('data-state="ended"');
    expect(html).toContain("The host ended the stream.");
    expect(html).toContain('href="/posttube/watch/p9"');
    expect(html).toContain("Watch the recording");
    expect(html).toContain("data-supporters");
    expect(html).not.toContain("data-stage");
    expect(html).not.toContain("data-chat");
    expect(html).not.toContain("watching");
  });

  test("ended without a recording: the reason and a plain line, no link", () => {
    const html = view(row("a", { status: "ended", ended_reason: "admin_stopped" }));
    expect(html).toContain("Our moderators stopped this stream.");
    expect(html).toContain("No recording is available for this stream.");
    expect(html).not.toContain("/posttube/watch/");
    expect(html).not.toContain("<video");
  });

  test("ended with only a recording file plays the file", () => {
    const html = view(row("a", { status: "ended", recording_url: "https://cdn.example/x.mp4" }));
    expect(html).toContain('<video src="https://cdn.example/x.mp4"');
    expect(html).not.toContain("No recording is available");
  });

  test("a refusal to watch replaces the player and names the reason", () => {
    const html = view(row("a"), { watchError: "Only the creator's followers can watch this stream.", chat: null });
    expect(html).toContain("Only the creator&#x27;s followers can watch this stream.");
    expect(html).not.toContain("data-stage");
  });

  test("Report is offered only when the page hands it in", () => {
    expect(view(row("a"), { onReport: () => {} })).toContain('aria-label="Report stream"');
    expect(view(row("a"))).not.toContain("Report stream");
  });
});

describe("channel Live tab and LIVE ring", () => {
  test("the ring wraps the avatar only when there is a live stream to open", () => {
    const live = renderToStaticMarkup(<LiveRing href="/posttube/live/a" name="Raghu Builds"><img alt="" /></LiveRing>);
    expect(live).toContain('href="/posttube/live/a"');
    expect(live).toContain('aria-label="Raghu Builds is live. Watch now"');
    expect(live).toContain(">LIVE<");
    expect(renderToStaticMarkup(<LiveRing name="Raghu Builds"><img alt="" /></LiveRing>)).toBe('<img alt=""/>');
  });

  test("Live now and Upcoming sections; nothing at all when the channel has neither", () => {
    const html = renderToStaticMarkup(
      <ChannelLiveView live={[row("a")]} upcoming={[row("u", { status: "scheduled", scheduled_at: iso(NOW + HOUR) })]} now={NOW} renderReminder={() => <button>Notify me</button>} />,
    );
    expect(html).toContain(">Live now<");
    expect(html).toContain(">Upcoming<");
    expect(html).toContain('href="/posttube/live/a"');
    expect(html).toContain(">Notify me<");
    expect(renderToStaticMarkup(<ChannelLiveView live={[]} upcoming={[]} />)).toBe("");
  });

  test("a visitor sees the Live tab of a channel with no recordings while its creator is live", () => {
    const counts = { videos: 4, shorts: 0, live: 0, collections: 0 };
    expect(visibleTabs(counts, false)).not.toContain("live");
    expect(visibleTabs(counts, false, true)).toContain("live");
    expect(visibleTabs(counts, false, true)).not.toContain("shorts");
  });
});

describe("Creator Hub → Live", () => {
  test("the hub has a Live section", () => {
    expect(HUB_NAV.find((i) => i.key === "live")).toMatchObject({ label: "Live", href: "/posttube/hub/live" });
  });

  test("a scheduled row: Edit and the host screen; reminders counted", () => {
    const html = renderToStaticMarkup(<HubLiveTable rows={[row("s", { status: "scheduled", scheduled_at: iso(NOW + HOUR), reminder_count: 3 })]} onEdit={() => {}} />);
    expect(html).toContain(">Edit<");
    expect(html).toContain('href="/live/s/broadcast"');
    expect(html).toContain("3 reminders set");
    expect(html.indexOf(">Edit<")).toBeLessThan(html.indexOf("Open host screen")); // alphabetical
    expect(html).not.toContain("Publish recording");
  });

  test("a live row: the host screen and the audience, no Edit", () => {
    const html = renderToStaticMarkup(<HubLiveTable rows={[row("l")]} onEdit={() => {}} />);
    expect(html).toContain('href="/live/l/broadcast"');
    expect(html).toContain("12 watching");
    expect(html).not.toContain(">Edit<");
  });

  test("a past row: the recording's publish link when it became a video, else No recording", () => {
    const withVideo = renderToStaticMarkup(<HubLiveTable rows={[row("e", { status: "ended", recording_post_id: "p9" })]} />);
    expect(withVideo).toContain('href="/posttube/hub/library?edit=p9"');
    expect(withVideo).toContain("Publish recording");
    expect(withVideo).toContain('href="/posttube/watch/p9"');
    expect(withVideo).toContain("Peak 90");
    expect(withVideo).not.toContain("Open host screen");
    const without = renderToStaticMarkup(<HubLiveTable rows={[row("e", { status: "ended" })]} />);
    expect(without).toContain("No recording");
    expect(without).not.toContain("Publish recording");
    expect(publishRecordingHref({ recording_post_id: "" })).toBe("");
  });

  test("the schedule form: every field of the contract, choices alphabetical, errors shown", () => {
    const cats = [
      { slug: "music", label: "Music", kind: "all" as const },
      { slug: "gaming", label: "Gaming", kind: "long" as const },
      { slug: "dance", label: "Dance", kind: "short" as const },
    ];
    const values = { title: "", description: "", category: "", visibility: "public" as const, orientation: "landscape" as const, source: "device" as const, scheduledLocal: "", cover_media_id: null };
    const html = renderToStaticMarkup(
      <StreamFormView
        values={values}
        onChange={() => {}}
        check={{ ok: false, errors: { title: "Give your stream a title.", scheduled_at: "Choose a date and time." }, scheduled_at: null }}
        categories={cats}
        editing={false}
        busy={false}
        error={null}
        coverPreview={null}
        onPickCover={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );
    for (const label of ["Title", "Description", "Topic", "Cover", "Date and time", "Visibility", "Source", "Orientation"]) expect(html).toContain(`>${label}<`);
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain("Give your stream a title.");
    expect(html).toContain("Choose a date and time.");
    const order = (words: string[]) => words.map((w) => html.indexOf(`>${w}<`));
    const ascending = (xs: number[]) => xs.every((x, i) => x >= 0 && (i === 0 || x > xs[i - 1]));
    expect(ascending(order(["Followers only", "Public"]))).toBe(true);
    expect(ascending(order(["Streaming software", "This device"]))).toBe(true);
    expect(ascending(order(["Vertical for Reels", "Wide for PostTube"]))).toBe(true);
    expect(ascending(order(["Gaming", "Music"]))).toBe(true); // topics by label
    expect(html).not.toContain(">Dance<"); // a shorts-only topic is not offered for a wide stream
    expect(html).not.toContain(">Paid<");
    expect(html).toContain(">Schedule<");
    expect(topicsFor(cats, "portrait").map((c) => c.slug)).toEqual(["dance", "music"]);
  });

  test("editing: the source is fixed and the button saves", () => {
    const values = { title: "T", description: "", category: "gaming", visibility: "followers" as const, orientation: "landscape" as const, source: "encoder" as const, scheduledLocal: "2026-10-05T18:30", cover_media_id: "c1" };
    const html = renderToStaticMarkup(
      <StreamFormView values={values} onChange={() => {}} check={null} categories={[]} editing busy={false} error="This stream has already started or ended, so it can't be edited." coverPreview="/c.png" onPickCover={() => {}} onSubmit={() => {}} onCancel={() => {}} />,
    );
    expect(html).toMatch(/<select id="hub-live-source"[^>]*disabled/);
    expect(html).toContain(">Save changes<");
    expect(html).toContain("Replace cover");
    expect(html).toContain('role="alert"');
    expect(html).toContain(">Gaming<"); // the saved topic stays selectable even before the list loads
  });
});

describe("going live from the hub, and a full stream", () => {
  const formProps = { values: { ...EMPTY_STREAM_FORM }, onChange: () => {}, check: null, categories: [], editing: false, busy: false, error: null, coverPreview: null, onPickCover: () => {}, onSubmit: () => {}, onCancel: () => {} };

  test("Schedule a stream: the account check, the closed-pilot notice, or the nearly-ready panel replaces the form", () => {
    const gate = (g: "loading" | "pilot" | "nearly") => renderToStaticMarkup(<ScheduleGateView gate={g} panel={<div data-panel />} onClose={() => {}} />);
    expect(gate("loading")).toContain("Checking your account…");
    expect(gate("loading")).not.toContain("data-panel");
    expect(gate("pilot")).toContain("Going live is in a closed pilot right now.");
    expect(gate("pilot")).not.toContain("data-panel");
    expect(gate("nearly")).toContain("data-panel");
    expect(gate("nearly")).not.toContain("closed pilot");
    for (const g of ["loading", "pilot", "nearly"] as const) {
      expect(gate(g)).toContain(">Close<");
      expect(gate(g)).not.toContain("<form");
    }
  });

  test("the schedule form carries the viewer-cap note only while a cap applies", () => {
    const capped = renderToStaticMarkup(<StreamFormView {...formProps} note="Your first streams are limited to 200 viewers." />);
    expect(capped).toContain("data-viewer-cap");
    expect(capped).toContain("Your first streams are limited to 200 viewers.");
    expect(renderToStaticMarkup(<StreamFormView {...formProps} note="" />)).not.toContain("data-viewer-cap");
    expect(renderToStaticMarkup(<StreamFormView {...formProps} />)).not.toContain("data-viewer-cap");
  });

  test("a full stream offers Try again; any other refusal does not", () => {
    const r = row("a");
    const base = { row: r, state: watchState(r, NOW), view: rowStatusView(r), creator: r.creator, topic: "", isHost: false, signedIn: true, chat: null };
    const full = renderToStaticMarkup(<LiveWatchView {...base} watchError="This stream is full right now. Try again in a little while." onRetryWatch={() => {}} />);
    expect(full).toContain("This stream is full right now. Try again in a little while.");
    expect(full).toContain(">Try again<");
    const refused = renderToStaticMarkup(<LiveWatchView {...base} watchError="Only the creator's followers can watch this stream." />);
    expect(refused).not.toContain(">Try again<");
  });
});

describe("house rules", () => {
  test("the stylesheets use theme tokens only: no hex colours", () => {
    for (const file of ["../live.css", "../../../live/surfaces.css"]) {
      const css = readFileSync(resolve(import.meta.dir, file), "utf8");
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(css).toContain("rgb(var(--");
    }
  });
});

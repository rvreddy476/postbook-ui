import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseCreator, parseLiveCreators, parseStream, rowStatusView, type StreamRow } from "@/features/live/discovery";
import { toReelItem } from "@/features/reels/model";
import { ReelAuthorCard } from "@/features/reels/components/ReelAuthorCard";
import { ReelRail } from "@/features/reels/components/ReelRail";
import { liveEmptyCopy, liveStageState } from "../liveStage";
import { LiveCreatorsList, LiveEmpty, LiveHeader, LiveStatusCard, LiveTabs, LiveWaitingCard, OverlayChat } from "../components/LiveStageViews";

const NOW = Date.parse("2026-10-02T10:00:00Z");
const here = (p: string) => resolve(import.meta.dir, p);
const read = (p: string) => readFileSync(here(p), "utf8");

const row = (extra: Record<string, unknown> = {}): StreamRow =>
  parseStream({
    id: "s1",
    creator_user_id: "u1",
    title: "Morning sketches",
    status: "live",
    orientation: "portrait",
    viewer_count: 1234,
    creator: { user_id: "u1", name: "Asha Rao", handle: "asha", badges: ["founding_creator"] },
    ...extra,
  }) as StreamRow;

const header = (r: StreamRow, extra: Partial<React.ComponentProps<typeof LiveHeader>> = {}) =>
  renderToStaticMarkup(<LiveHeader row={r} state={liveStageState(r, NOW)} view={rowStatusView(r)} creator={r.creator} {...extra} />);

describe("LiveTabs", () => {
  it("draws For you and Following and marks the current one", () => {
    const html = renderToStaticMarkup(<LiveTabs tab="following" />);
    expect(html).toContain('href="/reels/live"');
    expect(html).toContain('aria-current="page" href="/reels/live?feed=following"');
    expect(html.match(/aria-current/g)).toHaveLength(1);
  });
});

describe("LiveHeader", () => {
  it("live: creator, founding badge, Follow, the LIVE badge, viewers and hearts", () => {
    const html = header(row(), { follow: <button>Follow</button>, hearts: <span data-hearts>9</span> });
    expect(html).toContain("Asha Rao");
    expect(html).toContain('href="/u/asha"');
    expect(html).toContain("live-founding");
    expect(html).toContain(">Follow<");
    expect(html).toContain('data-status="live"');
    expect(html).toContain("LIVE");
    expect(html).toContain('aria-label="1,234 watching"');
    expect(html).toContain("1.2K");
    expect(html).toContain("data-hearts");
  });

  it("never says LIVE unless the status is live", () => {
    for (const status of ["scheduled", "starting", "reconnecting", "ended", "failed", ""]) {
      const html = header(row({ status }), { hearts: <span data-hearts>9</span> });
      expect([status, html.includes(">LIVE<") || html.includes("LIVE</span>")]).toEqual([status, false]);
      expect(html).not.toContain('data-status="live"');
    }
    expect(header(row({ status: "reconnecting" }))).toContain("Reconnecting");
    expect(header(row({ status: "ended" }))).toContain("Ended");
  });

  it("viewers and hearts are shown only while media can flow", () => {
    const html = header(row({ status: "ended" }), { hearts: <span data-hearts>9</span> });
    expect(html).not.toContain("watching");
    expect(html).not.toContain("data-hearts");
  });

  it("a host card with only an id falls through to a neutral name and the id's profile", () => {
    const r = row({ creator: { user_id: "u1", name: "", handle: "" } });
    const html = header(r, { creator: parseCreator({ user_id: "u1" }) });
    expect(html).toContain("Creator");
    expect(html).toContain('href="/u/u1"');
    expect(html).not.toContain("live-founding");
  });

  it("a landscape stream offers PostTube; a portrait one does not", () => {
    expect(header(row({ orientation: "landscape" }))).toContain('data-posttube-link="true" href="/posttube/live/s1"');
    expect(header(row({ orientation: "landscape" }))).toContain("Watch on PostTube");
    expect(header(row())).not.toContain("Watch on PostTube");
  });
});

describe("OverlayChat", () => {
  const messages = [
    { id: "m1", stream_id: "s1", user_id: "u2", text: "hello", created_at: "2026-10-02T10:00:00Z" },
    { id: "m2", stream_id: "s1", user_id: "u3", text: "<b>hi</b>", created_at: "2026-10-02T10:00:01Z" },
  ];
  const base = { messages, nameOf: (id: string) => `name-${id}`, draft: "", onDraft: () => {}, onSend: () => {} };

  it("draws the messages with names and a composer", () => {
    const html = renderToStaticMarkup(<OverlayChat {...base} note="" />);
    expect(html).toContain("name-u2");
    expect(html).toContain("hello");
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(html).toContain('aria-label="Chat message"');
    expect(html).toContain('aria-label="Send message"');
    expect(html).toContain('role="log"');
  });

  it("a signed-out reader gets a sign-in link in place of the composer", () => {
    const html = renderToStaticMarkup(<OverlayChat {...base} note="Sign in to chat" signInHref="/login?next=%2Freels%2Flive%2Fs1" />);
    expect(html).toContain('href="/login?next=%2Freels%2Flive%2Fs1"');
    expect(html).not.toContain('aria-label="Chat message"');
  });

  it("a closed chat says why and has no composer; a send error is announced", () => {
    const html = renderToStaticMarkup(<OverlayChat {...base} note="Chat opens when the stream is live." error="You're sending too quickly. Wait a moment." />);
    expect(html).toContain("Chat opens when the stream is live.");
    expect(html).not.toContain("<form");
    expect(html).toContain('role="alert"');
  });
});

describe("OverlayChat names come from the author card on each row", () => {
  const card = (user_id: string, name: string, handle: string, role: "host" | "moderator" | "viewer") => ({ user_id, name, handle, avatar_url: "", badges: [], role });
  const messages = [
    { id: "m1", stream_id: "s1", user_id: "9c1e7f3a-0000-4000-8000-000000000001", text: "welcome", created_at: "2026-10-02T10:00:00Z", author: card("9c1e7f3a-0000-4000-8000-000000000001", "Asha Rao", "asha", "host") },
    { id: "m2", stream_id: "s1", user_id: "9c1e7f3a-0000-4000-8000-000000000002", text: "requests?", created_at: "2026-10-02T10:00:01Z", author: card("9c1e7f3a-0000-4000-8000-000000000002", "", "kiran", "moderator") },
    { id: "m3", stream_id: "s1", user_id: "9c1e7f3a-0000-4000-8000-000000000003", text: "hi", created_at: "2026-10-02T10:00:02Z", author: card("9c1e7f3a-0000-4000-8000-000000000003", "", "", "viewer") },
    { id: "m4", stream_id: "s1", user_id: "9c1e7f3a-0000-4000-8000-000000000004", text: "old row", created_at: "2026-10-02T10:00:03Z" },
  ];

  it("name, else @handle, else Viewer; Host and Mod marked; never a piece of the id", () => {
    const html = renderToStaticMarkup(<OverlayChat messages={messages} note="" draft="" onDraft={() => {}} onSend={() => {}} />);
    expect(html).toContain('class="reel-live-chat__name">Asha Rao<');
    expect(html).toContain('class="reel-live-chat__name">@kiran<');
    expect(html.match(/class="reel-live-chat__name">Viewer</g)).toHaveLength(2);
    expect(html).toContain('class="reel-live-chat__role">Host<');
    expect(html).toContain('class="reel-live-chat__role">Mod<');
    expect(html.match(/reel-live-chat__role/g)).toHaveLength(2);
    expect(html).not.toContain("9c1e");
  });
});

describe("waiting, ended and refused cards", () => {
  it("scheduled: the cover, the title and Notify me for a viewer", () => {
    const r = row({ status: "scheduled", scheduled_at: "2026-10-03T10:00:00Z", reminder_count: 3 });
    const html = renderToStaticMarkup(<LiveWaitingCard row={r} state={liveStageState(r, NOW)} cover="/v1/media/c1/serve" isHost={false} reminder={<button>Notify me</button>} />);
    expect(html).toContain('data-wait="scheduled"');
    expect(html).toContain('src="/v1/media/c1/serve"');
    expect(html).toContain("Starts in");
    expect(html).toContain("Morning sketches");
    expect(html).toContain("3 reminders set");
    expect(html).toContain("Notify me");
    expect(html).not.toContain("Open host screen");
  });

  it("scheduled: the host gets the host screen instead of a reminder; a passed time says Starting soon", () => {
    const r = row({ status: "scheduled", scheduled_at: "2026-10-01T10:00:00Z" });
    const html = renderToStaticMarkup(<LiveWaitingCard row={r} state={liveStageState(r, NOW)} cover="" isHost reminder={<button>Notify me</button>} />);
    expect(html).toContain('href="/live/s1/broadcast"');
    expect(html).not.toContain("Notify me");
    expect(html).toContain("Starting soon");
    expect(html).not.toContain("<img");
  });

  it("ended: the reason and the recording link when the recording became a video", () => {
    const r = row({ status: "ended", ended_reason: "host_ended", recording_post_id: "p9" });
    const view = rowStatusView(r);
    const html = renderToStaticMarkup(<LiveStatusCard title={view.title} body={view.body} state={liveStageState(r, NOW)} />);
    expect(html).toContain("Stream ended");
    expect(html).toContain("The host ended the stream.");
    expect(html).toContain('href="/posttube/watch/p9"');
    expect(html).toContain("Watch the recording");
  });

  it("ended with only a file links to the file; with nothing says so", () => {
    const file = row({ status: "ended", recording_url: "https://cdn.example/x.mp4" });
    expect(renderToStaticMarkup(<LiveStatusCard title="Stream ended" state={liveStageState(file, NOW)} />)).toContain('href="https://cdn.example/x.mp4"');
    const none = row({ status: "ended" });
    const html = renderToStaticMarkup(<LiveStatusCard title="Stream ended" state={liveStageState(none, NOW)} />);
    expect(html).toContain("No recording is available for this stream.");
    expect(html).not.toContain("Watch the recording");
  });

  it("a card that is not an ended stream never offers a recording", () => {
    const html = renderToStaticMarkup(<LiveStatusCard kind="refused" title="Only the creator's followers can watch this stream." />);
    expect(html).toContain('data-status="refused"');
    expect(html).not.toContain("recording");
  });
});

describe("side list and empty state", () => {
  const creators = parseLiveCreators({
    data: [
      { creator: { user_id: "u1", name: "Asha Rao", badges: ["founding_creator"] }, stream_id: "s1", viewer_count: 2500, orientation: "portrait" },
      { creator: { user_id: "u2", handle: "wide" }, stream_id: "s2" },
    ],
  });

  it("each live creator is ringed, counted and opens their stream where it is watched", () => {
    const html = renderToStaticMarkup(<LiveCreatorsList rows={creators} currentStreamId="s1" />);
    expect(html).toContain('href="/reels/live/s1"');
    expect(html).toContain('href="/posttube/live/s2"');
    expect(html.match(/reel-live-ring is-live/g)).toHaveLength(2);
    expect(html).toContain("2.5K");
    expect(html).toContain("@wide");
    expect(html).toContain('aria-label="Asha Rao is live. Watch now"');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
  });

  it("nobody live draws nothing", () => {
    expect(renderToStaticMarkup(<LiveCreatorsList rows={[]} />)).toBe("");
  });

  it("empty: the reason, then each upcoming stream with its own Notify me", () => {
    const upcoming = [row({ id: "up1", status: "scheduled", scheduled_at: "2026-10-03T10:00:00Z", title: "Tomorrow's stream" }), row({ id: "up2", status: "scheduled", title: "" })];
    const html = renderToStaticMarkup(
      <LiveEmpty copy={liveEmptyCopy({ tab: "for-you", signedIn: true })} upcoming={upcoming} reminderFor={(r) => <button data-remind={r.id}>Notify me</button>} />,
    );
    expect(html).toContain("Nothing live right now");
    expect(html).toContain("Upcoming");
    expect(html).toContain("Tomorrow&#x27;s stream");
    expect(html).toContain('href="/reels/live/up1"');
    expect(html).toContain('data-remind="up1"');
    expect(html).toContain('data-remind="up2"');
    // An untitled stream still has a name to press.
    expect(html).toContain("Live stream");
  });

  it("empty with nothing scheduled has no Upcoming section", () => {
    const html = renderToStaticMarkup(<LiveEmpty copy={liveEmptyCopy({ tab: "following", signedIn: false })} upcoming={[]} reminderFor={() => null} />);
    expect(html).toContain("Sign in to see who is live");
    expect(html).not.toContain("Upcoming");
  });
});

describe("LIVE ring on reels avatars", () => {
  const reel = toReelItem({ id: "r1", author_id: "a1", title: "T", content_type: "reel", author: { id: "a1", display_name: "Asha", username: "asha" }, media: [{ media_id: "m", kind: "video" }] })!;
  const rail = { reel, isOwn: false, following: true, followPending: false, onToggleFollow: () => {}, onLike: () => {}, onComments: () => {}, onShare: () => {}, onSave: () => {} };
  const card = { reel, isOwn: false, following: true, followPending: false, onToggleFollow: () => {}, onLike: () => {}, onSave: () => {}, onShare: () => {} };

  it("the rail avatar of a live creator is ringed and opens their stream", () => {
    const html = renderToStaticMarkup(<ReelRail {...rail} liveHref="/reels/live/s1" />);
    expect(html).toContain('class="reel-rail-avatar is-live"');
    expect(html).toContain('href="/reels/live/s1"');
    expect(html).toContain("is live. Watch now");
    expect(html).toContain("reel-live-tag");
  });

  it("no live stream, no ring: the avatar is the profile link it always was", () => {
    for (const html of [renderToStaticMarkup(<ReelRail {...rail} />), renderToStaticMarkup(<ReelRail {...rail} liveHref="" />)]) {
      expect(html).not.toContain("is-live");
      expect(html).not.toContain("reel-live-tag");
      expect(html).toContain('class="reel-rail-avatar"');
      expect(html).not.toContain("/reels/live/");
    }
  });

  it("the Follow badge keeps its place: the LIVE tag yields to it", () => {
    const html = renderToStaticMarkup(<ReelRail {...rail} following={false} liveHref="/reels/live/s1" />);
    expect(html).toContain("reel-rail-follow");
    expect(html).toContain("is-live");
    expect(html).not.toContain("reel-live-tag");
  });

  it("the author card avatar is ringed the same way, and the name stays the profile", () => {
    const live = renderToStaticMarkup(<ReelAuthorCard {...card} liveHref="/posttube/live/s2" />);
    expect(live).toContain('class="reel-author-card__avatar is-live"');
    expect(live).toContain('href="/posttube/live/s2"');
    expect(live).toContain('class="reel-author-card__name"');
    const plain = renderToStaticMarkup(<ReelAuthorCard {...card} />);
    expect(plain).not.toContain("is-live");
  });
});

describe("wiring", () => {
  const screen = read("../components/ReelsLiveScreen.tsx");
  const css = read("../reels-live.css");
  /** The props of the one <LivePlayer> element. */
  const player = screen.slice(screen.indexOf("<LivePlayer"), screen.indexOf("<StageHearts"));

  it("both routes exist and render the one screen", () => {
    for (const page of ["../../../../app/reels/live/page.tsx", "../../../../app/reels/live/[streamId]/page.tsx"]) {
      expect([page, existsSync(here(page))]).toEqual([page, true]);
      expect(read(page)).toContain("ReelsLiveScreen");
    }
    expect(read("../../../../app/reels/live/[streamId]/page.tsx")).toContain("streamId={id}");
  });

  it("one player in the whole screen, mounted per stream id and connected by the rule", () => {
    expect(screen.match(/<LivePlayer\b/g)).toHaveLength(1);
    expect(screen).toContain("key={active.id}");
    expect(player).toContain("connect={connect}");
    expect(screen).toContain("const connect = shouldConnect({ active: true, pageVisible, player: state.player, refused: Boolean(watchError) });");
    expect(screen).toContain("usePageVisible()");
    // Neighbours are images, never players.
    expect(screen).toContain("neighbours(list, index).map((row) => (row.cover_media_id ? <img");
  });

  it("starts muted from the reels sound preference and keeps portrait video filling the frame", () => {
    expect(screen).toContain("const muted = liveMuted(prefs);");
    expect(player).toContain("muted={muted}");
    expect(player).toContain('fit={state.letterbox ? "contain" : "cover"}');
    expect(player).toContain("controls={false}");
  });

  it("the list is the shared hooks with the tab's filters; no request is written here", () => {
    expect(screen).toContain("useLiveNow(liveTabFilters(tab)");
    expect(screen).toContain("useUpcomingStreams(liveTabFilters(tab), { enabled: empty })");
    expect(screen).not.toContain("/v1/");
    expect(screen).not.toContain("api.get");
  });

  it("the normal reels feed never lists live streams: the stage only reads who is live, for the ring", () => {
    const reels = read("../../components/ReelsScreen.tsx");
    expect(reels).toContain("useLiveCreators(LIVE_CREATORS_LIMIT)");
    expect(reels).toContain("reelLiveHref(active?.authorId, liveMap)");
    expect(reels).not.toContain("useLiveNow");
    expect(reels).not.toContain("LivePlayer");
    expect(read("../../hooks/useReelFeed.ts")).not.toContain("livestream");
  });

  it("colours come from the theme tokens only, and reduced motion is respected", () => {
    const ring = read("../../components/reels-screen.css").split("LIVE ring")[1] ?? "";
    for (const sheet of [css, ring]) {
      expect(sheet).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(sheet).not.toMatch(/rgba?\(\s*\d/);
      expect(sheet).not.toMatch(/\b(white|black|red)\b\s*[;)]/);
    }
    expect(ring).toContain(".reel-rail-avatar.is-live");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".reel-live-enter, .reel-live-chat__row, .reel-live-badge__dot { animation: none; }");
  });
});

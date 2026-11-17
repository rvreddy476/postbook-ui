import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { ReactNode } from "react";

/*
  reels-14 (web half): only one reel player is active at a time, and two
  reels never play sound at once — mounted for real in happy-dom, with the
  stage's own transition (AnimatePresence, mode popLayout, keyed by reel),
  which keeps the leaving reel mounted while it animates out.

  The media elements are the only thing stood in for: happy-dom does not
  decode video, so play()/pause() record state and fire the events a browser
  would, and `paused` reads that state.
*/

const wasRegistered = GlobalRegistrator.isRegistered;
if (!wasRegistered) GlobalRegistrator.register({ url: "http://localhost:3000/reels" });
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// happy-dom's Web Animations cancel with an AbortError framer-motion does not catch; without
// element.animate framer runs the same timings on its own frame loop, as older browsers do.
const animateDescriptor = Object.getOwnPropertyDescriptor(window.Element.prototype, "animate");
delete (window.Element.prototype as { animate?: unknown }).animate;

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { AnimatePresence, motion } = await import("framer-motion");
const { default: api } = await import("@/lib/api");
const { ReelVideo } = await import("@/features/reels/components/ReelVideo");
const { toReelItem } = await import("@/features/reels/model");
const { DEFAULT_PREFS } = await import("@/features/reels/playback/playerPrefs");
type ReelItem = import("@/features/reels/model").ReelItem;

const playing = new WeakSet<HTMLMediaElement>();
const media = () => Array.from(document.querySelectorAll<HTMLMediaElement>("video, audio"));
/** Elements making sound right now: playing, not muted, volume above 0. */
const audible = () => media().filter((el) => playing.has(el) && !el.muted && el.volume > 0);
const playingVideos = () => Array.from(document.querySelectorAll("video")).filter((el) => playing.has(el));

let restore: Array<() => void> = [];
beforeAll(() => {
  const proto = window.HTMLMediaElement.prototype;
  const original = {
    play: Object.getOwnPropertyDescriptor(proto, "play")!,
    pause: Object.getOwnPropertyDescriptor(proto, "pause")!,
    paused: Object.getOwnPropertyDescriptor(proto, "paused")!,
    load: Object.getOwnPropertyDescriptor(proto, "load")!,
  };
  Object.defineProperty(proto, "play", {
    configurable: true,
    value(this: HTMLMediaElement) {
      if (!playing.has(this)) {
        playing.add(this);
        this.dispatchEvent(new window.Event("play"));
      }
      return Promise.resolve();
    },
  });
  Object.defineProperty(proto, "pause", {
    configurable: true,
    value(this: HTMLMediaElement) {
      if (playing.delete(this)) this.dispatchEvent(new window.Event("pause"));
    },
  });
  Object.defineProperty(proto, "paused", { configurable: true, get(this: HTMLMediaElement) { return !playing.has(this); } });
  Object.defineProperty(proto, "load", { configurable: true, value(this: HTMLMediaElement) { playing.delete(this); } });
  restore.push(() => { for (const [k, d] of Object.entries(original)) Object.defineProperty(proto, k, d); });
  // Watch telemetry and sounds talk to the API; nothing leaves the test.
  const post = spyOn(api, "post").mockResolvedValue({ data: { data: {} } } as never);
  const get = spyOn(api, "get").mockResolvedValue({ data: { data: [] } } as never);
  restore.push(() => { post.mockRestore(); get.mockRestore(); });
});

afterAll(async () => {
  for (const undo of restore.reverse()) undo();
  restore = [];
  if (animateDescriptor) Object.defineProperty(window.Element.prototype, "animate", animateDescriptor);
  if (!wasRegistered) await GlobalRegistrator.unregister();
});

function reel(id: string, withSound: boolean): ReelItem {
  const item = toReelItem({ id, author_id: "a", title: id, text: "", content_type: "reel", counts: { comments: 0 }, media: [{ media_id: `m-${id}`, kind: "video" }] })!;
  return {
    ...item,
    // No HLS: the progressive file, so no hls.js and no network.
    media: { ...item.media, hlsUrl: null, fileUrl: `/v1/media/m-${id}/serve`, posterUrl: null },
    sound: withSound ? { id: `s-${id}`, title: "Song", artist: "Band", startMs: 0, durationMs: 30000, useCount: 1, sourcePostId: null } : null,
  };
}

/** The stage as ReelsScreen renders it: one keyed, animated slot holding the active reel's player. */
function Stage({ current }: { current: ReelItem }): ReactNode {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div key={current.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
        <ReelVideo reel={current} active position={0} prefs={{ ...DEFAULT_PREFS, sound: true }} onPrefsChange={() => {}} />
      </motion.div>
    </AnimatePresence>
  );
}

const settle = async (ms = 0) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

describe("one reel player at a time (reels-14)", () => {
  test("swiping keeps a single player active and never two sounds at once, even while the old reel animates out", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const a = reel("a", true);
    const b = reel("b", true);
    const c = reel("c", false);

    try {
    await act(async () => root.render(<Stage current={a} />));
    await settle();
    expect(playingVideos()).toHaveLength(1);
    expect(audible().length).toBeGreaterThan(0);
    const aVideo = playingVideos()[0];

    // Swipe to b: a stays mounted for its exit animation.
    await act(async () => root.render(<Stage current={b} />));
    await settle();
    expect(document.querySelectorAll("video").length).toBe(2);
    expect(playing.has(aVideo)).toBe(false);
    expect(playingVideos()).toHaveLength(1);
    expect(playingVideos()[0]).not.toBe(aVideo);
    // a's added sound stopped with its video; only b's two elements (its video and its sound) may be heard.
    const aAudio = aVideo.parentElement?.querySelector("audio");
    expect(aAudio && playing.has(aAudio)).toBe(false);
    for (const el of audible()) expect(aVideo.parentElement?.contains(el)).toBe(false);

    // Swipe again before b's entry settles, then let the exits finish.
    await act(async () => root.render(<Stage current={c} />));
    await settle();
    expect(playingVideos()).toHaveLength(1);
    // However long the exits take to finish (the frame loop's pace differs between runs), still one.
    await settle(600);
    expect(playingVideos()).toHaveLength(1);
    // c has no added sound: whatever is heard is its own video.
    expect(audible().every((el) => el.tagName === "VIDEO")).toBe(true);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
    expect(playingVideos()).toHaveLength(0);
  });

  test("an inactive (warm) player never plays", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const prefs = { ...DEFAULT_PREFS, sound: true };
    await act(async () => root.render(<>
      <ReelVideo reel={reel("x", true)} active position={0} prefs={prefs} onPrefsChange={() => {}} />
      <ReelVideo reel={reel("y", true)} active={false} position={1} prefs={prefs} onPrefsChange={() => {}} />
    </>));
    await settle();
    expect(playingVideos()).toHaveLength(1);
    const [x, y] = Array.from(document.querySelectorAll("video"));
    expect(playing.has(x)).toBe(true);
    expect(playing.has(y)).toBe(false);
    await act(async () => root.render(<>
      <ReelVideo reel={reel("x", true)} active={false} position={0} prefs={prefs} onPrefsChange={() => {}} />
      <ReelVideo reel={reel("y", true)} active position={1} prefs={prefs} onPrefsChange={() => {}} />
    </>));
    await settle();
    expect(playing.has(x)).toBe(false);
    expect(playing.has(y)).toBe(true);
    await act(async () => root.unmount());
    host.remove();
  });
});

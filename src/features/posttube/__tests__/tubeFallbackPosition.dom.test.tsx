import { afterAll, describe, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

/*
  lv-27 follow-up: after a fatal hls.js error that is not about access (a
  network failure), TubePlayer falls back to the MP4 and continues at the
  same position — mounted for real in happy-dom. hls.js is replaced by a
  stand-in that lets the test raise its ERROR event; happy-dom does not
  decode media, so the element's clock is set by the test, and play()
  records that playback resumed.
*/

const wasRegistered = GlobalRegistrator.isRegistered;
if (!wasRegistered) GlobalRegistrator.register({ url: "http://localhost:3000/posttube/watch/v1" });
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Handler = (event: string, data: Record<string, unknown>) => void;
const instances: FakeHls[] = [];
class FakeHls {
  static Events = { MANIFEST_PARSED: "hlsManifestParsed", ERROR: "hlsError" };
  static DefaultConfig = { loader: class {} };
  static isSupported() { return true; }
  handlers = new Map<string, Handler[]>();
  levels: { height: number }[] = [{ height: 720 }];
  nextLevel = -1;
  destroyed = false;
  media: HTMLMediaElement | null = null;
  constructor(public config: unknown) { instances.push(this); }
  on(event: string, fn: Handler) { this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn]); }
  emit(event: string, data: Record<string, unknown>) { for (const fn of this.handlers.get(event) ?? []) fn(event, data); }
  loadSource() {}
  attachMedia(media: HTMLMediaElement) { this.media = media; }
  recoverMediaError() {}
  destroy() { this.destroyed = true; }
}
mock.module("hls.js", () => ({ default: FakeHls }));

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { ToastProvider } = await import("@/contexts/ToastContext");
const { TubePlayer } = await import("@/features/posttube/components/TubePlayer");
const { DEFAULT_TUBE_PREFS } = await import("@/features/posttube/model");

/* The media element's clock and play state, as a browser would keep them. */
const clock = new WeakMap<HTMLMediaElement, number>();
const playing = new WeakSet<HTMLMediaElement>();
const proto = window.HTMLMediaElement.prototype;
const saved = ["play", "pause", "paused", "currentTime", "load"].map((k) => [k, Object.getOwnPropertyDescriptor(proto, k)] as const);
Object.defineProperty(proto, "play", { configurable: true, value(this: HTMLMediaElement) { playing.add(this); return Promise.resolve(); } });
Object.defineProperty(proto, "pause", { configurable: true, value(this: HTMLMediaElement) { playing.delete(this); } });
Object.defineProperty(proto, "paused", { configurable: true, get(this: HTMLMediaElement) { return !playing.has(this); } });
Object.defineProperty(proto, "currentTime", {
  configurable: true,
  get(this: HTMLMediaElement) { return clock.get(this) ?? 0; },
  set(this: HTMLMediaElement, v: number) { clock.set(this, v); },
});
Object.defineProperty(proto, "load", { configurable: true, value(this: HTMLMediaElement) { clock.set(this, 0); playing.delete(this); } });

afterAll(async () => {
  for (const [k, d] of saved) if (d) Object.defineProperty(proto, k, d);
  if (!wasRegistered) await GlobalRegistrator.unregister();
});

const settle = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

async function mountPlayer() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(
    <ToastProvider>
      <TubePlayer
        videoId="v1"
        hlsUrl="/v1/media/m1/hls/master.m3u8"
        fileUrl="/v1/media/m1/serve"
        captions={[]}
        startPositionMs={0}
        startReady
        autoPlay
        prefs={DEFAULT_TUBE_PREFS}
        onPrefsChange={() => {}}
        ended={false}
        onEndedChange={() => {}}
      />
    </ToastProvider>,
  ));
  await settle();
  const video = host.querySelector("video")!;
  return { host, root, video };
}

describe("the MP4 fallback keeps the viewer's place (lv-27)", () => {
  test("a fatal network error mid-video switches to the MP4 and resumes at the same position, playing", async () => {
    instances.length = 0;
    const { host, root, video } = await mountPlayer();
    const hls = instances.at(-1)!;
    expect(hls.media).toBe(video);

    // HLS starts: metadata, then the viewer is 754.2 s in and playing.
    await act(async () => { video.dispatchEvent(new window.Event("loadedmetadata")); });
    video.currentTime = 754.2;
    await video.play();

    // A fatal network error that is not about access: the file takes over.
    await act(async () => hls.emit(FakeHls.Events.ERROR, { fatal: true, type: "networkError", details: "fragLoadError", response: { code: 0 } }));
    expect(hls.destroyed).toBe(true);
    expect(video.getAttribute("src") ?? video.src).toContain("/v1/media/m1/serve");

    // The new source loads from 0; on its metadata the player puts the clock back and plays.
    video.currentTime = 0;
    playing.delete(video);
    await act(async () => { video.dispatchEvent(new window.Event("loadedmetadata")); });
    expect(video.currentTime).toBeCloseTo(754.2, 3);
    expect(video.paused).toBe(false);

    await act(async () => root.unmount());
    host.remove();
  });

  test("a paused viewer stays paused at the same position", async () => {
    instances.length = 0;
    const { host, root, video } = await mountPlayer();
    const hls = instances.at(-1)!;
    await act(async () => { video.dispatchEvent(new window.Event("loadedmetadata")); });
    video.currentTime = 61.5;
    video.pause();
    await act(async () => hls.emit(FakeHls.Events.ERROR, { fatal: true, type: "networkError", details: "manifestLoadError", response: { code: 404 } }));
    video.currentTime = 0;
    await act(async () => { video.dispatchEvent(new window.Event("loadedmetadata")); });
    expect(video.currentTime).toBeCloseTo(61.5, 3);
    expect(video.paused).toBe(true);
    await act(async () => root.unmount());
    host.remove();
  });

  test("an access refusal (403) is not a fallback: the MP4 is never loaded", async () => {
    instances.length = 0;
    const { host, root, video } = await mountPlayer();
    const hls = instances.at(-1)!;
    const before = video.getAttribute("src");
    await act(async () => hls.emit(FakeHls.Events.ERROR, { fatal: true, type: "networkError", details: "fragLoadError", response: { code: 403 } }));
    expect(video.getAttribute("src")).toBe(before);
    expect(String(video.getAttribute("src") ?? "")).not.toContain("/serve");
    await act(async () => root.unmount());
    host.remove();
  });
});

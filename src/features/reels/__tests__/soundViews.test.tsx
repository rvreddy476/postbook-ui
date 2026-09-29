import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ReelAuthorCard } from "../components/ReelAuthorCard";
import { ReelOverlay } from "../components/ReelOverlay";
import { ReelRail } from "../components/ReelRail";
import { ReelSoundLabel } from "../components/ReelSoundLabel";
import { SoundPageHeader } from "../components/SoundPageHeader";
import { SoundPreviewButton, soundPreviewLabel } from "../components/SoundPreview";
import { toReelItem, toReelSound, type FeedReelPost } from "../model";

const noop = () => {};
const post = (over: Partial<FeedReelPost> = {}): FeedReelPost => ({
  id: "r1",
  author_id: "b",
  content_type: "reel",
  hashtags: ["dance"],
  author: { id: "b", username: "bee", display_name: "Bee" },
  media: [{ media_id: "m", kind: "video" }],
  ...over,
});
const wireSound = { id: "s-1", title: "Original sound - Asha", artist: "Asha", duration_ms: 28400, start_ms: 0, use_count: 3, source_post_id: "p-0", creator_user_id: "u-0" };
const plain = toReelItem(post())!;
const withSound = toReelItem(post({ audio_track_id: "s-1", sound: wireSound }))!;
const locked = toReelItem(post({ remix_setting: "disallow" }))!;

describe("ReelSoundLabel", () => {
  test("a reel with an added sound: a link to the sound's page, note icon and title", () => {
    const html = renderToStaticMarkup(<ReelSoundLabel reel={withSound} isOwn={false} onUseOriginal={noop} />);
    expect(html).toContain('<a class="reel-sound-line is-stage pointer-events-auto" data-sound="added"');
    expect(html).toContain('href="/reels/sound/s-1"');
    expect(html).toContain('<span class="reel-sound-line__text">Original sound - Asha</span>');
    expect(html).toContain("<svg");
    expect(html).not.toContain("<button");
  });

  test("the link needs no handler: it is a link even when nothing can be run", () => {
    const html = renderToStaticMarkup(<ReelSoundLabel reel={withSound} isOwn={false} />);
    expect(html).toContain('href="/reels/sound/s-1"');
  });

  test("no added sound, reuse allowed: a button reading Original sound - <author>", () => {
    const html = renderToStaticMarkup(<ReelSoundLabel reel={plain} isOwn={false} onUseOriginal={noop} />);
    expect(html).toContain('<button type="button" class="reel-sound-line is-stage pointer-events-auto" data-sound="original"');
    expect(html).toContain('<span class="reel-sound-line__text">Original sound - Bee</span>');
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("disabled");
  });

  test("while the request runs the button waits", () => {
    const html = renderToStaticMarkup(<ReelSoundLabel reel={plain} isOwn={false} onUseOriginal={noop} pending />);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
  });

  test("reuse turned off: no line for others, the button for the author", () => {
    expect(renderToStaticMarkup(<ReelSoundLabel reel={locked} isOwn={false} onUseOriginal={noop} />)).toBe("");
    expect(renderToStaticMarkup(<ReelSoundLabel reel={locked} isOwn onUseOriginal={noop} />)).toContain('data-sound="original"');
  });

  test("nothing to run, or a reel still processing: no line", () => {
    expect(renderToStaticMarkup(<ReelSoundLabel reel={plain} isOwn={false} />)).toBe("");
    expect(renderToStaticMarkup(<ReelSoundLabel reel={{ ...plain, isProcessing: true }} isOwn={false} onUseOriginal={noop} />)).toBe("");
  });

  test("on the author card it takes the card's tone", () => {
    expect(renderToStaticMarkup(<ReelSoundLabel reel={withSound} isOwn={false} tone="card" />)).toContain('class="reel-sound-line is-card pointer-events-auto"');
  });
});

describe("where the sound line is drawn", () => {
  test("the overlay: under the hashtags, inside the text block", () => {
    const html = renderToStaticMarkup(<ReelOverlay reel={withSound} sound volume={1} onVolumeChange={noop} onToggleSound={noop} />);
    const tags = html.indexOf('class="reel-hashtags');
    const line = html.indexOf('class="reel-sound-line');
    expect(tags).toBeGreaterThan(-1);
    expect(line).toBeGreaterThan(tags);
    const block = html.slice(html.indexOf('class="reel-overlay-text"'));
    expect(block).toContain("reel-sound-line");
  });

  test("the overlay without a handler draws no button (older callers are unchanged)", () => {
    const html = renderToStaticMarkup(<ReelOverlay reel={plain} sound volume={1} onVolumeChange={noop} onToggleSound={noop} />);
    expect(html).not.toContain("reel-sound-line");
    const wired = renderToStaticMarkup(<ReelOverlay reel={plain} sound volume={1} onVolumeChange={noop} onToggleSound={noop} onUseOriginalSound={noop} />);
    expect(wired).toContain('data-sound="original"');
  });

  test("the author card (theater panel and comments column): after the hashtags, before the counts", () => {
    const base = { isOwn: false, following: false as const, followPending: false, onToggleFollow: noop, onLike: noop, onSave: noop, onShare: noop };
    const html = renderToStaticMarkup(<ReelAuthorCard {...base} reel={withSound} />);
    const tags = html.indexOf("reel-author-card__tags");
    const line = html.indexOf("reel-sound-line is-card");
    const counts = html.indexOf("reel-author-card__counts");
    expect(tags).toBeGreaterThan(-1);
    expect(line).toBeGreaterThan(tags);
    expect(counts).toBeGreaterThan(line);
    expect(renderToStaticMarkup(<ReelAuthorCard {...base} reel={plain} onUseOriginalSound={noop} />)).toContain("Original sound - Bee");
    expect(readFileSync(resolve(import.meta.dir, "../components/ReelTheaterPanel.tsx"), "utf8")).toContain("<ReelAuthorCard {...card} />");
  });

  test("the screen hands the handlers to the overlay, the author card and the menu", () => {
    const screen = readFileSync(resolve(import.meta.dir, "../components/ReelsScreen.tsx"), "utf8");
    expect(screen).toContain('onUseOriginalSound={() => startUseSound("page")}');
    expect(screen).toContain('onUseOriginalSound: () => startUseSound("page")');
    expect(screen).toContain('onUseSound={() => startUseSound("create")}');
    expect(screen).toContain("nextSoundStep({ reel: target, signedIn: Boolean(viewerId), intent })");
  });

  test("the rail disc opens the sound's page when the reel plays one, the profile when not", () => {
    const base = { isOwn: false, following: false as const, followPending: false, onToggleFollow: noop, onLike: noop, onComments: noop, onShare: noop, onSave: noop };
    const sounding = renderToStaticMarkup(<ReelRail {...base} reel={withSound} playing />);
    expect(sounding).toContain('class="reel-rail-disc" aria-label="Sound: Original sound - Asha" data-sound="" data-playing="" href="/reels/sound/s-1"');
    const silent = renderToStaticMarkup(<ReelRail {...base} reel={plain} />);
    expect(silent).toContain('class="reel-rail-disc" aria-label="More from Bee" href="/u/bee"');
    expect(renderToStaticMarkup(<ReelRail {...base} reel={withSound} variant="phone" />)).not.toContain("reel-rail-disc");
  });
});

describe("SoundPreviewButton", () => {
  test("idle reads Preview, playing reads Pause and is pressed, failed is disabled and says so", () => {
    const idle = renderToStaticMarkup(<SoundPreviewButton state="idle" onToggle={noop} className="x" />);
    expect(idle).toContain('<button type="button" class="x" data-preview="idle" aria-pressed="false">');
    expect(idle).toContain("Preview</button>");
    const playing = renderToStaticMarkup(<SoundPreviewButton state="playing" onToggle={noop} />);
    expect(playing).toContain('data-preview="playing" aria-pressed="true"');
    expect(playing).toContain("Pause</button>");
    const failed = renderToStaticMarkup(<SoundPreviewButton state="failed" onToggle={noop} />);
    expect(failed).toContain('disabled=""');
    expect(failed).toContain("Preview unavailable</button>");
    expect(soundPreviewLabel("idle")).toBe("Preview");
  });

  test("the preview plays the sound alone: its own audio element, nothing fetched before the first press", () => {
    const src = readFileSync(resolve(import.meta.dir, "../components/SoundPreview.tsx"), "utf8");
    expect(src).toContain("src={soundServeHref(soundId)}");
    expect(src).toContain('preload="none"');
    expect(src).not.toContain("crossOrigin");
    expect(src).not.toContain("console.");
  });
});

describe("SoundPageHeader", () => {
  const sound = toReelSound(wireSound)!;
  const base = { preview: "idle" as const, onTogglePreview: noop, useHref: "/reels/create?sound=s-1" };

  test("ready: title, creator, number of reels, the preview button and Use this sound", () => {
    const html = renderToStaticMarkup(<SoundPageHeader {...base} sound={sound} loading={false} reelCount={3} creatorHref="/u/asha" />);
    expect(html).toContain('<header class="sound-page__head" data-state="ready">');
    expect(html).toContain('<h1 id="sound-page-title" class="sound-page__title">Original sound - Asha</h1>');
    expect(html).toContain('<p class="sound-page__creator"><a href="/u/asha">Asha</a></p>');
    expect(html).toContain('<p class="sound-page__count">3 reels</p>');
    expect(html).toContain('class="sound-page__preview" data-preview="idle"');
    expect(html).toContain('data-action="use-sound" href="/reels/create?sound=s-1"');
    expect(html).toContain("Use this sound</a>");
  });

  test("the creator is plain text when the source reel cannot be read; one reel is singular", () => {
    const html = renderToStaticMarkup(<SoundPageHeader {...base} sound={sound} loading={false} reelCount={1} creatorHref={null} />);
    expect(html).toContain('<p class="sound-page__creator">Asha</p>');
    expect(html).toContain('<p class="sound-page__count">1 reel</p>');
  });

  test("a sound with no artist shows no creator line", () => {
    const html = renderToStaticMarkup(<SoundPageHeader {...base} sound={{ ...sound, artist: "" }} loading={false} reelCount={0} />);
    expect(html).not.toContain("sound-page__creator");
    expect(html).toContain("No reels yet");
  });

  test("while previewing the button reads Pause; a preview that failed is disabled", () => {
    expect(renderToStaticMarkup(<SoundPageHeader {...base} preview="playing" sound={sound} loading={false} reelCount={3} />)).toContain("Pause</button>");
    expect(renderToStaticMarkup(<SoundPageHeader {...base} preview="failed" sound={sound} loading={false} reelCount={3} />)).toContain("Preview unavailable</button>");
  });

  test("signed out: Use this sound goes through sign-in", () => {
    const html = renderToStaticMarkup(<SoundPageHeader {...base} useHref="/login?next=%2Freels%2Fcreate%3Fsound%3Ds-1&redirect=%2Freels%2Fcreate%3Fsound%3Ds-1" sound={sound} loading={false} reelCount={3} />);
    expect(html).toContain('href="/login?next=%2Freels%2Fcreate%3Fsound%3Ds-1&amp;redirect=%2Freels%2Fcreate%3Fsound%3Ds-1"');
  });

  test("loading: the page's name holds the place, no actions yet", () => {
    const html = renderToStaticMarkup(<SoundPageHeader {...base} sound={null} loading reelCount={0} />);
    expect(html).toContain('data-state="loading"');
    expect(html).toContain(">Sound</h1>");
    expect(html).not.toContain("sound-page__actions");
    expect(html).not.toContain("Use this sound");
  });

  test("missing, or not this viewer's to hear: the name alone, nothing to play or use", () => {
    const html = renderToStaticMarkup(<SoundPageHeader {...base} sound={null} loading={false} reelCount={0} />);
    expect(html).toContain('data-state="missing"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Use this sound");
  });
});

describe("the sound page", () => {
  const screen = readFileSync(resolve(import.meta.dir, "../components/SoundReelsScreen.tsx"), "utf8");

  test("the liked page's frame and grid; tiles open the stage on the reel; the origin is marked Original", () => {
    expect(screen).toContain('<VideoShell app="reels" chrome="sidebar" immersive>');
    expect(screen).toContain('className="liked-reels__grid"');
    expect(screen).toContain("href={reelStageHref(reel.id)}");
    expect(screen).toContain('{isOrigin ? <span className="sound-page__badge">Original</span> : null}');
  });

  test("loading, error, missing and empty states are all drawn", () => {
    for (const words of ['aria-busy="true"', "Couldn't load this sound", "This sound isn't available", "No reels use this sound yet"]) expect(screen).toContain(words);
  });

  test("infinite: more pages as the end comes into view, and a button that does the same", () => {
    expect(screen).toContain("new IntersectionObserver(");
    expect(screen).toContain("void fetchNextPage()");
    expect(screen).toContain("Show more");
  });

  test("the route hands the id to the screen", () => {
    const page = readFileSync(resolve(import.meta.dir, "../../../app/reels/sound/[id]/page.tsx"), "utf8");
    expect(page).toContain("const { id } = await params;");
    expect(page).toContain("<SoundReelsScreen soundId={id} />");
  });
});

describe("the CSS: small type, tokens only", () => {
  const css = readFileSync(resolve(import.meta.dir, "../components/reels-screen.css"), "utf8");
  const block = css.slice(css.indexOf("/* ── the sound line"));

  test("the sound line is 12px/600 and takes its colour from the stage or the card", () => {
    expect(block).toContain(".reel-sound-line { display: flex; width: fit-content; max-width: 100%; min-width: 0; align-items: center; gap: 6px; margin: 6px 0 0;");
    expect(block).toContain("font-size: 12px; line-height: 16px; font-weight: 600;");
    expect(block).toContain(".reel-sound-line.is-stage { color: rgb(var(--reel-on-stage) / .9); }");
    expect(block).toContain(".reel-sound-line.is-card { margin-top: 8px; color: rgb(var(--brand-text) / .7); }");
  });

  test("the sound page's meta is 12-13px", () => {
    expect(block).toContain(".sound-page__creator { margin: 2px 0 0; font-size: 13px;");
    expect(block).toContain(".sound-page__count { margin: 2px 0 0; font-size: 12px;");
    expect(block).toContain(".sound-page__badge { position: absolute; top: 8px; left: 8px; padding: 2px 8px; border-radius: 999px; font-size: 11px;");
  });

  test("no hex value and no literal colour anywhere in the new rules", () => {
    expect(block.length).toBeGreaterThan(500);
    expect(block.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
    expect(block.match(/rgba?\((?!var\()[^)]*\)/g)).toBeNull();
    expect(block.match(/(?:color|background)[a-z-]*:\s*(?:white|black)\b/g)).toBeNull();
  });

  test("the new components carry no colour of their own", () => {
    for (const file of ["ReelSoundLabel.tsx", "SoundPageHeader.tsx", "SoundPreview.tsx", "SoundReelsScreen.tsx"]) {
      const src = readFileSync(resolve(import.meta.dir, "../components", file), "utf8");
      expect(src.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
      expect(src).not.toContain("rgb(");
    }
  });
});

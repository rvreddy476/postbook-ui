import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PostDetail } from "@/types/profile";
import { PostRail, type PostRailProps } from "../components/PostRail";
import { StageCaption } from "../components/StageCaption";
import { CarouselDots, StageCarousel } from "../components/StageCarousel";
import { WordsOnColour } from "../components/WordsOnColour";
import { toStagePost } from "../model";

const row = JSON.parse(readFileSync(resolve(import.meta.dir, "contracts", "feed_row_photo_carousel.json"), "utf8")) as PostDetail;
const noop = () => {};
const rail: PostRailProps = {
  authorName: "Raghu", profileHref: "/u/raghu", avatarSrc: "", authorSeed: "a",
  counts: { likes: 0, comments: 14, shares: undefined, saves: 21 },
  liked: false, saved: true,
  onLike: noop, onComments: noop, onSave: noop, onShare: noop,
};

test("rail: every control announces its count, 0 is \"0\", a missing count shows the name", () => {
  const html = renderToStaticMarkup(<PostRail {...rail} />);
  expect(html).toContain('aria-label="Like, 0"');
  expect(html).toContain('aria-label="Comments, 14"');
  expect(html).toContain('aria-label="Save, 21"');
  expect(html).toContain('aria-label="Share"');
  expect(html).toMatch(/data-rail="like"[^>]*>.*?<span class="ps-rail__count" aria-hidden="true">0<\/span>/);
  expect(html).toMatch(/data-rail="share"[^>]*>.*?<span class="ps-rail__count" aria-hidden="true">Share<\/span>/);
  // Saved reads as pressed.
  expect(html).toMatch(/aria-label="Save, 21" aria-pressed="true"/);
  // Order: like, comments, save, share.
  const order = ["like", "comments", "save", "share"].map((n) => html.indexOf(`data-rail="${n}"`));
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

test("rail: Follow is a pink plus AND the word \"Follow\" (never Subscribe), only when the viewer can follow; never a disc", () => {
  const can = renderToStaticMarkup(<PostRail {...rail} canFollow onFollow={noop} />);
  // The button's name is its word: no aria-label overriding it.
  expect(can).toMatch(/<button type="button" class="ps-rail__follow">/);
  expect(can).toContain('<span class="ps-rail__follow-badge" aria-hidden="true">');
  expect(can).toContain('<span class="ps-rail__follow-label">Follow</span>');
  expect(can).not.toContain("Subscribe");
  const cannot = renderToStaticMarkup(<PostRail {...rail} />);
  expect(cannot).not.toContain("ps-rail__follow");
  expect(can).not.toMatch(/disc|spin/);
});

test("rail: author settings remove their controls", () => {
  const html = renderToStaticMarkup(<PostRail {...rail} likesOff commentsOff shareHidden />);
  expect(html).not.toContain('data-rail="like"');
  expect(html).not.toContain('data-rail="comments"');
  expect(html).not.toContain('data-rail="share"');
  expect(html).toContain('data-rail="save"');
});

test("caption: @handle · date, the labels in order, the title, inline and trailing hashtags", () => {
  const post = toStagePost(row);
  const html = renderToStaticMarkup(
    <StageCaption post={post} authorName="Raghu" handle="raghu" profileHref="/u/raghu" now={Date.parse("2026-10-18T15:00:00Z")} />,
  );
  expect(html).toContain(">@raghu</a>");
  expect(html).toContain(" · 3h");
  expect(html.indexOf(">Brand<")).toBeLessThan(html.indexOf(">AI-generated<"));
  expect(html).toContain('<h2 class="ps-caption__title">Sunday market</h2>');
  expect(html).toContain('href="/hashtag/food"');
  expect(html).toContain('href="/hashtag/market"');
  expect(html).toContain('href="/u/call.b"');
});

test("caption: a long caption is clamped with \"more\"", () => {
  const post = { ...toStagePost(row), caption: "word ".repeat(60).trim() };
  const html = renderToStaticMarkup(<StageCaption post={post} authorName="R" handle="r" profileHref="/u/r" />);
  expect(html).toContain('class="ps-caption__text"');
  expect(html).toContain(">more</button>");
});

test("carousel: the 1080 rendition, n/N, dots, and arrows only where there is somewhere to go", () => {
  const post = toStagePost(row);
  const html = renderToStaticMarkup(<StageCarousel media={post.media} index={0} onIndex={noop} active dataSaver={false} />);
  expect(html).toContain('src="/v1/media/c3333333-3333-4333-8333-333333333333/serve/medium_1080"');
  expect(html).toContain('alt="Stalls under string lights"');
  expect(html).toContain(">1/3</span>");
  expect(html).toContain('aria-label="Next photo"');
  expect(html).not.toContain('aria-label="Previous photo"');
  const dots = renderToStaticMarkup(<CarouselDots count={3} index={1} />);
  expect(dots).toContain('aria-label="Photo 2 of 3"');
  expect((dots.match(/is-current/g) ?? []).length).toBe(1);
  expect(renderToStaticMarkup(<CarouselDots count={1} index={0} />)).toBe("");
});

test("words on a colour: no literal fallback colour — the stage tokens", () => {
  const card = renderToStaticMarkup(<WordsOnColour text="hi #there" rich={{ scale: 1.2 }} />);
  expect(card).toContain("rgb(var(--reel-stage))");
  expect(card).toContain("rgb(var(--reel-on-stage))");
  expect(card).toContain('href="/hashtag/there"');
  const stage = renderToStaticMarkup(<WordsOnColour text="hello" rich={{ background: "var(--x)", text_color: "var(--y)" }} variant="stage" />);
  expect(stage).toContain('class="ps-words"');
  expect(stage).toContain("background:var(--x)");
});

import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CollectionView, type CollectionViewProps } from "../components/CollectionView";
import { CollectionScreen } from "../components/CollectionScreen";
import { CollectionsIndex, wantsNewCollection } from "../components/CollectionsIndex";
import { LIBRARY_KEYS } from "../hooks/useCollection";
import { normalizeItems, normalizePlaylist, type Collection, type CollectionItem } from "../libraryApi";

const router: AppRouterInstance = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} };

function wrap(node: React.ReactNode, qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </AppRouterContext.Provider>,
  );
}

const noop = async () => null;
const base: CollectionViewProps = {
  status: "ready",
  collection: null,
  items: [],
  itemsLoading: false,
  itemsError: false,
  isOwner: true,
  error: null,
  pending: { move: false, remove: null, patch: false, destroy: false },
  onRetry: () => undefined,
  onMove: () => undefined,
  onMoveBy: () => undefined,
  onRemove: () => undefined,
  onPatch: noop,
  onDelete: async () => true,
};

const userCollection: Collection = normalizePlaylist({ id: "pl-1", creator_id: "me", title: "Late night builds", description: "Long ones.", visibility: "unlisted", item_count: 2 });
const queue: Collection = normalizePlaylist({ id: "sys-q", creator_id: "me", kind: "watch_later", title: "Watch later", visibility: "private", item_count: 1 });
const items: CollectionItem[] = normalizeItems(
  [
    { playlist_id: "pl-1", post_id: "v1", position: 0, post: { id: "v1", author_id: "a", title: "First video", content_type: "video", created_at: "2026-09-01T00:00:00Z", view_count: 1200, media: [{ media_id: "m1", kind: "video", duration_ms: 125_000 }], author: { display_name: "Ravi" } } },
    { playlist_id: "pl-1", post_id: "v2", position: 1, post: { id: "v2", author_id: "a", title: "Second video", content_type: "video", media: [{ media_id: "m2", kind: "video" }] } },
  ],
  "pl-1",
);

describe("CollectionView states", () => {
  test("empty user collection: title, count, visibility pill, edit + delete, no Play all, our empty copy", () => {
    const html = renderToStaticMarkup(<CollectionView {...base} collection={userCollection} items={[]} backHref="/posttube/playlists" backLabel="Collections" />);
    expect(html).toContain('id="tube-collection-title" class="tube-library__title">Late night builds<');
    expect(html).toContain("0 videos");
    expect(html).toContain("Unlisted");
    expect(html).toContain('aria-label="Edit collection"');
    expect(html).toContain('aria-label="Delete collection"');
    expect(html).not.toContain("Play all");
    expect(html).toContain("This collection is empty");
    expect(html).toContain('href="/posttube/playlists"');
    expect(html).not.toContain("Playlist"); // vocabulary: Collections, never Playlists
  });

  test("system Watch later with a row: no edit/delete/visibility pill, Yours pill, Play all carries ?list=, rows reorder + remove", () => {
    const html = renderToStaticMarkup(<CollectionView {...base} systemKind="watch_later" collection={queue} items={items} />);
    expect(html).toContain(">Watch later<");
    expect(html).toContain("Yours");
    expect(html).not.toContain('aria-label="Edit collection"');
    expect(html).not.toContain('aria-label="Delete collection"');
    expect(html).not.toContain("Private");
    expect(html).toContain('href="/posttube/watch/v1?list=sys-q"');
    expect(html).toContain("Play all");
    expect(html).toContain('draggable="true"');
    expect(html).toContain('aria-label="Move up: First video"');
    expect(html).toContain('aria-label="Move down: Second video"');
    expect(html).toContain('aria-label="Remove: First video"');
    // first row cannot move up, last cannot move down
    expect(html).toMatch(/aria-label="Move up: First video" disabled/);
    expect(html).toMatch(/aria-label="Move down: Second video" disabled/);
    expect(html).toContain("2:05"); // duration pill
    expect(html).toContain("1.2K views");
  });

  test("Liked videos and the signed-out card use the RUTUBE words", () => {
    const html = renderToStaticMarkup(<CollectionView {...base} status="signed-out" systemKind="liked" />);
    expect(html).toContain("Sign in to see your Liked videos");
    expect(html).toContain('href="/login?next=%2Fposttube%2Floved"');
    expect(html).not.toContain("Loved");
  });

  test("a viewer who does not own a public collection sees a static list: no handles, no move buttons", () => {
    const html = renderToStaticMarkup(<CollectionView {...base} isOwner={false} collection={{ ...userCollection, visibility: "public" }} items={items} />);
    expect(html).toContain("is-static");
    expect(html).not.toContain("draggable");
    expect(html).not.toContain("Move up");
    expect(html).not.toContain('aria-label="Edit collection"');
    expect(html).toContain("Play all");
  });

  test("loading, missing and error states", () => {
    expect(renderToStaticMarkup(<CollectionView {...base} status="loading" />)).toContain('aria-busy="true"');
    expect(renderToStaticMarkup(<CollectionView {...base} status="missing" backHref="/posttube/playlists" />)).toContain("This collection is not here");
    const err = renderToStaticMarkup(<CollectionView {...base} status="error" />);
    expect(err).toContain('role="alert"');
    expect(err).toContain("Retry");
    expect(renderToStaticMarkup(<CollectionView {...base} collection={userCollection} error="The order could not be saved." />)).toContain("The order could not be saved.");
  });
});

describe("CollectionScreen", () => {
  test("the server render is a neutral skeleton for a system list (no sign-in flash) and reads its title from the source", () => {
    const html = wrap(<CollectionScreen source={{ kind: "system", system: "watch_later" }} />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(">Watch later<");
    expect(html).not.toContain("Sign in");
    expect(html).not.toContain('href="/posttube/playlists"'); // system lists have no Back
  });

  test("a user collection already in the cache renders its header and rows through the hook", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(LIBRARY_KEYS.collection("pl-1"), userCollection);
    qc.setQueryData(LIBRARY_KEYS.items("pl-1"), items);
    const html = wrap(<CollectionScreen source={{ kind: "user", id: "pl-1" }} />, qc);
    // Not mounted on the server → skeleton, but the Back link and the title are already ours.
    expect(html).toContain("← Collections");
    expect(html).toContain('href="/posttube/playlists"');
    expect(html).toContain("Late night builds");
  });
});

describe("Collections index: ?new=1 opens the create sheet on arrival", () => {
  test("wantsNewCollection reads new=1 from a string or URLSearchParams and nothing else", () => {
    expect(wantsNewCollection("?new=1")).toBe(true);
    expect(wantsNewCollection("new=1")).toBe(true);
    expect(wantsNewCollection(new URLSearchParams("sort=recent&new=1"))).toBe(true);
    expect(wantsNewCollection("?new=0")).toBe(false);
    expect(wantsNewCollection("?new=")).toBe(false);
    expect(wantsNewCollection("?open=1")).toBe(false);
    expect(wantsNewCollection("")).toBe(false);
    expect(wantsNewCollection(null)).toBe(false);
    expect(wantsNewCollection(undefined)).toBe(false);
  });

  test("openNew renders the New collection sheet in the first paint; without it only the heading", () => {
    const opened = wrap(<CollectionsIndex openNew />);
    expect(opened).toContain('id="tube-collections-title" class="tube-library__title">Collections<');
    expect(opened).toContain('class="tube-library__sheet" aria-label="New collection"');
    expect(opened).toContain(">Create<");
    const plain = wrap(<CollectionsIndex />);
    expect(plain).toContain(">Collections<");
    expect(plain).not.toContain('aria-label="New collection"');
  });
});

describe("the library speaks the RUTUBE words and never bypasses the tokens", () => {
  test("CSS uses tokens only and the 160×90 row thumb", () => {
    const css = readFileSync(resolve(import.meta.dir, "../components/library.css"), "utf8");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).toContain(".tube-library__thumb { position: relative; display: block; width: 160px; height: 90px;");
    expect(css).toContain(".tube-library__row-title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 13px;");
    expect(css).toContain(".tube-library__row-meta { margin: 0; font-size: 11px;");
  });
  test("none of the retired labels in the screens", () => {
    for (const f of ["CollectionView.tsx", "CollectionsIndex.tsx", "RecentScreen.tsx", "CollectionRow.tsx"]) {
      const src = readFileSync(resolve(import.meta.dir, "../components", f), "utf8");
      // user-visible strings only (icons and hooks may carry the API's own names)
      expect(src).not.toMatch(/[>"'“](Queue|Loved|Playlists)[<"'.”]/);
    }
  });
});

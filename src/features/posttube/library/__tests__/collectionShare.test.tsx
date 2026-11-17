import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { CollectionView, type CollectionViewProps } from "../components/CollectionView";
import { canShareCollection, collectionShareUrl, normalizePlaylist, shareCollectionLink } from "../libraryApi";

/* lv-31: a playlist can be shared, and its link opens signed out. */

const router: AppRouterInstance = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} };
const ID = "6b1f1a0e-6c4a-4f1e-9f5d-3a2f9c8e7d61";

function view(visibility: string, isOwner: boolean, kind = "user") {
  const props: CollectionViewProps = {
    status: "ready",
    collection: normalizePlaylist({ id: ID, creator_id: "u1", kind, title: "Road trip", visibility, item_count: 0 }),
    items: [],
    itemsLoading: false,
    itemsError: false,
    isOwner,
    error: null,
    pending: { move: false, remove: null, patch: false, destroy: false },
    onRetry: () => undefined,
    onMove: () => undefined,
    onMoveBy: () => undefined,
    onRemove: () => undefined,
    onPatch: async () => null,
    onDelete: async () => true,
  };
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <CollectionView {...props} />
    </AppRouterContext.Provider>,
  );
}

describe("Share on the collection page", () => {
  test("public and unlisted collections offer Share, to the owner and to a visitor", () => {
    expect(view("public", true)).toContain('aria-label="Share collection"');
    expect(view("unlisted", false)).toContain('aria-label="Share collection"');
  });
  test("private collections and the system lists do not", () => {
    expect(view("private", true)).not.toContain("Share collection");
    expect(view("private", false, "watch_later")).not.toContain("Share collection");
    expect(canShareCollection(null)).toBe(false);
  });
  test("the link is the collection's own page", () => {
    expect(collectionShareUrl("https://app.cleestudio.com/", { id: ID })).toBe(`https://app.cleestudio.com/posttube/playlists/${ID}`);
  });
});

describe("shareCollectionLink", () => {
  test("the system share sheet first", async () => {
    const shared: unknown[] = [];
    expect(await shareCollectionLink("u", "t", { share: async (d) => void shared.push(d) })).toBe("shared");
    expect(shared).toEqual([{ title: "t", url: "u" }]);
  });
  test("the clipboard when there is no sheet; a dismissed sheet is not an error", async () => {
    const copied: string[] = [];
    expect(await shareCollectionLink("u", "t", { clipboard: { writeText: async (s) => void copied.push(s) } })).toBe("copied");
    expect(copied).toEqual(["u"]);
    const abort = Object.assign(new Error("x"), { name: "AbortError" });
    expect(await shareCollectionLink("u", "t", { share: async () => Promise.reject(abort) })).toBe("cancelled");
    expect(await shareCollectionLink("u", "t", {})).toBe("failed");
  });
});

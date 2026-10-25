import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  COLLECTION_NAME_PROBLEM_TEXT,
  DEFAULT_COLLECTION_NAME,
  MAX_SAVED_COLLECTIONS,
  OFFLINE_TEXT,
  applyDeleteToCounts,
  applyMoveToCounts,
  applyMoveToPages,
  canCreateCollection,
  collectionNameProblem,
  createCollectionRequest,
  deleteCollectionRequest,
  itemBelongsToTab,
  moveSavedItemRequest,
  normalizeCollectionName,
  parseDeletedCollection,
  parseSavedCollection,
  parseSavedCollections,
  parseSavedItem,
  parseSavedItemsPage,
  renameCollectionRequest,
  resolveTab,
  saveToCollectionRequest,
  savedErrorText,
  savedItemsParams,
  type SavedCollectionView,
} from "../savedCollections"
import * as fx from "./fixtures"

const collections = () => parseSavedCollections(fx.listCollections200)

describe("decoders", () => {
  test("the collection list: default first with its count, then the caller's in server order", () => {
    expect(collections()).toEqual([
      { id: null, name: "All Saved", count: 3, isDefault: true },
      { id: fx.COLLECTION_RECIPES, name: "Recipes", count: 2, isDefault: false },
      { id: fx.COLLECTION_TRIPS, name: "Trips", count: 0, isDefault: false },
    ])
  })

  test("a body without the default row still gets one; repeats, junk and a second default are dropped", () => {
    const [def, recipes] = fx.listCollections200.data.slice(0, 2)
    const out = parseSavedCollections({
      data: [recipes, recipes, null, 7, { id: "x" }, { name: "" }, def, { ...def, count: 99 }],
    })
    expect(out.map((c) => c.id)).toEqual([null, fx.COLLECTION_RECIPES])
    expect(out[0].count).toBe(3)
    expect(parseSavedCollections({ data: [recipes] })[0]).toEqual({ id: null, name: DEFAULT_COLLECTION_NAME, count: 0, isDefault: true })
    expect(parseSavedCollections(null)).toEqual([{ id: null, name: DEFAULT_COLLECTION_NAME, count: 0, isDefault: true }])
    expect(parseSavedCollections({ data: "nope" })).toHaveLength(1)
  })

  test("a row with is_default true or id null is the default, whatever its name; counts are whole and never negative", () => {
    expect(parseSavedCollection({ id: null, name: "default", count: 1 })).toEqual({ id: null, name: "All Saved", count: 1, isDefault: true })
    expect(parseSavedCollection({ id: fx.COLLECTION_TRIPS, name: "Trips", is_default: true })?.isDefault).toBe(true)
    expect(parseSavedCollection({ id: fx.COLLECTION_TRIPS, name: "Trips", count: -4 })?.count).toBe(0)
    expect(parseSavedCollection({ id: fx.COLLECTION_TRIPS, name: "Trips", count: "3" })?.count).toBe(0)
    expect(parseSavedCollection({ id: fx.COLLECTION_TRIPS, name: "Trips", count: 2.7 })?.count).toBe(2)
  })

  test("created / renamed collection (201 / 200 data: collection)", () => {
    expect(parseSavedCollection(fx.createCollection201.data)).toEqual({ id: fx.COLLECTION_TRIPS, name: "Trips", count: 0, isDefault: false })
  })

  test("saved items: collection_id null is the default; next_cursor carried; malformed rows dropped", () => {
    const page = parseSavedItemsPage(fx.listSavedItems200)
    expect(page.nextCursor).toBe("2026-10-24T11:00:00Z|aaaa")
    expect(page.items).toEqual([
      { id: fx.SAVED_A, targetType: "post", targetId: fx.POST_A, collectionId: fx.COLLECTION_RECIPES, collectionName: "Recipes", createdAt: "2026-10-24T11:00:00Z" },
      { id: fx.SAVED_B, targetType: "post", targetId: fx.POST_B, collectionId: null, collectionName: "All Saved", createdAt: "2026-10-24T12:00:00Z" },
    ])
    expect(parseSavedItemsPage({ data: [{ id: "x" }, null, fx.savedItemInDefault] }).items).toHaveLength(1)
    expect(parseSavedItemsPage({ data: [] })).toEqual({ items: [], nextCursor: null })
    expect(parseSavedItem({ ...fx.savedItemInDefault, collection_id: "" })?.collectionId).toBeNull()
  })

  test("the move answer is the item in its new collection", () => {
    expect(parseSavedItem(fx.moveSavedItem200.data)?.collectionId).toBe(fx.COLLECTION_RECIPES)
  })

  test("delete answer: how many went back to All Saved", () => {
    expect(parseDeletedCollection(fx.deleteCollection200)).toEqual({ collectionId: fx.COLLECTION_RECIPES, movedToDefault: 2 })
    expect(parseDeletedCollection({ data: {} })).toEqual({ collectionId: null, movedToDefault: 0 })
  })
})

describe("request bodies", () => {
  test("create, rename and delete", () => {
    expect(createCollectionRequest("Trips")).toEqual({ method: "post", url: "/v1/saved/collections", body: { name: "Trips" } })
    expect(renameCollectionRequest(fx.COLLECTION_TRIPS, "Holidays")).toEqual({
      method: "patch",
      url: `/v1/saved/collections/${fx.COLLECTION_TRIPS}`,
      body: { name: "Holidays" },
    })
    expect(deleteCollectionRequest(fx.COLLECTION_TRIPS)).toEqual({ method: "delete", url: `/v1/saved/collections/${fx.COLLECTION_TRIPS}` })
    expect(deleteCollectionRequest(fx.COLLECTION_TRIPS).body).toBeUndefined()
  })

  test("move a saved item: PUT by saved id, the collection_id key always present ('default' for All Saved)", () => {
    expect(moveSavedItemRequest(fx.SAVED_A, fx.COLLECTION_TRIPS)).toEqual({
      method: "put",
      url: `/v1/saved/${fx.SAVED_A}/collection`,
      body: { collection_id: fx.COLLECTION_TRIPS },
    })
    expect(moveSavedItemRequest(fx.SAVED_A, null)).toEqual({
      method: "put",
      url: `/v1/saved/${fx.SAVED_A}/collection`,
      body: { collection_id: "default" },
    })
  })

  test("save from a post: POST {collection_id} into a named one, plain POST or the move for All Saved", () => {
    expect(saveToCollectionRequest(fx.POST_A, fx.COLLECTION_RECIPES, false)).toEqual({
      method: "post",
      url: `/v1/posts/${fx.POST_A}/bookmark`,
      body: { collection_id: fx.COLLECTION_RECIPES },
    })
    // Already saved: the POST with a collection still moves it (upsert), so it stays a POST.
    expect(saveToCollectionRequest(fx.POST_A, fx.COLLECTION_RECIPES, true)).toEqual({
      method: "post",
      url: `/v1/posts/${fx.POST_A}/bookmark`,
      body: { collection_id: fx.COLLECTION_RECIPES },
    })
    expect(saveToCollectionRequest(fx.POST_A, null, false)).toEqual({ method: "post", url: `/v1/posts/${fx.POST_A}/bookmark` })
    // A plain POST keeps an already-saved post where it is, so All Saved is the move.
    expect(saveToCollectionRequest(fx.POST_A, null, true)).toEqual({
      method: "put",
      url: `/v1/posts/${fx.POST_A}/bookmark/collection`,
      body: { collection_id: "default" },
    })
  })

  test("the list filter: ?collection_id=default for All Saved (never unfiltered), the id otherwise", () => {
    expect(savedItemsParams("default")).toEqual({ limit: "20", collection_id: "default" })
    expect(savedItemsParams(fx.COLLECTION_RECIPES, "cur")).toEqual({ limit: "20", collection_id: fx.COLLECTION_RECIPES, cursor: "cur" })
    expect(savedItemsParams("default", "")).toEqual({ limit: "20", collection_id: "default" })
    expect("collection" in savedItemsParams("default")).toBe(false)
  })

  test("ids are path-encoded", () => {
    expect(moveSavedItemRequest("a/b", null).url).toBe("/v1/saved/a%2Fb/collection")
  })
})

describe("collection rules (NormalizeCollectionName + the store's)", () => {
  const list = collections()

  test("trims and folds whitespace, as the server stores it", () => {
    expect(normalizeCollectionName("  Weekend \t  trips  ")).toBe("Weekend trips")
    expect(collectionNameProblem("  Weekend   trips ", list)).toEqual({ ok: true, name: "Weekend trips" })
  })

  test("1 to 40 characters after trimming, counted as characters not bytes", () => {
    expect(collectionNameProblem("   ", list)).toEqual({ ok: false, problem: "empty" })
    expect(collectionNameProblem("a".repeat(40), list).ok).toBe(true)
    expect(collectionNameProblem("a".repeat(41), list)).toEqual({ ok: false, problem: "too_long" })
    expect(collectionNameProblem("é".repeat(40), list).ok).toBe(true)
    expect(collectionNameProblem("😀".repeat(40), list).ok).toBe(true)
    expect(collectionNameProblem("😀".repeat(41), list)).toEqual({ ok: false, problem: "too_long" })
  })

  test("control characters are refused; whitespace controls are just spaces", () => {
    expect(collectionNameProblem("bad\u0007name", list)).toEqual({ ok: false, problem: "invalid" })
    expect(collectionNameProblem("bad\u009bname", list)).toEqual({ ok: false, problem: "invalid" })
    expect(collectionNameProblem("two\nlines", list)).toEqual({ ok: true, name: "two lines" })
  })

  test("the default's names are reserved, case-insensitively", () => {
    expect(collectionNameProblem("All Saved", list)).toEqual({ ok: false, problem: "reserved" })
    expect(collectionNameProblem("  all   SAVED ", list)).toEqual({ ok: false, problem: "reserved" })
    expect(collectionNameProblem("Default", list)).toEqual({ ok: false, problem: "reserved" })
  })

  test("unique per user, case-insensitively; a rename may keep its own name", () => {
    expect(collectionNameProblem("recipes", list)).toEqual({ ok: false, problem: "taken" })
    expect(collectionNameProblem("RECIPES", list, fx.COLLECTION_RECIPES)).toEqual({ ok: true, name: "RECIPES" })
    expect(collectionNameProblem("Trips", list, fx.COLLECTION_RECIPES)).toEqual({ ok: false, problem: "taken" })
  })

  test("at most 50 named collections; the default does not count, and a rename is never limited", () => {
    const named = (n: number): SavedCollectionView[] => [
      { id: null, name: "All Saved", count: 0, isDefault: true },
      ...Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, name: `c${i}`, count: 0, isDefault: false })),
    ]
    expect(canCreateCollection(named(MAX_SAVED_COLLECTIONS - 1))).toBe(true)
    expect(canCreateCollection(named(MAX_SAVED_COLLECTIONS))).toBe(false)
    expect(collectionNameProblem("new", named(MAX_SAVED_COLLECTIONS - 1)).ok).toBe(true)
    expect(collectionNameProblem("new", named(MAX_SAVED_COLLECTIONS))).toEqual({ ok: false, problem: "limit" })
    expect(collectionNameProblem("renamed", named(MAX_SAVED_COLLECTIONS), "id-3")).toEqual({ ok: true, name: "renamed" })
  })

  test("every problem has a sentence", () => {
    for (const text of Object.values(COLLECTION_NAME_PROBLEM_TEXT)) expect(text).toMatch(/^[A-Z“].*\.$/)
    expect(COLLECTION_NAME_PROBLEM_TEXT.limit).toContain("50")
    expect(COLLECTION_NAME_PROBLEM_TEXT.too_long).toContain("40")
  })
})

describe("error copy", () => {
  test("each refusal code is a sentence of its own", () => {
    expect(savedErrorText(fx.errInvalidName, "create")).toBe("A collection name needs 1 to 40 characters and can't be “All Saved”.")
    expect(savedErrorText(fx.errNameTaken, "rename")).toBe("You already have a collection with that name.")
    expect(savedErrorText(fx.errLimit, "create")).toBe("You can have up to 50 collections. Delete one to make another.")
    expect(savedErrorText(fx.errNotFound, "move")).toBe("That collection no longer exists. It may have been deleted on another device.")
    expect(savedErrorText(fx.errNotSaved, "move")).toBe("This post isn't in your saved items any more.")
    expect(savedErrorText(fx.errStore, "load")).toBe("Saved items are unavailable right now. Try again in a moment.")
  })

  test("offline, and anything else by what was being done", () => {
    expect(savedErrorText(fx.errOffline, "save")).toBe(OFFLINE_TEXT)
    expect(savedErrorText(fx.errInternal, "delete")).toBe("That collection couldn't be deleted. Try again.")
    expect(savedErrorText(fx.errInternal, "move")).toBe("That post couldn't be moved. Try again.")
    expect(savedErrorText(new Error("boom"), "create")).toBe("That collection couldn't be created. Try again.")
    expect(savedErrorText(undefined, "unsave")).toBe("That post couldn't be removed from Saved. Try again.")
  })

  test("the server's English is never shown raw", () => {
    expect(savedErrorText(fx.errInvalidName, "create")).not.toContain("reserved name")
  })
})

describe("move and filter", () => {
  const page = () => parseSavedItemsPage(fx.listSavedItems200)
  const [inRecipes, inDefault] = parseSavedItemsPage(fx.listSavedItems200).items

  test("an item is on exactly one tab", () => {
    expect(itemBelongsToTab(inRecipes, fx.COLLECTION_RECIPES)).toBe(true)
    expect(itemBelongsToTab(inRecipes, "default")).toBe(false)
    expect(itemBelongsToTab(inRecipes, fx.COLLECTION_TRIPS)).toBe(false)
    expect(itemBelongsToTab(inDefault, "default")).toBe(true)
    expect(itemBelongsToTab(inDefault, fx.COLLECTION_RECIPES)).toBe(false)
  })

  test("moving out of the open tab takes the item off the list; the others stay", () => {
    const tab = fx.COLLECTION_RECIPES
    const listed = { items: [inRecipes], nextCursor: "c" }
    const out = applyMoveToPages([listed], fx.SAVED_A, fx.COLLECTION_TRIPS, tab)
    expect(out).toEqual([{ items: [], nextCursor: "c" }])
    const mixed = applyMoveToPages([page()], fx.SAVED_B, fx.COLLECTION_RECIPES, "default")
    expect(mixed[0].items.map((i) => i.id)).toEqual([fx.SAVED_A])
  })

  test("moving into the open tab (or within it) keeps the item, with its new collection", () => {
    const out = applyMoveToPages([{ items: [inDefault], nextCursor: null }], fx.SAVED_B, null, "default")
    expect(out[0].items).toEqual([inDefault])
    const into = applyMoveToPages([{ items: [inDefault], nextCursor: null }], fx.SAVED_B, fx.COLLECTION_TRIPS, fx.COLLECTION_TRIPS)
    expect(into[0].items[0].collectionId).toBe(fx.COLLECTION_TRIPS)
  })

  test("other items are never touched, and the input is not mutated", () => {
    const pages = [page()]
    const before = JSON.stringify(pages)
    const out = applyMoveToPages(pages, fx.SAVED_B, fx.COLLECTION_TRIPS, "default")
    expect(out[0].items[0]).toEqual(inRecipes)
    expect(JSON.stringify(pages)).toBe(before)
  })

  test("counts follow the item: one off where it was, one on where it went", () => {
    const out = applyMoveToCounts(collections(), fx.COLLECTION_RECIPES, null)
    expect(out.map((c) => c.count)).toEqual([4, 1, 0])
    const back = applyMoveToCounts(collections(), null, fx.COLLECTION_TRIPS)
    expect(back.map((c) => c.count)).toEqual([2, 2, 1])
    expect(applyMoveToCounts(collections(), fx.COLLECTION_RECIPES, fx.COLLECTION_RECIPES).map((c) => c.count)).toEqual([3, 2, 0])
    expect(applyMoveToCounts(collections(), fx.COLLECTION_TRIPS, null).map((c) => c.count)).toEqual([4, 2, 0])
  })

  test("deleting a collection: it goes and its items are counted in All Saved", () => {
    const out = applyDeleteToCounts(collections(), fx.COLLECTION_RECIPES, 2)
    expect(out).toEqual([
      { id: null, name: "All Saved", count: 5, isDefault: true },
      { id: fx.COLLECTION_TRIPS, name: "Trips", count: 0, isDefault: false },
    ])
  })

  test("the open tab falls back to All Saved when its collection is gone", () => {
    expect(resolveTab(fx.COLLECTION_RECIPES, collections())).toBe(fx.COLLECTION_RECIPES)
    expect(resolveTab(fx.COLLECTION_RECIPES, applyDeleteToCounts(collections(), fx.COLLECTION_RECIPES, 2))).toBe("default")
    expect(resolveTab("default", [])).toBe("default")
    // Still loading: keep what was chosen.
    expect(resolveTab(fx.COLLECTION_TRIPS, undefined)).toBe(fx.COLLECTION_TRIPS)
  })
})

describe("the screens", () => {
  const root = resolve(import.meta.dir, "../../..")
  const page = readFileSync(resolve(root, "app/saved/page.tsx"), "utf8")
  const card = readFileSync(resolve(root, "components/PostCard.tsx"), "utf8")
  const hooks = readFileSync(resolve(root, "hooks/useSavedItems.ts"), "utf8")

  test("/saved: tabs by collection id, Move to collection, rename and a confirmed delete", () => {
    expect(page).toContain("useSavedItems(tab, !collectionsQuery.isLoading)")
    expect(page).toContain("move.mutate(\n            { item: moving, toCollectionId: to.id, tab }")
    expect(page).toContain('title="Move to collection"')
    expect(page).toContain("currentCollectionId={moving.collectionId}")
    expect(page).toContain("<ConfirmDialog")
    expect(page).toContain("Nothing is unsaved.")
    // The old "Add to Collection" button unsaved the item.
    expect(page).not.toContain("Add to Collection")
  })

  test("a post card saves, unsaves and offers a collection", () => {
    expect(card).toContain("bookmarkMutation.mutate({ postId: post.id, saved: !wasBookmarked }")
    expect(card).toContain("<SavedPostToast onChoose={openCollectionSheet} />")
    expect(card).toContain("{ postId: post.id, toCollectionId: collection.id, alreadySaved: bookmarked }")
    expect(card).not.toContain("useToggleBookmark")
  })

  test("the unused useSaveItem (POST /v1/saved by collection name) is replaced", () => {
    expect(hooks).not.toContain("useSaveItem(")
    expect(hooks).toContain("export function useSavePostToCollection()")
    expect(hooks).toContain("saveToCollectionRequest(postId, toCollectionId, alreadySaved)")
  })
})

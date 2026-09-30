import { describe, expect, it } from "bun:test"
import {
  MAX_GALLERY_IMAGES,
  addToGallery,
  attachedGalleryItem,
  coverOf,
  galleryBusy,
  galleryMediaIds,
  galleryProblem,
  moveGalleryItem,
  patchGalleryItem,
  removeGalleryItem,
  type GalleryItem,
} from "../model/sellListing"
import { readImageStatus } from "../api/sellMedia"

// Ported from atpost-web-ui lib/gallery.test.ts.

const file = (name: string, type = "image/jpeg") => ({ name, type }) as unknown as File
let seq = 0
const key = () => `k${++seq}`
const ready = (id: string, over: Partial<GalleryItem> = {}): GalleryItem => ({ key: key(), mediaId: id, previewUrl: null, fileName: `${id}.jpg`, status: "ready", progress: 1, error: null, ...over })

describe("addToGallery", () => {
  it("appends picked images as queued rows with a preview", () => {
    const { items, rejected } = addToGallery([], [file("a.jpg"), file("b.png", "image/png")], key, (f) => `blob:${f.name}`)
    expect(rejected).toEqual([])
    expect(items.map((i) => [i.fileName, i.status, i.previewUrl, i.mediaId])).toEqual([
      ["a.jpg", "queued", "blob:a.jpg", null],
      ["b.png", "queued", "blob:b.png", null],
    ])
  })
  it("refuses the ninth image by name rather than dropping it silently", () => {
    const eight = Array.from({ length: MAX_GALLERY_IMAGES }, (_, i) => ready(`m${i}`))
    const { items, rejected } = addToGallery(eight, [file("nine.jpg"), file("ten.jpg")], key)
    expect(items).toHaveLength(MAX_GALLERY_IMAGES)
    expect(rejected.map((r) => r.fileName)).toEqual(["nine.jpg", "ten.jpg"])
    expect(rejected[0].reason).toContain("8")
  })
  it("fills to the cap and refuses only the overflow", () => {
    const seven = Array.from({ length: 7 }, (_, i) => ready(`m${i}`))
    const { items, rejected } = addToGallery(seven, [file("eight.jpg"), file("nine.jpg")], key)
    expect(items).toHaveLength(8)
    expect(items[7].fileName).toBe("eight.jpg")
    expect(rejected.map((r) => r.fileName)).toEqual(["nine.jpg"])
  })
  it("refuses a file that is not a JPEG, PNG or WebP before any bytes move", () => {
    const { items, rejected } = addToGallery([], [file("clip.mp4", "video/mp4"), file("ok.webp", "image/webp")], key)
    expect(items.map((i) => i.fileName)).toEqual(["ok.webp"])
    expect(rejected[0].fileName).toBe("clip.mp4")
  })
  it("does not mutate the list it was given", () => {
    const before = [ready("a")]
    addToGallery(before, [file("b.jpg")], key)
    expect(before).toHaveLength(1)
  })
})

describe("ordering and the cover", () => {
  it("the first row is the cover, whatever else is true of it", () => {
    expect(coverOf([ready("a", { status: "uploading" }), ready("b")])?.mediaId).toBe("a")
    expect(coverOf([])).toBeNull()
  })
  it("moving a row changes which one is the cover and leaves the input alone", () => {
    const items = [ready("a"), ready("b"), ready("c")]
    const out = moveGalleryItem(items, 2, 0)
    expect(out.map((i) => i.mediaId)).toEqual(["c", "a", "b"])
    expect(items.map((i) => i.mediaId)).toEqual(["a", "b", "c"])
    expect(moveGalleryItem(items, 0, 2).map((i) => i.mediaId)).toEqual(["b", "c", "a"])
  })
  it("an out-of-range move is the same list", () => {
    const items = [ready("a"), ready("b")]
    expect(moveGalleryItem(items, 0, 5).map((i) => i.mediaId)).toEqual(["a", "b"])
    expect(moveGalleryItem(items, -1, 0).map((i) => i.mediaId)).toEqual(["a", "b"])
    expect(moveGalleryItem(items, 1, 1).map((i) => i.mediaId)).toEqual(["a", "b"])
  })
  it("removing and patching by key touch exactly that row", () => {
    const a = ready("a", { status: "uploading", progress: 0.2 })
    const b = ready("b")
    expect(removeGalleryItem([a, b], a.key).map((i) => i.mediaId)).toEqual(["b"])
    const out = patchGalleryItem([a, b], a.key, { progress: 0.9 })
    expect(out[0].progress).toBe(0.9)
    expect(out[1]).toBe(b)
  })
})

describe("what is sent to the server", () => {
  it("sends only ready ids, in gallery order, once each", () => {
    const items = [ready("cover"), ready("slow", { status: "processing" }), ready("bad", { status: "failed", error: "no" }), ready("second"), ready(null as unknown as string, { status: "ready", mediaId: null }), ready("cover")]
    expect(galleryMediaIds(items)).toEqual(["cover", "second"])
  })
  it("knows when something is still on its way", () => {
    expect(galleryBusy([ready("a")])).toBe(false)
    expect(galleryBusy([ready("a"), ready("b", { status: "queued" })])).toBe(true)
    expect(galleryBusy([ready("a", { status: "processing" })])).toBe(true)
    expect(galleryBusy([ready("a", { status: "failed" })])).toBe(false)
  })
  it("names the reason a save must wait, or none", () => {
    expect(galleryProblem([])).toBeNull()
    expect(galleryProblem([ready("a")])).toBeNull()
    expect(galleryProblem([ready("a", { status: "uploading" })])).toBe("Images are still uploading.")
    expect(galleryProblem([ready("a", { status: "failed" })])).toBe("None of these images is ready to attach.")
  })
  it("an image already on the product starts ready with the server preview", () => {
    const row = attachedGalleryItem({ media_id: "m1", image_url: "https://cdn/full.jpg", thumbnail_url: "https://cdn/t.jpg" }, key)
    expect(row.status).toBe("ready")
    expect(row.previewUrl).toBe("https://cdn/t.jpg")
    expect(galleryMediaIds([row])).toEqual(["m1"])
  })
})

describe("readImageStatus", () => {
  it("waits until ready AND passed", () => {
    expect(readImageStatus({ processing_status: "processing" })).toEqual({ done: false, error: null })
    expect(readImageStatus({ processing_status: "ready", moderation_status: "pending" })).toEqual({ done: false, error: null })
    expect(readImageStatus({ processing_status: "ready", moderation_status: "passed" })).toEqual({ done: true, error: null })
  })
  it("gives up with a sentence on failure, rejection or manual review", () => {
    expect(readImageStatus({ processing_status: "failed" }).error).toContain("could not be processed")
    expect(readImageStatus({ moderation_status: "rejected" }).error).toContain("not accepted")
    expect(readImageStatus({ moderation_status: "manual_review" }).error).toContain("held for review")
  })
})

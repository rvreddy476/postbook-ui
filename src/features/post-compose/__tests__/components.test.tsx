import { describe, expect, test } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"

import { ComposeActions } from "../components/ComposeActions"
import { DraftsList, draftHref } from "../components/DraftsList"
import { MediaStrip } from "../components/MediaStrip"
import { CaptionHelpers, DetailRows, TitleField, disclosureSummary } from "../components/PostDetailsFields"
import { emptyDetails, toDraftRows, type ComposeMedia } from "../model"

const noop = () => {}
const media = (n: number, kind: "image" | "video" = "image"): ComposeMedia[] =>
  Array.from({ length: n }, (_, i) => ({ key: `k${i}`, kind, mediaId: `m${i}`, previewUrl: `/v1/media/m${i}/serve`, altText: "" }))

describe("the media strip", () => {
  test("a carousel marks its cover and says how to change it", () => {
    const html = renderToStaticMarkup(<MediaStrip media={media(3)} coverIndex={1} onCover={noop} onRemove={noop} onAdd={noop} />)
    expect((html.match(/data-compose="cover-mark"/g) ?? []).length).toBe(1)
    expect(html).toContain('aria-label="Photo 2, the cover"')
    expect(html).toContain('aria-label="Photo 1. Make this the cover"')
    expect(html).toContain("Tap a photo to make it the cover.")
    expect(html).toContain('aria-label="Add photos"')
    expect(html).toContain('aria-label="Remove photo 3"')
  })

  test("one photo, or a video among them, has no cover to choose; a full strip has no +", () => {
    const one = renderToStaticMarkup(<MediaStrip media={media(1)} coverIndex={0} onCover={noop} onRemove={noop} onAdd={noop} />)
    expect(one).not.toContain("cover-mark")
    expect(one).not.toContain("Tap a photo")
    const mixed = renderToStaticMarkup(<MediaStrip media={[...media(2), ...media(1, "video").map((m) => ({ ...m, key: "v" }))]} coverIndex={0} onCover={noop} onRemove={noop} onAdd={noop} />)
    expect(mixed).not.toContain("cover-mark")
    const full = renderToStaticMarkup(<MediaStrip media={media(10)} coverIndex={0} onCover={noop} onRemove={noop} onAdd={noop} />)
    expect(full).not.toContain('aria-label="Add photos"')
  })
})

describe("the details", () => {
  test("title, # Hashtags and @ Mention", () => {
    expect(renderToStaticMarkup(<TitleField value="" onChange={noop} />)).toContain('placeholder="Add a title"')
    const helpers = renderToStaticMarkup(<CaptionHelpers onInsertHashtag={noop} onPickMention={noop} extraHashtags={["market"]} onRemoveExtraHashtag={noop} />)
    expect(helpers).toContain("Hashtags")
    expect(helpers).toContain("Mention")
    expect(helpers).toContain('aria-label="Remove #market"')
  })

  test("the rows: Location, Add link, who can view, More options", () => {
    const html = renderToStaticMarkup(<DetailRows details={emptyDetails("en")} onDetails={noop} media={[]} onAltText={noop} />)
    const rows = [...html.matchAll(/data-row="([a-z-]+)"/g)].map((m) => m[1])
    expect(rows).toEqual(["location", "link", "audience", "more"])
    expect(html).toContain("Location")
    expect(html).toContain("Add link")
    expect(html).toContain("Everyone can view this post")
    expect(html).toContain("More options")
  })

  test("a set place and a bad link show on their rows", () => {
    const html = renderToStaticMarkup(
      <DetailRows details={{ ...emptyDetails("en"), locationName: "Hyderabad", link: "http://x.com", visibility: "friends" }} onDetails={noop} media={[]} onAltText={noop} />,
    )
    expect(html).toContain("Hyderabad")
    expect(html).toContain("Use a full https:// link.")
    expect(html).toContain("Friends can view this post")
  })

  test("content disclosure summary", () => {
    expect(disclosureSummary({ paidPromotion: true, isBranded: true })).toBe("Paid partnership, your brand")
    expect(disclosureSummary({ paidPromotion: false, isBranded: true })).toBe("Your brand")
    expect(disclosureSummary({ paidPromotion: false, isBranded: false })).toBe("Say when a post promotes a brand")
  })
})

describe("Drafts and Post", () => {
  test("both buttons; a blocked draft says why and is disabled", () => {
    const html = renderToStaticMarkup(<ComposeActions onDrafts={noop} onPost={noop} canPost posting={false} savingDraft={false} draftBlocked="Remove the video." />)
    expect(html).toMatch(/disabled=""[^>]*data-action="drafts"/)
    expect(html).toContain("Remove the video.")
    expect(html).toContain(">Post<")
    const ok = renderToStaticMarkup(<ComposeActions onDrafts={noop} onPost={noop} canPost posting={false} savingDraft={false} draftsLabel="Save" />)
    expect(ok).not.toContain(`disabled=""`)
    expect(ok).toContain(">Save<")
  })

  test("the list: heading, count and time, open link, delete", () => {
    const rows = toDraftRows(JSON.parse(readFileSync(resolve(import.meta.dir, "contracts/drafts_list.json"), "utf8")))
    const html = renderToStaticMarkup(<DraftsList rows={rows} onDelete={noop} now={Date.parse("2026-10-18T13:00:00Z")} />)
    expect(html).toContain("Sunday market")
    expect(html).toContain("3 photos · 1 h ago")
    expect(html).toContain(`href="${draftHref(rows[0].id)}"`)
    expect(html).toContain('aria-label="Delete draft Sunday market"')
    expect(renderToStaticMarkup(<DraftsList rows={[]} onDelete={noop} />)).toContain("No drafts")
  })
})

/* ─── Design tokens only ───────────────────────────────────────────── */

const FEATURE = resolve(import.meta.dir, "..")
const SRC = resolve(import.meta.dir, "../../..")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path)
    return /\.(ts|tsx|css)$/.test(name) ? [path] : []
  })
}

// Raw palette utilities (bg-slate-900, text-violet-400, text-white…) bypass the theme.
const RAW_PALETTE =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|accent|placeholder|divide|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?\b/g

describe("no hex and no raw palette", () => {
  test("in every file of the feature and the drafts page", () => {
    const files = [...sourceFiles(FEATURE), resolve(SRC, "app/create/drafts/page.tsx")]
    expect(files.length).toBeGreaterThan(6)
    for (const file of files) {
      const code = readFileSync(file, "utf8")
      expect(code.match(/#[0-9a-f]{3,8}\b/gi), file).toBeNull()
      expect(code.match(RAW_PALETTE), file).toBeNull()
    }
  })

  test("the full-page composer keeps hex only in its stored swatches", () => {
    const code = readFileSync(resolve(SRC, "app/create/post/page.tsx"), "utf8")
    expect(code.match(RAW_PALETTE)).toBeNull()
    const rest = code.slice(code.indexOf("const MAX_CHARS"))
    expect(rest.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull()
  })
})

/* ─── Both composers are on the shared form ────────────────────────── */

describe("composer wiring", () => {
  const portal = readFileSync(resolve(SRC, "components/CreatePortal.tsx"), "utf8")
  const page = readFileSync(resolve(SRC, "app/create/post/page.tsx"), "utf8")

  test("both post through useComposeSubmit and render the shared details", () => {
    for (const code of [portal, page]) {
      expect(code).toContain("useComposeSubmit(")
      expect(code).not.toContain("useCreatePost")
      expect(code).toContain("<DetailRows")
      expect(code).toContain("<CaptionHelpers")
      expect(code).toContain("<MediaStrip")
      expect(code).toContain("<ComposeActions")
      // The create contract has no `location` key.
      expect(code).not.toMatch(/\blocation: location\.trim\(\) \|\| null/)
    }
  })

  test("the stale 'post-service has no draft route' note is gone", () => {
    expect(portal).not.toContain("post-service has no draft route")
    expect(page).not.toContain("DRAFT AUTO-SAVED")
  })
})

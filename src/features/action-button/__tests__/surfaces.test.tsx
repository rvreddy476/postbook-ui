import { describe, expect, mock, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"

mock.module("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} }),
  usePathname: () => "/l/x",
  useSearchParams: () => new URLSearchParams(),
}))

const { ActionPill } = await import("../components/ActionPill")
const { ActionEditorView, actionSummary } = await import("../components/ActionEditor")
const { LeavingCard, LinkGone } = await import("../components/LeavingScreen")
const { ACTION_LABELS, actionErrorMessage, decodeAction } = await import("../model")
const { buildCreateRequest, buildDraftRequest, detailsProblem, draftToCompose, emptyDetails, refusalCopy, toDraftRow } = await import("@/features/post-compose/model")
const { studioCreateFields, studioDraftActionField, publishFailure } = await import("@/features/upload/studioApi")
const { getStepErrors } = await import("@/features/upload/validation")
const { INITIAL_FORM_STATE } = await import("@/features/upload/types")
const { normalizePostDetail, normalizeLibraryRow, postPatchBody } = await import("@/features/posttube/hub/hubApi")
const { toReelItem } = await import("@/features/reels/model")
const { normalizeChannel } = await import("@/features/posttube/channel/channelApi")
const { COMMENT_REPORT_REASONS, REPORT_REASONS, reportRequestBody } = await import("@/hooks/useReport")
const { BrandingScreen } = await import("@/features/settings/channel/BrandingScreen")
const { SECTIONS } = await import("@/features/settings/channel/view")

const ID = "0f8a2c10-1111-4a3b-9c00-000000000001"
const POST = "6f1c2a10-1111-4a3b-9c00-0000000000aa"
const viewerWire = { id: ID, label: "apply_now", label_text: "Apply now", domain: "epfindia.gov.in", href: `/l/${ID}` }
const authorWire = { ...viewerWire, url: "https://epfindia.gov.in/recruitment?ref=vchat" }
const draft = { label: "apply_now", url: "https://epfindia.gov.in/recruitment" }
const axiosError = (status: number, error: unknown) => ({ response: { status, data: { error } } })

/* ── the pills ──────────────────────────────────────────────────── */

describe("ActionPill", () => {
  test("links to /l/<id> with the label and the domain; the raw url never reaches the page", () => {
    const html = renderToStaticMarkup(<ActionPill action={decodeAction(authorWire)} variant="card" />)
    expect(html).toContain(`href="/l/${ID}"`)
    expect(html).toContain("Apply now")
    expect(html).toContain("epfindia.gov.in")
    expect(html).not.toContain("recruitment")
    expect(html).not.toContain("https://epfindia")
  })

  test("the reel pill and the profile button link the same way", () => {
    for (const variant of ["reel", "profile"] as const) {
      const html = renderToStaticMarkup(<ActionPill action={decodeAction(viewerWire)} variant={variant} />)
      expect(html).toContain(`href="/l/${ID}"`)
      expect(html).toContain(`data-action-pill="${variant}"`)
    }
  })

  test("blocked: nothing for a viewer; the author reads why, with no link", () => {
    const blocked = decodeAction({ ...authorWire, status: "blocked" })
    expect(renderToStaticMarkup(<ActionPill action={blocked} />)).toBe("")
    const own = renderToStaticMarkup(<ActionPill action={blocked} isAuthor />)
    expect(own).toContain("Link blocked: unsafe")
    expect(own).not.toContain("href=")
    expect(renderToStaticMarkup(<ActionPill action={decodeAction({ ...viewerWire, status: "under_review" })} isAuthor />)).toContain("Link under review")
  })

  test("nothing on a locked post, and nothing when there is no button", () => {
    expect(renderToStaticMarkup(<ActionPill action={decodeAction(viewerWire)} locked />)).toBe("")
    expect(renderToStaticMarkup(<ActionPill action={null} />)).toBe("")
  })
})

/* ── the editor ─────────────────────────────────────────────────── */

describe("ActionEditorView", () => {
  const noop = () => {}

  test("no button: the Add action button call", () => {
    const html = renderToStaticMarkup(<ActionEditorView value={null} onChange={noop} labels={ACTION_LABELS} />)
    expect(html).toContain("Add action button")
    expect(html).not.toContain("<select")
  })

  test("a button: the label picker, the link, Remove", () => {
    const html = renderToStaticMarkup(<ActionEditorView value={draft} onChange={noop} labels={ACTION_LABELS} />)
    expect(html).toContain("Button says")
    expect((html.match(/<option /g) ?? []).length).toBe(ACTION_LABELS.length)
    expect(html).toContain('value="https://epfindia.gov.in/recruitment"')
    expect(html).toContain("Remove action button")
    expect(html).toContain("Apply now · epfindia.gov.in")
  })

  test("a shortener and a group invite are said as they are typed", () => {
    const short = renderToStaticMarkup(<ActionEditorView value={{ label: "apply_now", url: "https://bit.ly/abc" }} onChange={noop} labels={ACTION_LABELS} />)
    expect(short).toContain('aria-invalid="true"')
    expect(short).toContain("Short links like bit.ly")
    const invite = renderToStaticMarkup(<ActionEditorView value={{ label: "apply_now", url: "https://chat.whatsapp.com/x" }} onChange={noop} labels={ACTION_LABELS} />)
    expect(invite).toContain("group invites")
  })

  test("an empty link is only called out once the host asks", () => {
    const quiet = renderToStaticMarkup(<ActionEditorView value={{ label: "apply_now", url: "" }} onChange={noop} labels={ACTION_LABELS} />)
    expect(quiet).not.toContain("data-action-url-problem")
    const loud = renderToStaticMarkup(<ActionEditorView value={{ label: "apply_now", url: "" }} onChange={noop} labels={ACTION_LABELS} showErrors />)
    expect(loud).toContain("Add the link people should open.")
  })

  test("the author's blocked button is explained; not eligible lists what is missing", () => {
    const html = renderToStaticMarkup(
      <ActionEditorView
        value={draft}
        onChange={noop}
        labels={ACTION_LABELS}
        savedStatus="blocked"
        serverProblem={{ code: "ACTION_NOT_ELIGIBLE", message: "x", missing: ["account_age", "email_verified"] }}
      />,
    )
    expect(html).toContain("Link blocked: unsafe")
    expect(html).toContain("You can&#x27;t add an action button yet:")
    expect(html).toContain("<li>Your account must be at least 7 days old.</li>")
    expect(html).toContain("<li>Verify your email address.</li>")
  })

  test("the collapsed row's summary", () => {
    expect(actionSummary(null, ACTION_LABELS)).toBe("Add a button that opens a website")
    expect(actionSummary(draft, ACTION_LABELS)).toBe("Apply now · epfindia.gov.in")
    expect(actionSummary({ label: "apply_now", url: "nope" }, ACTION_LABELS)).toBe("Apply now")
  })
})

/* ── /l/<id> ────────────────────────────────────────────────────── */

describe("the leaving page", () => {
  test("the domain, Continue and Go back", () => {
    const html = renderToStaticMarkup(<LeavingCard domain="epfindia.gov.in" onContinue={() => {}} />)
    expect(html).toContain("You&#x27;re leaving VChat")
    expect(html).toContain("epfindia.gov.in")
    expect(html).toContain("Continue")
    expect(html).toContain("Go back")
  })

  test("a link that is gone says so", () => {
    expect(renderToStaticMarkup(<LinkGone />)).toContain("This link is no longer available")
  })
})

/* ── the post composer ──────────────────────────────────────────── */

describe("post composer", () => {
  const input = (action: typeof draft | null | undefined) => ({ text: "hello", details: { ...emptyDetails("en"), ...(action !== undefined ? { action } : {}) }, media: [], extras: { contentType: "post" as const } })

  test("create: action only when there is one; link_url stays its own field", () => {
    expect(buildCreateRequest(input(draft)).action).toEqual(draft)
    expect("action" in buildCreateRequest(input(null))).toBe(false)
    expect("action" in buildCreateRequest(input(undefined))).toBe(false)
    const both = buildCreateRequest({ ...input(draft), details: { ...input(draft).details, link: "https://example.com/" } })
    expect(both.link_url).toBe("https://example.com/")
    expect(both.action).toEqual(draft)
  })

  test("draft: the payload carries it and it reads back into the form", () => {
    const req = buildDraftRequest(input(draft))
    expect(req.payload.action).toEqual(draft)
    expect("action" in buildDraftRequest(input(null)).payload).toBe(false)
    const row = toDraftRow({ id: "d1", post_type: "post", status: "draft", payload: JSON.parse(JSON.stringify(req.payload)) })!
    expect(draftToCompose(row, "en").details.action).toEqual(draft)
    const none = toDraftRow({ id: "d2", post_type: "post", status: "draft", payload: { text: "x" } })!
    expect("action" in draftToCompose(none, "en").details).toBe(false)
  })

  test("a bad link holds the post back; the server's refusal reads in our words", () => {
    expect(detailsProblem({ ...emptyDetails("en"), action: { label: "apply_now", url: "https://bit.ly/x" } })).toBe(actionErrorMessage("ACTION_LINK_SHORTENER"))
    expect(detailsProblem({ ...emptyDetails("en"), action: draft })).toBeNull()
    const err = { response: { status: 403, data: { error: { code: "ACTION_NOT_ELIGIBLE", message: "no", details: { missing: ["no_active_strikes"] } } } } }
    expect(refusalCopy("ACTION_NOT_ELIGIBLE", "no", "fallback", err)).toBe("You can't add an action button yet. You can't have an active strike on your account.")
    expect(refusalCopy("ACTION_LINK_UNSAFE", "unsafe", "fallback")).toBe(actionErrorMessage("ACTION_LINK_UNSAFE"))
    expect(refusalCopy("TITLE_TOO_LONG", null, "fallback")).toContain("title")
  })
})

/* ── the upload studio (long videos and reels) ──────────────────── */

describe("upload studio", () => {
  const form = (action: typeof draft | null) => ({ ...INITIAL_FORM_STATE, contentType: "reel" as const, title: "t", action })

  test("create and draft save", () => {
    expect(studioCreateFields(form(draft)).action).toEqual(draft)
    expect("action" in studioCreateFields(form(null))).toBe(false)
    expect(studioDraftActionField(form(draft))).toEqual({ action: draft })
    expect(studioDraftActionField(form(null))).toEqual({ action: null })
  })

  test("Publish waits for a usable link", () => {
    const errors = getStepErrors("publish", { ...form({ label: "apply_now", url: "https://tinyurl.com/x" }), videoFile: new File(["x"], "a.mp4") })
    expect(errors.find((e) => e.field === "action")?.message).toBe(actionErrorMessage("ACTION_LINK_SHORTENER"))
    expect(getStepErrors("publish", { ...form(draft), videoFile: new File(["x"], "a.mp4") }).some((e) => e.field === "action")).toBe(false)
  })

  test("a refused publish names what is missing", () => {
    expect(publishFailure(axiosError(403, { code: "ACTION_NOT_ELIGIBLE", details: { missing: ["email_verified"] } }))).toEqual({
      code: "ACTION_NOT_ELIGIBLE",
      message: "You can't add an action button yet. Verify your email address.",
    })
    expect(publishFailure(axiosError(400, { code: "ACTION_LINK_GROUP_INVITE", message: "group invite" }))?.message).toBe(actionErrorMessage("ACTION_LINK_GROUP_INVITE"))
  })
})

/* ── Creator Hub, reels, watch, channel decoders ────────────────── */

describe("decoders on every surface", () => {
  test("Hub detail and library rows: the author's copy; absent stays absent", () => {
    const row = { id: POST, title: "t", text: "", content_type: "long_video", visibility: "public" }
    expect(normalizePostDetail({ ...row, action: { ...authorWire, status: "blocked" } })?.action).toMatchObject({ status: "blocked", url: authorWire.url })
    expect(normalizePostDetail(row)).not.toHaveProperty("action")
    expect(normalizePostDetail({ ...row, action: null })).not.toHaveProperty("action")
    expect(normalizeLibraryRow({ ...row, action: viewerWire })?.action?.href).toBe(`/l/${ID}`)
    expect(normalizeLibraryRow(row)).not.toHaveProperty("action")
  })

  test("Hub PATCH: null removes (the key is kept), undefined is left off", () => {
    expect(postPatchBody({ title: "x", action: null })).toEqual({ title: "x", action: null })
    expect(postPatchBody({ title: "x", action: undefined })).toEqual({ title: "x" })
    expect(postPatchBody({ action: draft })).toEqual({ action: draft })
  })

  test("a reel row carries it; a locked reel never does", () => {
    const reel = {
      id: POST,
      author_id: "u1",
      content_type: "flick",
      media: [{ media_id: "m1", kind: "video", duration_ms: 20_000, width: 1080, height: 1920 }],
      action: viewerWire,
    }
    expect(toReelItem(reel)?.action?.labelText).toBe("Apply now")
    expect(toReelItem({ ...reel, action: undefined })).not.toHaveProperty("action")
    const locked = toReelItem({ ...reel, tier_required_id: "t1", body_redacted: true, media: [] })
    expect(locked?.locked).toBeTruthy()
    expect(locked).not.toHaveProperty("action")
  })

  test("a channel carries the profile button", () => {
    expect(normalizeChannel({ user_id: "u1", name: "Raghu", action: viewerWire })?.action?.href).toBe(`/l/${ID}`)
    expect(normalizeChannel({ user_id: "u1", name: "Raghu" })).not.toHaveProperty("action")
  })
})

/* ── reports ────────────────────────────────────────────────────── */

describe("reports", () => {
  test("posts and profiles offer Fake job or scam link; comments do not", () => {
    expect(REPORT_REASONS.find((r) => r.value === "scam_link")?.label).toBe("Fake job or scam link")
    expect(REPORT_REASONS[REPORT_REASONS.length - 1].value).toBe("other")
    expect(COMMENT_REPORT_REASONS.some((r) => r.value === "scam_link")).toBe(false)
    expect(COMMENT_REPORT_REASONS).toHaveLength(REPORT_REASONS.length - 1)
  })

  test("the wire: reason scam_link on a post (reels too) and on a profile", () => {
    expect(reportRequestBody({ targetType: "reel", targetId: POST, reason: "scam_link" })).toEqual({ entity_type: "post", entity_id: POST, reason: "scam_link", details: "" })
    expect(reportRequestBody({ targetType: "user", targetId: "u1", reason: "scam_link", description: "fake job" })).toEqual({ entity_type: "user", entity_id: "u1", reason: "scam_link", details: "fake job" })
  })
})

/* ── Branding ───────────────────────────────────────────────────── */

describe("Branding", () => {
  test("an Action button section after Links, in the nav", () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(["identity", "links", "action", "featured", "feed"])
    const noop = () => undefined
    const html = renderToStaticMarkup(
      <BrandingScreen
        kind="loaded"
        activeSection="identity"
        identity={{
          draft: { name: "Raghu", handle: "raghu", about: "", avatar_media_id: null, banner_media_id: null, links: [], contact_email: "", featured_post_id: null },
          errors: {},
          uploading: { avatar: false, banner: false },
          availability: { state: "idle" },
          nameAvailability: { state: "idle" },
          onChange: noop,
          onPickAvatar: noop,
          onRemoveAvatar: noop,
          onPickBanner: noop,
          onRemoveBanner: noop,
        }}
        links={{ links: [], contactEmail: "", errors: {}, onLinkChange: noop, onAddLink: noop, onRemoveLink: noop, onMoveLink: noop, onContactEmailChange: noop }}
        featured={{ selectedId: null, selected: null, videos: [], query: "", onQuery: noop, loading: false, hasMore: false, onMore: noop, onSelect: noop }}
        feed={{ feedUrl: "", podcastsUrl: "", hasHandle: true, copied: null, onCopy: noop }}
        save={{ dirty: false, saving: false, changeCount: 0, errorCount: 0, onSave: noop, onReset: noop }}
        actionButton={<ActionEditorView value={null} onChange={noop} labels={ACTION_LABELS} surface="profile" />}
      />,
    )
    expect(html).toContain('href="#action"')
    expect(html).toContain('id="action"')
    expect(html.indexOf('id="links"')).toBeLessThan(html.indexOf('id="action"'))
    expect(html.indexOf('id="action"')).toBeLessThan(html.indexOf('id="featured"'))
    expect(html).toContain("next to Follow and Message")
  })
})

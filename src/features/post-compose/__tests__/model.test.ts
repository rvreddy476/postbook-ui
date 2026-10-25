import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  AUDIENCE_OPTIONS,
  audienceRowLabel,
  buildCreateRequest,
  buildDraftRequest,
  captionTags,
  clampCover,
  commentAccessFor,
  coverAfterRemove,
  createAttemptKeys,
  defaultLanguage,
  detailsProblem,
  draftBlockReason,
  emptyDetails,
  firstWords,
  insertHashMark,
  insertMention,
  languageName,
  linkProblem,
  normalizeLink,
  POST_LANGUAGES,
  refusalCopy,
  relativeTime,
  remixSettingFor,
  requestTags,
  type ComposeInput,
  type UploadedMedia,
} from "../model"

const photos = (n: number): UploadedMedia[] => Array.from({ length: n }, (_, i) => ({ mediaId: `m${i}`, kind: "image" as const }))
const input = (over: Partial<ComposeInput> = {}): ComposeInput => ({
  text: "hello",
  details: emptyDetails("en"),
  media: [],
  extras: { contentType: "post" },
  ...over,
})

describe("who can view", () => {
  test("the sheet offers Everyone, Followers, Friends and Only you, with the wire values", () => {
    expect(AUDIENCE_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["public", "Everyone"],
      ["followers", "Followers"],
      ["friends", "Friends"],
      ["private", "Only you"],
    ])
    expect(AUDIENCE_OPTIONS.find((o) => o.value === "friends")?.detail).toBe("Followers you follow back")
    expect(audienceRowLabel("public")).toBe("Everyone can view this post")
    expect(audienceRowLabel("friends")).toBe("Friends can view this post")
    expect(audienceRowLabel("private")).toBe("Only you can view this post")
  })

  test("friends reaches the create request and the draft", () => {
    const details = { ...emptyDetails("en"), visibility: "friends" as const }
    expect(buildCreateRequest(input({ details })).visibility).toBe("friends")
    expect(buildDraftRequest(input({ details })).payload.visibility).toBe("friends")
    const priv = { ...emptyDetails("en"), visibility: "private" as const }
    expect(buildCreateRequest(input({ details: priv })).visibility).toBe("private")
  })
})

describe("add link", () => {
  test.each([
    ["https://example.com/a", "https://example.com/a"],
    ["  https://example.com  ", "https://example.com"],
    ["HTTPS://Example.com/x", "HTTPS://Example.com/x"],
    ["http://example.com", null],
    ["javascript:alert(1)", null],
    ["data:text/html,hi", null],
    ["example.com", null],
    ["https://", null],
    ["https:example.com", null],
    ["https://bank.example@evil.example", null],
    ["https://exa mple.com", null],
    ["", null],
  ])("%p → %p", (raw, sent) => {
    expect(normalizeLink(raw)).toBe(sent)
  })

  test("at most 500 characters, and the field says why it will not send", () => {
    const long = `https://example.com/${"a".repeat(481)}`
    expect([...long].length).toBe(501)
    expect(normalizeLink(long)).toBeNull()
    expect(linkProblem(long)).toBe("A link can be at most 500 characters.")
    expect(normalizeLink(long.slice(0, 500))).not.toBeNull()
    expect(linkProblem("http://example.com")).toBe("Use a full https:// link.")
    expect(linkProblem("")).toBeNull()
    expect(linkProblem("https://example.com")).toBeNull()
  })

  test("only a link we may send goes on the wire; a bad one blocks Post", () => {
    const bad = { ...emptyDetails("en"), link: "http://example.com" }
    expect(buildCreateRequest(input({ details: bad }))).not.toHaveProperty("link_url")
    expect(detailsProblem(bad)).toBe("Use a full https:// link.")
    const good = { ...emptyDetails("en"), link: "https://example.com" }
    expect(buildCreateRequest(input({ details: good })).link_url).toBe("https://example.com")
    expect(detailsProblem(good)).toBeNull()
    expect(buildCreateRequest(input())).not.toHaveProperty("link_url")
  })
})

describe("hashtags and mentions", () => {
  test("read from the caption, lowercased tags, names keep case, each once", () => {
    expect(captionTags("Sunday #Food #food @Call.B. and @call.b, mail a@b.com #über_cool")).toEqual({
      hashtags: ["food", "über_cool"],
      mentions: ["Call.B"],
    })
  })

  test("capped as the server caps them; an over-long tag is dropped rather than refused", () => {
    const many = Array.from({ length: 40 }, (_, i) => `#t${i}`).join(" ")
    expect(captionTags(many).hashtags).toHaveLength(30)
    expect(captionTags(`#${"a".repeat(51)} #ok`).hashtags).toEqual(["ok"])
    const names = Array.from({ length: 25 }, (_, i) => `@n${i}`).join(" ")
    expect(captionTags(names).mentions).toHaveLength(20)
  })

  test("a draft's extra tags ride beside the caption's, deduped", () => {
    expect(requestTags("#food", { extraHashtags: ["Food", "market"], extraMentions: ["x"] })).toEqual({ hashtags: ["food", "market"], mentions: ["x"] })
  })

  test("none: the keys stay off the wire", () => {
    const body = buildCreateRequest(input({ text: "no tags here" }))
    expect(body).not.toHaveProperty("hashtags")
    expect(body).not.toHaveProperty("mentions")
  })

  test("# Hashtags puts a # at the caret, on a word boundary", () => {
    expect(insertHashMark("")).toEqual({ text: "#", caret: 1 })
    expect(insertHashMark("hello")).toEqual({ text: "hello #", caret: 7 })
    expect(insertHashMark("hello ")).toEqual({ text: "hello #", caret: 7 })
    expect(insertHashMark("ab cd", 2)).toEqual({ text: "ab # cd", caret: 4 })
  })

  test("a picked mention replaces the half-typed @name before the caret", () => {
    expect(insertMention("hi @ca", "call.b")).toEqual({ text: "hi @call.b ", caret: 11 })
    expect(insertMention("hi", "call.b")).toEqual({ text: "hi @call.b ", caret: 11 })
    expect(insertMention("", "@bee")).toEqual({ text: "@bee ", caret: 5 })
    expect(insertMention("x", "not valid!")).toEqual({ text: "x", caret: 1 })
  })
})

describe("cover", () => {
  test("a carousel sends its cover as an index and the id there; a single photo sends none", () => {
    const details = { ...emptyDetails("en"), coverIndex: 2 }
    const body = buildCreateRequest(input({ details, media: photos(3) }))
    expect(body.post_type).toBe("image")
    expect(body.cover_index).toBe(2)
    expect(body.cover_media_id).toBe("m2")
    const one = buildCreateRequest(input({ details: { ...details, coverIndex: 0 }, media: photos(1) }))
    expect(one.post_type).toBe("image")
    expect(one).not.toHaveProperty("cover_index")
    expect(one).not.toHaveProperty("cover_media_id")
  })

  test("a post with a video is not a photo post: no post_type image and no cover", () => {
    const body = buildCreateRequest(input({ media: [...photos(2), { mediaId: "v", kind: "video" }] }))
    expect(body).not.toHaveProperty("post_type")
    expect(body).not.toHaveProperty("cover_index")
  })

  test("an out-of-range cover falls to the first photo; removal keeps the cover on its photo", () => {
    expect(clampCover(5, 3)).toBe(0)
    expect(clampCover(1, 3)).toBe(1)
    expect(coverAfterRemove(2, 0)).toBe(1)
    expect(coverAfterRemove(2, 2)).toBe(0)
    expect(coverAfterRemove(1, 3)).toBe(1)
  })
})

describe("More options", () => {
  test("Allow comments: off is nobody (and no_comments), on is everyone", () => {
    const off = buildCreateRequest(input({ details: { ...emptyDetails("en"), commentAccess: commentAccessFor(false) } }))
    expect(off.comment_access).toBe("nobody")
    expect(off.no_comments).toBe(true)
    const on = buildCreateRequest(input({ details: { ...emptyDetails("en"), commentAccess: commentAccessFor(true) } }))
    expect(on.comment_access).toBe("everyone")
    expect(on.no_comments).toBe(false)
  })

  test("Allow reuse: remix_setting allow / disallow", () => {
    expect(buildCreateRequest(input({ details: { ...emptyDetails("en"), remixSetting: remixSettingFor(false) } })).remix_setting).toBe("disallow")
    expect(buildCreateRequest(input()).remix_setting).toBe("allow")
  })

  test("disclosure and AI label go as paid_promotion / is_branded / ai_generated", () => {
    const body = buildCreateRequest(input({ details: { ...emptyDetails("en"), paidPromotion: true, isBranded: true, aiGenerated: true } }))
    expect([body.paid_promotion, body.is_branded, body.ai_generated]).toEqual([true, true, true])
  })

  test("alt texts: on the draft as alt_texts by media id; never on the create body", () => {
    const media = [{ mediaId: "a", kind: "image" as const, altText: "  A dog  " }, { mediaId: "b", kind: "image" as const, altText: "" }]
    expect(buildDraftRequest(input({ media })).payload.alt_texts).toEqual({ a: "A dog" })
    expect(buildCreateRequest(input({ media }))).not.toHaveProperty("alt_texts")
  })
})

describe("language", () => {
  test("listed by name with the native name as a hint; the code is what is sent", () => {
    expect(POST_LANGUAGES.map((l) => l.name)).toEqual([
      "English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Odia",
      "Assamese", "Urdu", "Arabic", "Spanish", "French", "German", "Portuguese", "Indonesian", "Japanese", "Korean", "Chinese",
    ])
    expect(POST_LANGUAGES.find((l) => l.code === "te")?.native).toBe("తెలుగు")
    expect(buildCreateRequest(input({ details: emptyDetails("te") })).language).toBe("te")
  })

  test("the default is the browser's base language when we list it, else English", () => {
    expect(defaultLanguage("te-IN")).toBe("te")
    expect(defaultLanguage("en-GB")).toBe("en")
    expect(defaultLanguage("sv-SE")).toBe("en")
    expect(defaultLanguage("")).toBe("en")
  })

  test("a name is shown, never the raw code", () => {
    expect(languageName("hi")).toBe("Hindi")
    expect(languageName("en-IN")).toBe("English")
    expect(languageName("sv")).toBe("Swedish")
    expect(languageName("")).toBe("Not set")
    expect(languageName("zz-not-a-thing")).not.toBe("zz-not-a-thing")
  })
})

describe("drafts", () => {
  test("a video or a journal entry cannot be a draft; photos and text can", () => {
    expect(draftBlockReason([{ kind: "image" }, { kind: "video" }])).toContain("Remove the video")
    expect(draftBlockReason([], { journal: true })).toContain("Journal")
    expect(draftBlockReason([{ kind: "image" }])).toBeNull()
  })

  test("a poll is a 'poll' draft carrying its poll", () => {
    const poll = { question: "Tea or coffee?", options: ["Tea", "Coffee"], allows_multiple: false, duration_hours: 24 }
    const req = buildDraftRequest(input({ extras: { contentType: "poll", poll } }))
    expect(req.post_type).toBe("poll")
    expect(req.payload.poll).toEqual(poll)
    expect(req.payload.content_type).toBe("poll")
  })

  test("relative times and first words for the list", () => {
    const now = Date.parse("2026-10-19T12:00:00Z")
    expect(relativeTime("2026-10-19T11:59:30Z", now)).toBe("Just now")
    expect(relativeTime("2026-10-19T11:55:00Z", now)).toBe("5 min ago")
    expect(relativeTime("2026-10-19T09:00:00Z", now)).toBe("3 h ago")
    expect(relativeTime("2026-10-18T09:00:00Z", now)).toBe("Yesterday")
    expect(relativeTime("2026-10-15T09:00:00Z", now)).toBe("4 days ago")
    expect(relativeTime("nope", now)).toBe("")
    expect(firstWords("one two three", 60)).toBe("one two three")
    expect(firstWords("alpha beta gamma delta epsilon", 20)).toBe("alpha beta gamma…")
  })
})

describe("one Idempotency-Key per publish attempt", () => {
  test("the same request keeps its key across retries; an edited one gets a new key; a sent one starts over", () => {
    let n = 0
    const keys = createAttemptKeys(() => `k${(n += 1)}`)
    const a = keys.keyFor('{"text":"a"}')
    expect(keys.keyFor('{"text":"a"}')).toBe(a)
    expect(keys.keyFor('{"text":"a"}')).toBe(a)
    const b = keys.keyFor('{"text":"b"}')
    expect(b).not.toBe(a)
    keys.reset()
    expect(keys.keyFor('{"text":"b"}')).not.toBe(b)
  })

  test("the create mutation takes the caller's key and never mints one per attempt", () => {
    const src = readFileSync(resolve(import.meta.dir, "../hooks.ts"), "utf8")
    const api = readFileSync(resolve(import.meta.dir, "../api.ts"), "utf8")
    expect(src).toContain("mutationFn: ({ body, idempotencyKey }: CreatePostVariables) => createPost(body, idempotencyKey)")
    expect(src).not.toContain("randomUUID")
    expect(api).not.toContain("randomUUID")
    expect(api).toContain('headers: { "Idempotency-Key": idempotencyKey }')
  })
})

describe("refusals", () => {
  test("known codes in our words, else the server's message, else the fallback", () => {
    expect(refusalCopy("INVALID_LINK_URL", "link_url must be…", "x")).toBe("Use a full https:// link.")
    expect(refusalCopy("INVALID_DRAFT", "invalid hashtag \"#!\"", "x")).toBe("invalid hashtag \"#!\"")
    expect(refusalCopy(null, null, "Try again.")).toBe("Try again.")
  })
})

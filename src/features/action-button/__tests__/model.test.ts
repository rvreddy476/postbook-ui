import { describe, expect, test } from "bun:test"

import {
  ACTION_ERROR_CODES,
  ACTION_LABELS,
  SHORTENER_HOSTS,
  actionCreateFields,
  actionErrorMessage,
  actionPatchFields,
  actionPatchValue,
  actionProblemFromError,
  checkActionUrl,
  decodeAction,
  draftFromAction,
  draftFromWire,
  draftProblem,
  labelText,
  missingSentences,
  pillText,
  statusExplanation,
  tapsText,
  toActionLabels,
  toActionStats,
  visibleAction,
  type ActionErrorCode,
} from "../model"
import { MAX_SEEN_DOMAINS, SEEN_DOMAINS_KEY, continueTo, decideLinkVisit, decodeLink, normalizeDomain, safeTarget, seenDomains, type StorageLike } from "../links"

const ID = "0f8a2c10-1111-4a3b-9c00-000000000001"

/* ── URL checks ─────────────────────────────────────────────────── */

const codeOf = (url: string) => {
  const r = checkActionUrl(url)
  return r.ok ? "OK" : r.code
}

describe("checkActionUrl: the server's rules", () => {
  test("a plain https link passes, and its domain drops www", () => {
    const r = checkActionUrl("  https://www.epfindia.gov.in/site_en/index.php?x=1  ")
    expect(r).toEqual({ ok: true, url: "https://www.epfindia.gov.in/site_en/index.php?x=1", domain: "epfindia.gov.in" })
  })

  test("https only", () => {
    expect(codeOf("http://example.com")).toBe("INVALID_ACTION_URL")
    expect(codeOf("ftp://example.com")).toBe("INVALID_ACTION_URL")
    expect(codeOf("javascript:alert(1)")).toBe("INVALID_ACTION_URL")
    expect(codeOf("example.com")).toBe("INVALID_ACTION_URL")
    expect(codeOf("HTTPS://Example.com/Path")).toBe("OK")
    // The words say what to fix, not that the text failed to parse.
    for (const url of ["example.com", "http://example.com", "www.example.com/jobs"]) {
      const r = checkActionUrl(url)
      expect(r.ok ? "" : r.message).toBe("Use a full link that starts with https://")
    }
  })

  test("each host refusal says its own reason", () => {
    const message = (url: string) => {
      const r = checkActionUrl(url)
      return r.ok ? "" : r.message
    }
    expect(message("https://127.0.0.1/")).toBe("Use the website's name, not a number address.")
    expect(message("https://[::1]/")).toBe("Use the website's name, not a number address.")
    expect(message("https://localhost/")).toBe("That link only works on your own computer.")
    expect(message("https://intranet/")).toBe("That link has no website in it.")
  })

  test("empty, spaces and control characters are refused", () => {
    expect(codeOf("")).toBe("INVALID_ACTION_URL")
    expect(codeOf("   ")).toBe("INVALID_ACTION_URL")
    expect(codeOf("https://exa mple.com")).toBe("INVALID_ACTION_URL")
    expect(codeOf("https://example.com/\u0007")).toBe("INVALID_ACTION_URL")
  })

  test("at most 500 characters", () => {
    const base = "https://example.com/"
    expect(codeOf(base + "a".repeat(500 - base.length))).toBe("OK")
    expect(codeOf(base + "a".repeat(501 - base.length))).toBe("INVALID_ACTION_URL")
  })

  test("a real host: no IP literal, no localhost, no dotless name", () => {
    expect(codeOf("https://127.0.0.1/x")).toBe("INVALID_ACTION_URL")
    expect(codeOf("https://10.0.0.5")).toBe("INVALID_ACTION_URL")
    // WHATWG folds odd IPv4 spellings into dotted form; still a number address.
    expect(codeOf("https://0x7f.1/")).toBe("INVALID_ACTION_URL")
    expect(codeOf("https://[::1]/")).toBe("INVALID_ACTION_URL")
    expect(codeOf("https://[2001:db8::1]:443/")).toBe("INVALID_ACTION_URL")
    expect(codeOf("https://localhost/")).toBe("INVALID_ACTION_URL")
    expect(codeOf("https://LOCALHOST./")).toBe("INVALID_ACTION_URL")
    expect(codeOf("https://app.localhost/")).toBe("INVALID_ACTION_URL")
    expect(codeOf("https://intranet/")).toBe("INVALID_ACTION_URL")
  })

  test("no user info", () => {
    expect(codeOf("https://user@example.com")).toBe("INVALID_ACTION_URL")
    expect(codeOf("https://user:pass@example.com")).toBe("INVALID_ACTION_URL")
    expect(codeOf("https://@example.com")).toBe("INVALID_ACTION_URL")
    expect(codeOf("https://google.com@evil.example/")).toBe("INVALID_ACTION_URL")
    // An @ after the host (a path or a query) is not user info.
    expect(codeOf("https://example.com/people/@raghu")).toBe("OK")
  })

  test("port 443 or none", () => {
    expect(codeOf("https://example.com:443/x")).toBe("OK")
    expect(codeOf("https://example.com:8443/x")).toBe("INVALID_ACTION_URL")
    expect(codeOf("https://example.com:80/")).toBe("INVALID_ACTION_URL")
  })

  test("every listed shortener is refused, a subdomain of one too, and nothing that merely looks alike", () => {
    expect(SHORTENER_HOSTS).toHaveLength(15)
    for (const host of SHORTENER_HOSTS) {
      expect(codeOf(`https://${host}/abc`)).toBe("ACTION_LINK_SHORTENER")
      expect(codeOf(`https://www.${host}/abc`)).toBe("ACTION_LINK_SHORTENER")
      expect(codeOf(`https://${host.toUpperCase()}/abc`)).toBe("ACTION_LINK_SHORTENER")
    }
    expect(codeOf("https://notbit.ly/abc")).toBe("OK")
    expect(codeOf("https://bit.ly.example.com/abc")).toBe("OK")
    expect(codeOf("https://t.com/abc")).toBe("OK")
  })

  test("WhatsApp and Telegram group invites are refused", () => {
    expect(codeOf("https://chat.whatsapp.com/AbCdEf123")).toBe("ACTION_LINK_GROUP_INVITE")
    expect(codeOf("https://chat.whatsapp.com/")).toBe("ACTION_LINK_GROUP_INVITE")
    expect(codeOf("https://t.me/+AbCdEf123")).toBe("ACTION_LINK_GROUP_INVITE")
    expect(codeOf("https://t.me/%2BAbCdEf123")).toBe("ACTION_LINK_GROUP_INVITE")
    expect(codeOf("https://t.me/joinchat/AbCdEf123")).toBe("ACTION_LINK_GROUP_INVITE")
    expect(codeOf("https://t.me/JoinChat/AbCdEf123")).toBe("ACTION_LINK_GROUP_INVITE")
    expect(codeOf("https://www.t.me/+AbC")).toBe("ACTION_LINK_GROUP_INVITE")
    expect(codeOf("https://telegram.me/joinchat/AbCdEf123")).toBe("ACTION_LINK_GROUP_INVITE")
  })

  test("wa.me to a number, other t.me links and our own domains are allowed", () => {
    expect(checkActionUrl("https://wa.me/919876543210")).toEqual({ ok: true, url: "https://wa.me/919876543210", domain: "wa.me" })
    expect(codeOf("https://wa.me/919876543210?text=Hi")).toBe("OK")
    expect(codeOf("https://api.whatsapp.com/send?phone=919876543210")).toBe("OK")
    expect(codeOf("https://t.me/vchat_jobs")).toBe("OK")
    expect(codeOf("https://telegram.me/vchat_jobs")).toBe("OK")
    expect(codeOf("https://cleestudio.com/post/abc")).toBe("OK")
  })

  test("a refusal carries the code's sentence for the two blocklists", () => {
    const short = checkActionUrl("https://bit.ly/x")
    expect(short.ok ? "" : short.message).toBe(actionErrorMessage("ACTION_LINK_SHORTENER"))
    const invite = checkActionUrl("https://chat.whatsapp.com/x")
    expect(invite.ok ? "" : invite.message).toBe(actionErrorMessage("ACTION_LINK_GROUP_INVITE"))
  })
})

/* ── labels ─────────────────────────────────────────────────────── */

describe("labels", () => {
  test("the contract's eleven, in its order", () => {
    expect(ACTION_LABELS.map((l) => l.value)).toEqual(["apply_now", "learn_more", "sign_up", "register", "book_now", "shop_now", "order_now", "download", "contact_us", "visit_website", "watch_more"])
    expect(ACTION_LABELS.find((l) => l.value === "apply_now")?.label).toBe("Apply now")
  })

  test("the server's list wins; an envelope, a bare array, a missing label; nothing usable falls back", () => {
    expect(toActionLabels({ data: [{ value: "apply_now", label: "Apply now" }, { value: "book_now", label: "Book now" }] })).toEqual([
      { value: "apply_now", label: "Apply now" },
      { value: "book_now", label: "Book now" },
    ])
    expect(toActionLabels([{ value: "shop_now" }, { value: "" }, { label: "x" }, { value: "shop_now", label: "dup" }])).toEqual([{ value: "shop_now", label: "Shop now" }])
    expect(toActionLabels(null)).toEqual([...ACTION_LABELS])
    expect(toActionLabels({ data: [] })).toEqual([...ACTION_LABELS])
    expect(toActionLabels("nonsense")).toEqual([...ACTION_LABELS])
  })

  test("labelText reads an unknown value as words", () => {
    expect(labelText("contact_us")).toBe("Contact us")
    expect(labelText("join_waitlist")).toBe("Join waitlist")
  })
})

/* ── the read decoder ───────────────────────────────────────────── */

const wire = { id: ID, label: "apply_now", label_text: "Apply now", domain: "epfindia.gov.in", href: `/l/${ID}` }

describe("decodeAction", () => {
  test("absent, null and junk are no button", () => {
    for (const raw of [undefined, null, "", 0, true, [], "apply_now", {}, { id: ID }, { label: "apply_now" }, { id: "", label: "apply_now" }, { id: ID, label: "  " }]) {
      expect(decodeAction(raw)).toBeNull()
    }
  })

  test("a viewer's row", () => {
    expect(decodeAction(wire)).toEqual({ id: ID, label: "apply_now", labelText: "Apply now", domain: "epfindia.gov.in", href: `/l/${ID}`, status: "active", url: null })
  })

  test("href is only ever one of our /l/ paths; the raw url is never a link target", () => {
    const evil = decodeAction({ ...wire, href: "https://evil.example/x", url: "https://evil.example/x" })
    expect(evil?.href).toBe(`/l/${ID}`)
    expect(decodeAction({ ...wire, href: "javascript:alert(1)" })?.href).toBe(`/l/${ID}`)
    expect(decodeAction({ ...wire, href: "//evil.example" })?.href).toBe(`/l/${ID}`)
    expect(decodeAction({ ...wire, href: "/l/a/../../x" })?.href).toBe(`/l/${ID}`)
    expect(decodeAction({ ...wire, href: "" })?.href).toBe(`/l/${ID}`)
    expect(decodeAction({ ...wire, href: undefined, id: "a b" })?.href).toBe("/l/a%20b")
  })

  test("Go zero values fall through: label_text and domain", () => {
    const a = decodeAction({ id: ID, label: "book_now", label_text: "", domain: "", url: "https://www.Shop.example.com/x", href: `/l/${ID}` })
    expect(a?.labelText).toBe("Book now")
    expect(a?.domain).toBe("shop.example.com")
    expect(decodeAction({ id: ID, label: "book_now" })?.domain).toBe("")
  })

  test("the author's copy: the url and the status", () => {
    expect(decodeAction({ ...wire, url: "https://epfindia.gov.in/", status: "blocked" })).toMatchObject({ status: "blocked", url: "https://epfindia.gov.in/" })
    expect(decodeAction({ ...wire, status: "under_review" })?.status).toBe("under_review")
    expect(decodeAction({ ...wire, status: "ACTIVE" })?.status).toBe("active")
    expect(decodeAction({ ...wire, status: "" })?.status).toBe("active")
    // A status this build does not know is not live (fail closed).
    expect(decodeAction({ ...wire, status: "quarantined" })?.status).toBe("under_review")
  })

  test("who sees it: a viewer only a live one, the author theirs whatever its status, nobody on a locked post", () => {
    const live = decodeAction(wire)
    const blocked = decodeAction({ ...wire, status: "blocked" })
    expect(visibleAction(live, { isAuthor: false })).toBe(live)
    expect(visibleAction(blocked, { isAuthor: false })).toBeNull()
    expect(visibleAction(blocked, { isAuthor: true })).toBe(blocked)
    expect(visibleAction(live, { isAuthor: false, locked: true })).toBeNull()
    expect(visibleAction(null, { isAuthor: true })).toBeNull()
  })

  test("the pill's words and the author's explanations", () => {
    expect(pillText({ labelText: "Apply now", domain: "epfindia.gov.in" })).toBe("Apply now · epfindia.gov.in")
    expect(pillText({ labelText: "Apply now", domain: "" })).toBe("Apply now")
    expect(statusExplanation("active")).toBeNull()
    expect(statusExplanation("blocked")?.title).toBe("Link blocked: unsafe")
    expect(statusExplanation("under_review")?.title).toBe("Link under review")
  })
})

/* ── request builders ───────────────────────────────────────────── */

describe("request builders", () => {
  const a = { label: "apply_now", url: "https://epfindia.gov.in/" }

  test("create: the key only when there is a button; the url trimmed", () => {
    expect(actionCreateFields(null)).toEqual({})
    expect(actionCreateFields(undefined)).toEqual({})
    expect("action" in actionCreateFields(null)).toBe(false)
    expect(actionCreateFields({ label: "apply_now", url: "  https://epfindia.gov.in/  " })).toEqual({ action: a })
  })

  test("edit: omitted = unchanged, null removes, an object adds or changes", () => {
    expect(actionPatchValue(null, null)).toBeUndefined()
    expect(actionPatchValue(undefined, undefined)).toBeUndefined()
    expect(actionPatchValue(a, a)).toBeUndefined()
    expect(actionPatchValue(a, { ...a, url: ` ${a.url} ` })).toBeUndefined()
    expect(actionPatchValue(a, null)).toBeNull()
    expect(actionPatchValue(null, a)).toEqual(a)
    expect(actionPatchValue(a, { ...a, label: "learn_more" })).toEqual({ ...a, label: "learn_more" })
    expect(actionPatchValue(a, { ...a, url: "https://epfindia.gov.in/jobs" })).toEqual({ ...a, url: "https://epfindia.gov.in/jobs" })
  })

  test("edit, as a body: no key when unchanged, action:null to remove", () => {
    expect(actionPatchFields(a, a)).toEqual({})
    expect("action" in actionPatchFields(a, a)).toBe(false)
    expect(actionPatchFields(a, null)).toEqual({ action: null })
    expect(JSON.stringify({ title: "t", ...actionPatchFields(a, null) })).toBe('{"title":"t","action":null}')
  })

  test("the editor's start, and a draft read back", () => {
    expect(draftFromAction(null)).toBeNull()
    expect(draftFromAction(decodeAction({ ...wire, url: "https://x.example/" }))).toEqual({ label: "apply_now", url: "https://x.example/" })
    expect(draftFromAction(decodeAction(wire))).toEqual({ label: "apply_now", url: "" })
    expect(draftFromWire({ label: "apply_now", url: "https://x.example/" })).toEqual({ label: "apply_now", url: "https://x.example/" })
    expect(draftFromWire(null)).toBeNull()
    expect(draftFromWire({ url: "https://x.example/" })).toBeNull()
  })

  test("draftProblem: none is fine; a label and a link are needed; with a list the label must be on it", () => {
    expect(draftProblem(null)).toBeNull()
    expect(draftProblem(a)).toBeNull()
    expect(draftProblem({ label: "", url: a.url })).toBe(actionErrorMessage("INVALID_ACTION_LABEL"))
    expect(draftProblem({ label: "made_up", url: a.url })).toBeNull()
    expect(draftProblem({ label: "made_up", url: a.url }, ACTION_LABELS)).toBe(actionErrorMessage("INVALID_ACTION_LABEL"))
    expect(draftProblem({ label: "apply_now", url: "" })).toBe("Add the link people should open.")
    expect(draftProblem({ label: "apply_now", url: "https://bit.ly/x" })).toBe(actionErrorMessage("ACTION_LINK_SHORTENER"))
  })
})

/* ── errors ─────────────────────────────────────────────────────── */

const axiosError = (status: number, error: unknown, extra: Record<string, unknown> = {}) => ({ response: { status, data: { error, ...extra } } })

describe("the error map", () => {
  test("every contract code has its own sentence", () => {
    const codes: ActionErrorCode[] = ["INVALID_ACTION_LABEL", "INVALID_ACTION_URL", "ACTION_LINK_SHORTENER", "ACTION_LINK_GROUP_INVITE", "ACTION_LINK_UNSAFE", "ACTION_LINK_CHECK_UNAVAILABLE", "ACTION_NOT_ELIGIBLE"]
    expect([...ACTION_ERROR_CODES].sort()).toEqual([...codes].sort())
    const sentences = codes.map((c) => actionErrorMessage(c))
    for (const s of sentences) {
      expect(s.length).toBeGreaterThan(10)
      expect(s).toMatch(/[.]$/)
      expect(s).not.toMatch(/ACTION_|INVALID_/)
    }
    expect(new Set(sentences).size).toBe(codes.length)
  })

  test("not eligible names what is missing, each once; unknown names read as words", () => {
    expect(missingSentences(["account_age", "email_verified", "no_active_strikes"])).toEqual([
      "Your account must be at least 7 days old.",
      "Verify your email address.",
      "You can't have an active strike on your account.",
    ])
    expect(missingSentences(["email", "verified_email", "  "])).toEqual(["Verify your email address."])
    expect(missingSentences(["phone_verified"])).toEqual(["Phone verified."])
    expect(actionErrorMessage("ACTION_NOT_ELIGIBLE", ["email_verified"])).toBe("You can't add an action button yet. Verify your email address.")
    expect(actionErrorMessage("ACTION_NOT_ELIGIBLE")).toContain("7 days old")
  })

  test("off an axios error: the code, the sentence, details.missing", () => {
    const p = actionProblemFromError(axiosError(403, { code: "ACTION_NOT_ELIGIBLE", message: "not eligible", details: { missing: ["account_age"] } }))
    expect(p).toEqual({ code: "ACTION_NOT_ELIGIBLE", message: "You can't add an action button yet. Your account must be at least 7 days old.", missing: ["account_age"] })
    // details beside the error, and a bare string code
    expect(actionProblemFromError(axiosError(403, "ACTION_NOT_ELIGIBLE", { details: { missing: ["email_verified"] } }))?.missing).toEqual(["email_verified"])
    expect(actionProblemFromError(axiosError(400, { code: "ACTION_LINK_UNSAFE" }))?.message).toBe(actionErrorMessage("ACTION_LINK_UNSAFE"))
    expect(actionProblemFromError(axiosError(503, { code: "ACTION_LINK_CHECK_UNAVAILABLE" }))?.code).toBe("ACTION_LINK_CHECK_UNAVAILABLE")
  })

  test("anything else is not an action problem", () => {
    expect(actionProblemFromError(axiosError(400, { code: "TITLE_TOO_LONG" }))).toBeNull()
    expect(actionProblemFromError(new Error("Network Error"))).toBeNull()
    expect(actionProblemFromError(null)).toBeNull()
    expect(actionProblemFromError({ response: { data: "html" } })).toBeNull()
  })
})

/* ── stats ──────────────────────────────────────────────────────── */

describe("creator stats", () => {
  test("the envelope, zero values and junk", () => {
    expect(toActionStats({ data: { clicks_total: 1234, clicks_7d: 56 } })).toEqual({ clicksTotal: 1234, clicks7d: 56 })
    expect(toActionStats({ clicks_total: 1 })).toEqual({ clicksTotal: 1, clicks7d: 0 })
    expect(toActionStats(null)).toEqual({ clicksTotal: 0, clicks7d: 0 })
    expect(toActionStats({ data: { clicks_total: -3, clicks_7d: "9" } })).toEqual({ clicksTotal: 0, clicks7d: 0 })
  })

  test("the words", () => {
    expect(tapsText({ clicksTotal: 1, clicks7d: 0 })).toBe("1 tap")
    expect(tapsText({ clicksTotal: 0, clicks7d: 0 })).toBe("0 taps")
    expect(tapsText({ clicksTotal: 1234, clicks7d: 56 })).toBe("1,234 taps · 56 this week")
  })
})

/* ── /l/<id>: the link and the once-per-domain page ─────────────── */

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

const target = (url: string) => decodeLink({ data: { id: ID, url, domain: "ignored.example", label: "apply_now", status: "active" } })!

describe("decodeLink", () => {
  test("the target; the domain is the url's own host, not the field beside it", () => {
    expect(decodeLink({ data: { id: ID, url: "https://www.EPFIndia.gov.in/x", domain: "other.example", label: "apply_now", status: "active" } })).toEqual({
      id: ID,
      url: "https://www.epfindia.gov.in/x",
      domain: "epfindia.gov.in",
      label: "apply_now",
      status: "active",
    })
    expect(decodeLink({ id: ID, url: "https://a.example/" })?.status).toBe("active")
  })

  test("nothing to open: no id, not https, not active, junk", () => {
    expect(decodeLink({ data: { url: "https://a.example/" } })).toBeNull()
    expect(decodeLink({ data: { id: ID, url: "http://a.example/" } })).toBeNull()
    expect(decodeLink({ data: { id: ID, url: "javascript:alert(1)" } })).toBeNull()
    expect(decodeLink({ data: { id: ID, url: "https://a.example/", status: "blocked" } })).toBeNull()
    expect(decodeLink({ data: { id: ID, url: "https://a.example/", status: "under_review" } })).toBeNull()
    expect(decodeLink(null)).toBeNull()
    expect(decodeLink([])).toBeNull()
    expect(safeTarget("data:text/html,x")).toBeNull()
    expect(normalizeDomain(" WWW.Example.COM. ")).toBe("example.com")
  })
})

describe("the leaving page shows once per domain per browser", () => {
  test("first visit: the page; Continue remembers; the next link there redirects at once", () => {
    const store = memoryStorage()
    const seen = seenDomains(store)
    const first = target("https://epfindia.gov.in/jobs")
    expect(decideLinkVisit(first, seen)).toEqual({ kind: "interstitial", url: "https://epfindia.gov.in/jobs", domain: "epfindia.gov.in" })
    // Showing the page is not continuing: still the page.
    expect(decideLinkVisit(first, seen).kind).toBe("interstitial")
    expect(continueTo(first, seen)).toBe("https://epfindia.gov.in/jobs")
    expect(JSON.parse(store.data.get(SEEN_DOMAINS_KEY)!)).toEqual(["epfindia.gov.in"])
    expect(decideLinkVisit(target("https://www.epfindia.gov.in/other"), seen)).toEqual({ kind: "redirect", url: "https://www.epfindia.gov.in/other" })
    // A fresh reader over the same storage (a new page load) remembers too.
    expect(decideLinkVisit(first, seenDomains(store)).kind).toBe("redirect")
  })

  test("the memory compares hosts, not spellings", () => {
    const seen = seenDomains(memoryStorage())
    seen.add("WWW.EPFindia.gov.in.")
    expect(seen.has("epfindia.gov.in")).toBe(true)
    expect(seen.has("www.epfindia.gov.in")).toBe(true)
    expect(seen.has(" EPFINDIA.GOV.IN ")).toBe(true)
    expect(seen.has("")).toBe(false)
  })

  test("per domain: another site, and a subdomain, still get the page", () => {
    const seen = seenDomains(memoryStorage())
    continueTo(target("https://epfindia.gov.in/"), seen)
    expect(decideLinkVisit(target("https://naukri.example/"), seen).kind).toBe("interstitial")
    expect(decideLinkVisit(target("https://jobs.epfindia.gov.in/"), seen).kind).toBe("interstitial")
    expect(decideLinkVisit(target("https://epfindia.gov.in.evil.example/"), seen).kind).toBe("interstitial")
  })

  test("storage that throws or is missing: the page every time, never an error", () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error("SecurityError")
      },
      setItem: () => {
        throw new Error("QuotaExceededError")
      },
    }
    for (const storage of [throwing, null]) {
      const seen = seenDomains(storage)
      const t = target("https://epfindia.gov.in/")
      expect(() => continueTo(t, seen)).not.toThrow()
      expect(decideLinkVisit(t, seen).kind).toBe("interstitial")
    }
    const corrupt = memoryStorage()
    corrupt.data.set(SEEN_DOMAINS_KEY, "{not json")
    expect(decideLinkVisit(target("https://epfindia.gov.in/"), seenDomains(corrupt)).kind).toBe("interstitial")
    corrupt.data.set(SEEN_DOMAINS_KEY, JSON.stringify({ "epfindia.gov.in": true }))
    expect(decideLinkVisit(target("https://epfindia.gov.in/"), seenDomains(corrupt)).kind).toBe("interstitial")
  })

  test("the memory is bounded; the oldest fall off first, a revisit moves to the end", () => {
    const store = memoryStorage()
    const seen = seenDomains(store)
    for (let i = 0; i < MAX_SEEN_DOMAINS + 5; i++) seen.add(`site${i}.example`)
    const list = JSON.parse(store.data.get(SEEN_DOMAINS_KEY)!) as string[]
    expect(list).toHaveLength(MAX_SEEN_DOMAINS)
    expect(seen.has("site0.example")).toBe(false)
    expect(seen.has(`site${MAX_SEEN_DOMAINS + 4}.example`)).toBe(true)
    seen.add("site10.example")
    const after = JSON.parse(store.data.get(SEEN_DOMAINS_KEY)!) as string[]
    expect(after[after.length - 1]).toBe("site10.example")
    expect(after.filter((d) => d === "site10.example")).toHaveLength(1)
  })
})

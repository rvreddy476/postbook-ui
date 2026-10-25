/*
  The Action button, the pure half (contract pinned 23 Oct 2026,
  action-button-contract.md). No React, no requests: the label list, the
  URL rules the server enforces (mirrored here for instant feedback), the
  error words, the decoder for the `action` read shape and the request
  builders. The editor, the pills and the /l/<id> page read everything from
  here, and the tests pin it.

  Wire:
    GET   /v1/posts/action-labels          [{value,label}] (public)
    POST  /v1/posts                        "action": {label,url} (omitted = none)
    PATCH /v1/posts/:id                    "action": {label,url} | null (null removes, omitted = unchanged)
    PATCH /v1/reels/drafts/:id             the same "action" key
    POST|PATCH /v1/posts/drafts            payload.action {label,url}
    PATCH /v1/channels/me                  "action": {label,url} | null (the profile button)
    GET   /v1/links/:id                    {id,url,domain,label,status}; 404 when not active
    GET   /v1/posts/:id/action/stats       {clicks_total, clicks_7d} (author)

  Read shape on post rows, channels and profiles, when present and active:
    {id, label, label_text, domain, href: "/l/<id>"}
  The author also gets `url` and, when the link is not live, `status`
  ("blocked" | "under_review"). Viewers never get a blocked one. Clients
  link to `href` only, never to the raw url.

  Go sends zero values ("" / null) where a field is empty, so every decoder
  treats absent, null and "" alike.
*/

/* ── wire helpers ────────────────────────────────────────────────── */

type Wire = Record<string, unknown>

function obj(v: unknown): Wire | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Wire) : null
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

/** The `data` of a `{data, error, meta}` envelope, or the value itself. */
function unwrap(body: unknown): unknown {
  const o = obj(body)
  return o && "data" in o ? o.data : body
}

/* ── labels ──────────────────────────────────────────────────────── */

export interface ActionLabelOption {
  value: string
  label: string
}

/** The contract's fixed list, in its order: what the picker shows when the server's list cannot be read. */
export const ACTION_LABELS: readonly ActionLabelOption[] = [
  { value: "apply_now", label: "Apply now" },
  { value: "learn_more", label: "Learn more" },
  { value: "sign_up", label: "Sign up" },
  { value: "register", label: "Register" },
  { value: "book_now", label: "Book now" },
  { value: "shop_now", label: "Shop now" },
  { value: "order_now", label: "Order now" },
  { value: "download", label: "Download" },
  { value: "contact_us", label: "Contact us" },
  { value: "visit_website", label: "Visit website" },
  { value: "watch_more", label: "Watch more" },
]

/**
  GET /v1/posts/action-labels → the picker's options. A bare array or an
  envelope; rows without a value are dropped, a row without a label takes
  the fallback's words. Nothing usable → the contract's list.
*/
export function toActionLabels(body: unknown): ActionLabelOption[] {
  const raw = unwrap(body)
  const list = Array.isArray(raw) ? raw : []
  const out: ActionLabelOption[] = []
  const seen = new Set<string>()
  for (const row of list) {
    const o = obj(row)
    const value = str(o?.value)
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push({ value, label: str(o?.label) || labelText(value) })
  }
  return out.length > 0 ? out : [...ACTION_LABELS]
}

/** "apply_now" → "Apply now"; an unknown value reads as words rather than as a code. */
export function labelText(value: string, labels: readonly ActionLabelOption[] = ACTION_LABELS): string {
  const known = labels.find((l) => l.value === value) ?? ACTION_LABELS.find((l) => l.value === value)
  if (known) return known.label
  const words = value.replace(/[_-]+/g, " ").trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ""
}

/* ── URL rules (the server's, said before the request) ───────────── */

export const MAX_ACTION_URL_LENGTH = 500

/** Link shorteners: the server answers ACTION_LINK_SHORTENER. A subdomain of one counts too. */
export const SHORTENER_HOSTS: readonly string[] = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "cutt.ly",
  "rb.gy",
  "is.gd",
  "ow.ly",
  "shorturl.at",
  "tiny.cc",
  "rebrand.ly",
  "s.id",
  "t.ly",
  "bl.ink",
  "buff.ly",
]

export type ActionErrorCode =
  | "INVALID_ACTION_LABEL"
  | "INVALID_ACTION_URL"
  | "ACTION_LINK_SHORTENER"
  | "ACTION_LINK_GROUP_INVITE"
  | "ACTION_LINK_UNSAFE"
  | "ACTION_LINK_CHECK_UNAVAILABLE"
  | "ACTION_NOT_ELIGIBLE"

export const ACTION_ERROR_CODES: readonly ActionErrorCode[] = [
  "INVALID_ACTION_LABEL",
  "INVALID_ACTION_URL",
  "ACTION_LINK_SHORTENER",
  "ACTION_LINK_GROUP_INVITE",
  "ACTION_LINK_UNSAFE",
  "ACTION_LINK_CHECK_UNAVAILABLE",
  "ACTION_NOT_ELIGIBLE",
]

export function isActionErrorCode(code: unknown): code is ActionErrorCode {
  return typeof code === "string" && (ACTION_ERROR_CODES as readonly string[]).includes(code)
}

export type UrlCheck = { ok: true; url: string; domain: string } | { ok: false; code: ActionErrorCode; message: string }

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

function decodedPath(pathname: string): string {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

/** A WhatsApp or Telegram group invite (wa.me/<number> and other t.me links are fine). */
export function isGroupInvite(host: string, pathname: string): boolean {
  const path = decodedPath(pathname).toLowerCase()
  if (hostMatches(host, "chat.whatsapp.com")) return true
  if (host === "t.me" || host === "www.t.me") return path.startsWith("/+") || path.startsWith("/joinchat")
  if (host === "telegram.me" || host === "www.telegram.me") return path.startsWith("/joinchat")
  return false
}

function fail(code: ActionErrorCode, message: string): UrlCheck {
  return { ok: false, code, message }
}

/**
  The link as the server will take it, or why it will not. https only, at
  most 500 characters, a real host (no IP literal, no localhost, no
  user@), port 443 or none, no link shortener, no group invite. The safety
  lookup (ACTION_LINK_UNSAFE) is the server's alone.
*/
export function checkActionUrl(raw: string): UrlCheck {
  const value = raw.trim()
  if (!value) return fail("INVALID_ACTION_URL", "Add the link people should open.")
  if ([...value].length > MAX_ACTION_URL_LENGTH) return fail("INVALID_ACTION_URL", `A link can be at most ${MAX_ACTION_URL_LENGTH} characters.`)
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f-\u009f]/.test(value)) return fail("INVALID_ACTION_URL", "A link can't have spaces in it.")
  if (!/^https:\/\//i.test(value)) return fail("INVALID_ACTION_URL", "Use a full link that starts with https://")
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return fail("INVALID_ACTION_URL", "That isn't a link we can open. Check it and try again.")
  }
  if (url.protocol !== "https:") return fail("INVALID_ACTION_URL", "Use a full link that starts with https://")
  if (url.username || url.password || /^https:\/\/[^/?#]*@/i.test(value)) return fail("INVALID_ACTION_URL", "Remove the name and @ before the website's address.")
  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  if (!host) return fail("INVALID_ACTION_URL", "That link has no website in it.")
  if (host.startsWith("[") || IPV4.test(host)) return fail("INVALID_ACTION_URL", "Use the website's name, not a number address.")
  if (host === "localhost" || host.endsWith(".localhost")) return fail("INVALID_ACTION_URL", "That link only works on your own computer.")
  if (!host.includes(".")) return fail("INVALID_ACTION_URL", "That link has no website in it.")
  if (url.port && url.port !== "443") return fail("INVALID_ACTION_URL", "Use a normal https:// link, without a port number.")
  if (SHORTENER_HOSTS.some((d) => hostMatches(host, d))) return fail("ACTION_LINK_SHORTENER", actionErrorMessage("ACTION_LINK_SHORTENER"))
  if (isGroupInvite(host, url.pathname)) return fail("ACTION_LINK_GROUP_INVITE", actionErrorMessage("ACTION_LINK_GROUP_INVITE"))
  return { ok: true, url: value, domain: host.replace(/^www\./, "") }
}

/* ── errors, in our words ────────────────────────────────────────── */

/** What each missing eligibility item says. The server's names are not pinned, so the common spellings all read. */
const MISSING_COPY: Record<string, string> = {
  account_age: "Your account must be at least 7 days old.",
  account_too_new: "Your account must be at least 7 days old.",
  min_account_age: "Your account must be at least 7 days old.",
  account_age_7d: "Your account must be at least 7 days old.",
  email_verified: "Verify your email address.",
  verified_email: "Verify your email address.",
  email: "Verify your email address.",
  email_verification: "Verify your email address.",
  no_active_strikes: "You can't have an active strike on your account.",
  active_strikes: "You can't have an active strike on your account.",
  strikes: "You can't have an active strike on your account.",
  standing: "You can't have an active strike on your account.",
  good_standing: "You can't have an active strike on your account.",
}

/** One sentence per missing item, in the server's order, each once. */
export function missingSentences(missing: readonly string[]): string[] {
  const out: string[] = []
  for (const item of missing) {
    const key = item.trim().toLowerCase()
    if (!key) continue
    const words = key.replace(/[_-]+/g, " ")
    const sentence = MISSING_COPY[key] ?? `${words.charAt(0).toUpperCase()}${words.slice(1)}.`
    if (!out.includes(sentence)) out.push(sentence)
  }
  return out
}

const ERROR_COPY: Record<ActionErrorCode, string> = {
  INVALID_ACTION_LABEL: "Choose what the button says from the list.",
  INVALID_ACTION_URL: "Use a full https:// link to a website.",
  ACTION_LINK_SHORTENER: "Short links like bit.ly hide where they go. Use the full link instead.",
  ACTION_LINK_GROUP_INVITE: "WhatsApp and Telegram group invites can't be used. A wa.me link to a number is fine.",
  ACTION_LINK_UNSAFE: "That link was flagged as unsafe, so it can't be used.",
  ACTION_LINK_CHECK_UNAVAILABLE: "We couldn't check that link right now. Try again in a few minutes.",
  ACTION_NOT_ELIGIBLE: "You can't add an action button yet.",
}

/** The sentence for an action refusal; ACTION_NOT_ELIGIBLE names what is missing when it is known. */
export function actionErrorMessage(code: ActionErrorCode, missing: readonly string[] = []): string {
  if (code === "ACTION_NOT_ELIGIBLE") {
    const items = missingSentences(missing)
    return items.length > 0 ? `${ERROR_COPY.ACTION_NOT_ELIGIBLE} ${items.join(" ")}` : `${ERROR_COPY.ACTION_NOT_ELIGIBLE} Accounts need to be 7 days old, with a verified email and no active strikes.`
  }
  return ERROR_COPY[code]
}

export interface ActionProblem {
  code: ActionErrorCode
  message: string
  /** ACTION_NOT_ELIGIBLE's details.missing, as sent. */
  missing: string[]
}

/**
  An action refusal off an axios error (`{error:{code,message,details}}`),
  or null when the error is about something else. details.missing may sit
  on the error or at the top of the body.
*/
export function actionProblemFromError(err: unknown): ActionProblem | null {
  const data = obj((err as { response?: { data?: unknown } } | null)?.response?.data)
  if (!data) return null
  const e = obj(data.error)
  const code = str(e?.code) || (typeof data.error === "string" ? str(data.error) : "") || str(data.code)
  if (!isActionErrorCode(code)) return null
  const details = obj(e?.details) ?? obj(data.details)
  const missing = Array.isArray(details?.missing) ? details.missing.map(str).filter(Boolean) : []
  return { code, message: actionErrorMessage(code, missing), missing }
}

/* ── the read shape ──────────────────────────────────────────────── */

export type ActionStatus = "active" | "blocked" | "under_review"

export interface PostAction {
  id: string
  label: string
  labelText: string
  domain: string
  /** Our redirect path, /l/<id>. Never the raw url. */
  href: string
  status: ActionStatus
  /** The raw link: only on the author's own copy (for editing). */
  url: string | null
}

function toStatus(v: unknown): ActionStatus {
  const s = str(v).toLowerCase()
  if (!s || s === "active") return "active"
  if (s === "blocked" || s === "removed" || s === "unsafe") return "blocked"
  // Anything else (under_review, pending, a status this build does not know) is not live: fail closed.
  return "under_review"
}

/** The domain to show: the server's, else the url's host, never a path. */
function domainOf(raw: Wire): string {
  const d = str(raw.domain).toLowerCase().replace(/^www\./, "")
  if (d) return d
  try {
    return new URL(str(raw.url)).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return ""
  }
}

/**
  The `action` on a post, channel or profile row → what the pills draw.
  Absent, null, not an object, no id, or no label → null (no button).
  `href` is the server's when it is one of our /l/ paths, else built from
  the id: the raw url is never a link target.
*/
export function decodeAction(raw: unknown): PostAction | null {
  const w = obj(raw)
  if (!w) return null
  const id = str(w.id)
  const label = str(w.label)
  if (!id || !label) return null
  const serverHref = str(w.href)
  const href = /^\/l\/[^/?#\s]+$/.test(serverHref) ? serverHref : `/l/${encodeURIComponent(id)}`
  return {
    id,
    label,
    labelText: str(w.label_text) || labelText(label),
    domain: domainOf(w),
    href,
    status: toStatus(w.status),
    url: str(w.url) || null,
  }
}

/** What a viewer sees: only a live button; the author sees theirs whatever its status. */
export function visibleAction(action: PostAction | null | undefined, opts: { isAuthor: boolean; locked?: boolean }): PostAction | null {
  if (!action || opts.locked) return null
  if (action.status === "active") return action
  return opts.isAuthor ? action : null
}

/** The pill's words: "Apply now · epfindia.gov.in". */
export function pillText(action: Pick<PostAction, "labelText" | "domain">): string {
  return action.domain ? `${action.labelText} · ${action.domain}` : action.labelText
}

/** The author's plain explanation of a button that is not live; null when it is. */
export function statusExplanation(status: ActionStatus): { title: string; detail: string } | null {
  if (status === "blocked") {
    return { title: "Link blocked: unsafe", detail: "A safety check flagged this link, so viewers don't see the button. Change the link or remove the button." }
  }
  if (status === "under_review") {
    return { title: "Link under review", detail: "People reported this link, so viewers don't see the button while our team checks it." }
  }
  return null
}

/* ── the editor's draft and the requests ─────────────────────────── */

/** What the editor holds: a label and the link as typed. null = no button. */
export interface ActionDraft {
  label: string
  url: string
}

/** What the server is sent. */
export interface ActionWrite {
  label: string
  url: string
}

/** The editor's starting point for an existing button (the author's copy carries the url). */
export function draftFromAction(action: PostAction | null | undefined): ActionDraft | null {
  if (!action) return null
  return { label: action.label, url: action.url ?? "" }
}

/**
  Why the draft can't be sent, or null. No button is never a problem. With
  `labels`, the label must be one of them; without, any label will do (the
  server's list is the judge).
*/
export function draftProblem(draft: ActionDraft | null | undefined, labels?: readonly ActionLabelOption[]): string | null {
  if (!draft) return null
  if (!draft.label.trim() || (labels && !labels.some((l) => l.value === draft.label))) return actionErrorMessage("INVALID_ACTION_LABEL")
  const check = checkActionUrl(draft.url)
  return check.ok ? null : check.message
}

function writeOf(draft: ActionDraft): ActionWrite {
  return { label: draft.label, url: draft.url.trim() }
}

/** The create body's action: the key when there is a button, nothing otherwise. */
export function actionCreateFields(draft: ActionDraft | null | undefined): { action?: ActionWrite } {
  return draft ? { action: writeOf(draft) } : {}
}

/**
  The PATCH's action: undefined = unchanged (leave the key off), null =
  remove the button, an object = add or change it. `before` is the saved
  draft (from the author's copy), `after` what the editor holds now.
*/
export function actionPatchValue(before: ActionDraft | null | undefined, after: ActionDraft | null | undefined): ActionWrite | null | undefined {
  if (!after) return before ? null : undefined
  const next = writeOf(after)
  if (before && before.label === next.label && before.url.trim() === next.url) return undefined
  return next
}

/** The PATCH body's action key, spread into a patch: {} when unchanged. */
export function actionPatchFields(before: ActionDraft | null | undefined, after: ActionDraft | null | undefined): { action?: ActionWrite | null } {
  const value = actionPatchValue(before, after)
  return value === undefined ? {} : { action: value }
}

/** A draft payload's saved action ({label,url}), read back; anything else is no button. */
export function draftFromWire(raw: unknown): ActionDraft | null {
  const w = obj(raw)
  const label = str(w?.label)
  if (!w || !label) return null
  return { label, url: str(w.url) }
}

/* ── creator stats ───────────────────────────────────────────────── */

export interface ActionStats {
  clicksTotal: number
  clicks7d: number
}

function count(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}

export function toActionStats(body: unknown): ActionStats {
  const w = obj(unwrap(body)) ?? {}
  return { clicksTotal: count(w.clicks_total), clicks7d: count(w.clicks_7d) }
}

/** "1 tap", "12 taps", with the week when there is one. */
export function tapsText(stats: ActionStats): string {
  const total = `${stats.clicksTotal.toLocaleString("en-IN")} ${stats.clicksTotal === 1 ? "tap" : "taps"}`
  return stats.clicks7d > 0 ? `${total} · ${stats.clicks7d.toLocaleString("en-IN")} this week` : total
}

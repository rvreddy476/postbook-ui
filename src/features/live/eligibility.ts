import { errorCode, num, str } from "./model"

// Who may go live (contract 2 Oct 2026, live-service-v2).
//
//   GET /v1/livestream/eligibility →
//     {data:{mode:"pilot|open", eligible, pilot_only?, viewer_cap?,
//            requirements:[{key, met:true|false|null, current?, needed?, unit?,
//                           posts?:{current?,needed}, followers?:{current?,needed}}]}}
//   POST /streams, POST /streams/:id/start, POST /streams/:id/ingress in open mode:
//     403 LIVE_NOT_ELIGIBLE, error.details.requirements = the rows not met
//     (including the ones that could not be checked);
//     503 AUTHORITY_UNAVAILABLE when something could not be checked.
//   Pilot mode: 403 LIVE_NOT_ENABLED, as before.
//
// `met` null means "could not be checked right now"; an unknown count is
// OMITTED (no `current`), and a requirement that is switched off is not
// listed at all. The server always decides: this file only words the answer.
// Verification is by EMAIL (2 Oct 2026): `email_verified` is listed first and
// `phone_verified` is normally no longer sent; it keeps its words if it is.
// No React and no network here; hooks/useLiveV2.ts fetches.

type Obj = Record<string, unknown>

function asObj(v: unknown): Obj | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null
}

export const ELIGIBILITY_PATH = "/v1/livestream/eligibility"
/** Where "Create a post" leads (the existing composer). */
export const CREATE_POST_HREF = "/create/post"
/**
 * Where "Verify email" leads. The web has no screen or call that lets a
 * SIGNED-IN user verify their email: /auth/verify-email and
 * /v1/auth/resend-verification both need the token registration issued,
 * which a signed-in session does not hold. Until one exists this is the
 * account's security settings; point it at the real screen when it ships.
 */
export const VERIFY_EMAIL_HREF = "/settings/security"

export interface RequirementProgress {
  /** null: the server could not count it (the field was omitted). */
  current: number | null
  needed: number | null
}

export interface LiveRequirement {
  key: string
  /** null: could not be checked right now. */
  met: boolean | null
  current: number | null
  needed: number | null
  /** account_age: "days" or "hours"; "" elsewhere. */
  unit: string
  posts: RequirementProgress | null
  followers: RequirementProgress | null
}

export interface LiveEligibility {
  mode: string
  eligible: boolean
  pilot_only: boolean
  requirements: LiveRequirement[]
  /** The new-streamer viewer cap, while it applies; null otherwise. */
  viewer_cap: number | null
}

function count(v: unknown): number | null {
  const n = num(v)
  return n !== null && n >= 0 ? n : null
}

function parseProgress(raw: unknown): RequirementProgress | null {
  const o = asObj(raw)
  return o ? { current: count(o.current), needed: count(o.needed) } : null
}

export function parseRequirements(raw: unknown): LiveRequirement[] {
  if (!Array.isArray(raw)) return []
  const out: LiveRequirement[] = []
  for (const entry of raw) {
    const o = asObj(entry)
    const key = str(o?.key)
    if (!o || !key) continue
    out.push({
      key,
      met: o.met === true ? true : o.met === false ? false : null,
      current: count(o.current),
      needed: count(o.needed),
      unit: str(o.unit),
      posts: parseProgress(o.posts),
      followers: parseProgress(o.followers),
    })
  }
  return out
}

/** The GET /eligibility answer; null when it cannot be read (the caller then shows the form). */
export function parseEligibility(body: unknown): LiveEligibility | null {
  const data = asObj(asObj(body)?.data)
  if (!data || typeof data.eligible !== "boolean") return null
  const cap = count(data.viewer_cap)
  return {
    mode: str(data.mode),
    eligible: data.eligible,
    pilot_only: data.pilot_only === true,
    requirements: parseRequirements(data.requirements),
    viewer_cap: cap !== null && cap > 0 ? cap : null,
  }
}

/** 403 LIVE_NOT_ELIGIBLE from create / start / ingress. Branches on the code, never on the message. */
export function isNotEligible(err: unknown): boolean {
  return errorCode(err) === "LIVE_NOT_ELIGIBLE"
}

/**
 * The rows still to do from a 403 LIVE_NOT_ELIGIBLE (error.details.requirements);
 * null for any other error. An answer without the list reads as no rows.
 */
export function requirementsFromError(err: unknown): LiveRequirement[] | null {
  if (!isNotEligible(err)) return null
  const error = asObj(asObj(asObj(asObj(err)?.response)?.data)?.error)
  return parseRequirements(asObj(error?.details)?.requirements)
}

// ── Which screen ──────────────────────────────────────────────────────

export type GoLiveGate = "loading" | "form" | "pilot" | "nearly"

/**
 * What a "go live" entry shows.
 *   pilot   — the closed-pilot notice (pilot mode, or a 403 LIVE_NOT_ENABLED)
 *   nearly  — the "You're nearly ready" panel (open mode, or a 403 LIVE_NOT_ELIGIBLE)
 *   form    — eligible, OR the eligibility call failed: the server still decides on submit
 * A refusal the server just gave on submit wins over the earlier answer.
 */
export function goLiveGate(input: {
  loading: boolean
  eligibility: LiveEligibility | null | undefined
  /** The server answered 403 LIVE_NOT_ENABLED. */
  pilotRefused?: boolean
  /** The server answered 403 LIVE_NOT_ELIGIBLE with these rows. */
  refused?: LiveRequirement[] | null
}): GoLiveGate {
  if (input.pilotRefused) return "pilot"
  if (input.refused) return "nearly"
  if (input.loading) return "loading"
  const e = input.eligibility
  if (!e || e.eligible) return "form"
  return e.pilot_only || e.mode === "pilot" ? "pilot" : "nearly"
}

/** The rows the panel lists: the refusal's when there is one with rows, else the eligibility answer's. */
export function gateRequirements(refused: LiveRequirement[] | null | undefined, eligibility: LiveEligibility | null | undefined): LiveRequirement[] {
  if (refused && refused.length > 0) return refused
  return eligibility?.requirements ?? []
}

// ── Wording ───────────────────────────────────────────────────────────

export type RequirementState = "met" | "todo" | "unknown"

export interface RequirementView {
  key: string
  state: RequirementState
  text: string
}

export const NEARLY_TITLE = "You're nearly ready to go live"
export const NEARLY_LEAD = "Finish what's left and you can start streaming."
export const NEARLY_EMPTY = "We couldn't load what's still needed. Check again in a moment."
export const COULD_NOT_CHECK = "Couldn't check"
export const STATE_LABEL: Record<RequirementState, string> = {
  met: "Done",
  todo: "Still needed",
  unknown: COULD_NOT_CHECK,
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString("en")} ${word}${n === 1 ? "" : "s"}`
}

function ageUnit(unit: string): string {
  return unit === "hours" ? "hour" : "day"
}

function accountAgeText(r: LiveRequirement, state: RequirementState): string {
  const unit = ageUnit(r.unit)
  if (r.needed === null || r.needed <= 0) {
    return state === "met" ? "Your account is old enough" : "Your account must be a little older"
  }
  if (state === "met") return `Your account is at least ${plural(r.needed, unit)} old`
  const base = `Your account must be ${plural(r.needed, unit)} old`
  if (state !== "todo" || r.current === null) return base
  const left = r.needed - r.current
  return left > 0 ? `${base} (${plural(left, unit)} to go)` : base
}

function activityText(r: LiveRequirement, state: RequirementState): string {
  if (state === "met") return "You have enough posts or followers"
  const posts = r.posts && r.posts.needed !== null && r.posts.needed > 0 ? r.posts : null
  const followers = r.followers && r.followers.needed !== null && r.followers.needed > 0 ? r.followers : null
  const asks: string[] = []
  if (posts) asks.push(`publish ${plural(posts.needed as number, "post")}`)
  if (followers) asks.push(`reach ${plural(followers.needed as number, "follower")}`)
  if (asks.length === 0) return "Publish a few posts or gain some followers"
  const sentence = asks.join(" or ")
  const base = sentence.charAt(0).toUpperCase() + sentence.slice(1)
  if (state !== "todo") return base
  // An unknown count is omitted by the server, and left out here.
  const progress: string[] = []
  if (posts && posts.current !== null) progress.push(`${posts.current.toLocaleString("en")} of ${plural(posts.needed as number, "post")}`)
  if (followers && followers.current !== null) progress.push(`${followers.current.toLocaleString("en")} of ${plural(followers.needed as number, "follower")}`)
  return progress.length > 0 ? `${base} (${progress.join(", ")})` : base
}

const SIMPLE: Record<string, Record<RequirementState, string>> = {
  adult: {
    met: "You're 18 or over",
    todo: "You must be 18 or over to go live",
    unknown: "You must be 18 or over",
  },
  good_standing: {
    met: "Your account is in good standing",
    todo: "Your account isn't in good standing right now",
    unknown: "Your account must be in good standing",
  },
  email_verified: {
    met: "Email verified",
    todo: "Verify your email address",
    unknown: "Your email address must be verified",
  },
  phone_verified: {
    met: "Your phone number is verified",
    todo: "Verify your phone number",
    unknown: "Your phone number must be verified",
  },
}

/** A requirement this build has no words for (a later backend): never hidden, never an internal key. */
export const OTHER_REQUIREMENT_COPY = "One more check on your account"

export function requirementState(r: Pick<LiveRequirement, "met">): RequirementState {
  return r.met === true ? "met" : r.met === false ? "todo" : "unknown"
}

/** One row of the panel, in plain words. */
export function requirementView(r: LiveRequirement): RequirementView {
  const state = requirementState(r)
  let text: string
  switch (r.key) {
    case "account_age":
      text = accountAgeText(r, state)
      break
    case "activity":
      text = activityText(r, state)
      break
    default:
      text = SIMPLE[r.key]?.[state] ?? OTHER_REQUIREMENT_COPY
  }
  return { key: r.key, state, text }
}

// ── The one button ────────────────────────────────────────────────────

export type NearlyAction =
  | { kind: "link"; key: string; label: string; href: string }
  | { kind: "recheck"; label: string }

export const RECHECK_LABEL = "Check again"

/** Requirements the web can help with directly; every other one is waited out or fixed elsewhere. */
const ACTIONS: Record<string, { label: string; href: string }> = {
  email_verified: { label: "Verify email", href: VERIFY_EMAIL_HREF },
  activity: { label: "Create a post", href: CREATE_POST_HREF },
}

/**
 * The primary button: the action of the FIRST requirement that is not met
 * and has one; otherwise "Check again". A requirement that is met, or that
 * could not be checked, never offers its action.
 */
export function primaryAction(requirements: readonly LiveRequirement[]): NearlyAction {
  for (const r of requirements) {
    const action = r.met === false ? ACTIONS[r.key] : undefined
    if (action) return { kind: "link", key: r.key, ...action }
  }
  return { kind: "recheck", label: RECHECK_LABEL }
}

// ── Small print ───────────────────────────────────────────────────────

/** The quiet line on the form while the new-streamer cap applies; "" otherwise. */
export function viewerCapNote(cap: number | null | undefined): string {
  if (typeof cap !== "number" || !Number.isFinite(cap) || cap <= 0) return ""
  return `Your first streams are limited to ${plural(cap, "viewer")}.`
}

export const LEARN_MORE_LABEL = "Learn more"

/** "Learn more", expanded in place. */
export function learnMoreLines(requirements: readonly LiveRequirement[], viewerCap?: number | null): string[] {
  const lines = [
    "Going live is open to accounts that have been here a little while and follow the rules. It doesn't depend on how popular you are.",
    "These checks update on their own as you use your account. There's nothing to apply for.",
  ]
  if (requirements.some((r) => r.met === null)) {
    lines.push("A check we couldn't complete isn't counted against you. Try again in a few minutes.")
  }
  const cap = viewerCapNote(viewerCap)
  if (cap) lines.push(cap)
  return lines
}

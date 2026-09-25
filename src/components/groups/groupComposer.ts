/**
 * What the group composer actually sends, and what to say about the answer.
 *
 * Kept out of CreatePortal so the rules can be tested without a DOM. Three of
 * them are the kind that only shows up in production:
 *
 *   1. The composer collects a feeling, an activity, a place and hashtags, and
 *      until now the group path forwarded none of them — while still showing a
 *      success toast. `buildGroupTypePayload` is where they survive.
 *
 *   2. The response shape of POST /v1/groups/:id/posts/v2 DEPENDS ON THE
 *      REQUEST: a bare post when `also_post_to` is absent, a batch result when
 *      it is not. `interpretCreateGroupPostResponse` decides from what was
 *      SENT, never by sniffing what came back, because the mobile app reads the
 *      bare shape and is not being changed.
 *
 *   3. group-service's cap of five counts the group you are looking at. Five
 *      extra spaces is six targets and a 400 — see MAX_ADDITIONAL_GROUPS.
 */

import type { GroupPostV2 } from '@/types/groups'

/* ───────────────────────── type_payload ───────────────────────── */

/** What the composer has collected that the post body cannot carry. */
export interface GroupTypePayloadInput {
  feeling?: string | null
  activity?: string | null
  activityDetail?: string | null
  location?: string | null
  hashtags?: readonly string[]
}

/**
 * The object that goes out as `type_payload`. Snake_case, because it is wire
 * shape: group-service stores it as an opaque `json.RawMessage` and hands it
 * back verbatim on the feed, so these key names are the only contract there is.
 */
export interface GroupTypePayload {
  feeling?: string
  activity?: string
  activity_detail?: string
  location?: string
  hashtags?: string[]
}

/** The composer's own limit, kept here so the wire cannot exceed the UI. */
export const MAX_HASHTAGS = 30

/**
 * Normalize one hashtag the way the composer's chips do: no leading '#', no
 * punctuation, lowercase. Exported so the reader and the writer cannot drift.
 */
export function normalizeHashtag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .replace(/[^\p{L}\p{N}_]/gu, '')
    .toLowerCase()
}

function normalizeHashtags(tags: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    const tag = normalizeHashtag(raw)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= MAX_HASHTAGS) break
  }
  return out
}

function trimmedOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t ? t : null
}

/**
 * Fold what the composer collected into `type_payload`, omitting anything empty.
 *
 * `undefined` — not `{}` — when there is nothing to carry, so an ordinary post
 * sends no `type_payload` key at all. An empty object would be stored, handed
 * back on every read, and make every plain post look like it has metadata.
 *
 * Empty values are OMITTED rather than sent as `""` or `[]`: a stored `""`
 * reads back as a present-but-blank field, and the card would then render an
 * empty chip for a feeling nobody chose.
 */
export function buildGroupTypePayload(input: GroupTypePayloadInput): GroupTypePayload | undefined {
  const payload: GroupTypePayload = {}

  const feeling = trimmedOrNull(input.feeling)
  if (feeling) payload.feeling = feeling

  const activity = trimmedOrNull(input.activity)
  if (activity) {
    payload.activity = activity
    /*
      The detail only means something next to its verb: the picker produces
      "Listening to" + "Radiohead", and "Radiohead" on its own is not a
      sentence the card can draw. So a detail without an activity is dropped
      rather than carried as an orphan.
    */
    const detail = trimmedOrNull(input.activityDetail)
    if (detail) payload.activity_detail = detail
  }

  const location = trimmedOrNull(input.location)
  if (location) payload.location = location

  const hashtags = normalizeHashtags(input.hashtags ?? [])
  if (hashtags.length > 0) payload.hashtags = hashtags

  return Object.keys(payload).length > 0 ? payload : undefined
}

/* ───────────────────────── reading it back ───────────────────────── */

/** `type_payload` as the card needs it: present fields only, never undefined. */
export interface GroupPostMetaFields {
  feeling: string | null
  activity: string | null
  activityDetail: string | null
  location: string | null
  hashtags: string[]
}

const EMPTY_META: GroupPostMetaFields = {
  feeling: null,
  activity: null,
  activityDetail: null,
  location: null,
  hashtags: [],
}

/**
 * Read `type_payload` back, defensively.
 *
 * It is an opaque column: rows written by other clients, by an older build, or
 * by the poll path hold shapes this function has never seen, and a group feed
 * must not blank out because one post carries a number where a string was
 * expected. Anything unrecognised is simply absent.
 *
 * A JSON string is accepted as well as an object, because `json.RawMessage`
 * survives a double-encode somewhere upstream as a quoted string rather than
 * as an object, and a feed that silently drops metadata is the bug this whole
 * module exists to close.
 */
export function readGroupPostMeta(payload: unknown): GroupPostMetaFields {
  let raw: unknown = payload
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return EMPTY_META
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY_META

  const obj = raw as Record<string, unknown>
  const str = (key: string): string | null =>
    typeof obj[key] === 'string' ? trimmedOrNull(obj[key] as string) : null

  const activity = str('activity')
  const tags = Array.isArray(obj.hashtags) ? normalizeHashtags(obj.hashtags as string[]) : []

  return {
    feeling: str('feeling'),
    activity,
    // Same rule as the writer: no orphan detail. A row written before the
    // writer existed may hold one.
    activityDetail: activity ? str('activity_detail') : null,
    location: str('location'),
    hashtags: tags,
  }
}

/** Whether there is anything at all to draw, so the card can render nothing. */
export function hasGroupPostMeta(meta: GroupPostMetaFields): boolean {
  return Boolean(
    meta.feeling || meta.activity || meta.location || meta.hashtags.length > 0,
  )
}

/** The one line a card shows for a mood: "Listening to Radiohead", "excited". */
export function moodLine(meta: GroupPostMetaFields): string | null {
  if (meta.activity) {
    return meta.activityDetail ? `${meta.activity} ${meta.activityDetail}` : meta.activity
  }
  return meta.feeling ? `Feeling ${meta.feeling}` : null
}

/* ───────────────────────── cross-posting ───────────────────────── */

/**
 * group-service's `MaxCrossPostTargets`. THIS COUNTS THE GROUP YOU ARE IN.
 *
 * CrossPost builds `targets := []uuid.UUID{primaryGroupID}` and then appends
 * `also_post_to`, and refuses when that list exceeds five. So five extra
 * spaces is six targets and a 400 before anything is written.
 */
export const MAX_CROSS_POST_TARGETS = 5

/** What the picker may therefore select: four, not five. */
export const MAX_ADDITIONAL_GROUPS = MAX_CROSS_POST_TARGETS - 1

/**
 * The `also_post_to` list, as the server would compute it.
 *
 * Dedupes, drops the group being posted to (the server treats it as one
 * target either way, so leaving it in silently spends one of four slots), and
 * caps. Order is the order they were picked.
 */
export function normalizeCrossPostTargets(
  ids: readonly string[],
  primaryGroupId: string,
): string[] {
  const out: string[] = []
  const seen = new Set<string>([primaryGroupId])
  for (const id of ids) {
    if (typeof id !== 'string') continue
    const trimmed = id.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
    if (out.length >= MAX_ADDITIONAL_GROUPS) break
  }
  return out
}

/** Whether another space can be picked, so the UI disables rather than 400s. */
export function canAddAnotherGroup(selectedCount: number): boolean {
  return selectedCount < MAX_ADDITIONAL_GROUPS
}

/**
 * Why no more can be picked, in the user's words. Says the number of spaces the
 * post reaches — five, counting this one — because that is the limit they will
 * hit, and "4 more" on its own reads like an arbitrary number.
 */
export function crossPostCapReason(): string {
  return `A post can go to ${MAX_CROSS_POST_TARGETS} spaces at once, so you can add ${MAX_ADDITIONAL_GROUPS} more.`
}

/** The outcome vocabulary, verbatim from internal/service/cross_post.go. */
export const CROSS_POST_OUTCOMES = [
  'published',
  'pending_approval',
  'not_a_member',
  'banned',
  'not_permitted',
  'anonymous_not_allowed',
  'blocked_content',
  'unavailable',
] as const

export type CrossPostOutcome = (typeof CROSS_POST_OUTCOMES)[number]

/** One target's answer. `post_id` is absent for anything but a written post. */
export interface CrossPostTarget {
  group_id: string
  post_id?: string
  outcome: string
}

/** The batch answer, returned only when `also_post_to` was non-empty. */
export interface CrossPostResult {
  published: number
  pending: number
  skipped: number
  targets: CrossPostTarget[]
}

/** Whether this outcome means the post exists in that space. */
export function outcomeLanded(outcome: string): boolean {
  return outcome === 'published' || outcome === 'pending_approval'
}

/**
 * What one outcome means, in words.
 *
 * `unavailable` is deliberately vague, and must stay that way: the server
 * collapses missing, deleted, archived and private-and-not-a-member into that
 * one answer precisely so cross-posting cannot be used to discover which
 * private groups exist. Inventing a more specific wording here would rebuild
 * the probe on the client.
 *
 * An outcome this build has never heard of gets the same vague answer rather
 * than the raw token: a future server string must not surface as
 * "shadowbanned_by_topic" in a toast, and must not render blank either.
 */
export function crossPostOutcomeMessage(outcome: string): string {
  switch (outcome) {
    case 'published':
      return 'posted'
    case 'pending_approval':
      return 'waiting for a moderator to approve it'
    case 'not_a_member':
      return 'you are not a member'
    case 'banned':
      return 'you are banned there'
    case 'not_permitted':
      return 'you are not allowed to post there'
    case 'anonymous_not_allowed':
      return 'it does not allow anonymous posts, so it was skipped'
    case 'blocked_content':
      return 'a word in your post is not allowed there'
    case 'unavailable':
    default:
      return 'not available'
  }
}

/** What the summary says, and whether it is good news. */
export interface CrossPostSummary {
  title: string
  /** One line per space that did not simply publish. '' when all did. */
  description: string
  /** True when every space took the post outright. */
  ok: boolean
}

/**
 * Report the batch honestly, naming the spaces.
 *
 * Naming them is right here and wrong for the invite batch: an invite refusal
 * identifies a PERSON who blocked you, while these are spaces the author
 * picked themselves. Saying only "posted" over two refusals is the failure
 * this whole stream exists to stop.
 *
 * `nameOf` resolves a group id to a name; a space the client cannot name is
 * still counted and still listed, because losing a refusal is worse than
 * printing "Another space".
 */
export function summariseCrossPost(
  result: CrossPostResult,
  nameOf: (groupId: string) => string | undefined,
): CrossPostSummary {
  const targets = Array.isArray(result?.targets) ? result.targets : []
  const total = targets.length
  const landed = targets.filter((t) => outcomeLanded(t.outcome)).length
  const spaces = (n: number) => `${n} ${n === 1 ? 'space' : 'spaces'}`

  const lines = targets
    .filter((t) => t.outcome !== 'published')
    .map((t) => {
      const name = nameOf(t.group_id)?.trim() || 'Another space'
      return `${name} — ${crossPostOutcomeMessage(t.outcome)}`
    })

  if (total === 0) {
    // The server always returns at least the primary target, so this is a
    // shape we do not understand rather than an empty success.
    return { title: 'Posted, but the result could not be read', description: '', ok: false }
  }

  let title: string
  if (landed === 0) {
    title = total === 1 ? 'Could not post' : `Could not post to any of the ${spaces(total)}`
  } else if (landed === total) {
    title = total === 1 ? 'Posted' : `Posted to ${spaces(total)}`
  } else {
    title = `Posted to ${landed} of ${total} spaces`
  }

  return { title, description: lines.join('\n'), ok: lines.length === 0 }
}

/* ───────────────── the compatibility hinge ───────────────── */

/** Either the bare post, as it always was, or the batch result. */
export type CreateGroupPostOutcome =
  | { kind: 'single'; post: GroupPostV2 }
  | { kind: 'batch'; result: CrossPostResult }

/**
 * Counts as Go marshals them: an unset int is `0`, not absent. `|| 0` rather
 * than `??` so a server build that omits a field yields 0 instead of NaN in a
 * summary, and a genuine 0 stays 0.
 */
export function normalizeCrossPostResult(body: unknown): CrossPostResult {
  const b = (body ?? {}) as Partial<CrossPostResult>
  const targets = Array.isArray(b.targets) ? b.targets : []
  return {
    published: Number(b.published) || 0,
    pending: Number(b.pending) || 0,
    skipped: Number(b.skipped) || 0,
    targets: targets.filter(
      (t): t is CrossPostTarget =>
        !!t && typeof t === 'object' && typeof t.group_id === 'string' && typeof t.outcome === 'string',
    ),
  }
}

/**
 * Which shape came back — decided by what was SENT.
 *
 * The response of POST /v1/groups/:id/posts/v2 is the bare post unless the
 * request carried `also_post_to`, in which case it is the batch result. The
 * tempting implementation is to sniff the body for a `targets` key; it is
 * wrong, because it makes the client's reading of a response depend on server
 * fields rather than on its own intent, and the bare-post shape is a contract
 * the mobile app depends on. The request knows. Ask the request.
 */
export function interpretCreateGroupPostResponse(
  sentTargetCount: number,
  body: unknown,
): CreateGroupPostOutcome {
  if (sentTargetCount > 0) {
    return { kind: 'batch', result: normalizeCrossPostResult(body) }
  }
  return { kind: 'single', post: body as GroupPostV2 }
}

/* ───────────────────────── anonymity ───────────────────────── */

export const ANONYMOUS_LABEL = 'Post anonymously'

/**
 * The wording is a product decision, not a phrasing choice.
 *
 * This is pseudonymity AGAINST OTHER MEMBERS. It is not untraceability: in a
 * three-person space, timing and content still correlate, so any promise that
 * "nobody can tell it was you" would be a promise the product cannot keep.
 * Admins cannot unmask — that is enforced server-side, where the alias
 * replaces the author id before the row is ever marshalled.
 */
export const ANONYMOUS_EXPLAINER =
  'Your name is hidden from other members. In a small space, what you write and when you write it can still point to you.'

/**
 * Whether `is_anonymous` may actually be sent.
 *
 * `groupAllows === true`, never `!== false`: the field is absent on a server
 * build older than the feature and Go marshals the unset case as `false`, and
 * both mean "this group has not opted in". Sending the flag anyway is a 403 the
 * author reads as having lost their post.
 *
 * It is re-evaluated at submit rather than only when the switch is drawn,
 * because the group detail query refetches: a space can withdraw anonymous
 * posting while the composer is open, leaving the toggle on.
 */
export function effectiveIsAnonymous(
  requested: boolean,
  groupAllows: boolean | undefined,
): boolean {
  return requested === true && groupAllows === true
}

/**
 * Warn before an anonymous cross-post loses spaces.
 *
 * A target that disallows anonymity is SKIPPED, never downgraded to a named
 * post — the server has an explicit test that there is no code path which
 * clears the flag and continues. So the honest warning is that the post may
 * not arrive everywhere, not that a name may be revealed.
 */
export function anonymousCrossPostWarning(
  isAnonymous: boolean,
  additionalCount: number,
): string | null {
  if (!isAnonymous || additionalCount <= 0) return null
  return 'Spaces that do not allow anonymous posts will be skipped — your name is never shown instead.'
}

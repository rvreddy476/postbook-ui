import { mediaHref } from "@/features/reels/model";

/*
  Video credits (cast & crew) on long videos, pure. Contract pinned
  23 Oct 2026 (credits-contract.md), with the server's final deviations:

    read   GET /v1/posts/:id and the create / PATCH answers ONLY: credits [{id,name,role,user_id?,user?,status?}];
           genres, release_year, production_house on every post body, omitted when unset
    write  POST /v1/posts, drafts, PATCH /v1/posts/:id   credits [{name,role,user_id?}] (PATCH replaces; [] clears;
           release_year null clears; production_house null clears; omitted = unchanged)
    consent GET /v1/credits/requests, POST /v1/credits/:id/accept|decline, DELETE /v1/credits/:id → {status}
    profile GET /v1/creators/:creatorId/appearances (the rows carry no credits)

  `status` and `user_id` are sent to the post owner only. A viewer never
  sees a pending or declined link: the decoder drops `user` for any credit
  that is not accepted, so a server slip cannot leak a tag. Go zero
  values ("", [], 0) read as absent. No React, no requests.
*/

/* ── Limits (the server's; the client checks first) ─────── */

export const CREDITS_MAX = 30;
export const CREDIT_NAME_MAX = 80;
export const CREDIT_ROLE_MAX = 40;
export const GENRES_MAX = 3;
export const PRODUCTION_HOUSE_MAX = 100;
export const RELEASE_YEAR_MIN = 1900;

/** The client's suggested roles; the server takes any 1..40 runes. */
export const SUGGESTED_ROLES = [
  "Actor",
  "Director",
  "Writer",
  "Producer",
  "Music",
  "Singer",
  "Cinematographer",
  "Editor",
  "Choreographer",
  "Host",
  "Guest",
  "Narrator",
] as const;

/**
 * The topics the studio and the Hub offer the Credits step for: the
 * existing post-service slugs (internal/service/categories.go) for film &
 * animation, entertainment, comedy, music, documentary and podcasts. There
 * is no series slug today. The server accepts credits on any long video;
 * this list only decides when to ask.
 */
export const CREDIT_CATEGORIES: readonly string[] = ["film-animation", "entertainment", "comedy", "music", "documentary", "podcasts"];

export function categoryTakesCredits(category: string | null | undefined): boolean {
  return CREDIT_CATEGORIES.includes((category ?? "").trim().toLowerCase());
}

/* ── Read shape ─────────────────────────────────────────── */

export type CreditStatus = "unlinked" | "pending" | "accepted" | "declined";
const STATUSES: readonly CreditStatus[] = ["unlinked", "pending", "accepted", "declined"];

export interface CreditUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface VideoCredit {
  id: string;
  name: string;
  role: string;
  /** Only for the post owner; null for everyone else. */
  status: CreditStatus | null;
  /** The linked account to SHOW: present only for an accepted credit. */
  user: CreditUser | null;
  /**
   * The tagged account, kept for the owner's edit (a PATCH must send the
   * same user_id to keep a pending tag's status). Never set for a viewer.
   */
  userId: string | null;
}

export interface VideoCreditsInfo {
  credits: VideoCredit[];
  genres: string[];
  releaseYear: number | null;
  productionHouse: string;
}

export const EMPTY_CREDITS_INFO: VideoCreditsInfo = { credits: [], genres: [], releaseYear: null, productionHouse: "" };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function avatar(raw: string): string {
  if (!raw) return "";
  return raw.startsWith("/v1/") ? mediaHref(raw) : raw;
}

export function decodeCreditUser(raw: unknown): CreditUser | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const username = str(raw.username).trim();
  const displayName = str(raw.display_name).trim() || str(raw.name).trim();
  return { id, username, displayName: displayName || username, avatarUrl: avatar(str(raw.avatar_url)) };
}

/** One credit row. A row without a name or a role is dropped. */
export function decodeCredit(raw: unknown): VideoCredit | null {
  if (!isRecord(raw)) return null;
  const name = str(raw.name).trim();
  const role = str(raw.role).trim();
  if (!name || !role) return null;
  const statusRaw = str(raw.status).toLowerCase();
  const status = STATUSES.includes(statusRaw as CreditStatus) ? (statusRaw as CreditStatus) : null;
  const owner = status !== null;
  const user = decodeCreditUser(raw.user);
  // Shown linked only when accepted; for a viewer (no status) the server sends `user` only then.
  const shown = user && (status === null || status === "accepted") ? user : null;
  // The owner keeps the tagged id whatever the status; a viewer never gets one.
  const userId = owner ? str(raw.user_id) || user?.id || null : null;
  return { id: str(raw.id), name, role, status, user: shown, userId };
}

export function decodeCredits(raw: unknown): VideoCredit[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(decodeCredit).filter((c): c is VideoCredit => c !== null).slice(0, CREDITS_MAX);
}

/** The four credit keys of a post row (owner or viewer); missing keys read as empty. */
export function decodeCreditsInfo(row: unknown): VideoCreditsInfo {
  if (!isRecord(row)) return EMPTY_CREDITS_INFO;
  const genres = Array.isArray(row.genres)
    ? [...new Set(row.genres.filter((g): g is string => typeof g === "string").map((g) => g.trim().toLowerCase()).filter(Boolean))].slice(0, GENRES_MAX)
    : [];
  const year = typeof row.release_year === "number" && Number.isInteger(row.release_year) && row.release_year >= RELEASE_YEAR_MIN ? row.release_year : null;
  return {
    credits: decodeCredits(row.credits),
    genres,
    releaseYear: year,
    productionHouse: str(row.production_house).trim(),
  };
}

export function hasCreditsInfo(info: VideoCreditsInfo | null | undefined): boolean {
  return !!info && (info.credits.length > 0 || info.genres.length > 0 || info.releaseYear !== null || !!info.productionHouse);
}

/* ── Genres (GET /v1/posts/genres) ──────────────────────── */

export interface Genre {
  slug: string;
  label: string;
}

export function decodeGenres(raw: unknown): Genre[] {
  const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.items) ? raw.items : [];
  const seen = new Set<string>();
  const out: Genre[] = [];
  for (const g of list) {
    if (!isRecord(g)) continue;
    const slug = str(g.slug).trim().toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, label: str(g.label).trim() || genreFallbackLabel(slug) });
  }
  return out;
}

function genreFallbackLabel(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : slug;
}

export function genreLabel(genres: readonly Genre[] | null | undefined, slug: string): string {
  return (genres ?? []).find((g) => g.slug === slug)?.label ?? genreFallbackLabel(slug);
}

/* ── Presentation ───────────────────────────────────────── */

export interface CreditGroup {
  /** "Cast" for actors, else the role as first written. */
  label: string;
  credits: VideoCredit[];
}

function roleKey(role: string): string {
  return role.trim().toLowerCase();
}

/** "Cast" for Actor (and Actress / Cast), else the role as written. */
export function roleGroupLabel(role: string): string {
  const k = roleKey(role);
  return k === "actor" || k === "actress" || k === "cast" ? "Cast" : role.trim();
}

/**
 * Credits grouped by role in the order the creator listed them: a group
 * appears where its first credit is, names keep their order inside it.
 * Roles group case-insensitively; every actor spelling is one "Cast".
 */
export function groupCredits(credits: readonly VideoCredit[]): CreditGroup[] {
  const groups: CreditGroup[] = [];
  const byKey = new Map<string, CreditGroup>();
  for (const c of credits) {
    const label = roleGroupLabel(c.role);
    const key = label.toLowerCase();
    let group = byKey.get(key);
    if (!group) {
      group = { label, credits: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.credits.push(c);
  }
  return groups;
}

/** "Cast: A, B, C · Director: D", the text of the watch page's credits line. */
export function creditsLine(credits: readonly VideoCredit[]): string {
  return groupCredits(credits)
    .map((g) => `${g.label}: ${g.credits.map((c) => c.name).join(", ")}`)
    .join(" · ");
}

/** "Drama, Thriller · 2024 · Blue Hour Films"; "" when none is set. */
export function creditsMetaLine(info: VideoCreditsInfo, genres?: readonly Genre[] | null): string {
  const parts: string[] = [];
  if (info.genres.length) parts.push(info.genres.map((g) => genreLabel(genres, g)).join(", "));
  if (info.releaseYear !== null) parts.push(String(info.releaseYear));
  if (info.productionHouse) parts.push(info.productionHouse);
  return parts.join(" · ");
}

/** Where a credited name goes: an accepted account's channel, else a search for the name. */
export function creditHref(credit: VideoCredit): string {
  if (credit.user && (credit.status === null || credit.status === "accepted")) {
    const ref = credit.user.username || credit.user.id;
    return `/posttube/channel/${encodeURIComponent(ref)}`;
  }
  return `/posttube/search?q=${encodeURIComponent(credit.name)}`;
}

export const CREDIT_STATUS_LABEL: Record<CreditStatus, string> = {
  unlinked: "Not linked",
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
};

/* ── The editor's form (studio and Hub) ─────────────────── */

export interface CreditDraft {
  /** Local key for React and reordering. */
  key: number;
  name: string;
  role: string;
  /** The VChat account to ask; null = plain text. */
  user: CreditUser | null;
  /** From the server (Hub edit): the saved status, shown to the owner. */
  status: CreditStatus | null;
}

export interface CreditsForm {
  credits: CreditDraft[];
  genres: string[];
  /** As typed: "" or four digits. */
  releaseYear: string;
  productionHouse: string;
}

export const EMPTY_CREDITS_FORM: CreditsForm = { credits: [], genres: [], releaseYear: "", productionHouse: "" };

/** The owner detail → the edit form, every credit keyed from `firstKey` up. */
export function creditsFormFrom(info: VideoCreditsInfo, firstKey = 1): CreditsForm {
  return {
    credits: info.credits.map((c, i) => ({
      key: firstKey + i,
      name: c.name,
      role: c.role,
      // The owner keeps the tag whatever its status; the form shows the status beside it.
      user: c.userId ? (c.user && c.user.id === c.userId ? c.user : { id: c.userId, username: "", displayName: c.name, avatarUrl: "" }) : null,
      status: c.status,
    })),
    genres: [...info.genres],
    releaseYear: info.releaseYear !== null ? String(info.releaseYear) : "",
    productionHouse: info.productionHouse,
  };
}

export function newCreditRow(key: number): CreditDraft {
  return { key, name: "", role: "", user: null, status: null };
}

/** Moves the row at `from` to `to` (both clamped); the same list when nothing moves. */
export function moveCredit<T>(rows: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= rows.length) return [...rows];
  const target = Math.max(0, Math.min(rows.length - 1, to));
  if (target === from) return [...rows];
  const out = [...rows];
  const [row] = out.splice(from, 1);
  out.splice(target, 0, row);
  return out;
}

/** Toggles a genre, never past GENRES_MAX. */
export function toggleGenre(selected: readonly string[], slug: string): string[] {
  if (selected.includes(slug)) return selected.filter((g) => g !== slug);
  if (selected.length >= GENRES_MAX) return [...selected];
  return [...selected, slug];
}

/* ── Validation ─────────────────────────────────────────── */

export interface CreditsProblem {
  field: string;
  message: string;
}

function runes(s: string): number {
  return [...s].length;
}

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

/** The year as a number, null when blank; NaN when typed but not a whole number. */
export function parseReleaseYear(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  return /^\d{4}$/.test(t) ? Number(t) : NaN;
}

export function maxReleaseYear(now = new Date()): number {
  return now.getFullYear() + 1;
}

/**
 * The contract's rules, in words: up to 30 credits, each with a name (1..80,
 * no control characters) and a role (1..40); up to 3 genres; a year from
 * 1900 to next year; a production house of at most 100 characters.
 */
export function creditsProblems(form: CreditsForm, now = new Date()): CreditsProblem[] {
  const out: CreditsProblem[] = [];
  if (form.credits.length > CREDITS_MAX) out.push({ field: "credits", message: `Up to ${CREDITS_MAX} credits` });
  form.credits.forEach((c, i) => {
    const name = c.name.trim();
    const role = c.role.trim();
    const n = i + 1;
    if (!name) out.push({ field: `credit-${c.key}-name`, message: `Credit ${n}: add a name` });
    else if (runes(name) > CREDIT_NAME_MAX) out.push({ field: `credit-${c.key}-name`, message: `Credit ${n}: the name is too long (${CREDIT_NAME_MAX} characters at most)` });
    else if (CONTROL_RE.test(name)) out.push({ field: `credit-${c.key}-name`, message: `Credit ${n}: the name has a character that can't be used` });
    if (!role) out.push({ field: `credit-${c.key}-role`, message: `Credit ${n}: add a role` });
    else if (runes(role) > CREDIT_ROLE_MAX) out.push({ field: `credit-${c.key}-role`, message: `Credit ${n}: the role is too long (${CREDIT_ROLE_MAX} characters at most)` });
    else if (CONTROL_RE.test(role)) out.push({ field: `credit-${c.key}-role`, message: `Credit ${n}: the role has a character that can't be used` });
  });
  if (form.genres.length > GENRES_MAX) out.push({ field: "genres", message: `Up to ${GENRES_MAX} genres` });
  const year = parseReleaseYear(form.releaseYear);
  if (year !== null && (Number.isNaN(year) || year < RELEASE_YEAR_MIN || year > maxReleaseYear(now))) {
    out.push({ field: "releaseYear", message: `Release year must be between ${RELEASE_YEAR_MIN} and ${maxReleaseYear(now)}` });
  }
  if (runes(form.productionHouse.trim()) > PRODUCTION_HOUSE_MAX) out.push({ field: "productionHouse", message: `Production house is too long (${PRODUCTION_HOUSE_MAX} characters at most)` });
  return out;
}

/* ── Wire ───────────────────────────────────────────────── */

export interface CreditWire {
  name: string;
  role: string;
  user_id?: string;
}

/** The form's rows as the request item, in order; the same account twice in one role keeps the first. */
export function creditsToWire(rows: readonly CreditDraft[]): CreditWire[] {
  const out: CreditWire[] = [];
  const tagged = new Set<string>();
  for (const r of rows.slice(0, CREDITS_MAX)) {
    const name = r.name.trim();
    const role = r.role.trim();
    if (!name || !role) continue;
    const item: CreditWire = { name, role };
    const key = r.user ? `${r.user.id}\u0000${role.toLowerCase()}` : "";
    if (r.user && !tagged.has(key)) {
      tagged.add(key);
      item.user_id = r.user.id;
    }
    out.push(item);
  }
  return out;
}

export interface CreditsFields {
  credits?: CreditWire[];
  genres?: string[];
  /** null clears (PATCH and drafts). */
  release_year?: number | null;
  /** null clears (PATCH and drafts). */
  production_house?: string | null;
}

function validYear(raw: string, now: Date): number | null {
  const y = parseReleaseYear(raw);
  return y !== null && !Number.isNaN(y) && y >= RELEASE_YEAR_MIN && y <= maxReleaseYear(now) ? y : null;
}

export interface CreditsContext {
  /** The topic slug chosen for the video. */
  category: string;
  /** The upload will be a long video (credits are refused on shorts/reels/posts). */
  longVideo: boolean;
}

/** Whether this upload is offered (and sends) credits. */
export function creditsApply(ctx: CreditsContext): boolean {
  return ctx.longVideo && categoryTakesCredits(ctx.category);
}

/**
 * POST /v1/posts (the direct create): the credit keys only when the video
 * is long and its topic takes credits, and only the ones that hold
 * something. {} otherwise.
 */
export function creditsCreateFields(form: CreditsForm, ctx: CreditsContext, now = new Date()): CreditsFields {
  if (!creditsApply(ctx)) return {};
  const out: CreditsFields = {};
  const credits = creditsToWire(form.credits);
  if (credits.length) out.credits = credits;
  if (form.genres.length) out.genres = form.genres.slice(0, GENRES_MAX);
  const year = validYear(form.releaseYear, now);
  if (year !== null) out.release_year = year;
  const house = form.productionHouse.trim();
  if (house) out.production_house = house;
  return out;
}

/**
 * A draft save replaces what the draft holds. A topic that takes credits
 * sends all four keys (an empty list, a blank year or house as the clear,
 * so a year typed and then removed does not stay on the draft); one that
 * does not (the creator moved away from a film topic) clears all four, so
 * a switched topic never publishes stale credits. A short sends nothing:
 * the server refuses credits there.
 */
export function creditsDraftFields(form: CreditsForm, ctx: CreditsContext, now = new Date()): CreditsFields {
  if (!ctx.longVideo) return {};
  if (!categoryTakesCredits(ctx.category)) return { credits: [], genres: [], release_year: null, production_house: null };
  return {
    credits: creditsToWire(form.credits),
    genres: form.genres.slice(0, GENRES_MAX),
    release_year: validYear(form.releaseYear, now),
    production_house: form.productionHouse.trim() || null,
  };
}

/**
 * The Hub's PATCH keys: only what moved (omitted = unchanged). `credits`
 * REPLACES the list on the server, so a change sends the whole list ([]
 * clears; genres the same). A cleared year or production house goes as
 * null.
 */
export function creditsEditPatch(base: CreditsForm, next: CreditsForm, now = new Date()): CreditsFields {
  const out: CreditsFields = {};
  const a = creditsToWire(base.credits);
  const b = creditsToWire(next.credits);
  if (JSON.stringify(a) !== JSON.stringify(b)) out.credits = b;
  if (base.genres.join(",") !== next.genres.join(",")) out.genres = next.genres.slice(0, GENRES_MAX);
  const yearA = validYear(base.releaseYear, now);
  const yearB = validYear(next.releaseYear, now);
  if (yearA !== yearB) out.release_year = yearB;
  if (base.productionHouse.trim() !== next.productionHouse.trim()) out.production_house = next.productionHouse.trim() || null;
  return out;
}

/* ── Server refusals (400s on create, drafts and PATCH) ─── */

/**
 * The credit codes the post routes answer, as the editor field they belong
 * to and a sentence for people (the server's message is for developers).
 * The field is the one CreditsEditor draws the problem under.
 */
const CREDITS_ERROR_PROBLEMS: Record<string, CreditsProblem> = {
  CREDITS_NOT_ALLOWED: { field: "credits", message: "Credits can only be added to long videos." },
  TOO_MANY_CREDITS: { field: "credits", message: `A video can have up to ${CREDITS_MAX} credits.` },
  INVALID_CREDIT: { field: "credits", message: `Each credit needs a name (up to ${CREDIT_NAME_MAX} characters) and a role (up to ${CREDIT_ROLE_MAX}).` },
  INVALID_GENRE: { field: "genres", message: `Pick up to ${GENRES_MAX} genres from the list.` },
  INVALID_RELEASE_YEAR: { field: "releaseYear", message: `Release year must be between ${RELEASE_YEAR_MIN} and next year.` },
  INVALID_PRODUCTION_HOUSE: { field: "productionHouse", message: `Production house can be up to ${PRODUCTION_HOUSE_MAX} characters.` },
};

/** A server code → the editor problem it stands for; null for a code that is not about credits. */
export function creditsErrorProblem(code: string | null | undefined): CreditsProblem | null {
  if (!code) return null;
  return CREDITS_ERROR_PROBLEMS[code.toUpperCase()] ?? null;
}

/* ── Consent answers (accept / decline / remove) ────────── */

/** `{data:{status}}` (or a bare `{status}`) → the credit's new status; null when it is not one. */
export function decodeCreditAnswer(envelope: unknown): CreditStatus | null {
  const body = isRecord(envelope) && isRecord(envelope.data) ? envelope.data : envelope;
  if (!isRecord(body)) return null;
  const status = str(body.status).toLowerCase();
  return STATUSES.includes(status as CreditStatus) ? (status as CreditStatus) : null;
}

/* ── Credit requests (GET /v1/credits/requests) ─────────── */

export interface CreditRequest {
  id: string;
  role: string;
  name: string;
  post: { id: string; title: string; coverUrl: string; channelName: string };
  from: CreditUser;
  createdAt: string;
}

export function decodeCreditRequest(raw: unknown): CreditRequest | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  const post = isRecord(raw.post) ? raw.post : null;
  const postId = post ? str(post.id) : "";
  if (!id || !postId || !post) return null;
  const from = decodeCreditUser(raw.from) ?? { id: "", username: "", displayName: "Someone", avatarUrl: "" };
  return {
    id,
    role: str(raw.role).trim(),
    name: str(raw.name).trim(),
    post: { id: postId, title: str(post.title).trim() || "Untitled", coverUrl: avatar(str(post.cover_url)), channelName: str(post.channel_name).trim() },
    from,
    createdAt: str(raw.created_at),
  };
}

export function decodeCreditRequestsPage(envelope: unknown): { items: CreditRequest[]; nextCursor: string | null } {
  const e = isRecord(envelope) ? envelope : {};
  const items = Array.isArray(e.data) ? e.data.map(decodeCreditRequest).filter((r): r is CreditRequest => r !== null) : [];
  const meta = isRecord(e.meta) ? e.meta : {};
  const next = str(meta.next_cursor);
  return { items, nextCursor: next || null };
}

/* The requests list with optimistic Accept / Decline and rollback. */

export type CreditAnswer = "accept" | "decline";

export interface RequestsState {
  items: CreditRequest[];
  /** Answered on screen, waiting for the server: the row and where it was. */
  inFlight: Record<string, { item: CreditRequest; index: number; answer: CreditAnswer }>;
  /** The last failure, in words; cleared by the next answer. */
  error: string | null;
}

export type RequestsAction =
  | { type: "loaded"; items: CreditRequest[] }
  | { type: "answer"; id: string; answer: CreditAnswer }
  | { type: "settled"; id: string }
  | { type: "failed"; id: string; message: string };

export const INITIAL_REQUESTS_STATE: RequestsState = { items: [], inFlight: {}, error: null };

export function requestsReducer(state: RequestsState, action: RequestsAction): RequestsState {
  switch (action.type) {
    case "loaded": {
      // A refetch never brings back a row answered on screen.
      const items = action.items.filter((r) => !state.inFlight[r.id]);
      return { ...state, items };
    }
    case "answer": {
      const index = state.items.findIndex((r) => r.id === action.id);
      if (index < 0 || state.inFlight[action.id]) return state;
      const item = state.items[index];
      return {
        items: state.items.filter((r) => r.id !== action.id),
        inFlight: { ...state.inFlight, [action.id]: { item, index, answer: action.answer } },
        error: null,
      };
    }
    case "settled": {
      if (!state.inFlight[action.id]) return state;
      const inFlight = { ...state.inFlight };
      delete inFlight[action.id];
      return { ...state, inFlight };
    }
    case "failed": {
      const pending = state.inFlight[action.id];
      if (!pending) return state;
      const inFlight = { ...state.inFlight };
      delete inFlight[action.id];
      const items = state.items.filter((r) => r.id !== action.id);
      items.splice(Math.min(pending.index, items.length), 0, pending.item);
      return { items, inFlight, error: action.message };
    }
  }
}

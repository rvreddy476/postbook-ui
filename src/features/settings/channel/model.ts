/*
  Branding — the pure side of the channel settings page.

  Wire (post-service, `GET /v1/channels/me` and `PATCH /v1/channels/me`):
  name, handle, about, avatar_media_id, banner_media_id, links [{title,url}]
  (≤10, https only, title ≤40), contact_email, featured_post_id. A PATCH
  carries only the keys that changed; `null` clears a media id or the
  featured post, "" clears the contact email, the links array is replaced
  whole.

  Server limits mirrored here (post-service internal/service/channels.go):
  name 3–40 runes, about ≤200 runes, handle 3–30 `^[a-z0-9][a-z0-9_.]*[a-z0-9]$`
  with no "..".
*/

export const MAX_LINKS = 10;
export const MAX_LINK_TITLE = 40;
export const NAME_MIN = 3;
export const NAME_MAX = 40;
export const ABOUT_MAX = 200;
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

const HANDLE_RE = /^[a-z0-9][a-z0-9_.]*[a-z0-9]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ChannelLink {
  title: string;
  url: string;
}

/** The editable state of the page: one object, compared whole on Save. */
export interface ChannelBranding {
  name: string;
  handle: string;
  about: string;
  avatar_media_id: string | null;
  banner_media_id: string | null;
  links: ChannelLink[];
  contact_email: string;
  featured_post_id: string | null;
}

export type BrandingField = keyof ChannelBranding;

/** `GET /v1/channels/me` as this page reads it (a superset of ChannelInfo). */
export interface ChannelBrandingWire {
  user_id?: string;
  name?: string | null;
  handle?: string | null;
  about?: string | null;
  /** Older rows and the legacy channel type spell it `description`. */
  description?: string | null;
  avatar_media_id?: string | null;
  avatar_url?: string | null;
  banner_media_id?: string | null;
  banner_url?: string | null;
  links?: ChannelLink[] | null;
  contact_email?: string | null;
  featured_post_id?: string | null;
  subscriber_count?: number;
  video_count?: number;
  short_count?: number;
  live_count?: number;
  collection_count?: number;
}

/** What `PATCH /v1/channels/me` receives: only the changed keys. */
export interface ChannelPatch {
  name?: string;
  handle?: string;
  about?: string;
  avatar_media_id?: string | null;
  banner_media_id?: string | null;
  links?: ChannelLink[];
  contact_email?: string;
  featured_post_id?: string | null;
}

export type FieldErrors = Partial<Record<BrandingField, string>> & {
  /** Per-row link errors, by row index. */
  linkRows?: Record<number, { title?: string; url?: string }>;
};

export const EMPTY_BRANDING: ChannelBranding = {
  name: "",
  handle: "",
  about: "",
  avatar_media_id: null,
  banner_media_id: null,
  links: [],
  contact_email: "",
  featured_post_id: null,
};

function emptyToNull(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s ? s : null;
}

/** The form state for a channel as the server returned it. */
export function brandingFromChannel(c: ChannelBrandingWire | null | undefined): ChannelBranding {
  if (!c) return { ...EMPTY_BRANDING, links: [] };
  return {
    name: c.name ?? "",
    handle: c.handle ?? "",
    about: c.about ?? c.description ?? "",
    avatar_media_id: emptyToNull(c.avatar_media_id),
    banner_media_id: emptyToNull(c.banner_media_id),
    links: normalizeLinks(Array.isArray(c.links) ? c.links : []),
    contact_email: (c.contact_email ?? "").trim(),
    featured_post_id: emptyToNull(c.featured_post_id),
  };
}

/** Trim both fields and drop rows that are empty on both sides. */
export function normalizeLinks(links: ReadonlyArray<Partial<ChannelLink> | null | undefined>): ChannelLink[] {
  const out: ChannelLink[] = [];
  for (const raw of links) {
    if (!raw) continue;
    const title = (raw.title ?? "").trim();
    const url = (raw.url ?? "").trim();
    if (!title && !url) continue;
    out.push({ title, url });
  }
  return out;
}

export function isHttpsUrl(value: string): boolean {
  const s = value.trim();
  if (!/^https:\/\//i.test(s)) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !!u.hostname && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Lowercase, drop a leading "@", keep only what the server accepts. */
export function normalizeHandleInput(value: string): string {
  return value.trim().toLowerCase().replace(/^@+/, "").replace(/[^a-z0-9_.]/g, "").slice(0, HANDLE_MAX);
}

export function isValidHandle(handle: string): boolean {
  return handle.length >= HANDLE_MIN && handle.length <= HANDLE_MAX && HANDLE_RE.test(handle) && !handle.includes("..");
}

/** A handle base from free text (display name or username), like the server's SlugifyHandle. */
export function suggestHandle(seed: string): string {
  const s = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, HANDLE_MAX);
  return s.length >= HANDLE_MIN ? s.replace(/\.+$/g, "") : "";
}

function runes(s: string): number {
  return Array.from(s).length;
}

/** Every rule the server enforces, applied before the request leaves. */
export function validateBranding(b: ChannelBranding): FieldErrors {
  const errors: FieldErrors = {};
  const name = b.name.trim();
  if (runes(name) < NAME_MIN || runes(name) > NAME_MAX) errors.name = `Name is ${NAME_MIN}–${NAME_MAX} characters.`;
  const handle = normalizeHandleInput(b.handle);
  if (!isValidHandle(handle)) errors.handle = `Handle is ${HANDLE_MIN}–${HANDLE_MAX} characters: letters, digits, "." or "_", starting and ending with a letter or digit.`;
  if (runes(b.about.trim()) > ABOUT_MAX) errors.about = `About is at most ${ABOUT_MAX} characters.`;
  const email = b.contact_email.trim();
  if (email && !EMAIL_RE.test(email)) errors.contact_email = "Enter a valid email address.";

  const links = normalizeLinks(b.links);
  if (links.length > MAX_LINKS) errors.links = `Up to ${MAX_LINKS} links.`;
  const rows: NonNullable<FieldErrors["linkRows"]> = {};
  // Row indexes are those of the draft, so an empty row in the middle keeps
  // the numbering the user sees.
  b.links.forEach((raw, i) => {
    const title = raw.title.trim();
    const url = raw.url.trim();
    if (!title && !url) return;
    const row: { title?: string; url?: string } = {};
    if (!title) row.title = "Give this link a title.";
    else if (runes(title) > MAX_LINK_TITLE) row.title = `Titles are at most ${MAX_LINK_TITLE} characters.`;
    if (!isHttpsUrl(url)) row.url = "Links must start with https://";
    if (row.title || row.url) rows[i] = row;
  });
  if (Object.keys(rows).length) {
    errors.linkRows = rows;
    errors.links = errors.links ?? "Fix the links marked below.";
  }
  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).some((k) => k !== "linkRows") || !!(errors.linkRows && Object.keys(errors.linkRows).length);
}

export class BrandingValidationError extends Error {
  readonly errors: FieldErrors;
  constructor(errors: FieldErrors) {
    super("Branding has invalid fields");
    this.name = "BrandingValidationError";
    this.errors = errors;
  }
}

function sameLinks(a: ChannelLink[], b: ChannelLink[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((l, i) => l.title === b[i].title && l.url === b[i].url);
}

/**
 * The PATCH body: only the keys whose normalised value differs from
 * `before`. Throws BrandingValidationError when `after` breaks a server
 * rule, so nothing invalid is ever sent.
 */
export function channelPatch(before: ChannelBranding, after: ChannelBranding): ChannelPatch {
  const errors = validateBranding(after);
  if (hasErrors(errors)) throw new BrandingValidationError(errors);

  const base = brandingFromChannel({
    name: before.name,
    handle: before.handle,
    about: before.about,
    avatar_media_id: before.avatar_media_id,
    banner_media_id: before.banner_media_id,
    links: before.links,
    contact_email: before.contact_email,
    featured_post_id: before.featured_post_id,
  });
  const next: ChannelBranding = {
    name: after.name.trim(),
    handle: normalizeHandleInput(after.handle),
    about: after.about.trim(),
    avatar_media_id: emptyToNull(after.avatar_media_id),
    banner_media_id: emptyToNull(after.banner_media_id),
    links: normalizeLinks(after.links).slice(0, MAX_LINKS),
    contact_email: after.contact_email.trim(),
    featured_post_id: emptyToNull(after.featured_post_id),
  };

  const patch: ChannelPatch = {};
  if (next.name !== base.name) patch.name = next.name;
  if (next.handle !== base.handle) patch.handle = next.handle;
  if (next.about !== base.about) patch.about = next.about;
  if (next.avatar_media_id !== base.avatar_media_id) patch.avatar_media_id = next.avatar_media_id;
  if (next.banner_media_id !== base.banner_media_id) patch.banner_media_id = next.banner_media_id;
  if (!sameLinks(next.links, base.links)) patch.links = next.links;
  if (next.contact_email !== base.contact_email) patch.contact_email = next.contact_email;
  if (next.featured_post_id !== base.featured_post_id) patch.featured_post_id = next.featured_post_id;
  return patch;
}

/** True when a Save would send something. Invalid drafts count as dirty. */
export function isDirty(before: ChannelBranding, after: ChannelBranding): boolean {
  try {
    return Object.keys(channelPatch(before, after)).length > 0;
  } catch (e) {
    if (e instanceof BrandingValidationError) return true;
    throw e;
  }
}

/** Move the row at `index` one step; out-of-range moves return the same array. */
export function moveLink<T>(links: ReadonlyArray<T>, index: number, direction: "up" | "down"): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= links.length || target < 0 || target >= links.length) return [...links];
  const out = [...links];
  [out[index], out[target]] = [out[target], out[index]];
  return out;
}

/* ── Errors from the server ─────────────────────────────── */

export interface ApiFieldError {
  status?: number;
  code: string;
  message: string;
  field?: BrandingField;
}

const CODE_TO_FIELD: Record<string, BrandingField> = {
  INVALID_NAME: "name",
  INVALID_HANDLE: "handle",
  HANDLE_TAKEN: "handle",
  INVALID_ABOUT: "about",
  INVALID_AVATAR: "avatar_media_id",
  INVALID_BANNER: "banner_media_id",
  INVALID_LINK: "links",
  INVALID_LINKS: "links",
  TOO_MANY_LINKS: "links",
  INVALID_CONTACT_EMAIL: "contact_email",
  INVALID_EMAIL: "contact_email",
  INVALID_FEATURED_POST: "featured_post_id",
  INVALID_FEATURED: "featured_post_id",
  FEATURED_NOT_FOUND: "featured_post_id",
};

const FIELDS: BrandingField[] = ["name", "handle", "about", "avatar_media_id", "banner_media_id", "links", "contact_email", "featured_post_id"];

function isBrandingField(v: unknown): v is BrandingField {
  return typeof v === "string" && (FIELDS as string[]).includes(v);
}

/**
 * Reads the `{error:{code,message,details}}` envelope off an axios error and
 * names the field it belongs to: by code first, then `details.field`, then a
 * field name mentioned in the message. Anything else is a page-level error.
 */
export function readApiError(err: unknown): ApiFieldError {
  const resp = (err as { response?: { status?: number; data?: { error?: { code?: string; message?: string; details?: unknown } } } })?.response;
  const status = resp?.status;
  const e = resp?.data?.error;
  const code = typeof e?.code === "string" ? e.code : "UNKNOWN";
  const message = typeof e?.message === "string" && e.message ? e.message : status ? `Request failed (${status})` : "Could not reach the server.";
  let field: BrandingField | undefined = CODE_TO_FIELD[code];
  const details = e?.details as { field?: unknown } | undefined;
  if (!field && details && typeof details === "object" && isBrandingField(details.field)) field = details.field;
  if (!field && status && status >= 400 && status < 500) {
    const lower = message.toLowerCase();
    field = FIELDS.find((f) => lower.includes(f.replace(/_/g, " ")) || lower.includes(f));
  }
  return { status, code, message, field };
}

/** Field errors for the form from one server rejection. */
export function fieldErrorsFromApi(err: unknown): { errors: FieldErrors; pageMessage?: string } {
  const e = readApiError(err);
  if (e.field) return { errors: { [e.field]: e.message } };
  return { errors: {}, pageMessage: e.message };
}

/*
  The /l/<id> redirect page, the pure half: the link decoder, the
  per-browser memory of domains already shown the "You're leaving VChat"
  page, and the decision between that page and an immediate redirect.

  GET /v1/links/:id (public) → {id, url, domain, label, status}; 404 when
  the link is not active. The first visit to a domain in this browser shows
  the interstitial; Continue remembers the domain, so the next link there
  redirects at once. The memory is localStorage, wrapped in try/catch: a
  blocked or private-window storage only means the page is shown again.
*/

export interface LinkTarget {
  id: string
  url: string
  domain: string
  label: string
  status: string
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

/** Only an https link is ever navigated to (the server takes nothing else); anything else is no link. */
export function safeTarget(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === "https:" && !!u.hostname ? u.toString() : null
  } catch {
    return null
  }
}

/** The host as the memory keys it: lower case, no trailing dot, no www. */
export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "")
}

/**
  The links route's body → the target, or null when there is nothing to
  open (no id, no https url, or a status that is not active).
*/
export function decodeLink(body: unknown): LinkTarget | null {
  const raw = body && typeof body === "object" && !Array.isArray(body) && "data" in (body as object) ? (body as { data: unknown }).data : body
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const w = raw as Record<string, unknown>
  const id = str(w.id)
  const url = safeTarget(str(w.url))
  if (!id || !url) return null
  const status = str(w.status).toLowerCase() || "active"
  if (status !== "active") return null
  // The page names, and remembers, where the browser will actually go: the
  // url's own host, not the `domain` field beside it.
  const domain = normalizeDomain(new URL(url).hostname)
  return { id, url, domain, label: str(w.label), status }
}

/* ── the memory of domains seen ──────────────────────────────────── */

export const SEEN_DOMAINS_KEY = "vchat:leaving-seen-domains"
/** Enough for anyone; the oldest fall off first. */
export const MAX_SEEN_DOMAINS = 500

export type StorageLike = Pick<Storage, "getItem" | "setItem">

export interface SeenDomains {
  has(domain: string): boolean
  add(domain: string): void
}

function read(storage: StorageLike | null): string[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(SEEN_DOMAINS_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((d): d is string => typeof d === "string" && d.length > 0) : []
  } catch {
    return []
  }
}

/** The browser's storage, or null when it cannot be reached (server render, blocked site data). */
export function browserStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

/** The per-browser set of domains whose leaving page was already shown and continued. */
export function seenDomains(storage: StorageLike | null = browserStorage()): SeenDomains {
  return {
    has(domain) {
      const d = normalizeDomain(domain)
      return !!d && read(storage).includes(d)
    },
    add(domain) {
      const d = normalizeDomain(domain)
      if (!d || !storage) return
      const next = [...read(storage).filter((x) => x !== d), d].slice(-MAX_SEEN_DOMAINS)
      try {
        storage.setItem(SEEN_DOMAINS_KEY, JSON.stringify(next))
      } catch {
        // Storage full or blocked: the page is shown again next time, which is safe.
      }
    },
  }
}

export type LinkVisit = { kind: "redirect"; url: string } | { kind: "interstitial"; url: string; domain: string }

/** A domain seen before redirects at once; a new one gets the "You're leaving VChat" page. */
export function decideLinkVisit(target: LinkTarget, seen: SeenDomains): LinkVisit {
  return seen.has(target.domain) ? { kind: "redirect", url: target.url } : { kind: "interstitial", url: target.url, domain: target.domain }
}

/** Continue on the leaving page: remember the domain, then go. Returns where to go. */
export function continueTo(target: LinkTarget, seen: SeenDomains): string {
  seen.add(target.domain)
  return target.url
}

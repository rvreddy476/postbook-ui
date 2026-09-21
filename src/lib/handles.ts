import api from '@/lib/api'

/**
 * Handles for groups and channels are derived, never asked for.
 *
 * A person is asked for a handle ONCE, when they create their account.
 * Making them invent another one for every group and channel is a second
 * naming decision for something nobody types — these handles only ever
 * appear in a URL. So the name becomes the handle, and a collision is
 * resolved silently rather than thrown back at the person as a form error.
 */

/** The longest a derived handle may be, matching the server's column. */
const MAX_HANDLE = 50
/** The server rejects anything shorter than this. */
const MIN_HANDLE = 3

/**
 * Turn a display name into a candidate handle: lowercase, ASCII letters
 * and digits, single hyphens, no leading or trailing hyphen.
 *
 * A name written entirely in a non-Latin script slugifies to nothing, so
 * the caller must handle an empty result — `deriveUniqueHandle` does.
 */
export function slugifyHandle(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_HANDLE)
}

/** Short, lowercase, no vowels to stumble over. */
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7)
}

/** Append a suffix without letting the handle run past the column width. */
function withSuffix(base: string, suffix: string): string {
  const room = MAX_HANDLE - suffix.length - 1
  return `${base.slice(0, Math.max(1, room))}-${suffix}`
}

/**
 * Find a free handle for `name`, asking `isAvailable` as few times as it
 * can.
 *
 * `isAvailable` returns true for free, false for taken, and null when the
 * server would not say — a 404 on the check route, or any error. A null is
 * treated as "cannot know", and we hand back the candidate anyway rather
 * than spinning: the create call is the real authority and will reject a
 * duplicate, which the caller surfaces.
 */
export async function deriveUniqueHandle(
  name: string,
  isAvailable: (handle: string) => Promise<boolean | null>,
): Promise<string> {
  const base = slugifyHandle(name)
  // Nothing survived slugification (a name in another script, or only
  // punctuation), or it is too short for the server to accept.
  const seed = base.length >= MIN_HANDLE ? base : `${base ? base + '-' : ''}${randomSuffix()}`

  const candidates = [
    seed,
    withSuffix(seed, '2'),
    withSuffix(seed, '3'),
    withSuffix(seed, randomSuffix()),
  ]

  for (const candidate of candidates) {
    const free = await isAvailable(candidate)
    if (free === null) return candidate // server would not say; let create decide
    if (free) return candidate
  }

  // Four takes is enough to say the name is crowded; a fresh random tail
  // is effectively certain to be free and the person never sees it.
  return withSuffix(seed, randomSuffix())
}

/** Availability probe for a broadcast channel handle. */
export async function channelHandleAvailable(handle: string): Promise<boolean | null> {
  try {
    const res = await api.get<{ data: { available: boolean } }>(
      '/v1/broadcast-channels/check-handle',
      { params: { handle } },
    )
    return res.data.data.available
  } catch {
    return null
  }
}

/** Availability probe for a group handle. */
export async function groupHandleAvailable(handle: string): Promise<boolean | null> {
  try {
    const res = await api.post<{ data: { available: boolean } }>(
      '/v1/groups/handle/check',
      { handle },
    )
    return res.data.data.available
  } catch {
    return null
  }
}

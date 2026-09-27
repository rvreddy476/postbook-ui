/** Username characters allowed in a mention; the backend accepts 2–30 of them. */
const USERNAME_CHAR = /[A-Za-z0-9._]/
const WORD_CHAR = /[A-Za-z0-9_]/

export interface ActiveMention {
  /** Text typed after the `@`, at least one character. */
  query: string
  /** Index of the `@` in the text. */
  start: number
}

/**
 * The mention being typed at `caret`, or null. Walks back from the caret over
 * username characters to an `@`; a space or a second `@` ends the run, and an
 * `@` glued to a preceding word character (an email address) is not a mention.
 */
export function activeMention(text: string, caret: number): ActiveMention | null {
  const end = Math.max(0, Math.min(caret, text.length))
  let index = end - 1
  while (index >= 0 && USERNAME_CHAR.test(text[index])) index--
  if (index < 0 || text[index] !== '@') return null
  const query = text.slice(index + 1, end)
  if (query.length === 0) return null
  if (index > 0 && WORD_CHAR.test(text[index - 1])) return null
  return { query, start: index }
}

/** Replace the mention run `[start, caret)` with `@username ` and put the caret after the space. */
export function insertMention(text: string, start: number, caret: number, username: string): { text: string; caret: number } {
  const from = Math.max(0, Math.min(start, text.length))
  const to = Math.max(from, Math.min(caret, text.length))
  const token = `@${username} `
  return { text: text.slice(0, from) + token + text.slice(to), caret: from + token.length }
}

export type MentionSegment = { type: 'text'; value: string } | { type: 'mention'; username: string }

const MENTION = /(^|[^A-Za-z0-9_@])@([A-Za-z0-9._]{2,30})/g

/**
 * Split a body into plain text and `@username` mentions. A trailing dot is
 * punctuation, not part of the name, so "@bob." links bob and keeps the dot.
 */
export function splitMentions(body: string): MentionSegment[] {
  const segments: MentionSegment[] = []
  if (!body) return segments
  let last = 0
  MENTION.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MENTION.exec(body)) !== null) {
    const lead = match[1]
    let username = match[2]
    let trailing = ''
    while (username.length > 0 && username.endsWith('.')) { username = username.slice(0, -1); trailing = '.' + trailing }
    if (username.length < 2) { MENTION.lastIndex = match.index + 1; continue }
    const mentionStart = match.index + lead.length
    if (mentionStart > last) segments.push({ type: 'text', value: body.slice(last, mentionStart) })
    segments.push({ type: 'mention', username })
    last = mentionStart + 1 + username.length
    MENTION.lastIndex = last
  }
  if (last < body.length) segments.push({ type: 'text', value: body.slice(last) })
  return segments
}

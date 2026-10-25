/*
  Hidden chats: what a secret key and a chat password may be (contract
  24 Oct 2026). The server checks the same rules; these only stop a form
  from sending something it would refuse.

  Secret key     4–12 letters or digits (A–Z, a–z, 0–9), typed into search.
  Chat password  6–64 characters, and not the same as the secret key.
*/

export const SECRET_KEY_MIN = 4
export const SECRET_KEY_MAX = 12
export const CHAT_PASSWORD_MIN = 6
export const CHAT_PASSWORD_MAX = 64

const KEY_PATTERN = /^[A-Za-z0-9]+$/

/** Characters as a person counts them (an emoji is one, not two UTF-16 units). */
export function charCount(value: string): number {
  return Array.from(value).length
}

export function secretKeyProblem(key: string): string | null {
  if (!key) return 'Enter a secret key.'
  if (!KEY_PATTERN.test(key)) return 'Use letters and numbers only, with no spaces.'
  if (key.length < SECRET_KEY_MIN) return `Use at least ${SECRET_KEY_MIN} letters or numbers.`
  if (key.length > SECRET_KEY_MAX) return `Use at most ${SECRET_KEY_MAX} letters or numbers.`
  return null
}

export function chatPasswordProblem(password: string): string | null {
  if (!password) return 'Enter a chat password.'
  const n = charCount(password)
  if (n < CHAT_PASSWORD_MIN) return `Use at least ${CHAT_PASSWORD_MIN} characters.`
  if (n > CHAT_PASSWORD_MAX) return `Use at most ${CHAT_PASSWORD_MAX} characters.`
  return null
}

/**
 * Whether text typed into chat search could be a secret key: the search box
 * then also tries it, quietly. Surrounding spaces are not part of a key.
 */
export function couldBeSecretKey(text: string): boolean {
  const t = text.trim()
  return t.length >= SECRET_KEY_MIN && t.length <= SECRET_KEY_MAX && KEY_PATTERN.test(t)
}

export interface SetupForm {
  secretKey: string
  chatPassword: string
  confirmPassword: string
}

export interface FormProblems {
  secretKey?: string
  chatPassword?: string
  confirmPassword?: string
  form?: string
}

const none = (p: FormProblems) => Object.keys(p).length === 0

/** First-time setup and reset: both secrets, confirmed, and different. */
export function setupProblems(f: SetupForm): FormProblems | null {
  const p: FormProblems = {}
  const key = secretKeyProblem(f.secretKey)
  if (key) p.secretKey = key
  const pw = chatPasswordProblem(f.chatPassword)
  if (pw) p.chatPassword = pw
  else if (f.confirmPassword !== f.chatPassword) p.confirmPassword = "The passwords don't match."
  if (!key && !pw && f.secretKey === f.chatPassword) p.chatPassword = 'Your chat password must be different from your secret key.'
  return none(p) ? null : p
}

export interface ChangeForm {
  currentPassword: string
  /** Empty = keep the current secret key. */
  newSecretKey: string
  /** Empty = keep the current chat password. */
  newPassword: string
  confirmPassword: string
}

/** Change: the current chat password, and at least one new secret. */
export function changeProblems(f: ChangeForm): FormProblems | null {
  const p: FormProblems = {}
  if (!f.currentPassword) p.form = 'Enter your current chat password.'
  if (!f.newSecretKey && !f.newPassword) p.form = p.form ?? 'Enter a new secret key, a new chat password, or both.'
  if (f.newSecretKey) {
    const key = secretKeyProblem(f.newSecretKey)
    if (key) p.secretKey = key
  }
  if (f.newPassword) {
    const pw = chatPasswordProblem(f.newPassword)
    if (pw) p.chatPassword = pw
    else if (f.confirmPassword !== f.newPassword) p.confirmPassword = "The passwords don't match."
  }
  if (!p.secretKey && !p.chatPassword && f.newSecretKey && f.newSecretKey === f.newPassword) {
    p.chatPassword = 'Your chat password must be different from your secret key.'
  }
  if (!p.secretKey && f.newSecretKey && !f.newPassword && f.newSecretKey === f.currentPassword) {
    p.secretKey = 'Your secret key must be different from your chat password.'
  }
  return none(p) ? null : p
}

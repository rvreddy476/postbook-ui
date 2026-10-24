import { describe, expect, test } from 'bun:test'

import {
  changeProblems,
  charCount,
  chatPasswordProblem,
  couldBeSecretKey,
  secretKeyProblem,
  setupProblems,
} from '../validation'

describe('secret key: 4–12 letters or digits', () => {
  test.each(['abcd', 'ABCD', 'a1b2', '1234', 'abcdefghijkl', 'Zz09Zz09Zz09'])('accepts %p', (k) => {
    expect(secretKeyProblem(k)).toBeNull()
  })

  test('the length bounds are inclusive and exact', () => {
    expect(secretKeyProblem('abc')).toContain('at least 4')
    expect(secretKeyProblem('abcd')).toBeNull()
    expect(secretKeyProblem('abcdefghijkl')).toBeNull()
    expect(secretKeyProblem('abcdefghijklm')).toContain('at most 12')
  })

  test.each(['ab cd', 'abcd!', 'abc-d', 'ab_cd', 'ñandú12', 'abcd ', ' abcd', '１２３４'])('refuses %p (letters and digits only)', (k) => {
    expect(secretKeyProblem(k)).toContain('letters and numbers only')
  })

  test('empty asks for one', () => {
    expect(secretKeyProblem('')).toBe('Enter a secret key.')
  })
})

describe('chat password: 6–64 characters', () => {
  test('bounds are inclusive and exact', () => {
    expect(chatPasswordProblem('12345')).toContain('at least 6')
    expect(chatPasswordProblem('123456')).toBeNull()
    expect(chatPasswordProblem('x'.repeat(64))).toBeNull()
    expect(chatPasswordProblem('x'.repeat(65))).toContain('at most 64')
    expect(chatPasswordProblem('')).toBe('Enter a chat password.')
  })

  test('any characters count, an emoji as one', () => {
    expect(chatPasswordProblem('pass word!')).toBeNull()
    expect(charCount('😀😀😀😀😀😀')).toBe(6)
    expect(chatPasswordProblem('😀😀😀😀😀😀')).toBeNull()
    expect(chatPasswordProblem('😀'.repeat(64))).toBeNull()
    expect(chatPasswordProblem('😀'.repeat(65))).toContain('at most 64')
  })
})

describe('couldBeSecretKey (search box)', () => {
  test('a key-shaped search, trimmed', () => {
    expect(couldBeSecretKey('abcd')).toBe(true)
    expect(couldBeSecretKey('  abc123  ')).toBe(true)
    expect(couldBeSecretKey('abcdefghijkl')).toBe(true)
  })

  test('anything a key cannot be is never tried', () => {
    expect(couldBeSecretKey('abc')).toBe(false)
    expect(couldBeSecretKey('abcdefghijklm')).toBe(false)
    expect(couldBeSecretKey('john smith')).toBe(false)
    expect(couldBeSecretKey('@john')).toBe(false)
    expect(couldBeSecretKey('')).toBe(false)
  })
})

describe('setupProblems', () => {
  const ok = { secretKey: 'abcd12', chatPassword: 'hunter22', confirmPassword: 'hunter22' }

  test('valid, confirmed and different → no problems', () => {
    expect(setupProblems(ok)).toBeNull()
  })

  test('the two secrets must differ', () => {
    expect(setupProblems({ secretKey: 'abc123', chatPassword: 'abc123', confirmPassword: 'abc123' })?.chatPassword).toContain('different')
  })

  test('the confirmation must match', () => {
    expect(setupProblems({ ...ok, confirmPassword: 'hunter2' })?.confirmPassword).toContain("don't match")
  })

  test('each field reports its own problem', () => {
    const p = setupProblems({ secretKey: 'a b', chatPassword: '123', confirmPassword: '' })
    expect(p?.secretKey).toBeDefined()
    expect(p?.chatPassword).toBeDefined()
    expect(p?.confirmPassword).toBeUndefined()
  })
})

describe('changeProblems', () => {
  const base = { currentPassword: 'oldpass1', newSecretKey: '', newPassword: '', confirmPassword: '' }

  test('needs the current chat password', () => {
    expect(changeProblems({ ...base, currentPassword: '', newSecretKey: 'abcd' })?.form).toContain('current chat password')
  })

  test('needs at least one new secret', () => {
    expect(changeProblems(base)?.form).toContain('new secret key')
  })

  test('a new key alone is fine; it may not equal the current password', () => {
    expect(changeProblems({ ...base, newSecretKey: 'abcd' })).toBeNull()
    expect(changeProblems({ ...base, newSecretKey: 'oldpass1' })?.secretKey).toContain('different')
  })

  test('a new password alone must be confirmed', () => {
    expect(changeProblems({ ...base, newPassword: 'newpass1', confirmPassword: 'newpass1' })).toBeNull()
    expect(changeProblems({ ...base, newPassword: 'newpass1', confirmPassword: 'x' })?.confirmPassword).toBeDefined()
  })

  test('both new and equal is refused', () => {
    expect(changeProblems({ ...base, newSecretKey: 'abc123', newPassword: 'abc123', confirmPassword: 'abc123' })?.chatPassword).toContain('different')
  })

  test('invalid new values are refused', () => {
    expect(changeProblems({ ...base, newSecretKey: 'ab' })?.secretKey).toBeDefined()
    expect(changeProblems({ ...base, newPassword: '123', confirmPassword: '123' })?.chatPassword).toBeDefined()
  })
})

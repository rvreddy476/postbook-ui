import { describe, expect, it } from 'bun:test'
import { createIdempotencyKeyHolder } from '../idempotency'

/** A generator whose every call is distinguishable, so caching is observable. */
function counter() {
  let n = 0
  return () => `key-${++n}`
}

describe('createIdempotencyKeyHolder', () => {
  it('mints the key lazily, not at construction', () => {
    let calls = 0
    createIdempotencyKeyHolder(() => {
      calls++
      return 'k'
    })
    expect(calls).toBe(0)
  })

  /*
    The point of the whole module. The group dialog re-renders on every
    keystroke in the name and description fields; if the key were minted per
    render or per submit, a retry after a lost response would create a second
    group instead of returning the first.
  */
  it('is stable across repeated reads, so keystrokes and retries reuse one key', () => {
    const holder = createIdempotencyKeyHolder(counter())
    const first = holder.current()
    expect(holder.current()).toBe(first)
    expect(holder.current()).toBe(first)
    expect(first).toBe('key-1')
  })

  it('generates exactly once however many times it is read', () => {
    let calls = 0
    const holder = createIdempotencyKeyHolder(() => {
      calls++
      return 'k'
    })
    holder.current()
    holder.current()
    holder.current()
    expect(calls).toBe(1)
  })

  it('reset starts a new intent', () => {
    const holder = createIdempotencyKeyHolder(counter())
    expect(holder.current()).toBe('key-1')
    holder.reset()
    expect(holder.current()).toBe('key-2')
    expect(holder.current()).toBe('key-2')
  })

  it('gives each holder its own key, so two dialog-opens do not share one', () => {
    const generate = counter()
    const a = createIdempotencyKeyHolder(generate)
    const b = createIdempotencyKeyHolder(generate)
    expect(a.current()).toBe('key-1')
    expect(b.current()).toBe('key-2')
    expect(a.current()).toBe('key-1')
  })

  it('does not cache an empty key, so a later read recovers', () => {
    /*
      A blank key is what the server treats as absent. It must not stick as if
      it were a real value, or every read for the rest of the intent would send
      a blank one. crypto.randomUUID never does this — the guard exists so an
      injected or stubbed generator cannot poison the holder permanently.
    */
    let n = 0
    const holder = createIdempotencyKeyHolder(() => (n++ === 0 ? '' : 'real'))
    expect(holder.current()).toBe('')
    expect(holder.current()).toBe('real')
    expect(holder.current()).toBe('real')
  })

  it('defaults to crypto.randomUUID and returns distinct keys per holder', () => {
    const a = createIdempotencyKeyHolder().current()
    const b = createIdempotencyKeyHolder().current()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })
})

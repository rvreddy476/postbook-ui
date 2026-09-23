import { useRef } from 'react'

/**
 * One durable idempotency key per user intent.
 *
 * The axios interceptor in `src/lib/api.ts` stamps an `Idempotency-Key` header
 * on every write, which satisfies servers that require one — but it mints a
 * fresh UUID per attempt, so it cannot dedupe a retry. That is the case this
 * module exists for: a failed POST may in fact have COMMITTED before the
 * response was lost. Retrying with the SAME key returns the thing already
 * created; retrying with a fresh key creates it twice.
 *
 * This is the composer's `createKeyRef` / `nextCreateKey` pattern (see
 * `src/components/CreatePortal.tsx`) lifted out of the component so the
 * stability rule is testable on its own, rather than re-implemented per dialog.
 */

export interface IdempotencyKeyHolder {
  /** The key for this intent. Mints one on first call, then returns the same value. */
  current(): string
  /** Drop the key, so the next `current()` starts a new intent. */
  reset(): void
}

/**
 * Pure factory. `generate` is injectable so tests do not depend on
 * `crypto.randomUUID` being present or on the values it returns.
 */
export function createIdempotencyKeyHolder(
  generate: () => string = () => crypto.randomUUID(),
): IdempotencyKeyHolder {
  let key = ''
  return {
    current() {
      // Empty string, not null: a generator that returns "" would otherwise be
      // cached as a valid key and every retry would send a blank one, which the
      // server rejects as absent.
      if (!key) key = generate()
      return key
    },
    reset() {
      key = ''
    },
  }
}

/**
 * One holder per mount. A dialog that mounts on open and unmounts on close
 * therefore gets a fresh key per open, stable across every re-render in
 * between — typing in the name field does not change it, and neither does
 * clicking "Create" a second time after a network error.
 */
export function useIdempotencyKey(): IdempotencyKeyHolder {
  const ref = useRef<IdempotencyKeyHolder | null>(null)
  if (ref.current === null) ref.current = createIdempotencyKeyHolder()
  return ref.current
}

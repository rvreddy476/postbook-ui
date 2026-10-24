import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { MAX_PINNED_POSTS, PIN_LIMIT_MESSAGE, pinErrorCopy } from "../pinned"

/*
  PUT /v1/posts/:id/pin { pinned: true } on a 4th post: post-service answers
  409 { error: { code: "PIN_LIMIT" } }.
*/

const axiosError = (status: number | undefined, code?: string) => ({
  isAxiosError: true,
  response: status === undefined ? undefined : { status, data: code ? { error: { code, message: "x" } } : {} },
})

describe("pin limit", () => {
  test("409 PIN_LIMIT on a pin says how many and what to do", () => {
    expect(PIN_LIMIT_MESSAGE).toBe("You can pin up to 3 posts. Unpin one first.")
    expect(MAX_PINNED_POSTS).toBe(3)
    expect(pinErrorCopy(axiosError(409, "PIN_LIMIT"), true)).toBe("You can pin up to 3 posts. Unpin one first.")
  })

  test("only that answer: another 409, a bare PIN_LIMIT code, or an unpin is a plain failure", () => {
    expect(pinErrorCopy(axiosError(409, "CONFLICT"), true)).toBe("That post couldn’t be pinned. Please try again.")
    expect(pinErrorCopy(axiosError(409), true)).toBe("That post couldn’t be pinned. Please try again.")
    expect(pinErrorCopy(axiosError(500, "PIN_LIMIT"), true)).toBe("That post couldn’t be pinned. Please try again.")
    expect(pinErrorCopy(axiosError(409, "PIN_LIMIT"), false)).toBe("That post couldn’t be unpinned. Please try again.")
    expect(pinErrorCopy(axiosError(500, "INTERNAL_ERROR"), false)).toBe("That post couldn’t be unpinned. Please try again.")
  })

  test("offline and unknown errors", () => {
    expect(pinErrorCopy(axiosError(undefined), true)).toBe("You seem to be offline. Check your connection and try again.")
    expect(pinErrorCopy(new Error("boom"), true)).toBe("That post couldn’t be pinned. Please try again.")
    expect(pinErrorCopy(undefined, true)).toBe("That post couldn’t be pinned. Please try again.")
  })

  test("the post menu's Pin shows it in a toast", () => {
    const src = readFileSync(join(resolve(import.meta.dir, "..", ".."), "PostCard.tsx"), "utf8")
    expect(src).toContain("import { pinErrorCopy } from '@/components/profile/pinned'")
    expect(src).toContain("onError: (err) => toast({ type: 'error', title: pinErrorCopy(err, pinning) })")
  })
})

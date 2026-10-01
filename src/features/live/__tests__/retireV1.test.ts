import { describe, expect, it } from "bun:test"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"

import LiveStartRedirect from "@/app/live/start/page"

const SRC = resolve(import.meta.dir, "../../..")

// Other lanes' folders are not read by this lane (they hold uncommitted
// work from another session); the earlier grep found no v1 use there.
const OTHER_LANES = ["features/shop", "app/shop", "features/upload", "features/posttube", "features/video-shell"]
  .map((d) => resolve(SRC, d))

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (OTHER_LANES.includes(p)) continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

describe("v1 live is retired", () => {
  it("/live/start redirects to /live/new", () => {
    let thrown: unknown
    try {
      LiveStartRedirect()
    } catch (err) {
      thrown = err
    }
    const digest = String((thrown as { digest?: string })?.digest ?? "")
    expect(digest).toStartWith("NEXT_REDIRECT")
    expect(digest).toContain(";/live/new;")
  })

  it("the v1 client files are gone", () => {
    for (const f of ["api.ts", "browserPublish.ts", "cache.ts", "queryKeys.ts", "types.ts", "useLiveStreamRoom.ts", "utils.ts"]) {
      expect(existsSync(resolve(SRC, "features/live", f))).toBe(false)
    }
  })

  it("no source calls the v1 API or links to /live/start", () => {
    const self = resolve(import.meta.dir, "retireV1.test.ts")
    const offenders = walk(SRC)
      .filter((p) => p !== self)
      .filter((p) => {
        const text = readFileSync(p, "utf8")
        return /["'`]\/v1\/live\//.test(text) || /["'`]\/live\/start["'`]/.test(text) || text.includes("@/features/live/api")
      })
    expect(offenders).toEqual([])
  })
})

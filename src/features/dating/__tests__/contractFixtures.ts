/*
  Golden fixtures for the dating contract tests.

  The files are dating-service's `internal/http/testdata/contracts/*.json`
  copied byte for byte into `__tests__/contracts/`. Nothing here invents one.
  When the backend checkout is on this machine the copies are compared to it
  byte for byte, so a fixture that changed there fails here.
*/

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const HERE = import.meta.dir
export const LOCAL_CONTRACTS = resolve(HERE, "contracts")

/** The backend checkouts this machine may have, first match wins. */
const BACKEND_CANDIDATES = [
  "C:/workspace/modernsmapp/.claude/worktrees/determined-herschel-21fb46/Architecture/services/dating-service/internal/http/testdata/contracts",
  "C:/workspace/modernsmapp/Architecture/services/dating-service/internal/http/testdata/contracts",
]

export function backendContractsDir(): string | null {
  return BACKEND_CANDIDATES.find((dir) => existsSync(dir)) ?? null
}

/** Fixture names, without the extension, sorted. */
export function fixtureNames(dir: string = LOCAL_CONTRACTS): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort()
}

export function readFixtureText(name: string, dir: string = LOCAL_CONTRACTS): string {
  return readFileSync(resolve(dir, `${name}.json`), "utf8")
}

export function readFixture(name: string): { data?: unknown; meta?: unknown; error?: unknown } {
  return JSON.parse(readFixtureText(name))
}

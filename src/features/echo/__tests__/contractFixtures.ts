/*
  Golden fixtures for the Echo contract tests.

  The files are post-service's `testdata/contracts/notes/*.json` copied byte
  for byte into `__tests__/contracts/`. Nothing here invents one. When the
  backend checkout is on this machine the copies are compared to it byte
  for byte, so a fixture that changed there fails here.
*/

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const HERE = import.meta.dir
export const LOCAL_CONTRACTS = resolve(HERE, "contracts")

/** The backend checkout, when this machine has one (the main tree only). */
const BACKEND_CANDIDATES = ["C:/workspace/modernsmapp/Architecture/services/post-service/testdata/contracts/notes"]

export function backendContractsDir(): string | null {
  return BACKEND_CANDIDATES.find((dir) => existsSync(dir)) ?? null
}

export function fixtureNames(dir: string = LOCAL_CONTRACTS): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort()
}

export function readFixtureText(name: string, dir: string = LOCAL_CONTRACTS): string {
  return readFileSync(resolve(dir, `${name}.json`), "utf8")
}

export function readFixture(name: string): unknown {
  return JSON.parse(readFixtureText(name))
}

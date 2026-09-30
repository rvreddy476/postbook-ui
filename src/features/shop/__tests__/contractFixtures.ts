/*
  Golden fixtures, shared by the W2 contract tests.

  The files are commerce-service's `internal/http/testdata/contracts/<area>/`
  copied byte for byte into `__tests__/contracts/<area>/` (lane C1 writes
  them from the real handlers). Nothing here invents one: a fixture that is
  not on disk makes its test skip and say so, and when the backend checkout
  is present the copy is compared to it byte for byte.
*/

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const HERE = import.meta.dir
const BACKEND_CONTRACTS = "C:/workspace/modernsmapp/Architecture/services/commerce-service/internal/http/testdata/contracts"

export interface Envelope<T> {
  data: T
  meta?: Record<string, unknown> | null
  error?: { code: string; message: string; details?: unknown }
}

export function fixturePath(area: string, name: string): string {
  return resolve(HERE, "contracts", area, `${name}.json`)
}

export function hasFixture(area: string, name: string): boolean {
  return existsSync(fixturePath(area, name))
}

export function readFixture<T = unknown>(area: string, name: string): Envelope<T> {
  return JSON.parse(readFileSync(fixturePath(area, name), "utf8")) as Envelope<T>
}

/** The backend's copy of the same file, or null when that checkout is not on this machine. */
export function readBackendFixture(area: string, name: string): string | null {
  const path = resolve(BACKEND_CONTRACTS, area, `${name}.json`)
  return existsSync(path) ? readFileSync(path, "utf8") : null
}

export function readLocalFixtureText(area: string, name: string): string {
  return readFileSync(fixturePath(area, name), "utf8")
}

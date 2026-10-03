/*
  food-service golden fixtures, copied byte for byte from
  Architecture/services/food-service/internal/http/testdata/contracts into
  ./contracts. When the backend checkout is on this machine the copy is
  compared to it byte for byte (see contracts.test.ts).
*/

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const HERE = import.meta.dir
export const BACKEND_CONTRACTS = "C:/workspace/modernsmapp/Architecture/services/food-service/internal/http/testdata/contracts"

export function fixtureNames(): string[] {
  return readdirSync(resolve(HERE, "contracts"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort()
}

export function readFixtureBytes(name: string): Buffer {
  return readFileSync(resolve(HERE, "contracts", `${name}.json`))
}

export function readFixture(name: string): unknown {
  return JSON.parse(readFixtureBytes(name).toString("utf8"))
}

export function readBackendBytes(name: string): Buffer | null {
  const path = resolve(BACKEND_CONTRACTS, `${name}.json`)
  return existsSync(path) ? readFileSync(path) : null
}

/** An axios-shaped rejection carrying a fixture as the response body. */
export function axiosError(status: number, name: string): { response: { status: number; data: unknown } } {
  return { response: { status, data: readFixture(name) } }
}

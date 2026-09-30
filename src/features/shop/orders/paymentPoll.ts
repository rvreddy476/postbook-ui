/*
  The payment poll, as a pure state machine. The hook in hooks/payments.ts
  owns the timers and the network; everything that decides WHEN to read
  and WHEN to stop is here, so it can be table-tested.

  The policy is Android's PaymentCoordinator, unchanged: wait, then read;
  1 s, 2 s, 3 s, 4 s, then every 5 s; stop on `paid` or `failed`; stop on a
  permanent 4xx (the order is not ours, or is not there); give up at 180 s
  and say so — the payment may still land, so a timeout is not a failure.
  A read that could not be made (5xx, network) is "still confirming", not
  a verdict. Nothing is read while the tab is hidden; the next read fires
  when it is shown again.
*/

import type { PaymentReading, RefundStatus } from "../model/payments"

export const POLL_DELAYS_MS: readonly number[] = [1000, 2000, 3000, 4000]
export const POLL_STEADY_MS = 5000
export const POLL_TIMEOUT_MS = 180_000

export type PollPhase = "confirming" | "paid" | "failed" | "timed_out" | "stopped"

export interface PollState {
  phase: PollPhase
  /** Reads attempted so far (successful or not). */
  reads: number
  /** Time spent waiting, in ms — the sum of the delays taken. */
  elapsedMs: number
  refundStatus: RefundStatus
  /** Why a `stopped` poll stopped: the HTTP status that was permanent. */
  stoppedByStatus: number
}

export const initialPollState: PollState = {
  phase: "confirming",
  reads: 0,
  elapsedMs: 0,
  refundStatus: "",
  stoppedByStatus: 0,
}

export function isTerminal(state: Pick<PollState, "phase">): boolean {
  return state.phase !== "confirming"
}

/** The wait before read number `reads + 1`. */
export function delayForRead(reads: number): number {
  return reads < POLL_DELAYS_MS.length ? POLL_DELAYS_MS[reads] : POLL_STEADY_MS
}

/**
  What to do next: wait `delayMs` then read, or nothing.

  `null` means no read is scheduled — the poll is over, or the tab is
  hidden (the hook re-asks on visibilitychange). Reaching the timeout is
  decided here too, before another wait is taken, so the 180 s ceiling is
  never overshot by a whole interval.
*/
export function nextStep(state: PollState, visible: boolean): { delayMs: number } | null {
  if (isTerminal(state)) return null
  if (!visible) return null
  if (state.elapsedMs >= POLL_TIMEOUT_MS) return null
  return { delayMs: delayForRead(state.reads) }
}

/** The wait was taken; account for it before the read. */
export function afterWait(state: PollState, delayMs: number): PollState {
  return { ...state, elapsedMs: state.elapsedMs + delayMs }
}

/** A successful read. */
export function applyReading(state: PollState, reading: PaymentReading): PollState {
  const next: PollState = { ...state, reads: state.reads + 1, refundStatus: reading.refundStatus }
  if (reading.state === "paid") return { ...next, phase: "paid" }
  if (reading.state === "failed") return { ...next, phase: "failed" }
  return timeOutIfDue(next)
}

/** HTTP statuses that will not change by asking again. 429 is not one. */
export function isPermanentStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429
}

/**
  A read that failed. A permanent 4xx (ORDER_NOT_FOUND, 403) ends the poll:
  the answer will not change. Anything else — 5xx, a timeout, no network —
  is "we do not know yet" and the schedule continues.
*/
export function applyReadError(state: PollState, httpStatus: number): PollState {
  const next: PollState = { ...state, reads: state.reads + 1 }
  if (isPermanentStatus(httpStatus)) return { ...next, phase: "stopped", stoppedByStatus: httpStatus }
  return timeOutIfDue(next)
}

function timeOutIfDue(state: PollState): PollState {
  if (state.elapsedMs >= POLL_TIMEOUT_MS) return { ...state, phase: "timed_out" }
  return state
}

/**
  The whole schedule, for the table test and for anyone reading this file:
  the delays a poll takes until it gives up, when every read says
  "confirming".
*/
export function fullSchedule(): number[] {
  const delays: number[] = []
  let state = initialPollState
  for (;;) {
    const step = nextStep(state, true)
    if (!step) break
    delays.push(step.delayMs)
    state = applyReading(afterWait(state, step.delayMs), { state: "confirming", refundStatus: "" })
  }
  return delays
}

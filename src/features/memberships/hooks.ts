"use client"

/*
  Paid memberships: the queries, the mutations and the checkout runner.
  Decisions live in model.ts and checkout.ts; this file owns React Query,
  timers and the Razorpay dialog (lib/razorpay.ts, the one loader).
*/

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useReducer, useRef, useState } from "react"

import { afterWait, applyReadError, applyReading, initialPollState, isTerminal, nextStep, type PollState } from "@/features/shop/orders/paymentPoll"
import { openRazorpayCheckout } from "@/lib/razorpay"

import {
  cancelMembership,
  changeLevel,
  createLevel,
  fetchAccess,
  fetchCreatorLevels,
  fetchCreatorMembers,
  fetchEligibility,
  fetchMembership,
  fetchMembersOnlyRows,
  fetchMyLevels,
  fetchMyMemberships,
  patchLevel,
  readMembershipPayment,
  setLevelActive,
  setPostMembersOnly,
  startJoin,
  startRenewal,
  verifyMembershipPayment,
} from "./api"
import { checkoutReducer, idle, resetsKey, type CheckoutEvent } from "./checkout"
import { activeLevels, createJoinKeys, gatedRows, razorpayOpen, toMembershipError, type Access, type Checkout, type TierChangeResult, type TierForm, type TierPatch } from "./model"

export const MEMBERSHIP_KEYS = {
  all: ["memberships"] as const,
  myLevels: ["memberships", "my-levels"] as const,
  creatorLevels: (creatorId: string) => ["memberships", "creator-levels", creatorId] as const,
  eligibility: (creatorId: string) => ["memberships", "eligibility", creatorId] as const,
  mine: ["memberships", "mine"] as const,
  one: (subscriptionId: string) => ["memberships", "one", subscriptionId] as const,
  creatorMembers: ["memberships", "creator-members"] as const,
  membersTab: (authorId: string) => ["memberships", "members-tab", authorId] as const,
  /** The old root, kept so anything still keyed on it is refreshed too. */
  access: (creatorId: string, tierId: string | null) => ["monetization-entitlement", creatorId, tierId] as const,
}

/** A 4xx (the switch off, not eligible, not yours) will not change by asking again. */
const retry = (count: number, error: unknown) => {
  const status = toMembershipError(error).status
  if (status >= 400 && status < 500) return false
  if (status === 503) return false
  return count < 2
}

/* ── levels ─────────────────────────────────────────────────────── */

export function useMyLevels(enabled = true) {
  return useQuery({ queryKey: MEMBERSHIP_KEYS.myLevels, queryFn: fetchMyLevels, enabled, retry, staleTime: 60_000 })
}

/** The creator's active levels (public route); [] while unknown. */
export function useCreatorLevels(creatorId: string | null | undefined) {
  return useQuery({
    queryKey: MEMBERSHIP_KEYS.creatorLevels(creatorId ?? ""),
    queryFn: () => fetchCreatorLevels(creatorId!),
    enabled: !!creatorId,
    retry,
    staleTime: 60_000,
  })
}

/** My active levels, cheapest first: what the "Members only" control offers. Empty when memberships are off. */
export function useGateLevels(enabled = true) {
  const q = useMyLevels(enabled)
  return { levels: q.data ? activeLevels(q.data) : [], loading: q.isLoading }
}

export function useEligibility(creatorId: string | null | undefined) {
  return useQuery({
    queryKey: MEMBERSHIP_KEYS.eligibility(creatorId ?? ""),
    queryFn: () => fetchEligibility(creatorId!),
    enabled: !!creatorId,
    retry,
    staleTime: 60_000,
  })
}

function refreshLevels(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: MEMBERSHIP_KEYS.myLevels })
  void qc.invalidateQueries({ queryKey: ["memberships", "creator-levels"] })
  void qc.invalidateQueries({ queryKey: ["monetization-dashboard"] })
}

export function useCreateLevel() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (form: TierForm) => createLevel(form), onSuccess: () => refreshLevels(qc) })
}

export function usePatchLevel() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, patch }: { id: string; patch: TierPatch }) => patchLevel(id, patch), onSuccess: () => refreshLevels(qc) })
}

export function useSetLevelActive() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, on }: { id: string; on: boolean }) => setLevelActive(id, on), onSuccess: () => refreshLevels(qc) })
}

/* ── access ─────────────────────────────────────────────────────── */

/**
  The viewer's access to a creator's content at a level. "unknown" while it
  loads, when it fails, when the viewer is signed out, or when not asked
  (`creatorId` null): the lock decision decides what unknown means.
*/
export function useMembershipAccess(creatorId: string | null | undefined, tierId: string | null | undefined, signedIn: boolean): Access {
  const q = useQuery({
    queryKey: MEMBERSHIP_KEYS.access(creatorId ?? "", tierId ?? null),
    queryFn: () => fetchAccess(creatorId!, tierId),
    enabled: !!creatorId && signedIn,
    retry,
    staleTime: 30_000,
  })
  return q.data ?? "unknown"
}

/* ── my memberships ─────────────────────────────────────────────── */

export function useMyMemberships(enabled = true) {
  return useQuery({ queryKey: MEMBERSHIP_KEYS.mine, queryFn: fetchMyMemberships, enabled, retry, staleTime: 15_000 })
}

/** One of my memberships (GET /memberships/:id): a 404 is "not yours / not there", not retried. */
export function useMembership(subscriptionId: string | null | undefined) {
  return useQuery({
    queryKey: MEMBERSHIP_KEYS.one(subscriptionId ?? ""),
    queryFn: () => fetchMembership(subscriptionId!),
    enabled: !!subscriptionId,
    retry,
    staleTime: 15_000,
  })
}

function refreshMine(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: MEMBERSHIP_KEYS.mine })
  void qc.invalidateQueries({ queryKey: ["memberships", "one"] })
}

export function useCancelMembership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (subscriptionId: string) => cancelMembership(subscriptionId),
    onSuccess: () => {
      refreshMine(qc)
      void qc.invalidateQueries({ queryKey: ["monetization-entitlement"] })
    },
  })
}

/* ── a creator's members ────────────────────────────────────────── */

/** The caller's members, newest first, by meta.next_cursor. */
export function useCreatorMembers(enabled = true) {
  return useInfiniteQuery({
    queryKey: MEMBERSHIP_KEYS.creatorMembers,
    queryFn: ({ pageParam }) => fetchCreatorMembers(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
    retry,
    staleTime: 30_000,
  })
}

/* ── the members-only gate on a post ────────────────────────────── */

/**
  After a write that set or cleared a gate (a create, a draft publish, the
  post PATCH, or the PUT): every read that shows it, refetched.
*/
export function invalidateGate(qc: QueryClient, postId?: string | null) {
  void qc.invalidateQueries({ queryKey: ["memberships", "members-tab"] })
  void qc.invalidateQueries({ queryKey: ["posttube"] })
  void qc.invalidateQueries({ queryKey: ["hub"] })
  void qc.invalidateQueries({ queryKey: ["home-feed"] })
  void qc.invalidateQueries({ queryKey: ["profile-posts"] })
  if (postId) void qc.invalidateQueries({ queryKey: ["post-detail", postId] })
}

/** PUT /v1/posts/:id/membership — only where no create, draft or PATCH fits. */
export function useSetPostMembersOnly() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, tierId }: { postId: string; tierId: string | null }) => setPostMembersOnly(postId, tierId),
    onSuccess: (_void, { postId }) => invalidateGate(qc, postId),
  })
}

/* ── the Members tab ────────────────────────────────────────────── */

/**
  The creator's members-only items: GET by-author?members_only=true, the
  same cursor paging. The rows are still read through gatedRows, so a row
  without a gate never shows here.
*/
export function useMembersOnlyRows(authorId: string | null | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: MEMBERSHIP_KEYS.membersTab(authorId ?? ""),
    queryFn: async ({ pageParam }) => {
      const page = await fetchMembersOnlyRows(authorId!, pageParam)
      return { items: gatedRows(page.rows), nextCursor: page.nextCursor }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!authorId && enabled,
    staleTime: 60_000,
  })
}

/* ── after a payment lands ──────────────────────────────────────── */

/** Every read that can hold a lock or a redacted body: refetched so content opens without a reload. */
export const UNLOCK_QUERY_ROOTS: readonly string[] = [
  "monetization-entitlement",
  "memberships",
  "home-feed",
  "profile-posts",
  "post-detail",
  "posts",
  "posttube",
  "reels",
  "feed",
  "comments",
  "comments-around",
  "hashtag",
]

export function invalidateUnlocked(qc: QueryClient) {
  for (const root of UNLOCK_QUERY_ROOTS) void qc.invalidateQueries({ queryKey: [root] })
}

/* ── the checkout runner ────────────────────────────────────────── */

export interface CheckoutIntent {
  /** What this decision to pay is (a level id, "renew:<sub>"…): one key per intent. */
  id: string
  /** The dialog's description line. */
  label: string
  start: (idempotencyKey: string) => Promise<Checkout | TierChangeResult>
}

export const joinIntent = (creatorId: string, tierId: string, label: string): CheckoutIntent => ({
  id: `join:${creatorId}:${tierId}`,
  label,
  start: (key) => startJoin(creatorId, tierId, key),
})

export const renewIntent = (subscriptionId: string, label: string): CheckoutIntent => ({
  id: `renew:${subscriptionId}`,
  label,
  start: (key) => startRenewal(subscriptionId, key),
})

export const changeLevelIntent = (subscriptionId: string, tierId: string, label: string): CheckoutIntent => ({
  id: `change:${subscriptionId}:${tierId}`,
  label,
  start: (key) => changeLevel(subscriptionId, tierId, key),
})

const tabVisible = () => typeof document === "undefined" || document.visibilityState !== "hidden"

/** A Checkout's kind is join | renewal | upgrade; a TierChangeResult's never is. */
function isTierChange(v: Checkout | TierChangeResult): v is TierChangeResult {
  return !("paymentId" in v)
}

export function useMembershipCheckout() {
  const qc = useQueryClient()
  const [state, dispatchRaw] = useReducer(checkoutReducer, idle)
  const [poll, setPoll] = useState<{ paymentId: string; generation: number } | null>(null)
  const keys = useRef(createJoinKeys())
  const busy = useRef(false)
  const last = useRef<CheckoutIntent | null>(null)

  const dispatch = useCallback((event: CheckoutEvent) => {
    if (resetsKey(event)) keys.current.reset()
    dispatchRaw(event)
  }, [])

  const run = useCallback(
    async (intent: CheckoutIntent) => {
      if (busy.current) return
      busy.current = true
      last.current = intent
      setPoll(null)
      dispatch({ type: "start" })
      try {
        let result: Checkout | TierChangeResult
        try {
          result = await intent.start(keys.current.keyFor(intent.id))
        } catch (error) {
          dispatch({ type: "start_failed", error })
          return
        }
        let checkout: Checkout
        if (isTierChange(result)) {
          if (result.kind === "scheduled") {
            dispatch({ type: "scheduled", effectiveAt: result.effectiveAt })
            // The detail page shows the booked downgrade from its own read.
            refreshMine(qc)
            return
          }
          if (result.kind !== "checkout") {
            dispatch({ type: "upgraded" })
            invalidateUnlocked(qc)
            return
          }
          checkout = result.checkout
        } else {
          checkout = result
        }
        const options = razorpayOpen(checkout, intent.label)
        dispatch({ type: "started", checkout, canOpen: !!options })
        if (!options) {
          invalidateUnlocked(qc)
          return
        }
        try {
          const resp = await openRazorpayCheckout(options)
          void verifyMembershipPayment(checkout.paymentId, resp)
        } catch {
          dispatch({ type: "dialog_dismissed" })
          return
        }
        dispatch({ type: "dialog_completed" })
        setPoll((p) => ({ paymentId: checkout.paymentId, generation: (p?.generation ?? 0) + 1 }))
      } finally {
        busy.current = false
      }
    },
    [dispatch, qc],
  )

  useEffect(() => {
    if (!poll) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let current: PollState = initialPollState

    const schedule = () => {
      if (cancelled || timer !== null) return
      const step = nextStep(current, tabVisible())
      if (!step) {
        // Out of time while visible: say so (the payment may still land).
        if (!isTerminal(current) && tabVisible()) dispatch({ type: "poll", poll: { ...current, phase: "timed_out" } })
        return
      }
      timer = setTimeout(async () => {
        timer = null
        if (cancelled || !tabVisible()) return
        current = afterWait(current, step.delayMs)
        try {
          current = applyReading(current, await readMembershipPayment(poll.paymentId))
        } catch (error) {
          current = applyReadError(current, toMembershipError(error).status)
        }
        if (cancelled) return
        dispatch({ type: "poll", poll: current })
        if (current.phase === "paid") invalidateUnlocked(qc)
        if (!isTerminal(current)) schedule()
      }, step.delayMs)
    }

    const onVisibility = () => {
      if (tabVisible()) schedule()
    }
    document.addEventListener("visibilitychange", onVisibility)
    schedule()
    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [poll, qc, dispatch])

  /** After a timeout: the same payment, another 180 s. */
  const checkAgain = useCallback(() => {
    dispatch({ type: "check_again" })
    setPoll((p) => (p ? { ...p, generation: p.generation + 1 } : p))
  }, [dispatch])

  /** The same intent again (Pay now after a dismissed dialog, Try again after no answer): the same key unless a verdict reset it. */
  const retryLast = useCallback(() => {
    if (last.current) void run(last.current)
  }, [run])

  const reset = useCallback(() => {
    setPoll(null)
    dispatch({ type: "reset" })
  }, [dispatch])

  return { state, run, checkAgain, retryLast, reset }
}

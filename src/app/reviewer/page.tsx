"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import api from "@/lib/api"

type Dashboard = {
  reviewer: {
    status: string
    tier: string
    reviewer_accuracy: number
    kyc_verified: boolean
  } | null
  reviews_completed: number
  escalated: number
  lifetime_earned_paise: number
  pending_queue: number
}

export default function ReviewerDashboardPage() {
  const router = useRouter()
  const [d, setD] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get("/v1/reviewer/me/stats")
      setD(res.data?.data ?? res.data)
    } catch {
      setError("Could not load your reviewer profile. Are you signed in?")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const optIn = async () => {
    setBusy(true)
    try {
      await api.post("/v1/reviewer/opt-in", { languages: ["en"], region: "IN" })
      await load()
    } catch {
      alert("Could not opt in. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const checkKyc = async () => {
    setBusy(true)
    try {
      const res = await api.post("/v1/reviewer/verify-kyc")
      const verified = (res.data?.data ?? res.data)?.kyc_verified
      await load()
      if (!verified) alert("Not verified yet — complete identity verification first.")
    } catch {
      alert("Could not check verification status.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Shell><p className="text-sm text-gray-500">Loading…</p></Shell>
  if (error) return <Shell><p className="text-sm text-red-600">{error}</p></Shell>

  const rev = d?.reviewer

  // Not a reviewer yet → opt-in.
  if (!rev) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Become a reviewer</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            Help keep the platform clean. Watch short/long videos and either approve them
            or escalate to the admin team with notes. You earn for each review.
          </p>
          {!!d?.pending_queue && (
            <p className="mt-2 text-xs text-gray-400">{d.pending_queue} videos waiting for review</p>
          )}
          <button
            onClick={optIn}
            disabled={busy}
            className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Joining…" : "Opt in to review"}
          </button>
        </div>
      </Shell>
    )
  }

  // Reviewer but not KYC-verified → verification gate.
  if (!rev.kyc_verified) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Verify your identity</h1>
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="text-sm text-amber-900">
            Reviewing is paid work, so we verify identity (KYC) before you can start —
            required for payouts and to keep the system fair. Complete identity
            verification (DigiLocker / PAN) in your wallet, then check status here.
          </p>
          <div className="mt-4 flex gap-3">
            <a
              href="/wallet"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Go to wallet / KYC
            </a>
            <button
              onClick={checkKyc}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {busy ? "Checking…" : "I've verified — check"}
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  // Verified reviewer → stats + start.
  const earned = (d!.lifetime_earned_paise / 100).toFixed(2)
  const cards: [string, string][] = [
    ["Tier", cap(rev.tier)],
    ["Accuracy", `${Math.round(rev.reviewer_accuracy * 100)}%`],
    ["Reviews", `${d!.reviews_completed}`],
    ["Escalated", `${d!.escalated}`],
    ["Earned", `₹${earned}`],
    ["In queue", `${d!.pending_queue}`],
  ]
  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reviewer</h1>
        <button onClick={load} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          Refresh
        </button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-2xl font-semibold">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>
      {rev.status === "suspended" && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Your reviewer account is suspended.
        </p>
      )}
      <button
        onClick={() => router.push("/reviewer/console")}
        disabled={rev.status === "suspended"}
        className="mt-6 w-full rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {d!.pending_queue > 0 ? `Start reviewing (${d!.pending_queue})` : "Start reviewing"}
      </button>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl p-6">{children}</div>
}

function cap(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

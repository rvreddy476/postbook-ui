"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import api from "@/lib/api"

type Assignment = { id: string; content_id: string; content_seconds: number }
type PostDetail = { content?: string; media_ids?: string[] }

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ""
const mediaSrc = (id?: string) => (id ? `${API_BASE}/v1/media/${id}/serve` : "")

export default function ReviewerConsolePage() {
  const router = useRouter()
  const [a, setA] = useState<Assignment | null>(null)
  const [post, setPost] = useState<PostDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [done, setDone] = useState(false) // queue empty
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopHeartbeat = () => {
    if (heartbeat.current) clearInterval(heartbeat.current)
    heartbeat.current = null
  }

  const loadNext = useCallback(async () => {
    stopHeartbeat()
    setLoading(true)
    setPost(null)
    try {
      const res = await api.get("/v1/reviewer/assignments/next")
      const data: Assignment | null = res.data?.data ?? null
      if (!data || !data.id) {
        setA(null)
        setDone(true)
        return
      }
      setA(data)
      setDone(false)
      try {
        const p = await api.get(`/v1/posts/${data.content_id}`)
        setPost(p.data?.data ?? p.data)
      } catch {
        setPost(null)
      }
      heartbeat.current = setInterval(() => {
        api.post(`/v1/reviewer/assignments/${data.id}/heartbeat`, { seconds: 10 }).catch(() => {})
      }, 10000)
    } catch (e: unknown) {
      const code = (e as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code
      if (code === "KYC_REQUIRED" || code === "NOT_REVIEWER") {
        router.replace("/reviewer")
        return
      }
      setA(null)
      setDone(true)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadNext()
    return stopHeartbeat
  }, [loadNext])

  const decide = async (decision: "approve" | "escalate") => {
    if (!a) return
    let comments = ""
    if (decision === "escalate") {
      const input = window.prompt("What's the concern? (sent to the super-admin)")
      if (!input || !input.trim()) return
      comments = input.trim()
    }
    setActing(true)
    try {
      await api.post(`/v1/reviewer/assignments/${a.id}/decision`, { decision, comments })
      await loadNext()
    } catch {
      alert("Could not submit. Try again.")
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Review</h1>
        <button onClick={() => router.push("/reviewer")} className="text-sm text-gray-500 hover:underline">
          Dashboard
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : done || !a ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-600">You&apos;re all caught up — no videos to review right now.</p>
          <button onClick={loadNext} className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            Check again
          </button>
        </div>
      ) : (
        <div>
          <div className="overflow-hidden rounded-xl bg-black">
            {mediaSrc(post?.media_ids?.[0]) ? (
              <video src={mediaSrc(post?.media_ids?.[0])} controls autoPlay className="aspect-[9/16] w-full object-contain" />
            ) : (
              <div className="flex aspect-[9/16] w-full items-center justify-center text-xs text-gray-400">
                preview unavailable
              </div>
            )}
          </div>
          {post?.content && <p className="mt-3 line-clamp-3 text-sm text-gray-700">{post.content}</p>}

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => decide("escalate")}
              disabled={acting}
              className="flex-1 rounded-lg border border-amber-400 px-4 py-3 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              Escalate
            </button>
            <button
              onClick={() => decide("approve")}
              disabled={acting}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

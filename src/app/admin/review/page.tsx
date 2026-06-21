"use client"

import { useCallback, useEffect, useState } from "react"
import api from "@/lib/api"

type Escalation = {
  id: string
  content_id: string
  creator_id: string
  reviewer_id: string
  reviewer_comments: string
  status: string
  created_at: string
}

type PostDetail = {
  id: string
  content?: string
  author_name?: string
  media_ids?: string[]
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ""
const mediaSrc = (id?: string) => (id ? `${API_BASE}/v1/media/${id}/serve` : "")

// Matches the existing admin pages' convention (src/app/admin/page.tsx): the
// admin surface asserts scope via this header, which the gateway forwards to the
// service. (The service still enforces the scope; production hardening should
// move scope issuance into the JWT — see review notes.)
const ADMIN_HEADERS = { "X-Scopes": "admin superadmin moderator" }

type Stats = { open_escalations: number; queue_depth: number }

export default function AdminReviewConsole() {
  const [items, setItems] = useState<Escalation[]>([])
  const [posts, setPosts] = useState<Record<string, PostDetail>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [stats, setStats] = useState<Stats | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      api
        .get("/v1/reviewer/admin/stats", { headers: ADMIN_HEADERS })
        .then((r) => setStats(r.data?.data ?? r.data))
        .catch(() => setStats(null))
      const res = await api.get("/v1/reviewer/admin/escalations", { headers: ADMIN_HEADERS })
      const list: Escalation[] = res.data?.data ?? res.data ?? []
      setItems(list)
      // Hydrate post detail (video + creator) per escalation, best-effort.
      const details: Record<string, PostDetail> = {}
      await Promise.all(
        list.map(async (e) => {
          try {
            const p = await api.get(`/v1/posts/${e.content_id}`)
            details[e.content_id] = p.data?.data ?? p.data
          } catch {
            /* content may be unavailable; show comments only */
          }
        })
      )
      setPosts(details)
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      setError(
        status === 403
          ? "You need super-admin access to view this queue."
          : "Could not load the review queue."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const decide = async (e: Escalation, decision: "approve" | "request_edits" | "reject") => {
    if (decision !== "approve" && !(notes[e.id] || "").trim()) {
      alert("Please add notes for the creator (what to change / why).")
      return
    }
    setBusy(e.id)
    try {
      await api.post(
        `/v1/reviewer/admin/escalations/${e.id}/decision`,
        { decision, notes: notes[e.id] || "" },
        { headers: ADMIN_HEADERS }
      )
      setItems((prev) => prev.filter((x) => x.id !== e.id))
    } catch {
      alert("Action failed. Please retry.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Review escalations</h1>
          <p className="mt-1 text-sm text-gray-600">
            Reviewers escalate borderline videos here. Approve to publish, request edits
            (sends your notes to the creator, who edits & re-submits), or reject.
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-semibold">{stats?.open_escalations ?? "—"}</div>
          <div className="text-xs text-gray-500">Open escalations</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-2xl font-semibold">{stats?.queue_depth ?? "—"}</div>
          <div className="text-xs text-gray-500">Videos awaiting a reviewer</div>
        </div>
      </div>

      {loading && <p className="mt-8 text-sm text-gray-500">Loading…</p>}
      {error && <p className="mt-8 text-sm text-red-600">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="mt-8 text-sm text-gray-500">Queue is clear. 🎉</p>
      )}

      <div className="mt-6 space-y-6">
        {items.map((e) => {
          const post = posts[e.content_id]
          const src = mediaSrc(post?.media_ids?.[0])
          return (
            <div key={e.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex gap-4">
                <div className="w-48 shrink-0">
                  {src ? (
                    <video
                      src={src}
                      controls
                      className="aspect-[9/16] w-full rounded-lg bg-black object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[9/16] w-full items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
                      preview unavailable
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-400">
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                  <div className="mt-0.5 text-sm font-medium">
                    {post?.author_name || "Creator"} · <span className="text-gray-500">{e.content_id.slice(0, 8)}</span>
                  </div>
                  {post?.content && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-700">{post.content}</p>
                  )}
                  <div className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                    <span className="font-medium">Reviewer note:</span> {e.reviewer_comments}
                  </div>

                  <textarea
                    value={notes[e.id] || ""}
                    onChange={(ev) => setNotes((n) => ({ ...n, [e.id]: ev.target.value }))}
                    placeholder="Notes to the creator (required for Request edits / Reject)…"
                    className="mt-3 w-full rounded-lg border border-gray-300 p-2 text-sm"
                    rows={2}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      disabled={busy === e.id}
                      onClick={() => decide(e, "approve")}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Approve & publish
                    </button>
                    <button
                      disabled={busy === e.id}
                      onClick={() => decide(e, "request_edits")}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      Request edits
                    </button>
                    <button
                      disabled={busy === e.id}
                      onClick={() => decide(e, "reject")}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

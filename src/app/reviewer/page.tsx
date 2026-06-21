"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import api from "@/lib/api"
import { 
  Shield, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, Play, 
  Clock, Lock, Check, Zap, Scale, Video, ShieldAlert, X, Eye, 
  Send, User, FileText, Film, EyeOff
} from "lucide-react"

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

type QueueItem = {
  content_id: string
  creator_id: string
  content_type: string
  languages: string[]
  content_seconds: number
}

type PostDetail = {
  content?: string
  author_name?: string
}

type ActiveAssignment = {
  id: string
  content_id: string
  content_seconds: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ""

// Resolve video URL from metadata
async function resolveVideoUrl(contentId: string): Promise<string> {
  try {
    const r = await api.get(`/v1/videos/${contentId}`)
    const vm = r.data?.data ?? r.data ?? {}
    if (vm.playback_url) return vm.playback_url as string
    if (vm.media_asset_id) return `${API_BASE}/v1/media/${vm.media_asset_id}/serve`
  } catch {
    /* no video metadata */
  }
  return ""
}

export default function ReviewerDashboardPage() {
  const router = useRouter()
  
  // Dashboard & Queue Stats
  const [d, setD] = useState<Dashboard | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [postsCache, setPostsCache] = useState<Record<string, PostDetail>>({})
  const [loading, setLoading] = useState(true)
  const [queueLoading, setQueueLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null)
  
  // Interactive Elements
  const [selectedCard, setSelectedCard] = useState<"pending" | "approved" | "escalated">("pending")
  
  // Modal Popup Player state
  const [activeItem, setActiveItem] = useState<QueueItem | null>(null)
  const [assignment, setAssignment] = useState<ActiveAssignment | null>(null)
  const [modalVideoUrl, setModalVideoUrl] = useState("")
  const [modalPost, setModalPost] = useState<PostDetail | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalActing, setModalActing] = useState(false)
  const [showEscalateForm, setShowEscalateForm] = useState(false)
  const [escalateComments, setEscalateComments] = useState("")
  const [isPlaying, setIsPlaying] = useState(true)
  
  // Heartbeats for Popup
  const modalHeartbeat = useRef<ReturnType<typeof setInterval> | null>(null)

  const triggerToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const stopModalHeartbeat = () => {
    if (modalHeartbeat.current) {
      clearInterval(modalHeartbeat.current)
      modalHeartbeat.current = null
    }
  }

  // Load basic stats
  const loadDashboard = useCallback(async () => {
    setError(null)
    try {
      const res = await api.get("/v1/reviewer/me/stats")
      setD(res.data?.data ?? res.data)
    } catch {
      setError("Could not load your reviewer profile. Are you signed in?")
    }
  }, [])

  // Load enqueued items + hydrate titles
  const loadQueue = useCallback(async () => {
    setQueueLoading(true)
    try {
      const res = await api.get("/v1/reviewer/queue")
      const list: QueueItem[] = res.data?.data ?? res.data ?? []
      setQueue(list)
      
      // Hydrate post details in background
      const newCache = { ...postsCache }
      await Promise.all(
        list.map(async (item) => {
          if (newCache[item.content_id]) return
          try {
            const p = await api.get(`/v1/posts/${item.content_id}`)
            newCache[item.content_id] = p.data?.data ?? p.data
          } catch {
            newCache[item.content_id] = { content: "" }
          }
        })
      )
      setPostsCache(newCache)
    } catch (e) {
      console.error("Could not load reviewer queue:", e)
    } finally {
      setQueueLoading(false)
    }
  }, [postsCache])

  const initData = useCallback(async () => {
    setLoading(true)
    await loadDashboard()
    await loadQueue()
    setLoading(false)
  }, [loadDashboard, loadQueue])

  useEffect(() => {
    initData()
  }, [initData])

  const handleRefresh = async () => {
    setQueueLoading(true)
    await loadDashboard()
    await loadQueue()
    setQueueLoading(false)
  }

  const optIn = async () => {
    setBusy(true)
    try {
      await api.post("/v1/reviewer/opt-in", { languages: ["en"], region: "IN" })
      await initData()
    } catch {
      triggerToast("Could not opt in. Try again.", "error")
    } finally {
      setBusy(false)
    }
  }

  const checkKyc = async () => {
    setBusy(true)
    try {
      const res = await api.post("/v1/reviewer/verify-kyc")
      const verified = (res.data?.data ?? res.data)?.kyc_verified
      await initData()
      if (!verified) {
        triggerToast("Not verified yet — complete identity verification first.", "error")
      }
    } catch {
      triggerToast("Could not check verification status.", "error")
    } finally {
      setBusy(false)
    }
  }

  // Claim and Open Modal
  const playVideo = async (item: QueueItem) => {
    setActiveItem(item)
    setModalLoading(true)
    setModalPost(postsCache[item.content_id] || null)
    setModalVideoUrl("")
    setShowEscalateForm(false)
    setEscalateComments("")
    setIsPlaying(true)
    
    try {
      // 1. Lease target video
      const res = await api.get("/v1/reviewer/assignments/next", { 
        params: { content_id: item.content_id } 
      })
      const assignData: ActiveAssignment | null = res.data?.data ?? res.data ?? null
      
      if (!assignData || !assignData.id) {
        triggerToast("Video was already claimed by another reviewer.", "error")
        setActiveItem(null)
        loadQueue()
        return
      }
      
      setAssignment(assignData)
      
      // 2. Resolve URL
      const resolved = await resolveVideoUrl(item.content_id)
      setModalVideoUrl(resolved)
      
      // 3. Heartbeat setup
      modalHeartbeat.current = setInterval(() => {
        api.post(`/v1/reviewer/assignments/${assignData.id}/heartbeat`, { seconds: 10 }).catch(() => {})
      }, 10000)

    } catch (e) {
      triggerToast("Could not assign video for review.", "error")
      setActiveItem(null)
    } finally {
      setModalLoading(false)
    }
  }

  const closeModal = () => {
    stopModalHeartbeat()
    setActiveItem(null)
    setAssignment(null)
    setModalVideoUrl("")
    setModalPost(null)
  }

  // Submit Modal Decision
  const submitDecision = async (decision: "approve" | "escalate", comments?: string) => {
    if (!assignment) return
    if (decision === "escalate" && (!comments || !comments.trim())) {
      triggerToast("Please enter notes explaining the escalation.", "error")
      return
    }

    setModalActing(true)
    try {
      await api.post(`/v1/reviewer/assignments/${assignment.id}/decision`, { 
        decision, 
        comments: comments ? comments.trim() : "" 
      })
      triggerToast(decision === "approve" ? "Video approved successfully!" : "Video escalated to admin.")
      closeModal()
      handleRefresh()
    } catch {
      triggerToast("Submission failed. Try again.", "error")
    } finally {
      setModalActing(false)
    }
  }

  const toggleVideo = () => {
    const video = document.getElementById("popup-video-player") as HTMLVideoElement | null
    if (video) {
      if (video.paused) {
        video.play().catch(() => {})
        setIsPlaying(true)
      } else {
        video.pause()
        setIsPlaying(false)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <div className="relative flex h-12 w-12 items-center justify-center">
          <div className="absolute h-12 w-12 rounded-full border-4 border-[#2A2740] border-t-brand-accent animate-spin" />
        </div>
        <p className="text-sm font-medium text-[#8B8B9E] dark:text-[#6B6980]">Loading reviewer console...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-[#0F0D15] dark:text-[#EEEDF5]">Authentication Error</h3>
        <p className="mt-2 max-w-md text-sm text-[#8B8B9E] dark:text-[#6B6980]">{error}</p>
        <button
          onClick={initData}
          className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-accent to-brand-highlight px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-90 transition-all active:scale-95"
        >
          <RefreshCw className="h-4 w-4" /> Retry Connection
        </button>
      </div>
    )
  }

  const rev = d?.reviewer

  // State 1: Opt-in Program Landing Page
  if (!rev) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12 md:py-20 animate-fadeIn">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-[#EEEDF5] dark:border-[#2A2740] bg-brand-card dark:bg-[#13111C]/60 p-8 md:p-16 backdrop-blur-xl shadow-2xl">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-accent/15 blur-[80px]" />
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <span className="flex items-center gap-1.5 rounded-full bg-brand-accent/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-accent">
              <Scale className="h-3.5 w-3.5" /> Trust & Safety Network
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-[#0F0D15] dark:text-[#EEEDF5] sm:text-5xl">
              Become a Trust & Safety Reviewer
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#8B8B9E] dark:text-[#A09EB5]">
              Moderate flagged uploads against standard community guidelines. Shield users from toxic, hateful, or explicit content and earn compensation.
            </p>

            {!!d?.pending_queue && (
              <div className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 border border-emerald-500/20 text-emerald-500 text-xs font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                {d.pending_queue} videos awaiting review in the queue
              </div>
            )}

            <div className="mt-8">
              <button
                onClick={optIn}
                disabled={busy}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-accent to-brand-highlight px-8 py-4 text-sm font-extrabold text-white shadow-xl shadow-brand-accent/20 hover:opacity-95 disabled:opacity-50 transition-all duration-200 active:scale-[0.98]"
              >
                {busy ? "Joining safety program..." : "Apply as a Reviewer"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // State 2: Reviewer but not KYC-verified
  if (!rev.kyc_verified) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 animate-fadeIn">
        <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/5 p-8 md:p-10 backdrop-blur-xl shadow-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-6">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#0F0D15] dark:text-[#EEEDF5]">
            Identity Verification Required
          </h2>
          <p className="mt-3 text-sm text-[#8B8B9E] dark:text-[#A09EB5] leading-relaxed">
            Content moderation is compensated work. To ensure compliance, prevent duplicate accounts, 
            and process wallet withdrawals, you must complete identity verification (KYC).
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <a
              href="/wallet"
              className="flex-1 text-center rounded-xl bg-gradient-to-r from-brand-accent to-brand-highlight px-5 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 transition-all duration-200 active:scale-95"
            >
              Go to Wallet / KYC
            </a>
            <button
              onClick={checkKyc}
              disabled={busy}
              className="flex-1 rounded-xl border border-[#EEEDF5] dark:border-[#2A2740] bg-brand-card dark:bg-[#1C1A28] px-5 py-3 text-sm font-semibold text-[#0F0D15] dark:text-[#EEEDF5] hover:bg-[#F8F7FC] dark:hover:bg-[#221F32] disabled:opacity-50 transition-all duration-200"
            >
              {busy ? "Checking status..." : "Check Status"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Dashboard Stats Calculations
  const pendingCount = d!.pending_queue
  const escalatedCount = d!.escalated
  const approvedCount = Math.max(0, d!.reviews_completed - d!.escalated)

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 animate-fadeIn relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-2xl animate-slideUp ${
          toast.type === "success" ? "bg-emerald-600 shadow-emerald-500/10" : "bg-red-600 shadow-red-500/10"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Title bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#EEEDF5] dark:border-[#2A2740] pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0F0D15] dark:text-[#EEEDF5] flex items-center gap-2.5">
            <Shield className="h-8 w-8 text-brand-accent" /> Reviewer Dashboard
          </h1>
          <p className="mt-1 text-sm text-[#8B8B9E] dark:text-[#6B6980]">
            Review enqueued video uploads, approve content, or escalate borderline items.
          </p>
        </div>
        
        <div>
          <button
            onClick={handleRefresh}
            disabled={queueLoading}
            className="flex items-center gap-2 rounded-xl border border-[#EEEDF5] dark:border-[#2A2740] bg-brand-card dark:bg-[#13111C]/50 px-4 py-2.5 text-sm font-semibold text-[#0F0D15] dark:text-[#EEEDF5] hover:bg-[#F8F7FC] dark:hover:bg-[#221F32] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${queueLoading ? "animate-spin" : ""}`} /> Refresh Queue
          </button>
        </div>
      </div>

      {/* Account Alerts */}
      {rev.status === "suspended" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-red-500 animate-fadeIn">
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold">Reviewer Account Suspended</h4>
            <p className="mt-1 text-xs leading-relaxed opacity-90">
              Your reviewer account is temporarily suspended. Support has locked active moderation due to low accuracy scores.
            </p>
          </div>
        </div>
      )}

      {/* THREE DASHBOARD CARDS (Clickable Tabs) */}
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {/* Card 1: Pending Videos */}
        <button
          onClick={() => setSelectedCard("pending")}
          className={`flex items-center justify-between text-left p-6 rounded-3xl border transition-all duration-300 ${
            selectedCard === "pending"
              ? "bg-[#1E1B2E] border-brand-accent/50 shadow-lg shadow-brand-accent/5 ring-1 ring-brand-accent/20"
              : "bg-brand-card dark:bg-[#13111C]/30 border-[#EEEDF5] dark:border-[#2A2740] hover:-translate-y-1 hover:border-brand-accent/30"
          }`}
        >
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8B8B9E] dark:text-[#6B6980]">
              Pending Videos
            </span>
            <span className="mt-2 text-3xl font-extrabold text-[#0F0D15] dark:text-[#EEEDF5]">
              {pendingCount}
            </span>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
            selectedCard === "pending"
              ? "text-brand-accent border-brand-accent/30 bg-brand-accent/10"
              : "text-[#8B8B9E] border-[#EEEDF5] dark:border-[#2A2740]"
          }`}>
            <Clock className="h-5 w-5" />
          </div>
        </button>

        {/* Card 2: Approved Videos */}
        <button
          onClick={() => setSelectedCard("approved")}
          className={`flex items-center justify-between text-left p-6 rounded-3xl border transition-all duration-300 ${
            selectedCard === "approved"
              ? "bg-[#1E1B2E] border-emerald-500/50 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/20"
              : "bg-brand-card dark:bg-[#13111C]/30 border-[#EEEDF5] dark:border-[#2A2740] hover:-translate-y-1 hover:border-emerald-500/20"
          }`}
        >
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8B8B9E] dark:text-[#6B6980]">
              Approved Videos
            </span>
            <span className="mt-2 text-3xl font-extrabold text-[#0F0D15] dark:text-[#EEEDF5]">
              {approvedCount}
            </span>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
            selectedCard === "approved"
              ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
              : "text-[#8B8B9E] border-[#EEEDF5] dark:border-[#2A2740]"
          }`}>
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </button>

        {/* Card 3: Escalated Videos */}
        <button
          onClick={() => setSelectedCard("escalated")}
          className={`flex items-center justify-between text-left p-6 rounded-3xl border transition-all duration-300 ${
            selectedCard === "escalated"
              ? "bg-[#1E1B2E] border-purple-500/50 shadow-lg shadow-purple-500/5 ring-1 ring-purple-500/20"
              : "bg-brand-card dark:bg-[#13111C]/30 border-[#EEEDF5] dark:border-[#2A2740] hover:-translate-y-1 hover:border-purple-500/20"
          }`}
        >
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8B8B9E] dark:text-[#6B6980]">
              Escalated Videos
            </span>
            <span className="mt-2 text-3xl font-extrabold text-[#0F0D15] dark:text-[#EEEDF5]">
              {escalatedCount}
            </span>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
            selectedCard === "escalated"
              ? "text-purple-500 border-purple-500/30 bg-purple-500/10"
              : "text-[#8B8B9E] border-[#EEEDF5] dark:border-[#2A2740]"
          }`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </button>
      </div>

      {/* CONDITIONAL CONTENT PANELS */}
      {selectedCard === "pending" ? (
        <div className="mt-10 rounded-[2rem] border border-[#EEEDF5] dark:border-[#2A2740] bg-brand-card dark:bg-[#13111C]/25 p-8 shadow-sm">
          {/* Table Header */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#0F0D15] dark:text-[#EEEDF5]">
              Click pending videos for review
            </h2>
            <p className="mt-1 text-xs text-[#8B8B9E] dark:text-[#6B6980]">
              Select a video from the grid below to open the review player.
            </p>
          </div>

          {queueLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-[#8B8B9E] dark:text-[#6B6980]">
              <div className="h-8 w-8 rounded-full border-4 border-[#2A2740] border-t-brand-accent animate-spin" />
              <span>Fetching latest video logs...</span>
            </div>
          ) : queue.length === 0 ? (
            <div className="py-16 text-center bg-[#F8F7FC] dark:bg-[#161424]/30 rounded-3xl border border-dashed border-[#EEEDF5] dark:border-[#2A2740]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-3">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-[#0F0D15] dark:text-[#EEEDF5]">All Caught Up!</h4>
              <p className="mt-1 text-xs text-[#8B8B9E] dark:text-[#6B6980]">There are no videos awaiting review.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#EEEDF5] dark:border-[#2A2740] bg-brand-card dark:bg-[#13111C]/35">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#EEEDF5] dark:border-[#2A2740] text-[#8B8B9E] dark:text-[#6B6980] bg-[#F8F7FC]/50 dark:bg-[#161424]/20">
                    <th className="py-4 pl-6 font-semibold uppercase tracking-wider">Video Name</th>
                    <th className="py-4 font-semibold uppercase tracking-wider">Video Type</th>
                    <th className="py-4 font-semibold uppercase tracking-wider">Duration</th>
                    <th className="py-4 font-semibold uppercase tracking-wider pr-6 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEEDF5] dark:divide-[#2A2740]">
                  {queue.map((item, index) => {
                    const postInfo = postsCache[item.content_id]
                    // Clean content string for the video name (first 30 chars) or fallback to ID
                    const videoName = postInfo?.content
                      ? postInfo.content.slice(0, 32) + (postInfo.content.length > 32 ? "..." : "")
                      : `Video Upload #${item.content_id.slice(0, 8)}`
                    
                    // Determine if Flick (reel/short) or Long Video
                    const isFlick = item.content_type === "reels" || item.content_seconds <= 60
                    const typeLabel = isFlick ? "Flick" : "Long Video"
                    
                    // Format duration
                    const formattedDuration = item.content_seconds < 60 
                      ? `${item.content_seconds}s` 
                      : `${Math.floor(item.content_seconds / 60)}m ${item.content_seconds % 60}s`
                      
                    return (
                      <tr 
                        key={item.content_id}
                        className="hover:bg-[#F8F7FC]/80 dark:hover:bg-[#1C1A28]/30 transition-all group"
                      >
                        {/* 1. Video Name */}
                        <td className="py-4.5 pl-6 font-medium text-[#0F0D15] dark:text-[#EEEDF5]">
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand-accent group-hover:scale-125 transition-transform" />
                            {videoName}
                          </div>
                        </td>
                        
                        {/* 2. Video Type */}
                        <td className="py-4.5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                            isFlick 
                              ? "bg-blue-500/10 text-blue-500 border-blue-500/20" 
                              : "bg-[#2A2740] text-[#EEEDF5] border-[#3A3650]"
                          }`}>
                            {isFlick ? <Film className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                            {typeLabel}
                          </span>
                        </td>
                        
                        {/* 3. Duration */}
                        <td className="py-4.5 font-mono text-sm text-[#0F0D15] dark:text-[#EEEDF5]">
                          {formattedDuration}
                        </td>
                        
                        {/* 4. Play Button */}
                        <td className="py-4.5 pr-6 text-right">
                          <button
                            onClick={() => playVideo(item)}
                            disabled={rev.status === "suspended"}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-all duration-200 hover:scale-110 active:scale-95 shadow-md shadow-emerald-500/10"
                            title="Play and Moderately Review Video"
                          >
                            <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : selectedCard === "approved" ? (
        <div className="mt-10 p-12 text-center border border-[#EEEDF5] dark:border-[#2A2740] bg-brand-card dark:bg-[#13111C]/25 rounded-[2.5rem] animate-fadeIn">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h4 className="text-base font-bold text-[#0F0D15] dark:text-[#EEEDF5]">Review History (Approved)</h4>
          <p className="mt-1 text-sm text-[#8B8B9E] dark:text-[#6B6980] max-w-md mx-auto">
            You have approved and published <span className="text-[#EEEDF5] font-bold">{approvedCount}</span> posts. Thank you for keeping VChat safe and accurate!
          </p>
        </div>
      ) : (
        <div className="mt-10 p-12 text-center border border-[#EEEDF5] dark:border-[#2A2740] bg-brand-card dark:bg-[#13111C]/25 rounded-[2.5rem] animate-fadeIn">
          <AlertTriangle className="h-12 w-12 text-purple-500 mx-auto mb-4" />
          <h4 className="text-base font-bold text-[#0F0D15] dark:text-[#EEEDF5]">Review History (Escalated)</h4>
          <p className="mt-1 text-sm text-[#8B8B9E] dark:text-[#6B6980] max-w-md mx-auto">
            You have flagged and escalated <span className="text-[#EEEDF5] font-bold">{escalatedCount}</span> borderline posts to the super-admin queue for final moderation.
          </p>
        </div>
      )}

      {/* POPUP MODAL REVIEW PLAYBACK DIALOG */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-6 animate-fadeIn">
          
          <div className="bg-brand-card dark:bg-[#13111C] border border-[#EEEDF5] dark:border-[#2A2740] rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row relative max-h-[90vh]">
            
            {/* Close handle */}
            <button 
              onClick={closeModal} 
              className="absolute top-4 right-4 z-50 text-[#8B8B9E] hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-all active:scale-95"
              title="Close Player"
            >
              <X className="h-5 w-5" />
            </button>

            {/* LEFT: Full Length Video Panel (3/5 Width) */}
            <div className="w-full md:w-3/5 bg-black flex items-center justify-center relative min-h-[300px] md:h-[75vh]">
              {modalLoading ? (
                <div className="flex flex-col items-center gap-3 text-xs text-[#8B8B9E]">
                  <div className="h-10 w-10 rounded-full border-4 border-dashed border-[#2A2740] animate-spin border-t-brand-accent" />
                  <span>Claiming lease & loading post metadata...</span>
                </div>
              ) : modalVideoUrl ? (
                <>
                  <video
                    id="popup-video-player"
                    src={modalVideoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-contain md:max-h-[75vh]"
                    onClick={toggleVideo}
                  />
                  
                  {/* Visual Video Overlay Badges */}
                  <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Secure Lease Active
                  </div>

                  {!isPlaying && (
                    <div 
                      className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer"
                      onClick={toggleVideo}
                    >
                      <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center px-6 text-[#8B8B9E]">
                  <EyeOff className="h-8 w-8 opacity-45" />
                  <p className="text-xs leading-relaxed max-w-xs">
                    Media file still processing. Content is currently unavailable on transcoding clusters.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT: Guidelines and Decision Controls (2/5 Width) */}
            <div className="w-full md:w-2/5 p-6 flex flex-col justify-between overflow-y-auto max-h-[50vh] md:max-h-none md:h-[75vh] border-t md:border-t-0 md:border-l border-[#EEEDF5] dark:border-[#2A2740]">
              
              {/* Top: Metadata */}
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-accent">
                    Content Moderation Detail
                  </span>
                  <h3 className="text-base font-extrabold text-[#0F0D15] dark:text-[#EEEDF5] mt-1 line-clamp-2">
                    {modalPost?.content ? modalPost.content : `Video Upload #${activeItem.content_id.slice(0, 8)}`}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 bg-[#F8F7FC]/30 dark:bg-[#1C1A28]/20 rounded-2xl p-3 border border-[#EEEDF5] dark:border-[#2A2740]">
                  <div className="text-[#8B8B9E] dark:text-[#6B6980]">Content ID:</div>
                  <div className="font-mono text-right text-[#0F0D15] dark:text-[#EEEDF5]">{activeItem.content_id.slice(0, 8)}</div>
                  
                  <div className="text-[#8B8B9E] dark:text-[#6B6980]">Format:</div>
                  <div className="text-right text-[#0F0D15] dark:text-[#EEEDF5] font-semibold">{activeItem.content_type === "reels" || activeItem.content_seconds <= 60 ? "Flick" : "Long Video"}</div>
                  
                  <div className="text-[#8B8B9E] dark:text-[#6B6980]">Duration:</div>
                  <div className="text-right text-[#0F0D15] dark:text-[#EEEDF5] font-semibold">{activeItem.content_seconds} seconds</div>
                  
                  <div className="text-[#8B8B9E] dark:text-[#6B6980]">Creator:</div>
                  <div className="text-right text-[#0F0D15] dark:text-[#EEEDF5] font-semibold truncate">{modalPost?.author_name || "Anonymous"}</div>
                </div>

                {/* Moderation instructions info box */}
                <div className="bg-[#2A2740]/40 rounded-2xl p-4 border border-[#3A3650]/40 text-[11px] leading-relaxed text-[#8B8B9E]">
                  <div className="font-bold text-[#EEEDF5] mb-1 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-brand-accent" /> Review instructions
                  </div>
                  Verify this post. Make sure there is no nudity, violence, copyright violation, or hate speech before approving. Use <span className="font-bold text-[#EEEDF5]">Approve</span> to publish, or <span className="font-bold text-amber-500">Escalate</span> if borderline.
                </div>
              </div>

              {/* Bottom: Decision Panel */}
              <div className="mt-6 border-t border-[#EEEDF5] dark:border-[#2A2740] pt-5">
                {!showEscalateForm ? (
                  <div className="space-y-2.5">
                    <button
                      onClick={() => submitDecision("approve")}
                      disabled={modalLoading || modalActing}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/10"
                    >
                      <Check className="h-4.5 w-4.5 stroke-[3]" /> Approve & Publish
                    </button>

                    <button
                      onClick={() => setShowEscalateForm(true)}
                      disabled={modalLoading || modalActing}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-amber-500 px-4 py-3.5 text-sm font-extrabold hover:bg-amber-500/10 disabled:opacity-50 transition-all"
                    >
                      <AlertTriangle className="h-4.5 w-4.5" /> Send for Escalation
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5 animate-fadeIn">
                    <div>
                      <label className="block text-[11px] font-bold text-[#8B8B9E] uppercase tracking-wider mb-1.5">
                        Escalation Concern Notes
                      </label>
                      <textarea
                        value={escalateComments}
                        onChange={(e) => setEscalateComments(e.target.value)}
                        placeholder="Explain why this content needs super-admin review..."
                        className="w-full rounded-2xl border border-[#EEEDF5] dark:border-[#2A2740] bg-[#F8F7FC] dark:bg-[#1C1A28] p-3.5 text-xs text-[#0F0D15] dark:text-[#EEEDF5] focus:outline-none focus:border-amber-500/30"
                        rows={3}
                        disabled={modalActing}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowEscalateForm(false)
                          setEscalateComments("")
                        }}
                        className="flex-1 rounded-xl border border-[#EEEDF5] dark:border-[#2A2740] text-xs font-bold text-[#0F0D15] dark:text-[#EEEDF5] py-2.5 hover:bg-[#F8F7FC] dark:hover:bg-[#221F32]"
                        disabled={modalActing}
                      >
                        Back
                      </button>
                      <button
                        onClick={() => submitDecision("escalate", escalateComments)}
                        disabled={modalActing || !escalateComments.trim()}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold py-2.5 hover:bg-amber-600 disabled:opacity-50 transition-all"
                      >
                        <Send className="h-3 w-3" /> Submit
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  )
}

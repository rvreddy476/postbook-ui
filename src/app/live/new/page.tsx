"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Radio, Globe, Users, DollarSign, Loader2, ImagePlus, X } from "lucide-react"

import { useCreateStream, type LiveVisibility } from "@/hooks/useLiveV2"
import { uploadMedia } from "@/lib/mediaUpload"

// ──────────────────────────────────────────────────────────────────────
// Broadcaster "Go Live" form.
//
// On submit:
//   1. (optional) Upload cover image via the standard 3-step media flow.
//   2. POST /v1/livestream/streams with the form payload.
//   3. Router-push to /live/{id}/broadcast where the publisher token is
//      minted and the LiveKit Room is opened.
// ──────────────────────────────────────────────────────────────────────

export default function NewLiveStreamPage() {
  const router = useRouter()
  const createStream = useCreateStream()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<LiveVisibility>("public")
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPickCover = (file: File | null) => {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    if (!file) {
      setCoverFile(null)
      setCoverPreview(null)
      return
    }
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const canSubmit = title.trim().length > 0 && !uploading && !createStream.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    let coverMediaID: string | null = null
    try {
      if (coverFile) {
        setUploading(true)
        coverMediaID = await uploadMedia(coverFile, "image", "cover")
        setUploading(false)
      }
      const stream = await createStream.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        visibility,
        cover_media_id: coverMediaID,
      })
      router.push(`/live/${stream.id}/broadcast`)
    } catch (err: unknown) {
      setUploading(false)
      let message = "Couldn't create your stream. Try again."
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string } } } }
        if (axiosErr.response?.data?.error?.message) message = axiosErr.response.data.error.message
      }
      setError(message)
    }
  }

  const visibilityChoices: Array<{
    value: LiveVisibility
    label: string
    sub: string
    icon: React.ReactNode
  }> = [
    {
      value: "public",
      label: "Public",
      sub: "Anyone on VChat can watch",
      icon: <Globe className="w-4 h-4" />,
    },
    {
      value: "followers",
      label: "Followers only",
      sub: "Only your followers can watch",
      icon: <Users className="w-4 h-4" />,
    },
    {
      value: "paid",
      label: "Paid",
      sub: "Subscribers only (coming soon)",
      icon: <DollarSign className="w-4 h-4" />,
    },
  ]

  return (
    <div className="min-h-screen bg-brand-bg py-10 px-4">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-brand-divider bg-brand-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-brand-text">Go Live</h1>
            <p className="text-xs text-brand-text/60">
              Start a real-time broadcast to your audience.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-text/60">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's the stream about?"
              maxLength={140}
              required
              className="w-full rounded-xl border border-brand-divider bg-brand-bg px-3 py-2.5 text-sm text-brand-text outline-none focus:border-purple-400"
            />
            <p className="mt-1 text-[10px] text-brand-text/40">{title.length}/140</p>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-text/60">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a short description so viewers know what to expect."
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-xl border border-brand-divider bg-brand-bg px-3 py-2.5 text-sm text-brand-text outline-none focus:border-purple-400"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-brand-text/60">
              Who can watch
            </label>
            <div className="space-y-2">
              {visibilityChoices.map((choice) => {
                const active = visibility === choice.value
                return (
                  <label
                    key={choice.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-all ${
                      active
                        ? "border-purple-400 bg-purple-50/40"
                        : "border-brand-divider hover:border-brand-text/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={choice.value}
                      checked={active}
                      onChange={() => setVisibility(choice.value)}
                      className="mt-1"
                    />
                    <div className="flex flex-1 items-center gap-2 text-brand-text">
                      {choice.icon}
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{choice.label}</span>
                        <span className="text-[11px] text-brand-text/60">{choice.sub}</span>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Cover image */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-text/60">
              Cover image
            </label>
            {coverPreview ? (
              <div className="relative overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverPreview} alt="cover preview" className="w-full max-h-56 object-cover" />
                <button
                  type="button"
                  onClick={() => onPickCover(null)}
                  className="absolute top-2 right-2 rounded-full bg-black/70 p-1 text-white hover:bg-black/80"
                  aria-label="Remove cover"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-divider px-3 py-6 text-brand-text/60 hover:border-purple-400 hover:text-purple-500">
                <ImagePlus className="h-5 w-5" />
                <span className="text-sm">Upload a cover image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickCover(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-brand-text/60 hover:bg-brand-divider/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {(uploading || createStream.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Radio className="h-4 w-4" />
              )}
              {uploading ? "Uploading cover…" : createStream.isPending ? "Creating…" : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

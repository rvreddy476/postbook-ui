"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Globe, ImagePlus, Radio, Users, X } from "lucide-react"

import { useCreateStream, type LiveVisibility } from "@/hooks/useLiveV2"
import { uploadMedia } from "@/lib/mediaUpload"
import { goLiveErrorCopy, isPilotRefusal } from "@/features/live/errors"
import { PilotNotice } from "@/features/live/components/PilotNotice"
import "@/features/live/live.css"

// Go live form (live-service-v2).
//   1. (optional) cover image via the standard media upload.
//   2. POST /v1/livestream/streams — 403 LIVE_NOT_ENABLED outside the pilot,
//      403 LIVE_BANNED for a platform live ban.
//   3. /live/{id}/broadcast mints the publisher token and opens the room.

// No "paid": live-service-v2 accepts the value on create but its viewer gate
// refuses a paid stream to everyone, the creator included (ErrPaidNotSupported).
const VISIBILITY_CHOICES: Array<{ value: LiveVisibility; label: string; sub: string; icon: React.ReactNode }> = [
  { value: "followers", label: "Followers only", sub: "Only your followers can watch", icon: <Users className="h-4 w-4" aria-hidden="true" /> },
  { value: "public", label: "Public", sub: "Anyone can watch", icon: <Globe className="h-4 w-4" aria-hidden="true" /> },
]

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
  const [pilotRefused, setPilotRefused] = useState(false)

  const onPickCover = (file: File | null) => {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverFile(file)
    setCoverPreview(file ? URL.createObjectURL(file) : null)
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
      if (isPilotRefusal(err)) {
        setPilotRefused(true)
        return
      }
      setError(goLiveErrorCopy(err))
    }
  }

  return (
    <div className="live-page">
      <div className="live-form">
        <div className="mb-5 flex items-center gap-3">
          <Radio className="h-5 w-5 text-primary-ink" aria-hidden="true" />
          <div>
            <h1 className="live-page__title">Go live</h1>
            <p className="live-page__meta">Start a real-time broadcast to your audience.</p>
          </div>
        </div>

        {pilotRefused ? (
          <PilotNotice />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="live-label" htmlFor="live-title">Title</label>
              <input
                id="live-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's the stream about?"
                maxLength={140}
                required
                className="live-field"
              />
              <p className="mt-1 text-xs text-muted-foreground">{title.length}/140</p>
            </div>

            <div>
              <label className="live-label" htmlFor="live-description">Description</label>
              <textarea
                id="live-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short line so viewers know what to expect."
                rows={3}
                maxLength={500}
                className="live-field resize-none"
              />
            </div>

            <div>
              <span className="live-label">Who can watch</span>
              <div className="live-choices" role="radiogroup" aria-label="Who can watch">
                {VISIBILITY_CHOICES.map((choice) => (
                  <label key={choice.value} className="live-choice" data-active={visibility === choice.value}>
                    <input
                      type="radio"
                      name="visibility"
                      value={choice.value}
                      checked={visibility === choice.value}
                      onChange={() => setVisibility(choice.value)}
                    />
                    {choice.icon}
                    <span className="flex flex-col">
                      <span>{choice.label}</span>
                      <span className="text-xs text-muted-foreground">{choice.sub}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="live-label">Cover image</span>
              {coverPreview ? (
                <div className="relative overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverPreview} alt="Cover preview" className="max-h-56 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onPickCover(null)}
                    className="live-stage__hud"
                    style={{ left: "auto", right: 8, top: 8 }}
                    aria-label="Remove cover"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <label className="live-choice justify-center border-dashed py-6 text-muted-foreground">
                  <ImagePlus className="h-5 w-5" aria-hidden="true" />
                  <span>Upload a cover image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickCover(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>

            {error && <div className="live-error" role="alert">{error}</div>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => router.back()} className="live-btn live-btn--ghost">
                Cancel
              </button>
              <button type="submit" disabled={!canSubmit} className="live-btn live-btn--primary">
                {uploading ? "Uploading cover…" : createStream.isPending ? "Creating…" : "Continue"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Globe, ImagePlus, Radio, RectangleHorizontal, RectangleVertical, Users, X } from "lucide-react"

import { useCreateStream, useGoLiveGate, type LiveVisibility } from "@/hooks/useLiveV2"
import { uploadMedia } from "@/lib/mediaUpload"
import { goLiveErrorCopy } from "@/features/live/errors"
import { viewerCapNote } from "@/features/live/eligibility"
import { NearlyReady } from "@/features/live/components/NearlyReady"
import { PilotNotice } from "@/features/live/components/PilotNotice"
import { SourcePicker } from "@/features/live/components/SourcePicker"
import type { LiveSource } from "@/features/live/encoder"
import { scheduleErrorCopy, validateStreamForm } from "@/features/live/discovery"
import { errorCode, type LiveOrientation } from "@/features/live/model"
import { useTopics } from "@/features/posttube/discovery/hooks/useDiscovery"
import "@/features/live/live.css"

// Go live form (live-service-v2).
//   0. GET /v1/livestream/eligibility first: eligible → the form; pilot_only →
//      the closed-pilot notice; otherwise the "nearly ready" panel. If the
//      question fails the form is shown anyway: the server decides on submit.
//   1. (optional) cover image via the standard media upload.
//   2. POST /v1/livestream/streams — 403 LIVE_NOT_ENABLED outside the pilot,
//      403 LIVE_NOT_ELIGIBLE (open mode, details.requirements → the same
//      panel), 403 LIVE_BANNED for a platform live ban, 503
//      AUTHORITY_UNAVAILABLE when the account could not be checked (retry).
//   3. /live/{id}/broadcast mints the publisher token and opens the room
//      (this device), or shows the server URL and stream key (streaming software).
// Topic (post-service's categories), orientation and an optional start time
// ride on the same POST; a stream with a start time is scheduled and listed
// in Creator Hub → Live instead of opening the studio.

// No "paid": live-service-v2 accepts the value on create but its viewer gate
// refuses a paid stream to everyone, the creator included (ErrPaidNotSupported).
const VISIBILITY_CHOICES: Array<{ value: LiveVisibility; label: string; sub: string; icon: React.ReactNode }> = [
  { value: "followers", label: "Followers only", sub: "Only your followers can watch", icon: <Users className="h-4 w-4" aria-hidden="true" /> },
  { value: "public", label: "Public", sub: "Anyone can watch", icon: <Globe className="h-4 w-4" aria-hidden="true" /> },
]

// Alphabetical, like every choice group here; wide stays the default.
const ORIENTATION_CHOICES: Array<{ value: LiveOrientation; label: string; sub: string; icon: React.ReactNode }> = [
  { value: "portrait", label: "Vertical for Reels", sub: "A tall stream, watched like a short", icon: <RectangleVertical className="h-4 w-4" aria-hidden="true" /> },
  { value: "landscape", label: "Wide for PostTube", sub: "A 16:9 stream with chat beside it", icon: <RectangleHorizontal className="h-4 w-4" aria-hidden="true" /> },
]

export default function NewLiveStreamPage() {
  const router = useRouter()
  const createStream = useCreateStream()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<LiveVisibility>("public")
  const [source, setSource] = useState<LiveSource>("device")
  const [orientation, setOrientation] = useState<LiveOrientation>("landscape")
  const [category, setCategory] = useState("")
  const [scheduledLocal, setScheduledLocal] = useState("")
  const [timeError, setTimeError] = useState<string | null>(null)
  const allTopics = useTopics().data ?? []
  // Wide streams take long-video topics, vertical ones the shorts topics; "all" fits both.
  const topics = allTopics.filter((t) => t.kind !== (orientation === "portrait" ? "long" : "short"))
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const live = useGoLiveGate()
  const capNote = viewerCapNote(live.viewerCap)

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
    const check = validateStreamForm({ title, scheduledLocal })
    setTimeError(check.errors.scheduled_at ?? null)
    if (!check.ok) return
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
        source,
        orientation,
        category: category || undefined,
        scheduled_at: check.scheduled_at,
      })
      router.push(check.scheduled_at ? "/posttube/hub/live" : `/live/${stream.id}/broadcast`)
    } catch (err: unknown) {
      setUploading(false)
      // LIVE_NOT_ENABLED → the pilot notice; LIVE_NOT_ELIGIBLE → the "nearly ready" panel.
      if (live.refuse(err)) return
      setError(errorCode(err) === "INVALID_CATEGORY" ? scheduleErrorCopy(err) : goLiveErrorCopy(err))
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

        {live.gate === "loading" ? (
          <p className="live-form__note" role="status">Checking your account…</p>
        ) : live.gate === "pilot" ? (
          <PilotNotice />
        ) : live.gate === "nearly" ? (
          <NearlyReady requirements={live.requirements} onRecheck={live.recheck} rechecking={live.rechecking} viewerCap={live.viewerCap} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {capNote && <p className="live-form__note" data-testid="live-viewer-cap">{capNote}</p>}
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

            <SourcePicker value={source} onChange={setSource} />

            <div>
              <span className="live-label" id="live-orientation-label">Orientation</span>
              <div className="live-choices" role="radiogroup" aria-labelledby="live-orientation-label">
                {ORIENTATION_CHOICES.map((choice) => (
                  <label key={choice.value} className="live-choice" data-active={orientation === choice.value}>
                    <input
                      type="radio"
                      name="orientation"
                      value={choice.value}
                      checked={orientation === choice.value}
                      onChange={() => {
                        setOrientation(choice.value)
                        // A topic that only fits the other shape is dropped with it.
                        const other = choice.value === "portrait" ? "long" : "short"
                        if (allTopics.some((t) => t.slug === category && t.kind === other)) setCategory("")
                      }}
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
              <label className="live-label" htmlFor="live-topic">Topic</label>
              <select id="live-topic" value={category} onChange={(e) => setCategory(e.target.value)} className="live-field">
                <option value="">No topic</option>
                {topics.map((t) => (
                  <option key={t.slug} value={t.slug}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="live-label" htmlFor="live-schedule">Start time (optional)</label>
              <input
                id="live-schedule"
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => { setScheduledLocal(e.target.value); setTimeError(null) }}
                aria-invalid={!!timeError}
                className="live-field"
              />
              <p className={`mt-1 text-xs ${timeError ? "text-danger" : "text-muted-foreground"}`} role={timeError ? "alert" : undefined}>
                {timeError ?? "Leave it empty to go live now. With a time, viewers can set a reminder."}
              </p>
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
                {uploading ? "Uploading cover…" : createStream.isPending ? "Creating…" : scheduledLocal ? "Schedule" : "Continue"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

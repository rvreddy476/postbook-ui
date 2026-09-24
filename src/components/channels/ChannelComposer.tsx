'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Radio, Image as ImageIcon, Video, BarChart3, Calendar,
  AlertTriangle, Bold, Italic, Underline, Strikethrough, Link2,
  List, ListOrdered, Code, Quote, Smile, Upload, Loader2,
  Clock, Pin, MessageCircle, Sparkles, GripVertical, Trash2,
  Plus, MapPin, Globe, Monitor, ChevronDown,
} from 'lucide-react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { uploadMedia } from '@/lib/mediaUpload'
import RichTextEditor from '@/components/studio/RichTextEditor'
import type { RichNode } from '@/components/studio/postStyle'
import type { BroadcastChannel } from '@/types/channels'

/* ===== Types ===== */
type UpdateType = 'announcement' | 'photo' | 'video' | 'poll' | 'event' | 'urgent'

interface PollOption { id: string; text: string }
interface ScheduleData { type: 'now' | 'scheduled'; date?: string; time?: string }

interface ComposerProps {
  channel: BroadcastChannel
  onPublish: (data: ComposerPayload) => Promise<void>
  onSaveDraft?: (data: ComposerPayload) => void
  isPublishing?: boolean
}

export interface ComposerPayload {
  update_type: string
  title?: string
  body: string
  media_ids?: string[]
  is_pinned?: boolean
  is_urgent?: boolean
  metadata?: Record<string, unknown>
  scheduled_at?: string
}

/* ===== Constants ===== */
/*
  The update types, coloured the way the main post composer colours its tiles —
  Photo green, Video red, Poll amber — so the same thing looks the same in both
  places and you can find the one you want without reading every label.

  fg is a THEME TOKEN, never a raw Tailwind colour. An unrecognised colour in
  this setup compiles to nothing and the icon silently loses its tint.
*/
const UPDATE_TYPES: { value: UpdateType; icon: React.ReactNode; label: string; fg: string }[] = [
  { value: 'announcement', icon: <Radio className="h-4 w-4" />, label: 'Announcement', fg: 'text-primary-ink' },
  { value: 'photo', icon: <ImageIcon className="h-4 w-4" />, label: 'Photo', fg: 'text-tile-photo' },
  { value: 'video', icon: <Video className="h-4 w-4" />, label: 'Video', fg: 'text-tile-video' },
  { value: 'poll', icon: <BarChart3 className="h-4 w-4" />, label: 'Poll', fg: 'text-tile-poll' },
  { value: 'event', icon: <Calendar className="h-4 w-4" />, label: 'Event', fg: 'text-tile-place' },
  { value: 'urgent', icon: <AlertTriangle className="h-4 w-4" />, label: 'Urgent', fg: 'text-danger' },
]

const POLL_DURATIONS = [
  { label: '1 hour', value: '1h' },
  { label: '6 hours', value: '6h' },
  { label: '12 hours', value: '12h' },
  { label: '24 hours', value: '24h' },
  { label: '3 days', value: '3d' },
  { label: '7 days', value: '7d' },
  { label: 'No limit', value: 'none' },
]

const MAX = {
  title: 150,
  body: 5000,
  caption: 2000,
  urgentBody: 2000,
  pollQuestion: 300,
  pollDesc: 1000,
  pollOption: 100,
  eventDesc: 5000,
  photoCaption: 200,
  tag: 5,
  photos: 10,
  attachments: 4,
  buttonLabel: 30,
}

/* ===== Helpers ===== */
function genId() { return Math.random().toString(36).slice(2, 10) }

function CharCount({ current, max }: { current: number; max: number }) {
  const pct = current / max
  return (
    <span className={`text-[10px] font-mono ${pct >= 1 ? 'text-danger font-bold' : pct >= 0.9 ? 'text-warning' : 'text-brand-text/30'}`}>
      {current}/{max}
    </span>
  )
}

/*
  A quiet heading over a field, not a form label.

  This used to append a red asterisk, then the word "required", to anything
  mandatory. Both shout at someone who has not done anything wrong yet — and
  the composer already refuses to post without them, with a message naming
  what is missing. That is the right moment to mention it.
*/
function FieldLabel({ children }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-[12px] font-semibold text-brand-text/55">
      {children}
    </label>
  )
}

function TextInput({ value, onChange, placeholder, maxLength, required, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder: string; maxLength: number; required?: boolean; className?: string
}) {
  return (
    <div>
      <input
        type="text" value={value}
        onChange={e => { if (e.target.value.length <= maxLength) onChange(e.target.value) }}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-[15px] text-brand-text outline-hidden transition-colors placeholder:text-brand-text/35 focus:border-brand-accent focus:bg-brand-card ${className}`}
      />
      <div className="mt-1 flex justify-end"><CharCount current={value.length} max={maxLength} /></div>
    </div>
  )
}

function TextArea({ value, onChange, placeholder, maxLength, rows = 4, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder: string; maxLength: number; rows?: number; className?: string
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={e => { if (e.target.value.length <= maxLength) onChange(e.target.value) }}
        placeholder={placeholder} rows={rows}
        className={`w-full resize-none rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-[15px] text-brand-text outline-hidden transition-colors placeholder:text-brand-text/35 focus:border-brand-accent focus:bg-brand-card ${className}`}
      />
      <div className="flex justify-end mt-1"><CharCount current={value.length} max={maxLength} /></div>
    </div>
  )
}

/*
  A "rich text toolbar" used to sit here: bold, italic, underline,
  strikethrough, link, lists, code, quote, emoji — ten buttons, and not one of
  them had an onClick. It rendered above four different composer bodies and
  did nothing at all, which is worse than having no toolbar: it tells the
  author their update can be formatted and then silently refuses.

  The announcement body now uses the real editor (the one the post composer
  uses). The other three bodies are short captions where a document adds
  nothing, so they are plain fields and no longer pretend otherwise.
*/

/* ===== File Upload Zone ===== */
function FileUploadZone({ accept, maxFiles, files, onAdd, onRemove, label }: {
  accept: string; maxFiles: number; files: File[]; onAdd: (f: File[]) => void; onRemove: (i: number) => void; label: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const remaining = maxFiles - files.length
    if (remaining <= 0) return
    onAdd(Array.from(fileList).slice(0, remaining))
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed px-4 py-3 transition-colors ${
          dragOver ? 'border-primary-ink bg-primary-tint' : 'border-brand-divider hover:border-primary-outline hover:bg-brand-secondary'
        } ${files.length >= maxFiles ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <Upload className="h-4 w-4 shrink-0 text-brand-text/40" strokeWidth={1.9} />
        <p className="text-[13px] font-medium text-brand-text/70">{label}</p>
        <p className="ml-auto shrink-0 text-[11px] text-brand-text/35">
          {files.length}/{maxFiles}
        </p>
      </div>
      <input ref={inputRef} type="file" accept={accept} multiple={maxFiles > 1} className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />

      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {files.map((f, i) => (
            <div key={i} className="relative group">
              {f.type.startsWith('image/') ? (
                <img src={URL.createObjectURL(f)} alt="" className="w-20 h-20 rounded-lg object-cover border border-brand-divider" />
              ) : (
                <div className="w-20 h-20 rounded-lg border border-brand-divider bg-brand-bg flex items-center justify-center">
                  <span className="text-[9px] text-brand-text/40 text-center px-1 truncate">{f.name}</span>
                </div>
              )}
              <button
                type="button" onClick={() => onRemove(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ===== COMPOSER COMPONENT ===== */
export default function ChannelComposer({ channel, onPublish, onSaveDraft, isPublishing }: ComposerProps) {
  const [updateType, setUpdateType] = useState<UpdateType>('announcement')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [reactionsOn, setReactionsOn] = useState(true)
  const [commentsOn, setCommentsOn] = useState(true)
  const [pinned, setPinned] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleData>({ type: 'now' })
  const [showSchedule, setShowSchedule] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Poll state
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollDesc, setPollDesc] = useState('')
  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { id: genId(), text: '' }, { id: genId(), text: '' },
  ])
  const [pollDuration, setPollDuration] = useState('24h')
  const [pollMultiple, setPollMultiple] = useState(false)
  const [pollAnonymous, setPollAnonymous] = useState(false)
  const [pollShowResults, setPollShowResults] = useState(false)
  const [pollQuiz, setPollQuiz] = useState(false)
  const [pollCorrectId, setPollCorrectId] = useState<string | null>(null)

  // Event state
  const [eventTitle, setEventTitle] = useState('')
  const [eventDesc, setEventDesc] = useState('')
  const [eventStartDate, setEventStartDate] = useState('')
  const [eventStartTime, setEventStartTime] = useState('')
  const [eventEndDate, setEventEndDate] = useState('')
  const [eventEndTime, setEventEndTime] = useState('')
  const [eventAllDay, setEventAllDay] = useState(false)
  const [eventLocationType, setEventLocationType] = useState<'in-person' | 'online' | 'hybrid'>('online')
  const [eventAddress, setEventAddress] = useState('')
  const [eventLink, setEventLink] = useState('')
  const [eventRsvp, setEventRsvp] = useState(true)
  const [eventMaxAttendees, setEventMaxAttendees] = useState('')

  // Urgent state
  const [urgentSeverity, setUrgentSeverity] = useState<'info' | 'warning' | 'critical'>('info')
  const [urgentExpiry, setUrgentExpiry] = useState('')
  const [urgentBtnLabel, setUrgentBtnLabel] = useState('')
  const [urgentBtnUrl, setUrgentBtnUrl] = useState('')

  // Draft auto-save
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!onSaveDraft) return
    autoSaveRef.current = setInterval(() => {
      if (body.trim() || title.trim() || pollQuestion.trim() || eventTitle.trim()) {
        onSaveDraft(buildPayload())
      }
    }, 30_000)
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current) }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTypeSwitch = (newType: UpdateType) => {
    if (newType === updateType) return
    const hasContent = body.trim() || title.trim() || files.length > 0 || pollQuestion.trim() || eventTitle.trim()
    if (hasContent && !confirm('Switching type will clear your current content. Continue?')) return
    setUpdateType(newType)
    setTitle(''); setBody(''); setFiles([]); setErrors({})
    setPollQuestion(''); setPollDesc(''); setPollOptions([{ id: genId(), text: '' }, { id: genId(), text: '' }])
    setEventTitle(''); setEventDesc(''); setEventStartDate(''); setEventStartTime('')
  }

  const addPollOption = () => {
    if (pollOptions.length >= 6) return
    setPollOptions([...pollOptions, { id: genId(), text: '' }])
  }

  const removePollOption = (id: string) => {
    if (pollOptions.length <= 2) return
    setPollOptions(pollOptions.filter(o => o.id !== id))
  }

  const updatePollOption = (id: string, text: string) => {
    if (text.length > MAX.pollOption) return
    setPollOptions(pollOptions.map(o => o.id === id ? { ...o, text } : o))
  }

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '')
    if (t && tags.length < MAX.tag && !tags.includes(t)) {
      setTags([...tags, t])
      setTagInput('')
    }
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    switch (updateType) {
      case 'announcement':
        if (!title.trim()) e.title = 'Title is required'
        if (!body.trim()) e.body = 'Content is required'
        break
      case 'photo':
        if (files.length === 0) e.files = 'At least one photo is required'
        break
      case 'video':
        if (files.length === 0) e.files = 'Video file is required'
        if (!title.trim()) e.title = 'Title is required'
        break
      case 'poll':
        if (!pollQuestion.trim()) e.pollQuestion = 'Question is required'
        if (pollOptions.filter(o => o.text.trim()).length < 2) e.pollOptions = 'At least 2 options required'
        if (pollOptions.some(o => o.text.trim() === '')) e.pollOptions = 'Option cannot be empty'
        break
      case 'event':
        if (!eventTitle.trim()) e.eventTitle = 'Event title is required'
        if (!eventDesc.trim()) e.eventDesc = 'Description is required'
        if (!eventStartDate) e.eventDate = 'Event date must be in the future'
        if (eventStartDate && new Date(`${eventStartDate}T${eventStartTime || '00:00'}`) <= new Date()) {
          e.eventDate = 'Event date must be in the future'
        }
        break
      case 'urgent':
        if (!title.trim()) e.title = 'Title is required'
        if (!body.trim()) e.body = 'Content is required'
        break
    }
    if (schedule.type === 'scheduled' && schedule.date) {
      if (new Date(`${schedule.date}T${schedule.time || '00:00'}`) <= new Date()) {
        e.schedule = 'Schedule date must be in the future'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const buildPayload = (): ComposerPayload => {
    const base: ComposerPayload = {
      update_type: updateType === 'urgent' ? 'alert' : updateType === 'photo' ? 'image' : updateType,
      is_pinned: pinned,
      is_urgent: updateType === 'urgent',
      body: '',
    }

    if (schedule.type === 'scheduled' && schedule.date) {
      base.scheduled_at = new Date(`${schedule.date}T${schedule.time || '00:00'}`).toISOString()
    }

    const meta: Record<string, unknown> = {
      reactions_enabled: reactionsOn,
      comments_enabled: commentsOn,
      tags,
    }

    switch (updateType) {
      case 'announcement':
        base.title = title; base.body = body; break
      case 'photo':
        base.body = body || 'Photo update'; break
      case 'video':
        base.title = title; base.body = body || 'Video update'; break
      case 'poll':
        base.body = pollQuestion; base.title = pollQuestion
        meta.poll_options = pollOptions.map(o => o.text)
        meta.poll_duration = pollDuration
        meta.poll_multiple = pollMultiple
        meta.poll_anonymous = pollAnonymous
        meta.poll_show_results = pollShowResults
        meta.poll_quiz = pollQuiz
        meta.poll_correct_id = pollCorrectId
        if (pollDesc) meta.poll_description = pollDesc
        break
      case 'event':
        base.title = eventTitle; base.body = eventDesc
        meta.event_start = `${eventStartDate}T${eventStartTime || '00:00'}`
        if (eventEndDate) meta.event_end = `${eventEndDate}T${eventEndTime || '23:59'}`
        meta.event_all_day = eventAllDay
        meta.event_location_type = eventLocationType
        meta.event_address = eventAddress
        meta.event_link = eventLink
        meta.event_rsvp = eventRsvp
        if (eventMaxAttendees) meta.event_max_attendees = parseInt(eventMaxAttendees)
        break
      case 'urgent':
        base.title = title; base.body = body; base.is_urgent = true
        meta.severity = urgentSeverity
        if (urgentExpiry) meta.expiry = urgentExpiry
        if (urgentBtnLabel) meta.action_label = urgentBtnLabel
        if (urgentBtnUrl) meta.action_url = urgentBtnUrl
        break
    }

    /*
      The document goes in metadata.rich. channel_updates.metadata is a jsonb
      column the service already stores, returns and merges BY KEY (it keeps
      `event` there the same way), so a formatted body needs no schema change
      and cannot collide with what is already in there.
    */
    if (richDoc) meta.rich = { format: 'tiptap', doc: richDoc }

    base.metadata = meta
    return base
  }

  /*
    The formatted body, kept beside the plain one. Only the announcement
    composer produces it; the other update types are plain by design.
  */
  const [richDoc, setRichDoc] = useState<RichNode | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)

  const uploadFiles = async (): Promise<string[]> => {
    if (files.length === 0) return []
    const ids: string[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      setUploadProgress(`Uploading ${i + 1}/${files.length}: ${f.name}`)
      const fileType = f.type.startsWith('video/') ? 'video' as const : 'image' as const
      try {
        const mediaId = await uploadMedia(f, fileType)
        ids.push(mediaId)
      } catch (err) {
        throw new Error(`Failed to upload ${f.name}. Please try again.`)
      }
    }
    setUploadProgress(null)
    return ids
  }

  const handlePublish = async () => {
    if (isPublishing || !validate()) return
    if (updateType === 'urgent' && urgentSeverity === 'critical') {
      if (!confirm('This will send a push notification to ALL subscribers. Continue?')) return
    }
    setPublishError(null)
    try {
      // Step 1: Upload all files and get media_ids
      const mediaIds = await uploadFiles()

      // Step 2: Build payload with media_ids
      const payload = buildPayload()
      if (mediaIds.length > 0) {
        payload.media_ids = mediaIds
      }

      // Step 3: Create the update
      await onPublish(payload)
      setPublishSuccess(true)
      setTimeout(() => setPublishSuccess(false), 3000)
    } catch (err: any) {
      // Keep form content intact on failure
      setPublishError(err?.message || 'Failed to publish. Your content has been preserved — you can retry or save as draft.')
    }
  }

  const handleSaveDraftManual = () => {
    if (onSaveDraft) {
      onSaveDraft(buildPayload())
      setPublishError(null)
    }
  }

  const avatarSrc = channel.avatar_media_id ? `/v1/media/${channel.avatar_media_id}/serve` : null

  return (
    /*
      Same shell as the main post composer: a capped height with the body
      scrolling inside it and the actions pinned below.

      It used to be a plain div that grew to whatever the form needed. Inside
      an overlay that meant the Post button sat below the fold on a laptop —
      you could fill the form in and not find the way to send it.
    */
    <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-[28px] border border-brand-divider bg-brand-card shadow-2xl">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-brand-divider px-5 py-4">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-brand-divider bg-brand-secondary">
          {avatarSrc ? <img src={avatarSrc} alt="" className="h-full w-full object-cover" /> : (
            <div className="bg-primary-grad flex h-full w-full items-center justify-center text-[13px] font-bold text-white">
              {channel.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold -tracking-[0.01em] text-brand-text">{channel.name}</p>
          <p className="text-[11px] text-brand-text/45">New update</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
      {/* What kind of update. Coloured like the main composer's tiles, because
          the colour is how you find the one you want without reading. */}
      <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto px-5 pb-3 pt-4">
        {UPDATE_TYPES.map(t => {
          const on = updateType === t.value
          return (
            <button
              key={t.value} type="button" onClick={() => handleTypeSwitch(t.value)}
              aria-pressed={on}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                on
                  ? 'bg-brand-text text-brand-bg'
                  : 'border border-brand-divider text-brand-text/60 hover:bg-brand-secondary'
              }`}
            >
              <span className={on ? '' : t.fg}>{t.icon}</span>
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Form body */}
      <div className="space-y-3.5 px-5 pb-5">

        {/* ── ANNOUNCEMENT ── */}
        {updateType === 'announcement' && (
          <>
            <div>
              <FieldLabel required>Title</FieldLabel>
              <TextInput value={title} onChange={setTitle} placeholder="Update title" maxLength={MAX.title} />
              {errors.title && <p className="text-[11px] text-danger mt-0.5">{errors.title}</p>}
            </div>
            <div>
              <FieldLabel required>Content</FieldLabel>
              {/*
                The editor emits the document AND the plain text, because both
                are needed and they are not interchangeable: `body` is what
                search, previews and notifications read, the document is what
                the card renders.
              */}
              <RichTextEditor
                placeholder="Write your update…"
                onChange={({ doc, text }) => { setRichDoc(doc); setBody(text) }}
              />
              {errors.body && <p className="text-[11px] text-danger mt-0.5">{errors.body}</p>}
            </div>
            <FileUploadZone
              accept="image/*,.pdf,.doc,.docx,.zip" maxFiles={MAX.attachments} files={files}
              onAdd={f => setFiles([...files, ...f])} onRemove={i => setFiles(files.filter((_, idx) => idx !== i))}
              label="Attach images or files (optional)"
            />
          </>
        )}

        {/* ── PHOTO ── */}
        {updateType === 'photo' && (
          <>
            <div>
              <FieldLabel>Caption</FieldLabel>
              <TextArea value={body} onChange={setBody} placeholder="Add a caption..." maxLength={MAX.caption} rows={3} />
            </div>
            <div>
              <FieldLabel required>Photos (1–10)</FieldLabel>
              <FileUploadZone
                accept="image/jpeg,image/png,image/webp,image/gif" maxFiles={MAX.photos} files={files}
                onAdd={f => setFiles([...files, ...f])} onRemove={i => setFiles(files.filter((_, idx) => idx !== i))}
                label="Upload photos (JPG, PNG, WEBP, GIF — max 10MB each)"
              />
              {errors.files && <p className="text-[11px] text-danger mt-0.5">{errors.files}</p>}
            </div>
          </>
        )}

        {/* ── VIDEO ── */}
        {updateType === 'video' && (
          <>
            <div>
              <FieldLabel required>Title</FieldLabel>
              <TextInput value={title} onChange={setTitle} placeholder="Video title" maxLength={MAX.title} />
              {errors.title && <p className="text-[11px] text-danger mt-0.5">{errors.title}</p>}
            </div>
            <div>
              <FieldLabel>Description</FieldLabel>
              <TextArea value={body} onChange={setBody} placeholder="Describe your video..." maxLength={MAX.body} rows={3} />
            </div>
            <div>
              <FieldLabel required>Video file</FieldLabel>
              <FileUploadZone
                accept="video/mp4,video/mov,video/webm" maxFiles={1} files={files}
                onAdd={f => setFiles([...files, ...f])} onRemove={i => setFiles(files.filter((_, idx) => idx !== i))}
                label="Upload video (MP4, MOV, WEBM — max 2GB, 60 min)"
              />
              {errors.files && <p className="text-[11px] text-danger mt-0.5">{errors.files}</p>}
            </div>
          </>
        )}

        {/* ── POLL ── */}
        {updateType === 'poll' && (
          <>
            <div>
              <FieldLabel required>Question</FieldLabel>
              <TextInput value={pollQuestion} onChange={setPollQuestion} placeholder="What do you want to ask?" maxLength={MAX.pollQuestion} />
              {errors.pollQuestion && <p className="text-[11px] text-danger mt-0.5">{errors.pollQuestion}</p>}
            </div>
            <div>
              <FieldLabel>Description / context</FieldLabel>
              <TextArea value={pollDesc} onChange={setPollDesc} placeholder="Add context (optional)..." maxLength={MAX.pollDesc} rows={2} />
            </div>
            <div>
              <FieldLabel required>Options (2–6)</FieldLabel>
              <div className="space-y-2">
                {pollOptions.map((opt, i) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <GripVertical className="w-3.5 h-3.5 text-brand-text/20 shrink-0 cursor-grab" />
                    <input
                      type="text" value={opt.text}
                      onChange={e => updatePollOption(opt.id, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 px-3 py-2 bg-brand-bg border border-brand-divider rounded-lg text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-hidden focus:ring-1 focus:ring-brand-text/10"
                    />
                    <CharCount current={opt.text.length} max={MAX.pollOption} />
                    {pollQuiz && (
                      <button type="button" onClick={() => setPollCorrectId(opt.id)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${pollCorrectId === opt.id ? 'border-success bg-success text-white' : 'border-brand-divider text-transparent'}`}
                      >✓</button>
                    )}
                    {pollOptions.length > 2 && (
                      <button type="button" onClick={() => removePollOption(opt.id)} className="text-brand-text/30 hover:text-danger">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {pollOptions.length < 6 && (
                <button type="button" onClick={addPollOption} className="flex items-center gap-1 mt-2 text-xs text-brand-text/50 hover:text-brand-text font-semibold">
                  <Plus className="w-3 h-3" /> Add option
                </button>
              )}
              {errors.pollOptions && <p className="text-[11px] text-danger mt-1">{errors.pollOptions}</p>}
            </div>
            {/* Poll settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Duration</FieldLabel>
                <select value={pollDuration} onChange={e => setPollDuration(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-bg border border-brand-divider rounded-lg text-xs text-brand-text focus:outline-hidden">
                  {POLL_DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="space-y-2 pt-5">
                <label className="flex items-center gap-2 text-xs text-brand-text/60 cursor-pointer">
                  <input type="checkbox" checked={pollMultiple} onChange={e => setPollMultiple(e.target.checked)} className="rounded-sm" />
                  Multiple selections
                </label>
                <label className="flex items-center gap-2 text-xs text-brand-text/60 cursor-pointer">
                  <input type="checkbox" checked={pollAnonymous} onChange={e => setPollAnonymous(e.target.checked)} className="rounded-sm" />
                  Anonymous voting
                </label>
                <label className="flex items-center gap-2 text-xs text-brand-text/60 cursor-pointer">
                  <input type="checkbox" checked={pollQuiz} onChange={e => setPollQuiz(e.target.checked)} className="rounded-sm" />
                  Quiz mode
                </label>
              </div>
            </div>
          </>
        )}

        {/* ── EVENT ── */}
        {updateType === 'event' && (
          <>
            <div>
              <FieldLabel required>Event title</FieldLabel>
              <TextInput value={eventTitle} onChange={setEventTitle} placeholder="What's the event?" maxLength={MAX.title} />
              {errors.eventTitle && <p className="text-[11px] text-danger mt-0.5">{errors.eventTitle}</p>}
            </div>
            <div>
              <FieldLabel required>Description</FieldLabel>
              <TextArea value={eventDesc} onChange={setEventDesc} placeholder="Event details..." maxLength={MAX.eventDesc} rows={3} />
              {errors.eventDesc && <p className="text-[11px] text-danger mt-0.5">{errors.eventDesc}</p>}
            </div>
            <FileUploadZone
              accept="image/*" maxFiles={1} files={files}
              onAdd={f => setFiles([...files, ...f])} onRemove={i => setFiles(files.filter((_, idx) => idx !== i))}
              label="Cover image (recommended)"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>Start date</FieldLabel>
                <input type="date" value={eventStartDate} onChange={e => setEventStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-bg border border-brand-divider rounded-lg text-xs text-brand-text focus:outline-hidden" />
                {errors.eventDate && <p className="text-[11px] text-danger mt-0.5">{errors.eventDate}</p>}
              </div>
              {!eventAllDay && (
                <div>
                  <FieldLabel required>Start time</FieldLabel>
                  <input type="time" value={eventStartTime} onChange={e => setEventStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-brand-bg border border-brand-divider rounded-lg text-xs text-brand-text focus:outline-hidden" />
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-brand-text/60 cursor-pointer">
              <input type="checkbox" checked={eventAllDay} onChange={e => setEventAllDay(e.target.checked)} className="rounded-sm" />
              All-day event
            </label>
            {/* Location */}
            <div>
              <FieldLabel>Location type</FieldLabel>
              <div className="flex gap-2">
                {(['in-person', 'online', 'hybrid'] as const).map(loc => (
                  <button key={loc} type="button" onClick={() => setEventLocationType(loc)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      eventLocationType === loc ? 'bg-brand-text text-brand-bg' : 'border border-brand-divider text-brand-text/60'
                    }`}>
                    {loc === 'in-person' ? <MapPin className="w-3 h-3" /> : loc === 'online' ? <Monitor className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                    {loc.charAt(0).toUpperCase() + loc.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {(eventLocationType === 'in-person' || eventLocationType === 'hybrid') && (
              <TextInput value={eventAddress} onChange={setEventAddress} placeholder="Event address" maxLength={500} />
            )}
            {(eventLocationType === 'online' || eventLocationType === 'hybrid') && (
              <TextInput value={eventLink} onChange={setEventLink} placeholder="Meeting link (Zoom, Meet, etc.)" maxLength={500} />
            )}
            {/* RSVP */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-xs text-brand-text/60 cursor-pointer">
                <input type="checkbox" checked={eventRsvp} onChange={e => setEventRsvp(e.target.checked)} className="rounded-sm" />
                Enable RSVP
              </label>
              {eventRsvp && (
                <div>
                  <FieldLabel>Max attendees</FieldLabel>
                  <input type="number" value={eventMaxAttendees} onChange={e => setEventMaxAttendees(e.target.value)}
                    placeholder="Unlimited" min="0"
                    className="w-full px-3 py-2 bg-brand-bg border border-brand-divider rounded-lg text-xs text-brand-text focus:outline-hidden" />
                </div>
              )}
            </div>
          </>
        )}

        {/* ── URGENT ── */}
        {updateType === 'urgent' && (
          <>
            {/* Severity */}
            <div>
              <FieldLabel required>Severity level</FieldLabel>
              <div className="flex gap-2">
                {(['info', 'warning', 'critical'] as const).map(sev => (
                  <button key={sev} type="button" onClick={() => setUrgentSeverity(sev)}
                    className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-colors ${
                      urgentSeverity === sev
                        ? sev === 'critical' ? 'bg-danger text-white' : sev === 'warning' ? 'bg-warning text-white' : 'bg-primary-ink text-white'
                        : 'border border-brand-divider text-brand-text/60'
                    }`}>
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </button>
                ))}
              </div>
              {urgentSeverity === 'critical' && (
                <p className="text-[11px] text-danger mt-1">Push notification + email sent to all subscribers. Max 1 per 24h.</p>
              )}
            </div>
            <div>
              <FieldLabel required>Title</FieldLabel>
              <TextInput value={title} onChange={setTitle} placeholder="Urgent alert title" maxLength={MAX.title} />
              {errors.title && <p className="text-[11px] text-danger mt-0.5">{errors.title}</p>}
            </div>
            <div>
              <FieldLabel required>Content</FieldLabel>
              <TextArea value={body} onChange={setBody} placeholder="Describe the situation..." maxLength={MAX.urgentBody} rows={4} />
              {errors.body && <p className="text-[11px] text-danger mt-0.5">{errors.body}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Expiry date/time</FieldLabel>
                <input type="datetime-local" value={urgentExpiry} onChange={e => setUrgentExpiry(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-bg border border-brand-divider rounded-lg text-xs text-brand-text focus:outline-hidden" />
              </div>
              <div>
                <FieldLabel>Action button label</FieldLabel>
                <TextInput value={urgentBtnLabel} onChange={setUrgentBtnLabel} placeholder="e.g. Learn more" maxLength={MAX.buttonLabel} />
              </div>
            </div>
            {urgentBtnLabel && (
              <div>
                <FieldLabel>Action button URL</FieldLabel>
                <TextInput value={urgentBtnUrl} onChange={setUrgentBtnUrl} placeholder="https://..." maxLength={500} />
              </div>
            )}
          </>
        )}

        {/* ===== BOTTOM ACTION BAR ===== */}
      </div>
      </div>

      {/* Pinned: the actions stay reachable however long the form is. */}
      <div className="shrink-0 border-t border-brand-divider bg-brand-card px-5 py-3">
        {/* text-[12px] throughout: these were 10px, which is below the size
            anything meant to be read should be. */}
        <div className="flex flex-wrap items-center gap-2 [&_button]:text-[12px]">
          {/* Tags */}
          <div className="flex items-center gap-1">
            {tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-text/8 text-brand-text/60">
                #{t}
                <button type="button" onClick={() => setTags(tags.filter(x => x !== t))}>
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            {tags.length < MAX.tag && (
              <input
                type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder={tags.length === 0 ? 'Tags' : '+'}
                className="w-16 px-2 py-1 bg-transparent text-[10px] text-brand-text/50 placeholder:text-brand-text/30 focus:outline-hidden"
              />
            )}
          </div>

          <div className="w-px h-4 bg-brand-divider" />

          {/* Toggles */}
          <button type="button" onClick={() => setReactionsOn(!reactionsOn)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${reactionsOn ? 'text-brand-text/60' : 'text-brand-text/30 line-through'}`}>
            <Sparkles className="w-3 h-3" /> Reactions: {reactionsOn ? 'ON' : 'OFF'}
          </button>
          <button type="button" onClick={() => setCommentsOn(!commentsOn)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${commentsOn ? 'text-brand-text/60' : 'text-brand-text/30 line-through'}`}>
            <MessageCircle className="w-3 h-3" /> Comments: {commentsOn ? 'ON' : 'OFF'}
          </button>

          <button type="button" onClick={() => setPinned(!pinned)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${pinned ? 'text-brand-text bg-brand-text/8' : 'text-brand-text/40'}`}>
            <Pin className="w-3 h-3" /> Pin
          </button>

          {/* Schedule */}
          <div className="relative">
            <button type="button" onClick={() => setShowSchedule(!showSchedule)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${schedule.type === 'scheduled' ? 'text-brand-text bg-brand-text/8' : 'text-brand-text/40'}`}>
              <Clock className="w-3 h-3" />
              {schedule.type === 'scheduled' ? `Scheduled: ${schedule.date}` : 'Schedule'}
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showSchedule && (
              <div className="absolute bottom-full mb-2 left-0 w-64 bg-brand-card border border-brand-divider rounded-xl shadow-lg p-3 z-50 space-y-2">
                <label className="flex items-center gap-2 text-xs text-brand-text cursor-pointer">
                  <input type="radio" name="sched" checked={schedule.type === 'now'} onChange={() => setSchedule({ type: 'now' })} /> Post now
                </label>
                <label className="flex items-center gap-2 text-xs text-brand-text cursor-pointer">
                  <input type="radio" name="sched" checked={schedule.type === 'scheduled'} onChange={() => setSchedule({ type: 'scheduled', date: '', time: '' })} /> Schedule for...
                </label>
                {schedule.type === 'scheduled' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <input type="date" value={schedule.date || ''} onChange={e => setSchedule({ ...schedule, date: e.target.value })}
                      className="px-2 py-1.5 bg-brand-bg border border-brand-divider rounded-lg text-[10px]" />
                    <input type="time" value={schedule.time || ''} onChange={e => setSchedule({ ...schedule, time: e.target.value })}
                      className="px-2 py-1.5 bg-brand-bg border border-brand-divider rounded-lg text-[10px]" />
                  </div>
                )}
                {errors.schedule && <p className="text-[11px] text-danger">{errors.schedule}</p>}
                <button type="button" onClick={() => setShowSchedule(false)} className="text-[10px] font-semibold text-brand-text underline">Done</button>
              </div>
            )}
          </div>

          {/* Upload progress */}
          {uploadProgress && (
            <span className="flex items-center gap-1.5 text-[10px] text-brand-text/50">
              <Loader2 className="w-3 h-3 animate-spin" /> {uploadProgress}
            </span>
          )}

          {/* PUBLISH */}
          <button
            type="button" onClick={handlePublish}
            disabled={isPublishing || !!uploadProgress}
            className="bg-primary-grad ml-auto flex shrink-0 items-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
          >
            {(isPublishing || uploadProgress) && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
            {uploadProgress ? 'Uploading…' : isPublishing ? 'Publishing…' : schedule.type === 'scheduled' ? 'Schedule' : 'Post'}
          </button>
        </div>

        {/* On tokens, not raw emerald/red: an unrecognised colour compiles to
            nothing at all in this Tailwind setup, silently. */}
        {publishSuccess && (
          <div className="mt-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-[12px] font-medium text-success">
            Published.
          </div>
        )}

        {publishError && (
          <div className="mt-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5">
            <p className="text-[12px] font-medium text-danger">{publishError}</p>
            <div className="mt-1.5 flex items-center gap-3">
              <button type="button" onClick={handlePublish} className="text-[11px] font-semibold text-danger underline">Retry</button>
              {onSaveDraft && (
                <button type="button" onClick={handleSaveDraftManual} className="text-[11px] font-semibold text-brand-text/60 underline">Save as draft</button>
              )}
            </div>
          </div>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="mt-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5">
            <p className="text-[12px] font-medium text-danger">Please fix the following:</p>
            {Object.values(errors).map((e, i) => <p key={i} className="mt-0.5 text-[11px] text-danger/80">• {e}</p>)}
          </div>
        )}
      </div>
    </div>
  )
}

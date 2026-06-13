'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  X, Loader2, Pin, MessageCircle, Sparkles, AlertTriangle,
  Info, Bold, Italic, Underline, Strikethrough, Link2,
  List, ListOrdered, Code, Quote, Smile, Video, BarChart3,
  Calendar, Radio,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BroadcastChannel, ChannelUpdate } from '@/types/channels'

/* ===== Types ===== */

interface EditPayload {
  title?: string
  body?: string
  is_pinned?: boolean
  metadata?: Record<string, unknown>
}

interface EditUpdateModalProps {
  update: ChannelUpdate
  channel: BroadcastChannel
  onSave: (updateId: string, data: Partial<EditPayload>) => Promise<void>
  onClose: () => void
  isSaving?: boolean
}

/* ===== Constants ===== */

const MAX = {
  title: 150,
  body: 5000,
  tag: 5,
}

const TYPE_LABELS: Record<string, string> = {
  announcement: 'Announcement',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  poll: 'Poll',
  event: 'Event',
  commerce: 'Commerce',
  alert: 'Urgent',
  digest: 'Digest',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  announcement: <Radio className="w-4 h-4" />,
  poll: <BarChart3 className="w-4 h-4" />,
  event: <Calendar className="w-4 h-4" />,
  alert: <AlertTriangle className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
}

/* ===== Helpers ===== */

function CharCount({ current, max }: { current: number; max: number }) {
  const pct = current / max
  return (
    <span className={`text-[10px] font-mono ${pct >= 1 ? 'text-red-500 font-bold' : pct >= 0.9 ? 'text-amber-500' : 'text-brand-text/30'}`}>
      {current}/{max}
    </span>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-bold text-brand-text/50 uppercase tracking-wider mb-1.5">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-[10px] text-red-500 mt-0.5">{message}</p>
}

function Toggle({ enabled, onToggle, label, icon }: {
  enabled: boolean; onToggle: () => void; label: string; icon: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-brand-divider bg-brand-secondary p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-brand-text">
        {icon}
        {label}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-brand-text' : 'bg-brand-divider'}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

function WarningBanner({ variant, children }: { variant: 'warning' | 'info'; children: React.ReactNode }) {
  const isWarning = variant === 'warning'
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs font-medium ${
      isWarning
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : 'border-blue-300 bg-blue-50 text-blue-800'
    }`}>
      {isWarning
        ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
        : <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
      }
      <span>{children}</span>
    </div>
  )
}

function RichTextToolbar() {
  const btn = 'w-7 h-7 rounded flex items-center justify-center text-brand-text/40 hover:text-brand-text hover:bg-brand-bg transition-colors'
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-brand-divider bg-brand-card rounded-t-xl">
      <button type="button" className={btn} title="Bold"><Bold className="w-3.5 h-3.5" /></button>
      <button type="button" className={btn} title="Italic"><Italic className="w-3.5 h-3.5" /></button>
      <button type="button" className={btn} title="Underline"><Underline className="w-3.5 h-3.5" /></button>
      <button type="button" className={btn} title="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></button>
      <div className="w-px h-4 bg-brand-divider mx-1" />
      <button type="button" className={btn} title="Link"><Link2 className="w-3.5 h-3.5" /></button>
      <button type="button" className={btn} title="Bullet list"><List className="w-3.5 h-3.5" /></button>
      <button type="button" className={btn} title="Numbered list"><ListOrdered className="w-3.5 h-3.5" /></button>
      <button type="button" className={btn} title="Code"><Code className="w-3.5 h-3.5" /></button>
      <button type="button" className={btn} title="Quote"><Quote className="w-3.5 h-3.5" /></button>
      <div className="w-px h-4 bg-brand-divider mx-1" />
      <button type="button" className={btn} title="Emoji"><Smile className="w-3.5 h-3.5" /></button>
    </div>
  )
}

/* ===== Determine which title-required types need title ===== */
const TITLE_REQUIRED_TYPES = new Set(['announcement', 'alert', 'video'])
const BODY_REQUIRED_TYPES = new Set(['announcement', 'alert'])

/* ===== Main Component ===== */

export default function EditUpdateModal({
  update,
  channel,
  onSave,
  onClose,
  isSaving = false,
}: EditUpdateModalProps) {
  /* ---------- Initial values from the update ---------- */
  const meta = (update.metadata ?? {}) as Record<string, unknown>
  const initialTags = Array.isArray(meta.tags) ? (meta.tags as string[]) : []

  const [title, setTitle] = useState(update.title ?? '')
  const [body, setBody] = useState(update.body ?? '')
  const [isPinned, setIsPinned] = useState(update.is_pinned)
  const [commentsEnabled, setCommentsEnabled] = useState(
    meta.comments_enabled !== false
  )
  const [reactionsEnabled, setReactionsEnabled] = useState(
    meta.reactions_enabled !== false
  )
  const [tags, setTags] = useState<string[]>(initialTags)
  const [tagInput, setTagInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  /* ---------- Type-specific warning states ---------- */
  const isPoll = update.update_type === 'poll'
  const isEvent = update.update_type === 'event'
  const isAlert = update.update_type === 'alert'
  const isVideo = update.update_type === 'video'

  const pollHasVotes = isPoll && (
    typeof meta.votes === 'number' ? (meta.votes as number) > 0 :
    Array.isArray(meta.votes) ? (meta.votes as unknown[]).length > 0 :
    !!meta.votes || update.reaction_count > 0
  )
  const eventHasAttendees = isEvent && !!meta.attendees
  const alertIsCritical = isAlert && meta.severity === 'critical'

  /* ---------- Dirty tracking ---------- */
  const hasChanges = useMemo(() => {
    if (title !== (update.title ?? '')) return true
    if (body !== (update.body ?? '')) return true
    if (isPinned !== update.is_pinned) return true
    if (commentsEnabled !== (meta.comments_enabled !== false)) return true
    if (reactionsEnabled !== (meta.reactions_enabled !== false)) return true
    if (JSON.stringify(tags) !== JSON.stringify(initialTags)) return true
    return false
  }, [title, body, isPinned, commentsEnabled, reactionsEnabled, tags, update, meta, initialTags])

  /* ---------- Tags ---------- */
  const addTag = useCallback(() => {
    const t = tagInput.trim().replace(/^#/, '')
    if (t && tags.length < MAX.tag && !tags.includes(t)) {
      setTags(prev => [...prev, t])
      setTagInput('')
    }
  }, [tagInput, tags])

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag))
  }, [])

  /* ---------- Validation ---------- */
  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {}

    if (TITLE_REQUIRED_TYPES.has(update.update_type) && !title.trim()) {
      e.title = 'Title is required for this update type'
    }
    if (BODY_REQUIRED_TYPES.has(update.update_type) && !body.trim()) {
      e.body = 'Content is required'
    }
    if (title.length > MAX.title) {
      e.title = `Title must be ${MAX.title} characters or fewer`
    }
    if (body.length > MAX.body) {
      e.body = `Body must be ${MAX.body} characters or fewer`
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }, [update.update_type, title, body])

  /* ---------- Build changed payload ---------- */
  const buildChangedPayload = useCallback((): Partial<EditPayload> => {
    const payload: Partial<EditPayload> = {}

    if (title !== (update.title ?? '')) {
      payload.title = title
    }
    if (body !== (update.body ?? '')) {
      payload.body = body
    }
    if (isPinned !== update.is_pinned) {
      payload.is_pinned = isPinned
    }

    const metaChanged =
      commentsEnabled !== (meta.comments_enabled !== false) ||
      reactionsEnabled !== (meta.reactions_enabled !== false) ||
      JSON.stringify(tags) !== JSON.stringify(initialTags)

    if (metaChanged) {
      payload.metadata = {
        ...meta,
        comments_enabled: commentsEnabled,
        reactions_enabled: reactionsEnabled,
        tags,
      }
    }

    return payload
  }, [title, body, isPinned, commentsEnabled, reactionsEnabled, tags, update, meta, initialTags])

  /* ---------- Save handler ---------- */
  const handleSave = useCallback(async () => {
    if (isSaving) return
    setSaveError(null)

    if (!validate()) return

    const payload = buildChangedPayload()
    if (Object.keys(payload).length === 0) {
      onClose()
      return
    }

    try {
      await onSave(update.id, payload)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save changes. Please try again.'
      setSaveError(message)
    }
  }, [isSaving, validate, buildChangedPayload, onSave, update.id, onClose])

  /* ---------- Escape key ---------- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const typeLabel = TYPE_LABELS[update.update_type] ?? update.update_type
  const typeIcon = TYPE_ICONS[update.update_type] ?? null
  const showTitleField = update.title !== undefined || TITLE_REQUIRED_TYPES.has(update.update_type)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
        >
          {/* ===== Header ===== */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-divider bg-brand-card px-6 py-4 rounded-t-2xl">
            <div className="flex items-center gap-2">
              {typeIcon}
              <h2 className="text-lg font-black text-brand-text">
                Edit {typeLabel} Update
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-brand-text/60 transition-colors hover:text-brand-text rounded-lg hover:bg-brand-secondary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ===== Body ===== */}
          <div className="p-6 space-y-5">

            {/* --- Type-specific warning banners --- */}
            {isPoll && pollHasVotes && (
              <WarningBanner variant="warning">
                This poll has votes. Options cannot be changed.
              </WarningBanner>
            )}
            {isEvent && eventHasAttendees && (
              <WarningBanner variant="info">
                Editing time/location will notify attendees.
              </WarningBanner>
            )}
            {isAlert && alertIsCritical && (
              <WarningBanner variant="warning">
                Critical alerts already sent cannot be silently downgraded.
              </WarningBanner>
            )}
            {isVideo && (
              <WarningBanner variant="info">
                Video cannot be changed after publish.
              </WarningBanner>
            )}

            {/* --- Title --- */}
            {showTitleField && (
              <div>
                <FieldLabel required={TITLE_REQUIRED_TYPES.has(update.update_type)}>Title</FieldLabel>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX.title) setTitle(e.target.value)
                  }}
                  placeholder="Update title"
                  className="w-full px-4 py-2.5 bg-brand-bg border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10"
                />
                <div className="flex items-center justify-between mt-1">
                  <FieldError message={errors.title} />
                  <CharCount current={title.length} max={MAX.title} />
                </div>
              </div>
            )}

            {/* --- Body / Description --- */}
            <div>
              <FieldLabel required={BODY_REQUIRED_TYPES.has(update.update_type)}>
                {isPoll ? 'Question' : isEvent ? 'Description' : 'Content'}
              </FieldLabel>
              <RichTextToolbar />
              <textarea
                value={body}
                onChange={(e) => {
                  if (e.target.value.length <= MAX.body) setBody(e.target.value)
                }}
                placeholder={
                  isPoll ? 'Poll question...' :
                  isEvent ? 'Event details...' :
                  'Write your update...'
                }
                rows={5}
                className="w-full px-4 py-2.5 bg-brand-bg border border-brand-divider rounded-xl rounded-t-none border-t-0 text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10 resize-none"
              />
              <div className="flex items-center justify-between mt-1">
                <FieldError message={errors.body} />
                <CharCount current={body.length} max={MAX.body} />
              </div>
            </div>

            {/* --- Tags --- */}
            <div>
              <FieldLabel>Tags</FieldLabel>
              <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] px-3 py-2 bg-brand-bg border border-brand-divider rounded-xl">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-text/8 text-brand-text/70"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {tags.length < MAX.tag && (
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addTag() }
                      if (e.key === ',' || e.key === ' ') { e.preventDefault(); addTag() }
                    }}
                    onBlur={addTag}
                    placeholder={tags.length === 0 ? 'Add tags (press Enter)' : 'Add more...'}
                    className="flex-1 min-w-[80px] bg-transparent text-xs text-brand-text placeholder:text-brand-text/30 focus:outline-none"
                  />
                )}
              </div>
              <p className="text-[10px] text-brand-text/30 mt-1">
                {tags.length}/{MAX.tag} tags
              </p>
            </div>

            {/* --- Toggles --- */}
            <div className="space-y-3">
              <Toggle
                enabled={isPinned}
                onToggle={() => setIsPinned(!isPinned)}
                label="Pin to top"
                icon={<Pin className="w-4 h-4" />}
              />
              <Toggle
                enabled={commentsEnabled}
                onToggle={() => setCommentsEnabled(!commentsEnabled)}
                label="Comments enabled"
                icon={<MessageCircle className="w-4 h-4" />}
              />
              <Toggle
                enabled={reactionsEnabled}
                onToggle={() => setReactionsEnabled(!reactionsEnabled)}
                label="Reactions enabled"
                icon={<Sparkles className="w-4 h-4" />}
              />
            </div>

            {/* --- Severity selector for alert (locked if critical already sent) --- */}
            {isAlert && (
              <div>
                <FieldLabel>Severity level</FieldLabel>
                <div className="flex gap-2">
                  {(['info', 'warning', 'critical'] as const).map((sev) => {
                    const isCurrent = meta.severity === sev
                    const isLocked = alertIsCritical && sev !== 'critical'
                    return (
                      <button
                        key={sev}
                        type="button"
                        disabled={alertIsCritical}
                        className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-colors ${
                          isCurrent
                            ? sev === 'critical' ? 'bg-red-500 text-white'
                            : sev === 'warning' ? 'bg-amber-500 text-white'
                            : 'bg-blue-500 text-white'
                            : 'border border-brand-divider text-brand-text/60'
                        } ${isLocked || alertIsCritical ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {sev.charAt(0).toUpperCase() + sev.slice(1)}
                      </button>
                    )
                  })}
                </div>
                {alertIsCritical && (
                  <p className="text-[10px] text-brand-text/40 mt-1">Severity is locked because this critical alert has already been sent.</p>
                )}
              </div>
            )}

            {/* --- Error summary --- */}
            {Object.keys(errors).length > 1 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-[11px] font-bold text-red-600 mb-1">Please fix the following:</p>
                {Object.values(errors).map((msg, i) => (
                  <p key={i} className="text-[10px] text-red-500">• {msg}</p>
                ))}
              </div>
            )}

            {/* --- Save error --- */}
            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs font-bold text-red-600">{saveError}</p>
              </div>
            )}
          </div>

          {/* ===== Footer ===== */}
          <div className="sticky bottom-0 flex items-center gap-3 border-t border-brand-divider bg-brand-card px-6 py-4 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-brand-secondary py-3 text-sm font-bold text-brand-text transition-all hover:bg-brand-secondary/80"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-text py-3 text-sm font-bold text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

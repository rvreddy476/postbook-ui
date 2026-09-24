'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { uploadMedia } from '@/lib/mediaUpload'

/** media-service's own ceiling for an image. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
import {
  Camera,
  ChevronDown,
  Save,
  AlertTriangle,
  Trash2,
  ArrowRightLeft,
  Loader2,
  Check,
} from 'lucide-react'
import type { BroadcastChannel } from '@/types/channels'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface SettingsTabProps {
  channel: BroadcastChannel
  /**
   * Applies the change. May return a promise; when it does, the button waits
   * on it and reports what happened. A void return keeps working — it just
   * cannot confirm, which is the state this screen was stuck in.
   */
  onUpdate: (data: Record<string, unknown>) => void | Promise<unknown>
  role: 'owner' | 'editor'
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  'Technology',
  'Music',
  'Art',
  'Gaming',
  'Education',
  'Business',
  'Lifestyle',
  'News',
  'Sports',
  'Other',
] as const

/**
 * `channel_type` mixes two ideas in one column: who can find the channel
 * (public / private) and what flavour it is (creator, brand, education,
 * official, topic, paid). Only the first is a question a channel owner
 * can usefully answer here, so this offers those two and leaves an
 * existing flavour value alone unless the owner actually changes it.
 */
/*
  A channel's type is not a two-way switch.

  channel_type carries seven values — public, private, creator, brand,
  education, official, topic, paid — and this offered two. channelTypeLabel
  collapsed everything that was not 'private' into "Public", so a creator or
  brand channel displayed as Public and the first touch of the select
  rewrote it to plain 'public', throwing its kind away silently.

  So the labels are built from what the channel ACTUALLY is: the two general
  choices when it is one of them, and its own kind listed first when it is
  not, so switching is still possible but never accidental.
*/
export const CHANNEL_TYPE_BY_LABEL: Record<string, string> = {
  Public: 'public',
  Private: 'private',
  Creator: 'creator',
  Brand: 'brand',
  Education: 'education',
  Official: 'official',
  Topic: 'topic',
  Paid: 'paid',
}

export function channelTypeLabel(value: string): string {
  const found = Object.entries(CHANNEL_TYPE_BY_LABEL).find(([, v]) => v === value)
  return found ? found[0] : 'Public'
}

export function channelTypeOptions(current: string): string[] {
  const label = channelTypeLabel(current)
  if (label === 'Public' || label === 'Private') return ['Public', 'Private']
  // A flavoured channel keeps its own kind as the selected option; the two
  // general ones remain available, and nothing changes unless it is chosen.
  return [label, 'Public', 'Private']
}

const SUBSCRIBER_LIST_VISIBILITY = ['Everyone', 'Subscribers Only', 'Only Me'] as const
const DEFAULT_VISIBILITY = ['Public', 'Subscribers Only'] as const
const NOTIFY_OPTIONS = ['Always', 'Only Urgent', 'Never'] as const
const EMAIL_DIGEST_OPTIONS = ['Daily', 'Weekly', 'Off'] as const

const HANDLE_REGEX = /^[a-zA-Z0-9_]{3,30}$/

/* ------------------------------------------------------------------ */
/*  Reusable primitives                                                */
/* ------------------------------------------------------------------ */

/*
  The settings sections.

  NO "NOTIFICATIONS" SECTION either, for the same reason it is not here:
  its two controls — notify-on-new-update and email digest — had no column,
  no handler and no effect. They are gone rather than left looking operable.

  NO "RULES" SECTION, and that is not an oversight. channel-service has no
  rules column — not in broadcast_channels, not on the wire, not in any
  handler. A Rules tab would be a text box that forgets what you type the
  moment you reload. Groups do have rules; channels need the field adding
  server-side first, which is a migration rather than a UI change.
*/
const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'permissions', label: 'Permissions' },
] as const

type SettingsSection = (typeof SETTINGS_SECTIONS)[number]['id']

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-brand-card border border-brand-divider rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-brand-divider">
        <h3 className="text-sm font-bold text-brand-text">{title}</h3>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold text-brand-text/40 tracking-wider mb-1.5">
      {children}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  maxLength,
  placeholder,
  error,
  mono,
}: {
  value: string
  onChange: (v: string) => void
  maxLength?: number
  placeholder?: string
  error?: string
  mono?: boolean
}) {
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`w-full bg-brand-bg border border-brand-divider rounded-xl px-3.5 py-2 text-sm text-brand-text placeholder:text-brand-text/30 outline-hidden focus:ring-2 focus:ring-brand-text/20 transition ${
          mono ? 'font-mono' : ''
        } ${error ? 'border-danger/30 focus:ring-danger' : ''}`}
      />
      {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
    </div>
  )
}

function TextArea({
  value,
  onChange,
  maxLength,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  maxLength?: number
  placeholder?: string
  rows?: number
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-brand-bg border border-brand-divider rounded-xl px-3.5 py-2 text-sm text-brand-text placeholder:text-brand-text/30 outline-hidden focus:ring-2 focus:ring-brand-text/20 transition resize-none"
      />
      {maxLength != null && (
        <p className="text-[10px] text-brand-text/30 text-right mt-0.5">
          {value.length}/{maxLength}
        </p>
      )}
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: readonly string[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-brand-bg border border-brand-divider rounded-xl px-3.5 py-2 text-sm text-brand-text outline-hidden focus:ring-2 focus:ring-brand-text/20 transition pr-9"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/30 pointer-events-none" />
    </div>
  )
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-brand-text/20 ${
        enabled ? 'bg-primary-ink' : 'bg-brand-divider'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition-transform duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string
  description?: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-brand-text">{label}</p>
        {description && <p className="text-[11px] text-brand-text/40 mt-0.5">{description}</p>}
      </div>
      <Toggle enabled={enabled} onToggle={onToggle} />
    </div>
  )
}

/*
  Pick an image and upload it.

  This was MediaUploadPlaceholder, and the name was accurate: a button with
  no onClick, no file input and no upload. It rendered a camera icon and the
  word "Upload" and did nothing at all when clicked, so the founder could
  not set a channel avatar or banner from Settings — the same shape as the
  dead rich-text toolbar removed earlier.

  The upload itself is the platform's three-step flow (init, PUT to the
  presigned URL, confirm), via the same helper ChannelEditModal already uses.
  The subtypes matter and are not interchangeable: 'avatar' and 'cover' are
  what media-service processes for these two slots.

  The media id is handed UP rather than saved here, because an avatar and a
  name are one edit — uploading must not commit a half-finished form, and
  Cancel has to be able to drop it.
*/
function MediaUpload({
  label,
  current,
  aspect,
  subtype,
  onUploaded,
}: {
  label: string
  current?: string
  aspect: 'square' | 'banner'
  subtype: 'avatar' | 'cover'
  onUploaded: (mediaId: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const sizeClasses = aspect === 'square' ? 'h-20 w-20 rounded-xl' : 'h-24 w-full rounded-xl'
  const shown = preview || (current ? `/v1/media/${current}/serve` : null)

  const choose = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset the input so choosing the SAME file again still fires onChange.
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setFailed('That is not an image.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFailed('That image is over 10 MB.')
      return
    }

    setFailed(null)
    setBusy(true)
    // Shown immediately, from the local file: the upload takes seconds and a
    // picker that looks unchanged until it finishes reads as broken.
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)
    try {
      const mediaId = await uploadMedia(file, 'image', subtype)
      onUploaded(mediaId)
    } catch (err: unknown) {
      // Back to whatever was there before, so the picker never shows an image
      // that was not actually stored.
      setPreview(null)
      URL.revokeObjectURL(localPreview)
      const body = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      setFailed(body?.message || 'Could not upload that image.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={`Change ${label.toLowerCase()}`}
        className={`${sizeClasses} group relative flex items-center justify-center overflow-hidden border-2 border-dashed border-brand-divider bg-brand-secondary transition-colors hover:border-primary-outline disabled:opacity-60`}
      >
        {shown ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-5 w-5 text-white" />
            </div>
          </>
        ) : (
          <div className="text-center">
            <Camera className="mx-auto h-5 w-5 text-brand-text/25" />
            <p className="mt-1 text-[11px] text-brand-text/40">Upload</p>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-brand-card/70">
            <Loader2 className="h-4 w-4 animate-spin text-primary-ink" />
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={choose}
      />
      {failed && <p className="mt-1 text-[11px] text-danger">{failed}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function SettingsTab({ channel, onUpdate, role }: SettingsTabProps) {
  /* ---- Channel Profile ---- */
  /* Which section is open. Not in the URL: this lives inside a tab that is
     already in the URL, and two levels of query state for one screen is more
     bookkeeping than it is worth. */
  const [section, setSection] = useState<SettingsSection>('general')
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  /*
    Uploaded but not yet saved. Held here rather than committed on upload,
    because the avatar and the name are one edit: uploading must not write a
    half-finished form, and Cancel has to be able to drop it.
  */
  const [avatarMediaId, setAvatarMediaId] = useState<string | undefined>()
  const [bannerMediaId, setBannerMediaId] = useState<string | undefined>()

  const [name, setName] = useState(channel.name)
  const [handle, setHandle] = useState(channel.handle)
  const [description, setDescription] = useState(channel.description)
  const [category, setCategory] = useState(channel.category || 'Other')
  const [channelType, setChannelType] = useState<string>(channel.channel_type || 'public')

  /*
    Real server fields only.

    require_approval, subscriber_list_visibility and welcome_message were
    invented by this form: no column, no handler, discarded on arrival. These
    two exist on broadcast_channels and are honoured.
  */
  const [forwardAllowed, setForwardAllowed] = useState(channel.forward_allowed !== false)
  const [subscriberCountVisible, setSubscriberCountVisible] = useState(true)

  /* ---- Update Defaults ---- */
  const [defaultReactions, setDefaultReactions] = useState(channel.reaction_mode === 'enabled')
  const [defaultComments, setDefaultComments] = useState(
    channel.comment_mode === 'enabled' || channel.comment_mode === 'moderated'
  )




  /*
    Cancel puts every field back to what the server last said — the channel
    prop — rather than closing the screen. The settings are one form with one
    Save, so "cancel" can only sensibly mean "undo what I typed"; closing
    would also discard it but would additionally take the user somewhere they
    did not ask to go.
  */
  const resetForm = useCallback(() => {
    setName(channel.name)
    setHandle(channel.handle)
    setDescription(channel.description)
    setCategory(channel.category || 'Other')
    setChannelType(channel.channel_type || 'public')
    setDefaultReactions(channel.reaction_mode === 'enabled')
    setDefaultComments(channel.comment_mode === 'enabled' || channel.comment_mode === 'moderated')
    setAvatarMediaId(undefined)
    setBannerMediaId(undefined)
  }, [channel])

  /* ---- Danger Zone ---- */
  const [showTransferConfirm, setShowTransferConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  /* ---- Saving ---- */
  const [saving, setSaving] = useState(false)

  /* ---- Validation ---- */
  const handleError = useMemo(() => {
    if (!handle) return 'Handle is required'
    if (!HANDLE_REGEX.test(handle)) return 'Must be 3-30 alphanumeric characters or underscores'
    return undefined
  }, [handle])

  const nameError = useMemo(() => {
    if (!name.trim()) return 'Name is required'
    if (name.length > 100) return 'Max 100 characters'
    return undefined
  }, [name])

  const hasErrors = !!handleError || !!nameError

  /* ---- Collect changes ---- */
  const collectChanges = useCallback(() => {
    const changes: Record<string, unknown> = {}

    if (name !== channel.name) changes.name = name
    if (handle !== channel.handle) changes.handle = handle
    if (description !== channel.description) changes.description = description
    if (category !== (channel.category || 'Other')) changes.category = category
    // Only when the owner actually moved it, so a channel carrying a
    // flavour value (creator, brand, education…) is not silently
    // rewritten to 'public' just by opening this tab and saving.
    if (channelType !== (channel.channel_type || 'public')) changes.channel_type = channelType

    // Only when a new one was actually uploaded. Sending undefined would read
    // as "clear it"; sending the existing id back is pointless churn.
    if (avatarMediaId) changes.avatar_media_id = avatarMediaId
    if (bannerMediaId) changes.banner_media_id = bannerMediaId

    /*
      THE NAMES THE SERVER ACTUALLY READS.

      These two were sent as default_reaction_mode and default_comment_mode.
      channel-service's update takes reaction_mode and comment_mode, ignores
      anything it does not recognise, and answers 200 — so switching
      reactions or comments off, pressing Save and getting a clean response
      changed nothing at all, for ever. That is the "save changes is not
      working" report: the save worked, the fields did not.

      Seven other invented fields went the same way and are gone:
      require_approval, subscriber_list_visibility, welcome_message,
      default_visibility, notify_subscribers and email_digest have no column,
      no handler and no meaning to the server. Their controls are removed
      rather than left looking operable — a switch that flips and does
      nothing is worse than no switch.
    */
    changes.reaction_mode = defaultReactions ? 'enabled' : 'disabled'
    changes.comment_mode = defaultComments ? 'enabled' : 'disabled'
    changes.forward_allowed = forwardAllowed
    changes.subscriber_count_visible = subscriberCountVisible

    return changes
  }, [
    name, handle, description, category, channelType,
    defaultReactions, defaultComments, forwardAllowed, subscriberCountVisible,
    channel, avatarMediaId, bannerMediaId,
  ])

  const handleSave = useCallback(async () => {
    if (hasErrors) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      // Awaited, so "Saving…" is true while it is actually saving and the
      // outcome is known before anything is reported.
      await onUpdate(collectChanges())
      setSaved(true)
    } catch (err: unknown) {
      const body = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      setSaveError(body?.message || 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [hasErrors, collectChanges, onUpdate])

  /* The confirmation is transient; the error stays until the next attempt. */
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2500)
    return () => clearTimeout(t)
  }, [saved])

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-card">
      <header className="border-b border-brand-divider px-5 py-4">
        <h2 className="text-[17px] font-semibold -tracking-[0.018em] text-brand-text">Channel Settings</h2>
        <p className="mt-0.5 text-[12px] text-brand-text/55">
          Manage your channel information and preferences
        </p>

        {/* Sections rather than one long scroll: this was four stacked cards
            and a danger zone in a single column, so changing the description
            meant scrolling past every notification default. */}
        <nav role="tablist" aria-label="Settings sections" className="-mb-4 mt-3 flex items-center gap-1 overflow-x-auto">
          {SETTINGS_SECTIONS.map((sec) => {
            const active = section === sec.id
            return (
              <button
                key={sec.id}
                role="tab"
                aria-selected={active}
                onClick={() => setSection(sec.id)}
                className={[
                  'shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] transition-colors',
                  active
                    ? 'border-primary-ink font-semibold text-primary-ink'
                    : 'border-transparent font-medium text-brand-text/50 hover:text-brand-text',
                ].join(' ')}
              >
                {sec.label}
              </button>
            )
          })}
        </nav>
      </header>

      <div className="space-y-4 px-5 py-5">
      {/* ============================================================ */}
      {/*  Channel Profile                                             */}
      {/* ============================================================ */}
      {section === 'general' && (
      <SectionCard title="Channel Profile">
        <div>
          <FieldLabel>Channel Name</FieldLabel>
          <TextInput
            value={name}
            onChange={setName}
            maxLength={100}
            placeholder="My awesome channel"
            error={nameError}
          />
          <p className="text-[10px] text-brand-text/30 text-right mt-0.5">
            {name.length}/100
          </p>
        </div>

        <div>
          <FieldLabel>Handle</FieldLabel>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-brand-text/30 font-mono">
              @
            </span>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              maxLength={30}
              className={`w-full bg-brand-bg border border-brand-divider rounded-xl pl-7 pr-3.5 py-2 text-sm text-brand-text font-mono placeholder:text-brand-text/30 outline-hidden focus:ring-2 focus:ring-brand-text/20 transition ${
                handleError ? 'border-danger/30 focus:ring-danger' : ''
              }`}
              placeholder="channel_handle"
            />
          </div>
          {handleError && <p className="text-[11px] text-danger mt-1">{handleError}</p>}
          <p className="text-[10px] text-brand-text/30 mt-0.5">
            3-30 characters. Letters, numbers, and underscores only.
          </p>
        </div>

        <div>
          <FieldLabel>Description</FieldLabel>
          <TextArea
            value={description}
            onChange={setDescription}
            maxLength={500}
            placeholder="Tell subscribers what your channel is about..."
            rows={3}
          />
        </div>

        <div>
          <FieldLabel>Category</FieldLabel>
          <Select value={category} onChange={setCategory} options={CATEGORIES} />
        </div>

        {/* Every channel starts public — the schema default and what both
            creation forms send. This is where that is changed, and the
            only place it can be: creation no longer asks. */}
        <div>
          <FieldLabel>Who can find this channel</FieldLabel>
          <Select
            value={channelTypeLabel(channelType)}
            onChange={(label) => setChannelType(CHANNEL_TYPE_BY_LABEL[label] ?? channelType)}
            options={channelTypeOptions(channel.channel_type || 'public')}
          />
          <p className="mt-1.5 text-[11px] text-brand-text/45">
            {channelType === 'private'
              ? 'Only people you invite can see this channel or its updates.'
              : 'Anyone can find this channel and read its updates.'}
          </p>
        </div>

        <div className="flex items-start gap-6">
          <MediaUpload
            label="Avatar"
            current={avatarMediaId || channel.avatar_media_id}
            aspect="square"
            subtype="avatar"
            onUploaded={setAvatarMediaId}
          />
          <div className="flex-1">
            <MediaUpload
              label="Banner"
              current={bannerMediaId || channel.banner_media_id}
              aspect="banner"
              subtype="cover"
              onUploaded={setBannerMediaId}
            />
          </div>
        </div>
      </SectionCard>
      )}

      {/* ============================================================ */}
      {/*  Permissions — REAL server fields only                        */}
      {/* ============================================================ */}
      {section === 'permissions' && (
      <SectionCard title="Posts and subscribers">
        {/*
          Everything here maps to a column on broadcast_channels that
          channel-service's update actually reads.

          What was here before did not. "Require approval to subscribe",
          "Who can see subscriber list", "Welcome message", "Default
          visibility", "Notify subscribers on new update" and "Email digest"
          were invented by this form: no column, no handler, discarded on
          arrival, and the save answered 200 regardless. Six switches and
          selects that moved and meant nothing.

          They are removed rather than disabled. A control that looks
          operable and silently does nothing is the worst of the three
          options, and it is what made saving look broken.
        */}
        <ToggleRow
          label="Reactions"
          description="Let subscribers react to posts"
          enabled={defaultReactions}
          onToggle={() => setDefaultReactions((prev) => !prev)}
        />

        <div className="border-t border-brand-divider pt-4">
          <ToggleRow
            label="Comments"
            description="Let subscribers comment on posts"
            enabled={defaultComments}
            onToggle={() => setDefaultComments((prev) => !prev)}
          />
        </div>

        <div className="border-t border-brand-divider pt-4">
          <ToggleRow
            label="Forwarding"
            description="Let people share posts outside the channel"
            enabled={forwardAllowed}
            onToggle={() => setForwardAllowed((prev) => !prev)}
          />
        </div>

        <div className="border-t border-brand-divider pt-4">
          <ToggleRow
            label="Show subscriber count"
            description="Display how many people subscribe"
            enabled={subscriberCountVisible}
            onToggle={() => setSubscriberCountVisible((prev) => !prev)}
          />
        </div>
      </SectionCard>
      )}

      {/* ============================================================ */}
      {/*  Danger Zone (owner only)                                     */}
      {/* ============================================================ */}
      {section === 'general' && (
      <>
      {role === 'owner' && (
        <div className="bg-white border border-danger/30 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-danger/30 bg-danger/10/50">
            <h3 className="text-sm font-bold text-danger flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </h3>
          </div>
          <div className="px-5 py-4 space-y-4">
            {/* Transfer ownership */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-brand-text">Transfer channel ownership</p>
                <p className="text-[11px] text-brand-text/40 mt-0.5">
                  Transfer this channel to another user. You will become an editor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferConfirm(true)}
                className="shrink-0 flex items-center gap-1.5 border border-danger/30 text-danger text-xs font-semibold rounded-xl px-3.5 py-2 hover:bg-danger/10 transition-colors"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Transfer
              </button>
            </div>

            {showTransferConfirm && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl p-4">
                <p className="text-sm text-danger font-semibold">Confirm transfer</p>
                <p className="text-[11px] text-danger/70 mt-1">
                  Enter the username of the new owner and confirm. This action cannot be undone
                  without the new owner&apos;s consent.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    placeholder="New owner's username"
                    className="flex-1 bg-white border border-danger/30 rounded-xl px-3.5 py-2 text-sm text-brand-text placeholder:text-brand-text/30 outline-hidden focus:ring-2 focus:ring-danger"
                  />
                  <button className="shrink-0 bg-danger text-white text-xs font-semibold rounded-xl px-4 py-2 hover:bg-danger transition-colors">
                    Confirm Transfer
                  </button>
                  <button
                    onClick={() => setShowTransferConfirm(false)}
                    className="shrink-0 border border-brand-divider text-brand-text/60 text-xs font-semibold rounded-xl px-3.5 py-2 hover:bg-brand-secondary/50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-danger/30 pt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand-text">Delete channel</p>
                  <p className="text-[11px] text-brand-text/40 mt-0.5">
                    Permanently delete this channel and all its updates. This action has a 30-day
                    recovery period.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="shrink-0 flex items-center gap-1.5 bg-danger text-white text-xs font-semibold rounded-xl px-3.5 py-2 hover:bg-danger transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Channel
                </button>
              </div>
            </div>

            {showDeleteConfirm && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl p-4">
                <p className="text-sm text-danger font-semibold">Are you absolutely sure?</p>
                <p className="text-[11px] text-danger/70 mt-1">
                  This will schedule your channel <strong>{channel.name}</strong> for deletion.
                  You have a <strong>30-day recovery period</strong> during which you can contact
                  support to restore it. After 30 days, all data is permanently erased.
                </p>
                <p className="text-[11px] text-danger/70 mt-2">
                  Type <strong className="font-mono">{channel.name}</strong> to confirm:
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={channel.name}
                    className="flex-1 bg-white border border-danger/30 rounded-xl px-3.5 py-2 text-sm text-brand-text font-mono placeholder:text-brand-text/30 outline-hidden focus:ring-2 focus:ring-danger"
                  />
                  <button
                    disabled={deleteConfirmText !== channel.name}
                    className="shrink-0 bg-danger text-white text-xs font-semibold rounded-xl px-4 py-2 hover:bg-danger transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Permanently Delete
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false)
                      setDeleteConfirmText('')
                    }}
                    className="shrink-0 border border-brand-divider text-brand-text/60 text-xs font-semibold rounded-xl px-3.5 py-2 hover:bg-brand-secondary/50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}

      </div>

      {/* Pinned, so Save is reachable from any section without scrolling to
          the bottom of the longest one. */}
      <div className="flex items-center justify-end gap-2 border-t border-brand-divider bg-brand-card px-5 py-3.5">
        {/* Nothing here said anything at all before: no "Saving…", no
            confirmation, no error. A save that worked looked exactly like a
            button that did nothing. */}
        {saveError ? (
          <p role="alert" className="mr-auto text-[12px] font-medium text-danger">{saveError}</p>
        ) : saved ? (
          <p role="status" className="mr-auto flex items-center gap-1.5 text-[12px] font-medium text-success">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Saved
          </p>
        ) : null}
        <button
          type="button"
          onClick={resetForm}
          disabled={saving}
          className="rounded-full px-4 py-2.5 text-[13px] font-semibold text-brand-text/60 transition-colors hover:text-brand-text disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || hasErrors}
          className="bg-primary-grad flex items-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

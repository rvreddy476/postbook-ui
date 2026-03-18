'use client'

import React, { useState, useCallback, useMemo } from 'react'
import {
  Camera,
  ChevronDown,
  Save,
  AlertTriangle,
  Trash2,
  ArrowRightLeft,
  Loader2,
} from 'lucide-react'
import type { BroadcastChannel } from '@/types/channels'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface SettingsTabProps {
  channel: BroadcastChannel
  onUpdate: (data: Record<string, unknown>) => void
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

const SUBSCRIBER_LIST_VISIBILITY = ['Everyone', 'Subscribers Only', 'Only Me'] as const
const DEFAULT_VISIBILITY = ['Public', 'Subscribers Only'] as const
const NOTIFY_OPTIONS = ['Always', 'Only Urgent', 'Never'] as const
const EMAIL_DIGEST_OPTIONS = ['Daily', 'Weekly', 'Off'] as const

const HANDLE_REGEX = /^[a-zA-Z0-9_]{3,30}$/

/* ------------------------------------------------------------------ */
/*  Reusable primitives                                                */
/* ------------------------------------------------------------------ */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-brand-divider rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-brand-divider">
        <h3 className="text-sm font-bold text-brand-text">{title}</h3>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold text-brand-text/40 uppercase tracking-wider mb-1.5">
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
        className={`w-full bg-brand-bg border border-brand-divider rounded-xl px-3.5 py-2 text-sm text-brand-text placeholder:text-brand-text/30 outline-none focus:ring-2 focus:ring-brand-text/20 transition ${
          mono ? 'font-mono' : ''
        } ${error ? 'border-red-400 focus:ring-red-200' : ''}`}
      />
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
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
        className="w-full bg-brand-bg border border-brand-divider rounded-xl px-3.5 py-2 text-sm text-brand-text placeholder:text-brand-text/30 outline-none focus:ring-2 focus:ring-brand-text/20 transition resize-none"
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
        className="w-full appearance-none bg-brand-bg border border-brand-divider rounded-xl px-3.5 py-2 text-sm text-brand-text outline-none focus:ring-2 focus:ring-brand-text/20 transition pr-9"
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
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-text/20 ${
        enabled ? 'bg-brand-text' : 'bg-brand-divider'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
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

function MediaUploadPlaceholder({
  label,
  current,
  aspect,
}: {
  label: string
  current?: string
  aspect: 'square' | 'banner'
}) {
  const sizeClasses = aspect === 'square' ? 'w-20 h-20 rounded-xl' : 'w-full h-24 rounded-xl'

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        className={`${sizeClasses} bg-brand-bg border-2 border-dashed border-brand-divider flex items-center justify-center hover:border-brand-text/30 transition-colors overflow-hidden group relative`}
      >
        {current ? (
          <>
            <img
              src={`/v1/media/${current}/serve`}
              alt={label}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </>
        ) : (
          <div className="text-center">
            <Camera className="w-5 h-5 text-brand-text/25 mx-auto" />
            <p className="text-[10px] text-brand-text/30 mt-1">Upload</p>
          </div>
        )}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function SettingsTab({ channel, onUpdate, role }: SettingsTabProps) {
  /* ---- Channel Profile ---- */
  const [name, setName] = useState(channel.name)
  const [handle, setHandle] = useState(channel.handle)
  const [description, setDescription] = useState(channel.description)
  const [category, setCategory] = useState(channel.category || 'Other')

  /* ---- Subscriber Settings ---- */
  const [requireApproval, setRequireApproval] = useState(false)
  const [subscriberListVisibility, setSubscriberListVisibility] = useState<string>('Everyone')
  const [welcomeMessage, setWelcomeMessage] = useState('')

  /* ---- Update Defaults ---- */
  const [defaultReactions, setDefaultReactions] = useState(channel.reaction_mode === 'enabled')
  const [defaultComments, setDefaultComments] = useState(
    channel.comment_mode === 'enabled' || channel.comment_mode === 'moderated'
  )
  const [defaultVisibility, setDefaultVisibility] = useState<string>('Public')

  /* ---- Notification Settings ---- */
  const [notifyOnUpdate, setNotifyOnUpdate] = useState<string>('Always')
  const [emailDigest, setEmailDigest] = useState<string>('Weekly')

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

    changes.require_approval = requireApproval
    changes.subscriber_list_visibility = subscriberListVisibility
    if (welcomeMessage) changes.welcome_message = welcomeMessage

    changes.default_reaction_mode = defaultReactions ? 'enabled' : 'disabled'
    changes.default_comment_mode = defaultComments ? 'enabled' : 'disabled'
    changes.default_visibility = defaultVisibility.toLowerCase().replace(/ /g, '_')

    changes.notify_subscribers = notifyOnUpdate.toLowerCase().replace(/ /g, '_')
    changes.email_digest = emailDigest.toLowerCase()

    return changes
  }, [
    name, handle, description, category,
    requireApproval, subscriberListVisibility, welcomeMessage,
    defaultReactions, defaultComments, defaultVisibility,
    notifyOnUpdate, emailDigest,
    channel,
  ])

  const handleSave = useCallback(async () => {
    if (hasErrors) return
    setSaving(true)
    try {
      onUpdate(collectChanges())
    } finally {
      setSaving(false)
    }
  }, [hasErrors, collectChanges, onUpdate])

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/*  Channel Profile                                             */}
      {/* ============================================================ */}
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
              className={`w-full bg-brand-bg border border-brand-divider rounded-xl pl-7 pr-3.5 py-2 text-sm text-brand-text font-mono placeholder:text-brand-text/30 outline-none focus:ring-2 focus:ring-brand-text/20 transition ${
                handleError ? 'border-red-400 focus:ring-red-200' : ''
              }`}
              placeholder="channel_handle"
            />
          </div>
          {handleError && <p className="text-[11px] text-red-500 mt-1">{handleError}</p>}
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

        <div className="flex items-start gap-6">
          <MediaUploadPlaceholder
            label="Avatar"
            current={channel.avatar_media_id}
            aspect="square"
          />
          <div className="flex-1">
            <MediaUploadPlaceholder
              label="Banner"
              current={channel.banner_media_id}
              aspect="banner"
            />
          </div>
        </div>
      </SectionCard>

      {/* ============================================================ */}
      {/*  Subscriber Settings                                         */}
      {/* ============================================================ */}
      <SectionCard title="Subscriber Settings">
        <ToggleRow
          label="Require approval to subscribe"
          description="New subscribers must be approved before they can see updates"
          enabled={requireApproval}
          onToggle={() => setRequireApproval((p) => !p)}
        />

        <div className="border-t border-brand-divider pt-4">
          <FieldLabel>Who can see subscriber list</FieldLabel>
          <Select
            value={subscriberListVisibility}
            onChange={setSubscriberListVisibility}
            options={SUBSCRIBER_LIST_VISIBILITY}
          />
        </div>

        <div className="border-t border-brand-divider pt-4">
          <FieldLabel>Welcome message to new subscribers</FieldLabel>
          <TextArea
            value={welcomeMessage}
            onChange={setWelcomeMessage}
            maxLength={500}
            placeholder="Thanks for subscribing! Here's what to expect..."
            rows={3}
          />
        </div>
      </SectionCard>

      {/* ============================================================ */}
      {/*  Update Defaults                                              */}
      {/* ============================================================ */}
      <SectionCard title="Update Defaults">
        <ToggleRow
          label="Default reactions"
          description="Allow reactions on new updates by default"
          enabled={defaultReactions}
          onToggle={() => setDefaultReactions((p) => !p)}
        />

        <div className="border-t border-brand-divider pt-4">
          <ToggleRow
            label="Default comments"
            description="Allow comments on new updates by default"
            enabled={defaultComments}
            onToggle={() => setDefaultComments((p) => !p)}
          />
        </div>

        <div className="border-t border-brand-divider pt-4">
          <FieldLabel>Default visibility</FieldLabel>
          <Select
            value={defaultVisibility}
            onChange={setDefaultVisibility}
            options={DEFAULT_VISIBILITY}
          />
        </div>
      </SectionCard>

      {/* ============================================================ */}
      {/*  Notification Settings                                        */}
      {/* ============================================================ */}
      <SectionCard title="Notification Settings">
        <div>
          <FieldLabel>Notify subscribers on new update</FieldLabel>
          <Select value={notifyOnUpdate} onChange={setNotifyOnUpdate} options={NOTIFY_OPTIONS} />
        </div>

        <div className="border-t border-brand-divider pt-4">
          <FieldLabel>Email digest</FieldLabel>
          <Select value={emailDigest} onChange={setEmailDigest} options={EMAIL_DIGEST_OPTIONS} />
        </div>
      </SectionCard>

      {/* ============================================================ */}
      {/*  Danger Zone (owner only)                                     */}
      {/* ============================================================ */}
      {role === 'owner' && (
        <div className="bg-white border border-red-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-red-200 bg-red-50/50">
            <h3 className="text-sm font-bold text-red-700 flex items-center gap-1.5">
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
                className="shrink-0 flex items-center gap-1.5 border border-red-300 text-red-600 text-xs font-semibold rounded-xl px-3.5 py-2 hover:bg-red-50 transition-colors"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Transfer
              </button>
            </div>

            {showTransferConfirm && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 font-semibold">Confirm transfer</p>
                <p className="text-[11px] text-red-600/70 mt-1">
                  Enter the username of the new owner and confirm. This action cannot be undone
                  without the new owner&apos;s consent.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    placeholder="New owner's username"
                    className="flex-1 bg-white border border-red-200 rounded-xl px-3.5 py-2 text-sm text-brand-text placeholder:text-brand-text/30 outline-none focus:ring-2 focus:ring-red-200"
                  />
                  <button className="shrink-0 bg-red-600 text-white text-xs font-semibold rounded-xl px-4 py-2 hover:bg-red-700 transition-colors">
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

            <div className="border-t border-red-200 pt-4">
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
                  className="shrink-0 flex items-center gap-1.5 bg-red-600 text-white text-xs font-semibold rounded-xl px-3.5 py-2 hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Channel
                </button>
              </div>
            </div>

            {showDeleteConfirm && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 font-semibold">Are you absolutely sure?</p>
                <p className="text-[11px] text-red-600/70 mt-1">
                  This will schedule your channel <strong>{channel.name}</strong> for deletion.
                  You have a <strong>30-day recovery period</strong> during which you can contact
                  support to restore it. After 30 days, all data is permanently erased.
                </p>
                <p className="text-[11px] text-red-600/70 mt-2">
                  Type <strong className="font-mono">{channel.name}</strong> to confirm:
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={channel.name}
                    className="flex-1 bg-white border border-red-200 rounded-xl px-3.5 py-2 text-sm text-brand-text font-mono placeholder:text-brand-text/30 outline-none focus:ring-2 focus:ring-red-200"
                  />
                  <button
                    disabled={deleteConfirmText !== channel.name}
                    className="shrink-0 bg-red-600 text-white text-xs font-semibold rounded-xl px-4 py-2 hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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

      {/* ============================================================ */}
      {/*  Save Button                                                  */}
      {/* ============================================================ */}
      <div className="sticky bottom-4 z-10">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || hasErrors}
          className="w-full flex items-center justify-center gap-2 bg-brand-text text-brand-bg text-sm font-bold rounded-2xl py-3 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

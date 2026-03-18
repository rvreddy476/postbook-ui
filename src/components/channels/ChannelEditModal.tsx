'use client'

import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Loader2, Pencil, X } from 'lucide-react'

import { useUpdateBroadcastChannel } from '@/hooks/useBroadcastChannels'
import { uploadMedia } from '@/lib/mediaUpload'
import type { BroadcastChannel } from '@/types/channels'

interface ChannelEditModalProps {
  channel: BroadcastChannel
  onClose: () => void
}

const channelTypes = [
  { value: 'public', label: 'Public' },
  { value: 'creator', label: 'Creator' },
  { value: 'brand', label: 'Brand' },
  { value: 'education', label: 'Education' },
  { value: 'official', label: 'Official' },
] as const

const channelCategories = [
  'Creator', 'Brand', 'News', 'Education', 'Technology',
  'Entertainment', 'Sports', 'Official', 'Health', 'Finance', 'Other',
]

const commentOptions = [
  { value: 'disabled', label: 'No comments', desc: 'Broadcast only' },
  { value: 'enabled', label: 'Reactions only', desc: 'Subscribers can react, not comment' },
  { value: 'moderated', label: 'Comments enabled', desc: 'Full discussion' },
]

function loadPreview(file: File, onLoad: (value: string) => void) {
  const reader = new FileReader()
  reader.onload = (event) => onLoad(event.target?.result as string)
  reader.readAsDataURL(file)
}

export default function ChannelEditModal({ channel, onClose }: ChannelEditModalProps) {
  const updateChannel = useUpdateBroadcastChannel()

  const [name, setName] = useState(channel.name)
  const [description, setDescription] = useState(channel.description || '')
  const [channelType, setChannelType] = useState<BroadcastChannel['channel_type']>(channel.channel_type || 'public')
  const [category, setCategory] = useState(channel.category || '')
  const [commentMode, setCommentMode] = useState(channel.comment_mode)
  const [forwardAllowed, setForwardAllowed] = useState(channel.forward_allowed)
  const [paidAccess, setPaidAccess] = useState(channel.paid_access)
  const [price, setPrice] = useState(
    channel.subscription_price_cents ? (channel.subscription_price_cents / 100).toFixed(2) : ''
  )
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    channel.avatar_media_id ? `/v1/media/${channel.avatar_media_id}/serve` : null
  )
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    channel.banner_media_id ? `/v1/media/${channel.banner_media_id}/serve` : null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    loadPreview(file, setAvatarPreview)
  }

  const handleBannerSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setBannerFile(file)
    loadPreview(file, setBannerPreview)
  }

  const handleSave = async () => {
    if (!name.trim()) return

    setSaving(true)
    setError(null)

    try {
      let avatarMediaId: string | undefined
      let bannerMediaId: string | undefined

      if (avatarFile) {
        avatarMediaId = await uploadMedia(avatarFile, 'image', 'avatar')
      }
      if (bannerFile) {
        bannerMediaId = await uploadMedia(bannerFile, 'image', 'cover')
      }

      await updateChannel.mutateAsync({
        channelId: channel.id,
        name: name.trim(),
        description: description.trim(),
        channel_type: channelType,
        category: category.trim() || undefined,
        comment_mode: commentMode,
        forward_allowed: forwardAllowed,
        paid_access: paidAccess,
        subscription_price_cents: paidAccess && price ? Math.round(parseFloat(price) * 100) : 0,
        ...(avatarMediaId ? { avatar_media_id: avatarMediaId } : {}),
        ...(bannerMediaId ? { banner_media_id: bannerMediaId } : {}),
      })

      onClose()
    } catch (err) {
      console.error('Failed to update channel:', err)
      setError('Failed to update channel. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const fallbackInitial = (name.trim().charAt(0) || 'C').toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-brand-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-brand-divider px-6 py-4">
          <h2 className="text-lg font-black text-brand-text">Edit Channel</h2>
          <button onClick={onClose} className="p-1 text-brand-text/60 transition-colors hover:text-brand-highlight">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Banner</label>
            <div
              className="group relative h-36 cursor-pointer overflow-hidden rounded-2xl border border-brand-divider bg-brand-secondary"
              onClick={() => bannerInputRef.current?.click()}
            >
              {bannerPreview ? (
                <img src={bannerPreview} alt="Channel banner" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-text/10 via-brand-text/5 to-brand-text/15 text-5xl font-black text-brand-text/15">
                  {fallbackInitial}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-brand-text shadow-sm">
                  Change banner
                </span>
              </div>
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerSelect}
            />
          </div>

          <div className="flex items-center gap-4">
            <div
              className="group relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-brand-divider bg-brand-secondary"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Channel avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-brand-text/10 text-3xl font-black text-brand-text/60">
                  {fallbackInitial}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-brand-text">Channel icon</p>
              <p className="text-xs leading-relaxed text-brand-text/60">Upload a square image for the channel avatar.</p>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="text-xs font-bold text-brand-text transition-colors hover:text-brand-text/90"
              >
                Change photo
              </button>
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelect}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Channel Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-sm focus:border-brand-text/50 focus:outline-none focus:ring-2 focus:ring-brand-text/30"
              placeholder="Enter channel name"
              maxLength={100}
            />
            <p className="mt-2 text-xs font-mono text-brand-text/50">@{channel.handle}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-sm focus:border-brand-text/50 focus:outline-none focus:ring-2 focus:ring-brand-text/30"
              placeholder="What is this channel about?"
              maxLength={500}
            />
          </div>

          <div>
            <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Channel Type</label>
            <div className="grid grid-cols-2 gap-3">
              {channelTypes.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setChannelType(option.value)}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                    channelType === option.value
                      ? 'border-brand-text/50 bg-brand-text/5 text-brand-text'
                      : 'border-brand-divider bg-brand-secondary text-brand-text/60 hover:border-brand-text/30'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Category</label>
            <div className="flex flex-wrap gap-2">
              {channelCategories.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCategory(option)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    category === option
                      ? 'bg-brand-text text-brand-bg'
                      : 'border border-brand-divider text-brand-text hover:bg-brand-secondary/50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Comment Settings</label>
            <div className="space-y-2">
              {commentOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCommentMode(option.value as BroadcastChannel['comment_mode'])}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                    commentMode === option.value
                      ? 'border-brand-text/50 bg-brand-text/5 text-brand-text'
                      : 'border-brand-divider bg-brand-secondary text-brand-text/70 hover:border-brand-text/30'
                  }`}
                >
                  <p className="text-sm font-bold">{option.label}</p>
                  <p className="mt-1 text-xs text-brand-text/60">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-brand-divider bg-brand-secondary p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-brand-text">Allow Forwarding</p>
                  <p className="mt-1 text-xs text-brand-text/60">Let subscribers echo channel updates.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForwardAllowed(!forwardAllowed)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    forwardAllowed ? 'bg-brand-text' : 'bg-brand-divider'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      forwardAllowed ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-divider bg-brand-secondary p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-brand-text">Paid Channel</p>
                  <p className="mt-1 text-xs text-brand-text/60">Charge a monthly subscription to access posts.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaidAccess(!paidAccess)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    paidAccess ? 'bg-brand-text' : 'bg-brand-divider'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      paidAccess ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {paidAccess && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Monthly Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-brand-text/40">$</span>
                    <input
                      type="number"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      min="0"
                      step="0.01"
                      className="w-full rounded-xl border border-brand-divider bg-white px-4 py-3 pl-8 text-sm focus:border-brand-text/50 focus:outline-none focus:ring-2 focus:ring-brand-text/30"
                      placeholder="4.99"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-sm font-bold text-rose-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-brand-secondary py-3 text-sm font-bold text-brand-highlight transition-all hover:bg-brand-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-text py-3 font-bold text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

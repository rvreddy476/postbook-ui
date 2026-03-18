'use client'

import React, { useRef, useState } from 'react'
import AppShell from '@/components/AppShell'
import { useRouter } from 'next/navigation'
import { useCreateBroadcastChannel, useCheckHandleAvailability } from '@/hooks/useBroadcastChannels'
import { uploadMedia } from '@/lib/mediaUpload'
import { ArrowLeft, ArrowRight, Check, Image as ImageIcon, Loader2, Radio, Upload, X } from 'lucide-react'
import Link from 'next/link'

const channelCategories = [
  'Creator', 'Brand', 'News', 'Education', 'Technology',
  'Entertainment', 'Sports', 'Official', 'Health', 'Finance', 'Other',
]

const commentOptions = [
  { value: 'disabled', label: 'No comments', desc: 'Broadcast only' },
  { value: 'enabled', label: 'Reactions only', desc: 'Subscribers can react, not comment' },
  { value: 'moderated', label: 'Comments enabled', desc: 'Full discussion' },
]

function mapCategoryToChannelType(category: string) {
  switch (category.toLowerCase()) {
    case 'creator':
      return 'creator'
    case 'brand':
      return 'brand'
    case 'education':
      return 'education'
    case 'official':
      return 'official'
    default:
      return 'public'
  }
}

function loadPreview(file: File, onLoad: (value: string) => void) {
  const reader = new FileReader()
  reader.onload = (event) => onLoad(event.target?.result as string)
  reader.readAsDataURL(file)
}

export default function CreateChannelPage() {
  const router = useRouter()
  const createChannel = useCreateBroadcastChannel()

  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [commentMode, setCommentMode] = useState('disabled')
  const [forwardAllowed, setForwardAllowed] = useState(true)
  const [paidAccess, setPaidAccess] = useState(false)
  const [price, setPrice] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const coverInputRef = useRef<HTMLInputElement>(null)
  const iconInputRef = useRef<HTMLInputElement>(null)

  const { data: handleAvailable, isLoading: checkingHandle } = useCheckHandleAvailability(handle)

  const canProceed = name.trim().length >= 2 && handle.trim().length >= 3 && category !== ''
  const canSubmit = canProceed && !submitting

  const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    loadPreview(file, setCoverPreview)
  }

  const handleIconSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIconFile(file)
    loadPreview(file, setIconPreview)
  }

  const handleSubmit = async () => {
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)

    try {
      let avatarMediaId: string | undefined
      let bannerMediaId: string | undefined

      if (iconFile) {
        avatarMediaId = await uploadMedia(iconFile, 'image', 'avatar')
      }
      if (coverFile) {
        bannerMediaId = await uploadMedia(coverFile, 'image', 'cover')
      }

      const result = await createChannel.mutateAsync({
        name: name.trim(),
        handle: handle.trim(),
        description: description.trim(),
        channel_type: mapCategoryToChannelType(category),
        comment_mode: commentMode,
        forward_allowed: forwardAllowed,
        paid_access: paidAccess,
        subscription_price_cents: paidAccess && price ? Math.round(parseFloat(price) * 100) : undefined,
        category,
        avatar_media_id: avatarMediaId,
        banner_media_id: bannerMediaId,
      })

      router.push(`/channels/${result.id}`)
    } catch (err) {
      console.error('Failed to create channel:', err)
      setError('Failed to create channel. Check the handle and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-16">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/channels"
            className="w-9 h-9 rounded-xl border border-brand-divider flex items-center justify-center text-brand-text/60 hover:bg-brand-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-display font-black text-xl text-brand-text tracking-tight">Create Channel</h1>
            <p className="text-xs text-brand-text/60 mt-0.5">Step {step} of 2</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-8">
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-brand-text' : 'bg-brand-divider'}`} />
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-brand-text' : 'bg-brand-divider'}`} />
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-brand-text/60 uppercase tracking-wider mb-1.5">
                Channel Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="My Awesome Channel"
                className="w-full px-4 py-3 bg-white border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10 transition-all"
              />
              <p className="text-[11px] text-brand-text/30 mt-1 text-right">{name.length}/100</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-text/60 uppercase tracking-wider mb-1.5">
                Handle
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-brand-text/40">@</span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="mychannel"
                  className="w-full pl-8 pr-10 py-3 bg-white border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10 transition-all"
                />
                {handle.length >= 3 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingHandle ? (
                      <Loader2 className="w-4 h-4 animate-spin text-brand-text/40" />
                    ) : handleAvailable === true ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : handleAvailable === false ? (
                      <X className="w-4 h-4 text-brand-text/40" />
                    ) : null}
                  </span>
                )}
              </div>
              {handle.length >= 3 && !checkingHandle && (
                <p className={`text-[11px] mt-1 ${
                  handleAvailable === true
                    ? 'text-green-600'
                    : handleAvailable === false
                      ? 'text-brand-text/40'
                      : 'text-brand-text/50'
                }`}>
                  {handleAvailable === true
                    ? `@${handle} is available`
                    : handleAvailable === false
                      ? `@${handle} is taken`
                      : 'Handle availability will be confirmed when you create the channel'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-text/60 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {channelCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      category === cat
                        ? 'bg-brand-text text-brand-bg'
                        : 'border border-brand-divider text-brand-text hover:bg-brand-secondary/50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-text/60 uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                placeholder="What is this channel about?"
                rows={3}
                className="w-full px-4 py-3 bg-white border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10 transition-all resize-none"
              />
              <p className="text-[11px] text-brand-text/30 mt-1 text-right">{description.length}/300</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-brand-text/60 uppercase tracking-wider mb-1.5">
                  Cover Image
                </label>
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="h-24 w-full bg-white border border-dashed border-brand-divider rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-brand-secondary/30 transition-colors overflow-hidden"
                >
                  {coverPreview ? (
                    <img src={coverPreview} alt="Channel cover preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-brand-text/30 mb-1" />
                      <span className="text-[11px] text-brand-text/30">Upload cover</span>
                    </>
                  )}
                </button>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverSelect}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-text/60 uppercase tracking-wider mb-1.5">
                  Channel Icon
                </label>
                <button
                  type="button"
                  onClick={() => iconInputRef.current?.click()}
                  className="h-24 w-full bg-white border border-dashed border-brand-divider rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-brand-secondary/30 transition-colors overflow-hidden"
                >
                  {iconPreview ? (
                    <img src={iconPreview} alt="Channel icon preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImageIcon className="w-5 h-5 text-brand-text/30 mb-1" />
                      <span className="text-[11px] text-brand-text/30">Upload icon</span>
                    </>
                  )}
                </button>
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleIconSelect}
                />
              </div>
            </div>

            <button
              type="button"
              disabled={!canProceed}
              onClick={() => setStep(2)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-text text-brand-bg text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-brand-text/60 uppercase tracking-wider mb-2">
                Comment Settings
              </label>
              <div className="space-y-2">
                {commentOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCommentMode(opt.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      commentMode === opt.value
                        ? 'border-brand-text bg-brand-text/5'
                        : 'border-brand-divider bg-white hover:bg-brand-secondary/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        commentMode === opt.value ? 'border-brand-text' : 'border-brand-divider'
                      }`}>
                        {commentMode === opt.value && (
                          <div className="w-2 h-2 rounded-full bg-brand-text" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-brand-text">{opt.label}</p>
                        <p className="text-xs text-brand-text/50">{opt.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between bg-white border border-brand-divider rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-brand-text">Allow Echo / Forward</p>
                <p className="text-xs text-brand-text/50 mt-0.5">Subscribers can echo updates to their feed</p>
              </div>
              <button
                type="button"
                onClick={() => setForwardAllowed(!forwardAllowed)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  forwardAllowed ? 'bg-brand-text' : 'bg-brand-divider'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    forwardAllowed ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="bg-white border border-brand-divider rounded-xl px-4 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-text">Paid Channel</p>
                  <p className="text-xs text-brand-text/50 mt-0.5">Require a subscription to view updates</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaidAccess(!paidAccess)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    paidAccess ? 'bg-brand-text' : 'bg-brand-divider'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      paidAccess ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {paidAccess && (
                <div>
                  <label className="block text-xs font-bold text-brand-text/60 uppercase tracking-wider mb-1.5">
                    Monthly Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-brand-text/40">$</span>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="4.99"
                      className="w-full pl-8 pr-4 py-2.5 bg-brand-bg border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-brand-secondary/30 border border-brand-divider rounded-xl px-4 py-3">
              <p className="text-xs text-brand-text/60">
                Apply for a verified badge after reaching 1,000 subscribers.
              </p>
            </div>

            {error && (
              <p className="text-sm text-brand-text/60 font-medium bg-brand-secondary/50 rounded-xl px-4 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-brand-divider text-brand-text text-sm font-bold rounded-xl hover:bg-brand-secondary/50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand-text text-brand-bg text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                <Radio className="w-4 h-4" />
                {submitting ? 'Creating...' : 'Create Channel'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

'use client'

import React, { useState } from 'react'
import AppShell from '@/components/AppShell'
import { useRouter } from 'next/navigation'
import { useCreateBroadcastChannel, useCheckHandleAvailability } from '@/hooks/useBroadcastChannels'
import { ArrowLeft, ArrowRight, Radio, Check, X, Upload } from 'lucide-react'
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

export default function CreateChannelPage() {
  const router = useRouter()
  const createChannel = useCreateBroadcastChannel()

  const [step, setStep] = useState(1)

  // Step 1
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')

  // Step 2
  const [commentMode, setCommentMode] = useState('disabled')
  const [forwardAllowed, setForwardAllowed] = useState(true)
  const [paidAccess, setPaidAccess] = useState(false)
  const [price, setPrice] = useState('')

  // Handle availability
  const { data: handleAvailable, isLoading: checkingHandle } = useCheckHandleAvailability(handle)

  const canProceed = name.trim().length >= 2 && handle.trim().length >= 3 && category !== ''
  const canSubmit = canProceed && !createChannel.isPending

  const handleSubmit = async () => {
    if (!canSubmit) return
    const result = await createChannel.mutateAsync({
      name: name.trim(),
      handle: handle.trim(),
      description: description.trim(),
      channel_type: category.toLowerCase() === 'creator' ? 'creator'
        : category.toLowerCase() === 'brand' ? 'brand'
        : category.toLowerCase() === 'education' ? 'education'
        : category.toLowerCase() === 'official' ? 'official'
        : 'public',
      comment_mode: commentMode,
      paid_access: paidAccess,
      subscription_price_cents: paidAccess && price ? Math.round(parseFloat(price) * 100) : undefined,
      category: category,
    })
    router.push(`/channels/${result.id}`)
  }

  return (
    <AppShell>
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-16">
      {/* Header */}
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

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-brand-text' : 'bg-brand-divider'}`} />
        <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-brand-text' : 'bg-brand-divider'}`} />
      </div>

      {/* ====== STEP 1: Identity ====== */}
      {step === 1 && (
        <div className="space-y-5">
          {/* Name */}
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

          {/* Handle */}
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
                    <div className="w-4 h-4 border-2 border-brand-text/20 border-t-brand-text rounded-full animate-spin" />
                  ) : handleAvailable ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-brand-text/40" />
                  )}
                </span>
              )}
            </div>
            {handle.length >= 3 && !checkingHandle && (
              <p className={`text-[11px] mt-1 ${handleAvailable ? 'text-green-600' : 'text-brand-text/40'}`}>
                {handleAvailable ? `@${handle} is available` : `@${handle} is taken`}
              </p>
            )}
          </div>

          {/* Category */}
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

          {/* Description */}
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

          {/* Cover + Icon upload */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-brand-text/60 uppercase tracking-wider mb-1.5">
                Cover Image
              </label>
              <div className="h-24 bg-white border border-dashed border-brand-divider rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-brand-secondary/30 transition-colors">
                <Upload className="w-5 h-5 text-brand-text/30 mb-1" />
                <span className="text-[11px] text-brand-text/30">Upload cover</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-brand-text/60 uppercase tracking-wider mb-1.5">
                Channel Icon
              </label>
              <div className="h-24 bg-white border border-dashed border-brand-divider rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-brand-secondary/30 transition-colors">
                <Upload className="w-5 h-5 text-brand-text/30 mb-1" />
                <span className="text-[11px] text-brand-text/30">Upload icon</span>
              </div>
            </div>
          </div>

          {/* Next */}
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

      {/* ====== STEP 2: Settings ====== */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Comment settings */}
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

          {/* Forward/Echo */}
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

          {/* Paid channel toggle */}
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

          {/* Verification info */}
          <div className="bg-brand-secondary/30 border border-brand-divider rounded-xl px-4 py-3">
            <p className="text-xs text-brand-text/60">
              Apply for a verified badge after reaching 1,000 subscribers.{' '}
              <span className="text-brand-text underline cursor-pointer">Learn more</span>
            </p>
          </div>

          {/* Error */}
          {createChannel.isError && (
            <p className="text-sm text-brand-text/60 font-medium bg-brand-secondary/50 rounded-xl px-4 py-2">
              Failed to create channel. Please try again.
            </p>
          )}

          {/* Back + Create */}
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
              {createChannel.isPending ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </div>
      )}
    </div>
    </AppShell>
  )
}

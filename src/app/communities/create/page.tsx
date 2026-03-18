'use client'

import React, { useRef, useState } from 'react'
import AppShell from '@/components/AppShell'
import { useRouter } from 'next/navigation'
import { useCreateCommunity } from '@/hooks/useCommunities'
import { uploadMedia } from '@/lib/mediaUpload'
import { ArrowLeft, ArrowRight, Check, Image as ImageIcon, Loader2, Upload } from 'lucide-react'
import Link from 'next/link'

const CATEGORIES = [
  { emoji: '💻', label: 'Technology' },
  { emoji: '🎮', label: 'Gaming' },
  { emoji: '🎨', label: 'Art & Design' },
  { emoji: '📚', label: 'Education' },
  { emoji: '🎵', label: 'Music' },
  { emoji: '⚽', label: 'Sports' },
  { emoji: '🍕', label: 'Food' },
  { emoji: '✈️', label: 'Travel' },
  { emoji: '📸', label: 'Photography' },
  { emoji: '💼', label: 'Business' },
  { emoji: '🧘', label: 'Wellness' },
  { emoji: '🎬', label: 'Film & TV' },
]

const COMMUNITY_TYPES = [
  { value: 'public', label: 'Public', desc: 'Anyone can find and join' },
  { value: 'private', label: 'Private', desc: 'Visible but requires approval' },
  { value: 'invite', label: 'Invite Only', desc: 'Hidden, join by invite' },
] as const

const JOIN_MODES = [
  { value: 'open', label: 'Open', desc: 'Anyone can join instantly' },
  { value: 'approval', label: 'Approval Required', desc: 'Admins approve requests' },
  { value: 'invite', label: 'Invite Only', desc: 'Members must be invited' },
] as const

type Step = 1 | 2 | 3

function mapJoinMode(joinMode: string) {
  switch (joinMode) {
    case 'approval':
      return 'request'
    case 'invite':
      return 'invite_only'
    default:
      return 'open'
  }
}

function loadPreview(file: File, onLoad: (value: string) => void) {
  const reader = new FileReader()
  reader.onload = (event) => onLoad(event.target?.result as string)
  reader.readAsDataURL(file)
}

export default function CreateCommunityPage() {
  const router = useRouter()
  const createMut = useCreateCommunity()

  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [category, setCategory] = useState('')
  const [communityType, setCommunityType] = useState<string>('public')
  const [description, setDescription] = useState('')
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [joinMode, setJoinMode] = useState('open')
  const [rules, setRules] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const coverInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const canProceedStep1 = name.trim().length >= 2 && handle.trim().length >= 2 && category !== ''
  const canProceedStep2 = description.trim().length >= 10

  const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    loadPreview(file, setCoverPreview)
  }

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    loadPreview(file, setAvatarPreview)
  }

  function addRule() {
    setRules([...rules, ''])
  }

  function updateRule(index: number, value: string) {
    const updated = [...rules]
    updated[index] = value
    setRules(updated)
  }

  function removeRule(index: number) {
    if (rules.length <= 1) return
    setRules(rules.filter((_, i) => i !== index))
  }

  async function handleCreate() {
    setSubmitting(true)
    setError(null)

    try {
      let bannerMediaId: string | undefined
      let avatarMediaId: string | undefined

      if (coverFile) {
        bannerMediaId = await uploadMedia(coverFile, 'image', 'cover')
      }
      if (avatarFile) {
        avatarMediaId = await uploadMedia(avatarFile, 'image', 'avatar')
      }

      const cleanRules = rules.map((rule) => rule.trim()).filter(Boolean)
      const community = await createMut.mutateAsync({
        name: name.trim(),
        handle: handle.trim(),
        description: description.trim(),
        community_type: communityType,
        category,
        join_mode: mapJoinMode(joinMode),
        avatar_media_id: avatarMediaId,
        banner_media_id: bannerMediaId,
        rules: cleanRules,
      })

      router.push(`/communities/${community.id}`)
    } catch (err) {
      console.error('Failed to create community:', err)
      setError('Failed to create community. Check the handle and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-16">
        <Link
          href="/communities"
          className="inline-flex items-center gap-1.5 text-sm text-brand-text/60 hover:text-brand-text mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Communities
        </Link>

        <h1 className="text-2xl font-bold text-brand-text mb-2">Create Community</h1>
        <p className="text-sm text-brand-text/60 mb-6">Set up your new community in 3 easy steps</p>

        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  s === step
                    ? 'bg-brand-text text-brand-bg'
                    : s < step
                      ? 'bg-brand-text text-brand-bg'
                      : 'bg-brand-bg text-brand-text/40'
                }`}
              >
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-0.5 rounded ${s < step ? 'bg-brand-text' : 'bg-brand-divider'}`}
                />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">
                Community Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Frontend Developers"
                className="w-full px-4 py-3 bg-white border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">
                @handle
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-brand-text/40">
                  @
                </span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                  placeholder="frontend-devs"
                  className="w-full pl-8 pr-4 py-3 bg-white border border-brand-divider rounded-xl text-sm font-mono text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-text mb-2">Category</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                      category === cat.label
                        ? 'bg-brand-text text-brand-bg border-brand-text'
                        : 'bg-white border-brand-divider text-brand-text hover:bg-brand-bg'
                    }`}
                  >
                    <span className="text-xl">{cat.emoji}</span>
                    <span className="text-xs font-semibold truncate w-full text-center">
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-text mb-2">Type</label>
              <div className="space-y-2">
                {COMMUNITY_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setCommunityType(t.value)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      communityType === t.value
                        ? 'border-brand-text bg-brand-bg'
                        : 'border-brand-divider bg-white hover:bg-brand-bg'
                    }`}
                  >
                    <p className="text-sm font-semibold text-brand-text">{t.label}</p>
                    <p className="text-xs text-brand-text/50 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="flex items-center gap-2 px-6 py-3 bg-brand-text text-brand-bg text-sm font-bold rounded-xl hover:bg-brand-text/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell people what your community is about..."
                rows={4}
                className="w-full px-4 py-3 bg-white border border-brand-divider rounded-xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/20 resize-none"
              />
              <p className="text-[11px] text-brand-text/40 mt-1">
                {description.length}/500 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">
                Cover Photo
              </label>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverSelect}
              />
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="w-full h-32 rounded-xl border-2 border-dashed border-brand-divider bg-white hover:bg-brand-bg transition-colors flex items-center justify-center overflow-hidden"
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="Community cover preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-brand-text/40">
                    <Upload className="w-6 h-6" />
                    <span className="text-xs font-semibold">Upload cover photo</span>
                  </div>
                )}
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">Avatar</label>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="w-20 h-20 rounded-2xl border-2 border-dashed border-brand-divider bg-white hover:bg-brand-bg transition-colors flex items-center justify-center overflow-hidden"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Community avatar preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-brand-text/40" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-3 border border-brand-divider text-brand-text text-sm font-semibold rounded-xl hover:bg-brand-bg transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="flex items-center gap-2 px-6 py-3 bg-brand-text text-brand-bg text-sm font-bold rounded-xl hover:bg-brand-text/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-brand-text mb-2">Join Mode</label>
              <div className="space-y-2">
                {JOIN_MODES.map((jm) => (
                  <button
                    key={jm.value}
                    type="button"
                    onClick={() => setJoinMode(jm.value)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      joinMode === jm.value
                        ? 'border-brand-text bg-brand-bg'
                        : 'border-brand-divider bg-white hover:bg-brand-bg'
                    }`}
                  >
                    <p className="text-sm font-semibold text-brand-text">{jm.label}</p>
                    <p className="text-xs text-brand-text/50 mt-0.5">{jm.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-text mb-2">
                Community Rules
              </label>
              <div className="space-y-2">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-brand-text/40 w-5 text-right">
                      {i + 1}.
                    </span>
                    <input
                      type="text"
                      value={rule}
                      onChange={(e) => updateRule(i, e.target.value)}
                      placeholder={`Rule ${i + 1}`}
                      className="flex-1 px-3 py-2 bg-white border border-brand-divider rounded-lg text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/20"
                    />
                    {rules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRule(i)}
                        className="text-brand-text/30 hover:text-brand-text text-sm px-2"
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addRule}
                className="mt-2 text-xs font-semibold text-brand-text/60 hover:text-brand-text transition-colors"
              >
                + Add rule
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 pt-4">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-3 border border-brand-divider text-brand-text text-sm font-semibold rounded-xl hover:bg-brand-bg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 bg-brand-text text-brand-bg text-sm font-bold rounded-xl hover:bg-brand-text/90 transition-colors disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Community
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

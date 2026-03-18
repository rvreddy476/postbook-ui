'use client'

import React, { useState, useRef, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import { useRouter } from 'next/navigation'
import { useCreateGroup, useCheckHandle, useUpdateGroup, useUpdateGroupRules } from '@/hooks/useGroups'
import {
  Check, ChevronLeft, ChevronRight, Upload, Pencil,
  MapPin, X, Loader2, Globe, Lock, Shield,
} from 'lucide-react'
import { uploadMedia } from '@/lib/mediaUpload'

type Step = 1 | 2 | 3

const CATEGORIES = [
  { label: 'Technology', emoji: '💻' },
  { label: 'Education', emoji: '📚' },
  { label: 'Local', emoji: '📍' },
  { label: 'Buy & Sell', emoji: '🛒' },
  { label: 'Sports', emoji: '⚽' },
  { label: 'Arts', emoji: '🎨' },
  { label: 'Food', emoji: '🍕' },
  { label: 'Gaming', emoji: '🎮' },
  { label: 'Health', emoji: '❤️' },
  { label: 'Family', emoji: '👨‍👩‍👧' },
  { label: 'Professional', emoji: '💼' },
  { label: 'Other', emoji: '✨' },
]

const COVER_SWATCHES = [
  '#f0ede6',
  '#e8f0e4',
  '#e4ecf0',
  '#f0ece0',
  '#ece0f0',
  '#f0e0e4',
]

export default function CreateGroupPage() {
  const router = useRouter()
  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const updateRules = useUpdateGroupRules()

  const [step, setStep] = useState<Step>(1)

  // Step 1
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [handleTouched, setHandleTouched] = useState(false)
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'restricted' | 'private'>('public')
  const [category, setCategory] = useState('')

  // Step 2
  const [coverColor, setCoverColor] = useState(COVER_SWATCHES[0])
  const [coverCustomColor, setCoverCustomColor] = useState('')
  const [coverEmoji, setCoverEmoji] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const [iconImageUrl, setIconImageUrl] = useState<string | null>(null)
  const [iconImageFile, setIconImageFile] = useState<File | null>(null)
  const [iconEmoji, setIconEmoji] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [location, setLocation] = useState('')

  // Step 3
  const [whoCanPost, setWhoCanPost] = useState<'all_members' | 'admins_mods' | 'approval'>('all_members')
  const [whoCanInvite, setWhoCanInvite] = useState<'all_members' | 'admins_only'>('all_members')
  const [joinQuestions, setJoinQuestions] = useState<string[]>([])
  const [rules, setRules] = useState<{ title: string; description: string }[]>([])

  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null)

  const coverFileRef = useRef<HTMLInputElement>(null)
  const iconFileRef = useRef<HTMLInputElement>(null)
  const colorPickerRef = useRef<HTMLInputElement>(null)

  const { data: handleCheck } = useCheckHandle(handle)

  // Auto-generate handle from name
  const handleNameChange = (val: string) => {
    setName(val)
    if (!handleTouched) {
      const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (slug.length >= 3) setHandle(slug.slice(0, 50))
      else setHandle('')
    }
  }

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 1: return name.trim().length >= 3 && handle.length >= 3 && !!category
      case 2: return true
      case 3: return true
      default: return false
    }
  }, [step, name, handle, category])

  const handleSubmit = async () => {
    try {
      // Upload cover and icon images if selected
      let coverMediaId: string | undefined
      let avatarMediaId: string | undefined
      if (coverImageFile) {
        coverMediaId = await uploadMedia(coverImageFile, 'image', 'cover')
      }
      if (iconImageFile) {
        avatarMediaId = await uploadMedia(iconImageFile, 'image', 'avatar')
      }

      const joinMode = privacyLevel === 'private' ? 'invite_only' : privacyLevel === 'restricted' ? 'request' : 'open'
      const group = await createGroup.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        handle,
        category,
        privacy_level: privacyLevel,
        join_mode: joinMode,
        who_can_post: whoCanPost,
        who_can_invite: whoCanInvite,
        location: location || undefined,
        idempotency_key: `create-${Date.now()}`,
      })
      if (coverMediaId || avatarMediaId) {
        await updateGroup.mutateAsync({
          groupId: group.id,
          ...(coverMediaId ? { cover_media_id: coverMediaId } : {}),
          ...(avatarMediaId ? { avatar_media_id: avatarMediaId } : {}),
        })
      }
      // Save rules if any were defined
      const validRules = rules.filter(r => r.title.trim())
      if (validRules.length > 0) {
        await updateRules.mutateAsync({ groupId: group.id, rules: validRules })
      }
      setCreatedGroupId(group.id)
    } catch {
      // Error handled by React Query
    }
  }

  // Cover image upload handler
  const handleCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setCoverImageUrl(url)
      setCoverImageFile(file)
    }
  }

  // Icon image upload handler
  const handleIconFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setIconImageUrl(url)
      setIconImageFile(file)
    }
  }

  // Tags
  const addTag = (val: string) => {
    const t = val.trim().replace(/^#/, '')
    if (t && tags.length < 5 && !tags.includes(t)) {
      setTags([...tags, t])
    }
    setTagInput('')
  }

  const removeTag = (idx: number) => {
    setTags(tags.filter((_, i) => i !== idx))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  // Rules & questions
  const addRule = () => { if (rules.length < 10) setRules([...rules, { title: '', description: '' }]) }
  const updateRule = (i: number, field: 'title' | 'description', val: string) => {
    const u = [...rules]; u[i] = { ...u[i], [field]: val }; setRules(u)
  }
  const removeRule = (i: number) => setRules(rules.filter((_, idx) => idx !== i))

  const addQuestion = () => { if (joinQuestions.length < 3) setJoinQuestions([...joinQuestions, '']) }
  const updateQuestion = (i: number, val: string) => {
    const u = [...joinQuestions]; u[i] = val; setJoinQuestions(u)
  }
  const removeQuestion = (i: number) => setJoinQuestions(joinQuestions.filter((_, idx) => idx !== i))

  // Resolve effective cover background
  const effectiveCoverColor = coverCustomColor || coverColor

  // Post-create success screen
  if (createdGroupId) {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto px-4 pt-16 pb-12 text-center">
          <div className="w-16 h-16 rounded-full bg-brand-text flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-brand-bg" />
          </div>
          <h1 className="text-2xl font-[800] text-brand-text mb-2" style={{ fontFamily: 'var(--font-outfit, Outfit, sans-serif)' }}>Group Created!</h1>
          <p className="text-sm text-brand-text/60 mb-8">Your group is ready. Start inviting members and sharing content.</p>
          <button
            onClick={() => router.push(`/groups/${createdGroupId}`)}
            className="px-8 py-3 bg-brand-text text-brand-bg font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            Go to Group
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-8 pb-12">

        {/* ===== STEP INDICATOR ===== */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2, 3].map((s) => {
            const completed = s < step
            const active = s === step
            return (
              <React.Fragment key={s}>
                {s > 1 && (
                  <div className={`w-10 h-0.5 rounded-full ${s <= step ? 'bg-brand-text' : 'bg-brand-text/10'}`} />
                )}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    completed
                      ? 'bg-brand-text/10 text-brand-text'
                      : active
                      ? 'bg-white border-2 border-brand-text ring-4 ring-brand-text/15 text-brand-text'
                      : 'bg-white border border-brand-divider text-brand-text/30'
                  }`}
                >
                  {completed ? <Check className="w-4 h-4" /> : s}
                </div>
              </React.Fragment>
            )
          })}
        </div>

        {/* ===== STEP 1: Basics ===== */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-[800] text-brand-text mb-1" style={{ fontFamily: 'var(--font-outfit, Outfit, sans-serif)' }}>Name & Type</h1>
              <p className="text-sm text-brand-text/60">Choose a name, type, and category for your group</p>
            </div>

            {/* Group Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-2">Group Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Enter group name..."
                  className="w-full px-4 py-3 bg-white border border-brand-divider rounded-2xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10"
                  maxLength={100}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-brand-text/30">{name.length}/100</span>
              </div>
            </div>

            {/* Handle */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-2">Handle</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-brand-text/40">@</span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => { setHandleTouched(true); setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }}
                  placeholder="group-handle"
                  className="w-full pl-8 pr-10 py-3 bg-white border border-brand-divider rounded-2xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10"
                  maxLength={50}
                />
                {handle.length >= 3 && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2">
                    {handleCheck?.available ? (
                      <Check className="w-4 h-4 text-brand-text/60" />
                    ) : (
                      <span className="text-xs text-brand-text/60 font-bold">Taken</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Privacy Type */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-3">Type</label>
              <div className="space-y-2.5">
                {([
                  { value: 'public' as const, icon: Globe, label: 'Public', desc: 'Anyone can find and see group content' },
                  { value: 'restricted' as const, icon: Shield, label: 'Private', desc: 'Anyone can find, but content is members-only' },
                  { value: 'private' as const, icon: Lock, label: 'Hidden', desc: 'Hidden from search, invite-only' },
                ] as const).map(({ value, icon: Icon, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPrivacyLevel(value)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                      privacyLevel === value
                        ? 'border-brand-text bg-brand-text/5'
                        : 'border-brand-divider bg-white hover:border-brand-text/30'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${privacyLevel === value ? 'text-brand-text' : 'text-brand-text/40'}`} />
                    <div>
                      <p className="text-sm font-bold text-brand-text">{label}</p>
                      <p className="text-xs text-brand-text/50">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Category Grid */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-3">Category</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setCategory(category === cat.label ? '' : cat.label)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all ${
                      category === cat.label
                        ? 'border-brand-text bg-brand-text/5'
                        : 'border-brand-divider bg-white hover:border-brand-text/30'
                    }`}
                  >
                    <span className="text-lg">{cat.emoji}</span>
                    <span className="text-[10px] font-bold text-brand-text/70">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP 2: Appearance & Details ===== */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-[800] text-brand-text mb-1" style={{ fontFamily: 'var(--font-outfit, Outfit, sans-serif)' }}>Appearance & Details</h1>
              <p className="text-sm text-brand-text/60">Customize your group look and add details</p>
            </div>

            {/* === Cover Image Section === */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-3">Cover</label>

              {/* Cover preview */}
              <div
                className="relative h-36 rounded-2xl flex items-center justify-center overflow-hidden group cursor-pointer"
                style={{ backgroundColor: coverImageUrl ? undefined : effectiveCoverColor }}
                onClick={() => coverFileRef.current?.click()}
              >
                {coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : coverEmoji ? (
                  <span className="text-5xl select-none">{coverEmoji}</span>
                ) : (
                  <Upload className="w-6 h-6 text-brand-text/20" />
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-brand-text/0 group-hover:bg-brand-text/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-brand-text bg-white/80 px-3 py-1.5 rounded-lg">
                    Change cover
                  </span>
                </div>
              </div>
              <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />

              {/* Color swatches */}
              <div className="flex items-center gap-2 mt-3">
                {COVER_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => { setCoverColor(hex); setCoverCustomColor(''); setCoverImageUrl(null) }}
                    className={`w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center ${
                      !coverCustomColor && coverColor === hex && !coverImageUrl
                        ? 'border-brand-text shadow-[0_0_0_2px_rgba(0,0,0,0.08)]'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: hex }}
                  >
                    {!coverCustomColor && coverColor === hex && !coverImageUrl && (
                      <Check className="w-3.5 h-3.5 text-brand-text/60" />
                    )}
                  </button>
                ))}
                {/* Custom color picker */}
                <button
                  type="button"
                  onClick={() => colorPickerRef.current?.click()}
                  className={`w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center ${
                    coverCustomColor
                      ? 'border-brand-text shadow-[0_0_0_2px_rgba(0,0,0,0.08)]'
                      : 'border-brand-divider'
                  }`}
                  style={{ backgroundColor: coverCustomColor || '#fff' }}
                >
                  {coverCustomColor ? (
                    <Check className="w-3.5 h-3.5 text-brand-text/60" />
                  ) : (
                    <span className="text-brand-text/40 text-xs font-bold">+</span>
                  )}
                </button>
                <input
                  ref={colorPickerRef}
                  type="color"
                  className="hidden"
                  value={coverCustomColor || '#f0ede6'}
                  onChange={(e) => { setCoverCustomColor(e.target.value); setCoverImageUrl(null) }}
                />
              </div>

              {/* Emoji input */}
              <div className="mt-3">
                <input
                  type="text"
                  value={coverEmoji}
                  onChange={(e) => setCoverEmoji(e.target.value.slice(0, 2))}
                  placeholder="Type an emoji for cover..."
                  className="w-full px-4 py-2.5 bg-white border border-brand-divider rounded-2xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10"
                />
              </div>
            </div>

            {/* === Group Icon Section === */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-3">Group Icon</label>
              <div className="flex items-start gap-4">
                {/* Icon preview */}
                <div
                  className="relative w-[88px] h-[88px] rounded-[20px] flex-shrink-0 flex items-center justify-center overflow-hidden border border-brand-divider cursor-pointer"
                  style={{ backgroundColor: iconImageUrl ? undefined : effectiveCoverColor }}
                  onClick={() => iconFileRef.current?.click()}
                >
                  {iconImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={iconImageUrl} alt="Icon" className="w-full h-full object-cover" />
                  ) : iconEmoji ? (
                    <span className="text-3xl select-none">{iconEmoji}</span>
                  ) : coverEmoji ? (
                    <span className="text-3xl select-none">{coverEmoji}</span>
                  ) : (
                    <Upload className="w-5 h-5 text-brand-text/20" />
                  )}
                  {/* Edit badge */}
                  <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-white border border-brand-divider flex items-center justify-center shadow-sm">
                    <Pencil className="w-3 h-3 text-brand-text/60" />
                  </div>
                </div>
                <input ref={iconFileRef} type="file" accept="image/*" className="hidden" onChange={handleIconFile} />

                {/* Icon actions */}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => iconFileRef.current?.click()}
                    className="text-xs font-bold text-brand-text hover:underline text-left"
                  >
                    Upload photo
                  </button>
                  {iconImageUrl && (
                    <button
                      type="button"
                      onClick={() => setIconImageUrl(null)}
                      className="text-xs font-bold text-brand-text/50 hover:text-brand-text text-left"
                    >
                      Remove
                    </button>
                  )}
                  {coverEmoji && !iconImageUrl && (
                    <button
                      type="button"
                      onClick={() => { setIconEmoji(coverEmoji); setIconImageUrl(null) }}
                      className="text-xs font-bold text-brand-text/50 hover:text-brand-text text-left"
                    >
                      Use cover emoji
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* === Description === */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-2">Description</label>
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this group about?"
                  className="w-full px-4 py-3 bg-white border border-brand-divider rounded-2xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10 resize-none"
                  rows={4}
                  maxLength={500}
                />
                <span className={`absolute bottom-3 right-4 text-[11px] ${description.length >= 450 ? 'text-amber-600' : 'text-brand-text/30'}`}>
                  {description.length} / 500
                </span>
              </div>
            </div>

            {/* === Topic Tags === */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-brand-text/50">Topic Tags</label>
                <span className="text-[11px] text-brand-text/30">{tags.length}/5 tags</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-white border border-brand-divider rounded-2xl min-h-[44px] focus-within:ring-2 focus-within:ring-brand-text/10">
                {tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-bg rounded-lg text-xs font-bold text-brand-text">
                    #{tag}
                    <button type="button" onClick={() => removeTag(i)} className="text-brand-text/40 hover:text-brand-text">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {tags.length < 5 && (
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
                    placeholder={tags.length === 0 ? 'Type a tag and press Enter...' : ''}
                    className="flex-1 min-w-[100px] text-sm text-brand-text placeholder:text-brand-text/30 bg-transparent outline-none"
                  />
                )}
              </div>
              <p className="text-[11px] text-brand-text/30 mt-1">Press Enter or comma to add a tag</p>
            </div>

            {/* === Location === */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-3.5 h-3.5 text-brand-text/50" />
                <label className="text-xs font-bold uppercase tracking-wider text-brand-text/50">Location</label>
                <span className="text-[10px] text-brand-text/30 bg-brand-bg px-1.5 py-0.5 rounded">Optional</span>
              </div>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
                className="w-full px-4 py-3 bg-white border border-brand-divider rounded-2xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10"
              />
              <p className="text-[11px] text-brand-text/30 mt-1">Helps nearby people discover your group</p>
            </div>
          </div>
        )}

        {/* ===== STEP 3: Rules & Settings ===== */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-[800] text-brand-text mb-1" style={{ fontFamily: 'var(--font-outfit, Outfit, sans-serif)' }}>Rules & Settings</h1>
              <p className="text-sm text-brand-text/60">Control who can post, invite, and set group rules</p>
            </div>

            {/* Who can post */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-3">Who can post</label>
              <div className="space-y-2">
                {([
                  { value: 'all_members' as const, label: 'All members', desc: 'Anyone in the group can create posts' },
                  { value: 'admins_mods' as const, label: 'Admins & mods only', desc: 'Only admins and moderators can post' },
                  { value: 'approval' as const, label: 'Anyone but needs approval', desc: 'Members can post, but posts require admin approval' },
                ] as const).map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWhoCanPost(value)}
                    className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border transition-all text-left ${
                      whoCanPost === value
                        ? 'border-brand-text bg-brand-text/5'
                        : 'border-brand-divider bg-white hover:border-brand-text/30'
                    }`}
                  >
                    <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      whoCanPost === value ? 'border-brand-text' : 'border-brand-text/20'
                    }`}>
                      {whoCanPost === value && <div className="w-2 h-2 rounded-full bg-brand-text" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-text">{label}</p>
                      <p className="text-xs text-brand-text/50">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Who can invite */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-text/50 mb-3">Who can invite</label>
              <div className="space-y-2">
                {([
                  { value: 'all_members' as const, label: 'All members', desc: 'Anyone can invite people to join' },
                  { value: 'admins_only' as const, label: 'Admins only', desc: 'Only admins can send invites' },
                ] as const).map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWhoCanInvite(value)}
                    className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border transition-all text-left ${
                      whoCanInvite === value
                        ? 'border-brand-text bg-brand-text/5'
                        : 'border-brand-divider bg-white hover:border-brand-text/30'
                    }`}
                  >
                    <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      whoCanInvite === value ? 'border-brand-text' : 'border-brand-text/20'
                    }`}>
                      {whoCanInvite === value && <div className="w-2 h-2 rounded-full bg-brand-text" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-text">{label}</p>
                      <p className="text-xs text-brand-text/50">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Join Questions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold uppercase tracking-wider text-brand-text/50">Join Questions</label>
                {joinQuestions.length < 3 && (
                  <button type="button" onClick={addQuestion} className="text-xs font-bold text-brand-text hover:underline">+ Add</button>
                )}
              </div>
              {joinQuestions.length === 0 ? (
                <p className="text-xs text-brand-text/40 italic">No join questions. People will join without answering questions.</p>
              ) : (
                <div className="space-y-2">
                  {joinQuestions.map((q, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => updateQuestion(i, e.target.value)}
                        placeholder={`Question ${i + 1}...`}
                        className="flex-1 px-4 py-2.5 bg-white border border-brand-divider rounded-2xl text-sm text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10"
                      />
                      <button onClick={() => removeQuestion(i)} className="p-1.5 text-brand-text/40 hover:text-brand-text transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-brand-text/30 mt-1">Up to 3 questions</p>
            </div>

            {/* Group Rules */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold uppercase tracking-wider text-brand-text/50">Group Rules</label>
                {rules.length < 10 && (
                  <button type="button" onClick={addRule} className="text-xs font-bold text-brand-text hover:underline">+ Add Rule</button>
                )}
              </div>
              {rules.length === 0 ? (
                <p className="text-xs text-brand-text/40 italic">No rules yet. You can add them later too.</p>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-brand-divider p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-brand-text/40">Rule {i + 1}</span>
                        <button type="button" onClick={() => removeRule(i)} className="text-brand-text/40 hover:text-brand-text">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={rule.title}
                        onChange={(e) => updateRule(i, 'title', e.target.value)}
                        placeholder="Rule title..."
                        className="w-full px-3 py-2 bg-brand-text/5 border border-brand-divider rounded-xl text-sm mb-2 text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10"
                      />
                      <input
                        type="text"
                        value={rule.description}
                        onChange={(e) => updateRule(i, 'description', e.target.value)}
                        placeholder="Description (optional)..."
                        className="w-full px-3 py-2 bg-brand-text/5 border border-brand-divider rounded-xl text-xs text-brand-text placeholder:text-brand-text/30 focus:outline-none focus:ring-2 focus:ring-brand-text/10"
                      />
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-brand-text/30 mt-1">Up to 10 rules</p>
            </div>

            {/* Review summary */}
            <div className="bg-white rounded-2xl border border-brand-divider p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text/50">Review</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-brand-text/40">Name</span><span className="font-bold text-brand-text">{name}</span>
                <span className="text-brand-text/40">Handle</span><span className="font-bold text-brand-text">@{handle}</span>
                {category && <><span className="text-brand-text/40">Category</span><span className="font-bold text-brand-text">{category}</span></>}
                <span className="text-brand-text/40">Type</span><span className="font-bold text-brand-text capitalize">{privacyLevel}</span>
                <span className="text-brand-text/40">Who Can Post</span><span className="font-bold text-brand-text capitalize">{whoCanPost.replace(/_/g, ' ')}</span>
                <span className="text-brand-text/40">Rules</span><span className="font-bold text-brand-text">{rules.length || 'None'}</span>
              </div>
            </div>
          </div>
        )}

        {/* ===== FOOTER: Back / Step N of 3 / Next ===== */}
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => step === 1 ? router.back() : setStep((step - 1) as Step)}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-brand-divider rounded-xl text-sm font-bold text-brand-text hover:bg-brand-text/5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <span className="text-xs text-brand-text/40 font-bold">Step {step} of 3</span>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((step + 1) as Step)}
              disabled={!canProceed()}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-text text-brand-bg rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!name.trim() || createGroup.isPending}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-text text-brand-bg rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              {createGroup.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
              ) : (
                <>Create Group</>
              )}
            </button>
          )}
        </div>
      </div>
    </AppShell>
  )
}

'use client'

import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Loader2, Pencil, X } from 'lucide-react'

import { useUpdateCommunity } from '@/hooks/useCommunities'
import { uploadMedia } from '@/lib/mediaUpload'
import type { Community } from '@/types/communities'

interface CommunityEditModalProps {
  community: Community
  onClose: () => void
}

const categories = [
  'Technology', 'Gaming', 'Art & Design', 'Education', 'Music', 'Sports',
  'Food', 'Travel', 'Photography', 'Business', 'Wellness', 'Film & TV',
]

const communityTypes = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'invite', label: 'Invite Only' },
] as const

const joinModes = [
  { value: 'open', label: 'Open' },
  { value: 'request', label: 'Approval Required' },
  { value: 'invite_only', label: 'Invite Only' },
] as const

function loadPreview(file: File, onLoad: (value: string) => void) {
  const reader = new FileReader()
  reader.onload = (event) => onLoad(event.target?.result as string)
  reader.readAsDataURL(file)
}

export default function CommunityEditModal({ community, onClose }: CommunityEditModalProps) {
  const updateCommunity = useUpdateCommunity()

  const [name, setName] = useState(community.name)
  const [description, setDescription] = useState(community.description || '')
  const [category, setCategory] = useState(community.category || '')
  const [communityType, setCommunityType] = useState<Community['community_type']>(community.community_type || 'public')
  const [joinMode, setJoinMode] = useState(community.join_mode || 'open')
  const [rules, setRules] = useState<string[]>(community.rules && community.rules.length > 0 ? community.rules : [''])
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    community.avatar_media_id ? `/v1/media/${community.avatar_media_id}/serve` : null
  )
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    community.banner_media_id ? `/v1/media/${community.banner_media_id}/serve` : null
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

  const updateRule = (index: number, value: string) => {
    const nextRules = [...rules]
    nextRules[index] = value
    setRules(nextRules)
  }

  const addRule = () => setRules([...rules, ''])

  const removeRule = (index: number) => {
    if (rules.length <= 1) return
    setRules(rules.filter((_, currentIndex) => currentIndex !== index))
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

      await updateCommunity.mutateAsync({
        communityId: community.id,
        name: name.trim(),
        description: description.trim(),
        category: category.trim() || undefined,
        community_type: communityType,
        join_mode: joinMode,
        rules: rules.map((rule) => rule.trim()).filter(Boolean),
        ...(avatarMediaId ? { avatar_media_id: avatarMediaId } : {}),
        ...(bannerMediaId ? { banner_media_id: bannerMediaId } : {}),
      })

      onClose()
    } catch (err) {
      console.error('Failed to update community:', err)
      setError('Failed to update community. Please try again.')
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
          <h2 className="text-lg font-black text-brand-text">Edit Community</h2>
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
                <img src={bannerPreview} alt="Community banner" className="h-full w-full object-cover" />
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
                <img src={avatarPreview} alt="Community avatar" className="h-full w-full object-cover" />
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
              <p className="text-sm font-bold text-brand-text">Community avatar</p>
              <p className="text-xs leading-relaxed text-brand-text/60">Upload a square image for the community icon.</p>
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
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Community Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-sm focus:border-brand-text/50 focus:outline-none focus:ring-2 focus:ring-brand-text/30"
              placeholder="Enter community name"
              maxLength={100}
            />
            <p className="mt-2 text-xs font-mono text-brand-text/50">@{community.handle}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-sm focus:border-brand-text/50 focus:outline-none focus:ring-2 focus:ring-brand-text/30"
              placeholder="What is this community about?"
              maxLength={500}
            />
          </div>

          <div>
            <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Community Type</label>
            <div className="grid grid-cols-3 gap-3">
              {communityTypes.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCommunityType(option.value)}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                    communityType === option.value
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
              {categories.map((option) => (
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
            <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Join Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {joinModes.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setJoinMode(option.value)}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                    joinMode === option.value
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
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Rules</label>
            <div className="space-y-2">
              {rules.map((rule, index) => (
                <div key={`${community.id}-rule-${index}`} className="flex items-center gap-2">
                  <span className="w-5 text-right text-xs font-mono text-brand-text/40">{index + 1}.</span>
                  <input
                    type="text"
                    value={rule}
                    onChange={(event) => updateRule(index, event.target.value)}
                    className="flex-1 rounded-lg border border-brand-divider bg-brand-secondary px-3 py-2 text-sm focus:border-brand-text/50 focus:outline-none focus:ring-2 focus:ring-brand-text/30"
                    placeholder={`Rule ${index + 1}`}
                  />
                  {rules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRule(index)}
                      className="px-2 text-sm text-brand-text/40 transition-colors hover:text-brand-text"
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
              className="mt-2 text-xs font-bold text-brand-text transition-colors hover:text-brand-text/90"
            >
              + Add rule
            </button>
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

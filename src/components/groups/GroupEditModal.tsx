'use client'

import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Globe, Loader2, Lock, X } from 'lucide-react'

import { useUpdateGroup } from '@/hooks/useGroups'
import { uploadMedia } from '@/lib/mediaUpload'
import type { Group } from '@/types/groups'

interface GroupEditModalProps {
  group: Group
  onClose: () => void
}

function resolveVisibility(group: Group): 'public' | 'private' {
  if (group.visibility === 'private' || group.privacy_level === 'private') {
    return 'private'
  }
  return 'public'
}

function loadPreview(file: File, onLoad: (value: string) => void) {
  const reader = new FileReader()
  reader.onload = (event) => onLoad(event.target?.result as string)
  reader.readAsDataURL(file)
}

export default function GroupEditModal({ group, onClose }: GroupEditModalProps) {
  const updateGroup = useUpdateGroup()

  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description || '')
  const [visibility, setVisibility] = useState<'public' | 'private'>(resolveVisibility(group))
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    group.avatar_media_id ? `/v1/media/${group.avatar_media_id}/serve` : null
  )
  const [coverPreview, setCoverPreview] = useState<string | null>(
    group.cover_media_id ? `/v1/media/${group.cover_media_id}/serve` : null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setAvatarFile(file)
    loadPreview(file, setAvatarPreview)
  }

  const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setCoverFile(file)
    loadPreview(file, setCoverPreview)
  }

  const handleSave = async () => {
    if (!name.trim()) return

    setSaving(true)
    setError(null)

    try {
      let avatarMediaId: string | undefined
      let coverMediaId: string | undefined

      if (avatarFile) {
        avatarMediaId = await uploadMedia(avatarFile, 'image', 'avatar')
      }
      if (coverFile) {
        coverMediaId = await uploadMedia(coverFile, 'image', 'cover')
      }

      await updateGroup.mutateAsync({
        groupId: group.id,
        name: name.trim(),
        description: description.trim(),
        visibility,
        ...(avatarMediaId ? { avatar_media_id: avatarMediaId } : {}),
        ...(coverMediaId ? { cover_media_id: coverMediaId } : {}),
      })

      onClose()
    } catch (err) {
      console.error('Failed to update group:', err)
      setError('Failed to update group. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const fallbackInitial = (name.trim().charAt(0) || 'G').toUpperCase()

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
        className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-brand-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-brand-divider px-6 py-4">
          <h2 className="text-lg font-black text-brand-text">Edit Space</h2>
          <button onClick={onClose} className="p-1 text-brand-text/60 transition-colors hover:text-brand-highlight">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Cover Photo</label>
            <div
              className="group relative h-36 cursor-pointer overflow-hidden rounded-2xl border border-brand-divider bg-brand-secondary"
              onClick={() => coverInputRef.current?.click()}
            >
              {coverPreview ? (
                <img src={coverPreview} alt="Group cover" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-text/10 via-brand-text/5 to-brand-text/15 text-5xl font-black text-brand-text/15">
                  {fallbackInitial}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="rounded-full bg-brand-card/90 px-3 py-1.5 text-xs font-bold text-brand-text shadow-sm">
                  Change cover
                </span>
              </div>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverSelect}
            />
          </div>

          <div className="flex items-center gap-4">
            <div
              className="group relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-brand-divider bg-brand-secondary"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Group avatar" className="h-full w-full object-cover" />
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
              <p className="text-sm font-bold text-brand-text">Avatar</p>
              <p className="text-xs leading-relaxed text-brand-text/60">Upload a square image for the group icon.</p>
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
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Space Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-sm focus:border-brand-text/50 focus:outline-none focus:ring-2 focus:ring-brand-text/30"
              placeholder="Enter group name"
              maxLength={100}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-sm focus:border-brand-text/50 focus:outline-none focus:ring-2 focus:ring-brand-text/30"
              placeholder="What's this group about?"
              maxLength={500}
            />
          </div>

          <div>
            <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Visibility</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                  visibility === 'public'
                    ? 'border-brand-text/50 bg-brand-text/5 text-brand-text'
                    : 'border-brand-divider bg-brand-secondary text-brand-text/60 hover:border-brand-text/30'
                }`}
              >
                <Globe className="h-4 w-4" />
                Public
              </button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                  visibility === 'private'
                    ? 'border-brand-text/50 bg-brand-text/5 text-brand-text'
                    : 'border-brand-divider bg-brand-secondary text-brand-text/60 hover:border-brand-text/30'
                }`}
              >
                <Lock className="h-4 w-4" />
                Private
              </button>
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
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

'use client'

import React, { useState, useRef } from 'react'
import { useUpdateGroup } from '@/hooks/useGroups'
import { uploadMedia } from '@/lib/mediaUpload'
import { X, Camera, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Group } from '@/types/groups'

interface GroupEditModalProps {
  group: Group
  onClose: () => void
}

export default function GroupEditModal({ group, onClose }: GroupEditModalProps) {
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    group.avatar_media_id ? `/v1/media/${group.avatar_media_id}/serve` : null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const updateGroup = useUpdateGroup()

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      let avatarMediaId: string | undefined
      if (avatarFile) {
        avatarMediaId = await uploadMedia(avatarFile, 'image', 'avatar')
      }

      await updateGroup.mutateAsync({
        groupId: group.id,
        name: name.trim(),
        description: description.trim(),
        ...(avatarMediaId ? { avatar_media_id: avatarMediaId } : {}),
      })
      onClose()
    } catch (err) {
      console.error('Failed to update group:', err)
      setError('Failed to update group. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
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
        className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-800">Edit Group</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative w-24 h-24 rounded-2xl overflow-hidden cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Group avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full orchid-gradient flex items-center justify-center text-white font-black text-3xl">
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-bold text-[#D8103F] hover:text-[#b80d35] transition-colors"
            >
              Change Photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelect}
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D8103F]/30 focus:border-[#D8103F]/50"
              placeholder="Enter group name"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#D8103F]/30 focus:border-[#D8103F]/50"
              placeholder="What's this group about?"
            />
          </div>

          {error && (
            <p className="text-sm text-rose-600 font-bold">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 orchid-gradient text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
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

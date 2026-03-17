'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateGroup, useCheckHandle } from '@/hooks/useGroups'
import {
  X, Globe, Lock, Shield, Loader2, Users, UserPlus,
  Check, AlertCircle, AtSign, Hash
} from 'lucide-react'
import { motion } from 'framer-motion'

interface GroupCreateModalProps {
  onClose: () => void
  onCreated?: (groupId: string) => void
}

const CATEGORIES = [
  'Gaming', 'Technology', 'Music', 'Sports', 'Art',
  'Food', 'Travel', 'Education', 'Fitness', 'Business',
  'Photography', 'Science', 'Fashion', 'Movies', 'Other'
]

export default function GroupCreateModal({ onClose, onCreated }: GroupCreateModalProps) {
  const router = useRouter()
  const createGroup = useCreateGroup()

  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'restricted' | 'private'>('public')
  const [joinMode, setJoinMode] = useState<'open' | 'request' | 'invite_only'>('open')

  // Auto-generate handle from name
  const autoHandle = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
  const effectiveHandle = handle || autoHandle
  const { data: handleCheck, isLoading: checkingHandle } = useCheckHandle(effectiveHandle)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      const group = await createGroup.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        handle: effectiveHandle,
        category: category || undefined,
        privacy_level: privacyLevel,
        join_mode: joinMode,
      })
      onClose()
      if (onCreated) {
        onCreated(group.id)
        return
      }
      router.push(`/groups/${group.id}`)
    } catch {
      // Error handled by React Query
    }
  }

  const privacyOptions = [
    { value: 'public' as const, icon: <Globe className="w-4 h-4" />, label: 'Public', desc: 'Anyone can find and join' },
    { value: 'restricted' as const, icon: <Shield className="w-4 h-4" />, label: 'Restricted', desc: 'Visible, but content is members-only' },
    { value: 'private' as const, icon: <Lock className="w-4 h-4" />, label: 'Private', desc: 'Only invited members can find it' },
  ]

  const joinModeOptions = [
    { value: 'open' as const, icon: <Users className="w-4 h-4" />, label: 'Open', desc: 'Join instantly' },
    { value: 'request' as const, icon: <UserPlus className="w-4 h-4" />, label: 'Request', desc: 'Admin must approve' },
    { value: 'invite_only' as const, icon: <Lock className="w-4 h-4" />, label: 'Invite Only', desc: 'By invitation only' },
  ]

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
        className="w-full max-w-lg mx-4 bg-brand-card rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-divider shrink-0">
          <h2 className="text-lg font-bold text-slate-800">Create Group</h2>
          <button onClick={onClose} className="p-1 text-brand-text/60 hover:text-brand-highlight transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-highlight mb-1.5">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. React Developers"
              className="w-full px-4 py-3 bg-brand-secondary border border-brand-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20 focus:border-[#D8103F]/30"
              maxLength={100}
              required
            />
            <p className="text-[11px] text-slate-300 mt-1">{name.length}/100 characters</p>
          </div>

          {/* Handle */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-highlight mb-1.5">Handle</label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder={autoHandle || 'group-handle'}
                className="w-full pl-9 pr-10 py-3 bg-brand-secondary border border-brand-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20 focus:border-[#D8103F]/30"
                maxLength={50}
              />
              {effectiveHandle.length >= 3 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingHandle ? (
                    <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
                  ) : handleCheck?.available ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              {effectiveHandle.length >= 3 && handleCheck && !handleCheck.available
                ? 'This handle is taken'
                : 'Lowercase letters, numbers, and hyphens only'}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-highlight mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group about?"
              className="w-full px-4 py-3 bg-brand-secondary border border-brand-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20 focus:border-[#D8103F]/30 resize-none"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-highlight mb-1.5">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(category === cat ? '' : cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    category === cat
                      ? 'bg-[#D8103F] text-white shadow-sm'
                      : 'bg-brand-secondary text-brand-highlight hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy Level */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-highlight mb-2">Privacy</label>
            <div className="space-y-2">
              {privacyOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setPrivacyLevel(opt.value)
                    if (opt.value === 'private') setJoinMode('invite_only')
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    privacyLevel === opt.value
                      ? 'border-[#D8103F]/40 bg-[#D8103F]/5'
                      : 'border-brand-divider bg-brand-card hover:border-brand-divider'
                  }`}
                >
                  <div className={`${privacyLevel === opt.value ? 'text-[#D8103F]' : 'text-brand-text/60'}`}>
                    {opt.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{opt.label}</p>
                    <p className="text-[11px] text-brand-text/60">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Join Mode (only for non-private) */}
          {privacyLevel !== 'private' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-highlight mb-2">Join Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {joinModeOptions.filter(o => o.value !== 'invite_only').map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setJoinMode(opt.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      joinMode === opt.value
                        ? 'border-[#D8103F]/40 bg-[#D8103F]/5'
                        : 'border-brand-divider bg-brand-card hover:border-brand-divider'
                    }`}
                  >
                    <div className={`${joinMode === opt.value ? 'text-[#D8103F]' : 'text-brand-text/60'}`}>
                      {opt.icon}
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-brand-divider shrink-0">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-sm font-bold text-brand-highlight bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || createGroup.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#D8103F] text-white font-bold text-sm rounded-xl hover:bg-[#C00E38] transition-all disabled:opacity-50"
            >
              {createGroup.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {createGroup.isPending ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

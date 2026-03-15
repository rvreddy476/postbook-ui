'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { fetchUsers } from '@/services/userService'
import { getSession } from '@/services/authService'
import { useCreateGroup, useInviteToGroup } from '@/hooks/useGroups'
import { uploadMedia } from '@/lib/mediaUpload'
import {
  X, Camera, Search, Check, ChevronRight, ChevronLeft,
  Users, Loader2, Globe, Lock, Shield, Crown, UserPlus,
  AtSign, AlertCircle, ImageIcon
} from 'lucide-react'
import type { User } from '@/types'

interface CreateGroupPanelProps {
  onClose: () => void
  onCreated: (groupId: string) => void
}

const CATEGORIES = [
  'Gaming', 'Technology', 'Music', 'Sports', 'Art',
  'Food', 'Travel', 'Education', 'Fitness', 'Business',
  'Photography', 'Science', 'Other'
]

export default function CreateGroupPanel({ onClose, onCreated }: CreateGroupPanelProps) {
  const me = getSession()

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1: Group identity
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'restricted' | 'private'>('public')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)

  // Step 2: Members
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<User[]>([])

  // Step 3: Creating
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createGroup = useCreateGroup()
  const inviteToGroup = useInviteToGroup()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const autoHandle = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
  const effectiveHandle = handle || autoHandle

  // Load users when step 2
  useEffect(() => {
    if (step === 2 && allUsers.length === 0) {
      const load = async () => {
        setUsersLoading(true)
        try {
          const users = await fetchUsers(50, 0)
          setAllUsers(me?.id ? users.filter(u => u.id !== me.id) : users)
        } catch (err) {
          console.error('Failed to load users:', err)
        } finally {
          setUsersLoading(false)
        }
      }
      load()
    }
  }, [step, allUsers.length, me?.id])

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return allUsers
    return allUsers.filter(u =>
      u.name.toLowerCase().includes(q) ||
      (u.loginId && u.loginId.toLowerCase().includes(q))
    )
  }, [allUsers, search])

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    const reader = new FileReader()
    reader.onload = ev => setCoverPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const toggleMember = (user: User) => {
    setSelectedMembers(prev =>
      prev.some(m => m.id === user.id)
        ? prev.filter(m => m.id !== user.id)
        : [...prev, user]
    )
  }

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      let avatarMediaId: string | undefined
      if (avatarFile) avatarMediaId = await uploadMedia(avatarFile, 'image', 'avatar')

      let coverMediaId: string | undefined
      if (coverFile) coverMediaId = await uploadMedia(coverFile, 'image', 'cover')

      const newGroup = await createGroup.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        handle: effectiveHandle || undefined,
        category: category || undefined,
        privacy_level: privacyLevel,
        avatar_media_id: avatarMediaId,
        cover_media_id: coverMediaId,
      })

      for (const member of selectedMembers) {
        try {
          await inviteToGroup.mutateAsync({ groupId: newGroup.id, userId: member.id })
        } catch (err) {
          console.error(`Failed to invite ${member.name}:`, err)
        }
      }

      onCreated(newGroup.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create group. Please try again.'
      setError(message)
    } finally {
      setCreating(false)
    }
  }

  const canProceedStep1 = name.trim().length >= 3
  const canProceedStep2 = selectedMembers.length >= 1

  // ---- RENDER ----

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#D8103F]/10 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-[#D8103F]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-800">Create Group</h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Step {step} of 3 — {step === 1 ? 'Identity' : step === 2 ? 'Add Members' : 'Review & Create'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 px-5 pt-3 pb-1 shrink-0">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                s <= step ? 'bg-[#D8103F]' : 'bg-slate-100'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="p-5 space-y-5">
              {/* Cover Photo Upload */}
              <div
                onClick={() => coverInputRef.current?.click()}
                className="relative w-full h-32 rounded-xl overflow-hidden cursor-pointer group border-2 border-dashed border-slate-200 hover:border-[#D8103F]/30 transition-all"
              >
                {coverPreview ? (
                  <>
                    <img src={coverPreview} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                      <span className="text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Change Cover</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center gap-1.5">
                    <ImageIcon className="w-6 h-6 text-slate-300 group-hover:text-[#D8103F]/50 transition-colors" />
                    <span className="text-[11px] font-semibold text-slate-400">Add Cover Photo</span>
                  </div>
                )}
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
              </div>

              {/* Avatar Upload */}
              <div className="flex justify-center -mt-10 relative z-10">
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-16 h-16 rounded-2xl overflow-hidden cursor-pointer group bg-white p-0.5 shadow-lg ring-2 ring-white"
                >
                  <div className="w-full h-full rounded-[14px] overflow-hidden bg-slate-100 relative">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                        <Camera className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                      <Camera className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
              </div>
              <p className="text-center text-[11px] text-slate-400 font-medium -mt-1">Group Icon</p>

              {/* Name */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Group Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. React Developers"
                  maxLength={100}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20 focus:border-[#D8103F]/30 transition-all"
                />
                <p className="text-[10px] text-slate-300 mt-1">{name.length}/100 · Minimum 3 characters</p>
              </div>

              {/* Handle */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Handle</label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder={autoHandle || 'group-handle'}
                    maxLength={50}
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20 focus:border-[#D8103F]/30 transition-all"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this group about?"
                  rows={2}
                  maxLength={500}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20 focus:border-[#D8103F]/30 transition-all"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(category === cat ? '' : cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        category === cat
                          ? 'bg-[#D8103F] text-white shadow-sm'
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Privacy */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Privacy</label>
                <div className="space-y-2">
                  {([
                    { value: 'public' as const, icon: <Globe className="w-4 h-4" />, label: 'Public', desc: 'Anyone can find and join' },
                    { value: 'restricted' as const, icon: <Shield className="w-4 h-4" />, label: 'Restricted', desc: 'Visible, but content is members-only' },
                    { value: 'private' as const, icon: <Lock className="w-4 h-4" />, label: 'Private', desc: 'Only invited members can find it' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPrivacyLevel(opt.value)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        privacyLevel === opt.value
                          ? 'border-[#D8103F]/40 bg-[#D8103F]/5'
                          : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className={privacyLevel === opt.value ? 'text-[#D8103F]' : 'text-slate-400'}>{opt.icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{opt.label}</p>
                        <p className="text-[11px] text-slate-400">{opt.desc}</p>
                      </div>
                      {privacyLevel === opt.value && <Check className="w-4 h-4 text-[#D8103F] ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col h-full">
              {/* Selected members chips */}
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-5 pt-4 pb-2 border-b border-slate-50">
                  {selectedMembers.map(m => (
                    <div
                      key={m.id}
                      className="flex items-center gap-1.5 pl-1 pr-2 py-1 bg-[#D8103F]/5 border border-[#D8103F]/15 rounded-full"
                    >
                      <img src={m.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                      <span className="text-[11px] font-semibold text-slate-700 max-w-[60px] truncate">{m.name}</span>
                      <button
                        onClick={() => toggleMember(m)}
                        className="w-4 h-4 rounded-full bg-slate-200 hover:bg-rose-200 flex items-center justify-center transition-colors"
                      >
                        <X className="w-2.5 h-2.5 text-slate-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="px-5 pt-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users by name..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#D8103F]/20 focus:border-[#D8103F]/30 transition-all"
                  />
                </div>
                <p className="text-[10px] text-slate-300 mt-1.5 font-medium">
                  {selectedMembers.length} selected · Add at least 1 member to continue
                </p>
              </div>

              {/* User list */}
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                {usersLoading ? (
                  <div className="space-y-2 px-2 pt-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                        <div className="w-10 h-10 rounded-xl bg-slate-100" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-24 bg-slate-100 rounded" />
                          <div className="h-2.5 w-16 bg-slate-50 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <Search className="w-8 h-8 text-slate-200" />
                    <p className="text-sm text-slate-400 font-medium">
                      {search.trim() ? 'No users found' : 'No users available'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredUsers.map(user => {
                      const isSelected = selectedMembers.some(m => m.id === user.id)
                      return (
                        <button
                          key={user.id}
                          onClick={() => toggleMember(user)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                            isSelected
                              ? 'bg-[#D8103F]/5 border border-[#D8103F]/10'
                              : 'hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'bg-[#D8103F] border-[#D8103F]'
                              : 'border-slate-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>

                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{user.name}</p>
                            {user.loginId && (
                              <p className="text-[11px] text-slate-400">@{user.loginId}</p>
                            )}
                          </div>

                          {user.isOnline && (
                            <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="p-5 space-y-5">
              {/* Group preview card */}
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                {/* Cover */}
                <div className="h-24 relative">
                  {coverPreview ? (
                    <img src={coverPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300" />
                  )}
                </div>

                {/* Avatar + name */}
                <div className="px-4 pb-4 -mt-6 relative">
                  <div className="w-14 h-14 rounded-xl bg-white p-0.5 shadow-lg inline-block">
                    <div className="w-full h-full rounded-[10px] overflow-hidden bg-slate-100">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#D8103F]/20 to-[#D8103F]/10 flex items-center justify-center text-[#D8103F] font-bold text-lg">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mt-2">{name}</h3>
                  {effectiveHandle && (
                    <p className="text-xs text-slate-400 font-medium">@{effectiveHandle}</p>
                  )}
                  {description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {selectedMembers.length + 1} members
                    </span>
                    {category && (
                      <span className="px-2 py-0.5 bg-slate-50 rounded-full text-[10px] font-semibold">{category}</span>
                    )}
                    <span className="flex items-center gap-1 capitalize">
                      {privacyLevel === 'public' ? <Globe className="w-3.5 h-3.5" /> :
                       privacyLevel === 'restricted' ? <Shield className="w-3.5 h-3.5" /> :
                       <Lock className="w-3.5 h-3.5" />}
                      {privacyLevel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Members list */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Members</h3>

                {/* Creator = Admin */}
                {me && (
                  <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl mb-1.5">
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-200">
                      <img src={me.avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{me.name}</p>
                      <p className="text-[10px] text-slate-400">You</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 rounded-md">
                      <Crown className="w-2.5 h-2.5" />Admin
                    </span>
                  </div>
                )}

                {selectedMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl mb-1">
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100">
                      <img src={m.avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{m.name}</p>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                      Member
                    </span>
                  </div>
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <p className="text-xs text-rose-600 font-medium">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
          {step > 1 && (
            <button
              onClick={() => setStep((step - 1) as 1 | 2)}
              disabled={creating}
              className="flex items-center gap-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}

          <div className="flex-1" />

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-[#D8103F] rounded-xl hover:bg-[#C00E38] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add Members
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 2 && (
            <div className="flex items-center gap-3">
              {!canProceedStep2 && (
                <span className="text-[11px] text-rose-400 font-semibold">Add at least 1 member</span>
              )}
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-[#D8103F] rounded-xl hover:bg-[#C00E38] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Review
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 3 && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-[#D8103F] rounded-xl hover:bg-[#C00E38] transition-all disabled:opacity-60"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Group
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Globe, Loader2, Lock, Trash2 } from 'lucide-react'

import AppShell from '@/components/AppShell'
import { useDeleteGroup, useGroupDetails, useGroupMembers, useUpdateGroup } from '@/hooks/useGroups'
import { uploadMedia } from '@/lib/mediaUpload'
import { useAuthUser } from '@/store/auth'

function resolveVisibility(value?: string): 'public' | 'private' {
  return value === 'private' ? 'private' : 'public'
}

function loadPreview(file: File, onLoad: (value: string) => void) {
  const reader = new FileReader()
  reader.onload = (event) => onLoad(event.target?.result as string)
  reader.readAsDataURL(file)
}

export default function GroupSettingsPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string

  const authUser = useAuthUser()
  const { data: group, isLoading } = useGroupDetails(groupId)
  const { data: members } = useGroupMembers(groupId)
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()

  const membership = members?.find((member) => member.user_id === authUser?.id)
  const isAdmin = membership?.role === 'admin' || membership?.role === 'owner'

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!group) return

    setName(group.name)
    setDescription(group.description || '')
    setVisibility(resolveVisibility(group.visibility ?? group.privacy_level))
    setAvatarPreview(group.avatar_media_id ? `/v1/media/${group.avatar_media_id}/serve` : null)
    setCoverPreview(group.cover_media_id ? `/v1/media/${group.cover_media_id}/serve` : null)
  }, [group])

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

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 pt-8">
          <div className="h-64 animate-pulse rounded-2xl bg-brand-secondary" />
        </div>
      </AppShell>
    )
  }

  if (!group || !isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h2 className="text-xl font-bold text-brand-text">Access Denied</h2>
          <p className="mt-2 text-sm text-brand-text/60">Only space owners and admins can access settings.</p>
          <button onClick={() => router.back()} className="mt-4 text-sm font-bold text-brand-text hover:underline">
            Go Back
          </button>
        </div>
      </AppShell>
    )
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return

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
        groupId,
        name: name.trim(),
        description: description.trim(),
        visibility,
        ...(avatarMediaId ? { avatar_media_id: avatarMediaId } : {}),
        ...(coverMediaId ? { cover_media_id: coverMediaId } : {}),
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Failed to save space settings. Please try again.')
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${group.name}"? This cannot be undone.`)) return
    await deleteGroup.mutateAsync(groupId)
    router.push('/groups')
  }

  const fallbackInitial = (name.trim().charAt(0) || 'G').toUpperCase()

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-8">
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={() => router.push(`/groups/${groupId}`)}
            className="rounded-full bg-brand-secondary p-2 text-brand-highlight transition-all hover:bg-brand-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-black text-brand-text">Space Settings</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-5 rounded-2xl border border-brand-divider bg-brand-card p-6">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Cover Photo</label>
              <div
                className="group relative h-40 cursor-pointer overflow-hidden rounded-2xl border border-brand-divider bg-brand-secondary"
                onClick={() => coverInputRef.current?.click()}
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="Group cover" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-text/10 via-brand-text/5 to-brand-text/15 text-6xl font-black text-brand-text/15">
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
                <p className="text-xs leading-relaxed text-brand-text/60">Update the square icon shown in space cards and headers.</p>
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
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Space Name</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-text/30"
                maxLength={100}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Description</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full resize-none rounded-xl border border-brand-divider bg-brand-secondary px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-text/30"
                rows={3}
                maxLength={500}
              />
            </div>

            <div>
              <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Visibility</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`flex items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                    visibility === 'public'
                      ? 'border-brand-text/50 bg-brand-text/5'
                      : 'border-brand-divider bg-brand-card hover:border-brand-text/30'
                  }`}
                >
                  <Globe className={`h-4 w-4 ${visibility === 'public' ? 'text-brand-text/50' : 'text-brand-text/60'}`} />
                  <span className="text-sm font-bold text-brand-text">Public</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`flex items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                    visibility === 'private'
                      ? 'border-brand-text/50 bg-brand-text/5'
                      : 'border-brand-divider bg-brand-card hover:border-brand-text/30'
                  }`}
                >
                  <Lock className={`h-4 w-4 ${visibility === 'private' ? 'text-brand-text/50' : 'text-brand-text/60'}`} />
                  <span className="text-sm font-bold text-brand-text">Private</span>
                </button>
              </div>
            </div>

            {error && <p className="text-sm font-bold text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={!name.trim() || updateGroup.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-text py-3 font-bold text-brand-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {updateGroup.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {saved ? 'Saved!' : updateGroup.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        <div className="mt-8 rounded-2xl border border-rose-200 bg-brand-card p-6">
          <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-rose-600">Danger Zone</h3>
          <p className="mb-4 text-xs text-brand-text/60">Deleting this space is permanent and cannot be undone. All posts, members, and data will be lost.</p>
          <button
            onClick={handleDelete}
            disabled={deleteGroup.isPending}
            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600 transition-all hover:bg-rose-100 disabled:opacity-50"
          >
            {deleteGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleteGroup.isPending ? 'Deleting...' : 'Delete Space'}
          </button>
        </div>
      </div>
    </AppShell>
  )
}

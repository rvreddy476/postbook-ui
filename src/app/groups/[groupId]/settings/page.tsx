'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Camera, Globe, Loader2, Lock, Trash2,
  Settings as SettingsIcon, UserPlus, FileClock, ShieldOff, ScrollText, Check, X,
} from 'lucide-react'

import AppShell from '@/components/AppShell'
import api from '@/lib/api'
import { useDeleteGroup, useGroupDetails, useGroupMembers, useUpdateGroup } from '@/hooks/useGroups'
import {
  usePendingGroupPosts,
  useApproveGroupPost,
  useRejectGroupPost,
  useGroupBans,
  useGroupJoinRequests,
} from '@/hooks/useGroupAdmin'
import GroupJoinRequestsPanel from '@/components/groups/GroupJoinRequestsPanel'
import GroupRulesTab from '@/components/groups/tabs/GroupRulesTab'
import { uploadMedia } from '@/lib/mediaUpload'
import { useAuthUser } from '@/store/auth'

type Section = 'details' | 'requests' | 'pending' | 'banned' | 'rules'

interface PendingPost {
  id: string
  author_id: string
  title?: string
  body?: string
  created_at: string
}

interface BanEntry {
  user_id: string
  reason?: string
}

function resolveVisibility(value?: string): 'public' | 'private' {
  return value === 'private' ? 'private' : 'public'
}

function loadPreview(file: File, onLoad: (value: string) => void) {
  const reader = new FileReader()
  reader.onload = (event) => onLoad(event.target?.result as string)
  reader.readAsDataURL(file)
}

/**
 * The space admin console — FB-style: settings menu on the left
 * (details, member requests, pending posts, banned members, rules),
 * the selected section's editor on the right.
 */
export default function SpaceSettingsPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string
  const qc = useQueryClient()

  const authUser = useAuthUser()
  const { data: group, isLoading } = useGroupDetails(groupId)
  const { data: members } = useGroupMembers(groupId)
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()

  const { data: joinRequests } = useGroupJoinRequests(groupId)
  const { data: pendingPosts } = usePendingGroupPosts(groupId)
  const approvePost = useApproveGroupPost(groupId)
  const rejectPost = useRejectGroupPost(groupId)
  const { data: bans } = useGroupBans(groupId)
  const unban = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/v1/groups/${groupId}/members/${userId}/ban`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-bans', groupId] }),
  })

  const membership = members?.find((member) => member.user_id === authUser?.id)
  const isAdmin = membership?.role === 'admin' || membership?.role === 'owner'

  const [section, setSection] = useState<Section>('details')
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

  if (isLoading) {
    return (
      <AppShell hideSidebar>
        <div className="mx-auto max-w-2xl px-4 pt-8">
          <div className="h-64 animate-pulse rounded-2xl bg-brand-secondary" />
        </div>
      </AppShell>
    )
  }

  if (!group || !isAdmin) {
    return (
      <AppShell hideSidebar>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h2 className="text-xl font-bold text-brand-text">Access Denied</h2>
          <p className="mt-2 text-sm text-brand-text/60">Only space owners and admins can access settings.</p>
          <button onClick={() => router.push('/groups')} className="mt-4 text-sm font-bold text-brand-text hover:underline">
            Go Back
          </button>
        </div>
      </AppShell>
    )
  }

  const requestCount = (joinRequests ?? []).length
  const posts: PendingPost[] = pendingPosts ?? []
  const banned: BanEntry[] = bans ?? []

  const menu: { key: Section; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'details', label: 'Space details', icon: <SettingsIcon className="h-4 w-4" /> },
    { key: 'requests', label: 'Member requests', icon: <UserPlus className="h-4 w-4" />, badge: requestCount },
    { key: 'pending', label: 'Pending posts', icon: <FileClock className="h-4 w-4" />, badge: posts.length },
    { key: 'banned', label: 'Banned members', icon: <ShieldOff className="h-4 w-4" /> },
    { key: 'rules', label: 'Rules', icon: <ScrollText className="h-4 w-4" /> },
  ]

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

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setError(null)
    try {
      let avatarMediaId: string | undefined
      let coverMediaId: string | undefined
      if (avatarFile) avatarMediaId = await uploadMedia(avatarFile, 'image', 'avatar')
      if (coverFile) coverMediaId = await uploadMedia(coverFile, 'image', 'cover')

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

  const fallbackInitial = (name.trim().charAt(0) || 'S').toUpperCase()

  return (
    <AppShell hideSidebar>
      <div className="flex w-full items-start">
        {/* ── Left: settings menu ───────────────────────────────────── */}
        <aside className="sticky top-0 flex h-[calc(100vh-5rem)] w-[300px] flex-shrink-0 flex-col overflow-y-auto scrollbar-hide border-r border-brand-divider bg-brand-card p-4 xl:w-[330px]">
          <button
            onClick={() => router.push(`/groups?space=${groupId}`)}
            className="mb-4 flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-text/50 transition-colors hover:text-brand-text"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to space
          </button>

          {/* Space identity */}
          <div className="mb-4 flex items-center gap-3 border-b border-brand-divider pb-4">
            <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl bg-brand-text/10">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt={group.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-base font-black text-brand-text/50">
                  {fallbackInitial}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-brand-text">{group.name}</p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand-text/40">Manage</p>
            </div>
          </div>

          <nav className="space-y-1">
            {menu.map((item) => (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  section === item.key
                    ? 'bg-emerald-500/10 text-brand-text ring-1 ring-emerald-500/40'
                    : 'text-brand-text/60 hover:bg-brand-text/5 hover:text-brand-text'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    section === item.key ? 'bg-emerald-500 text-white' : 'bg-brand-text/8 text-brand-text/60'
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
                {!!item.badge && (
                  <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Right: section content ────────────────────────────────── */}
        <main className="min-w-0 flex-1 px-4 pt-6 pb-16 lg:px-8">
          <div className="mx-auto max-w-[760px]">
            <h1 className="mb-5 text-xl font-black tracking-tight text-brand-text">
              {menu.find((m) => m.key === section)?.label}
            </h1>

            {section === 'details' && (
              <>
                <form onSubmit={handleSave} className="space-y-6">
                  <div className="space-y-5 rounded-2xl border border-brand-divider bg-brand-card p-6">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-highlight">Cover Photo</label>
                      <div
                        className="group relative h-44 cursor-pointer overflow-hidden rounded-2xl border border-brand-divider bg-brand-secondary"
                        onClick={() => coverInputRef.current?.click()}
                      >
                        {coverPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={coverPreview} alt="Space cover" className="h-full w-full object-cover" />
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
                      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
                    </div>

                    <div className="flex items-center gap-4">
                      <div
                        className="group relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-brand-divider bg-brand-secondary"
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        {avatarPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarPreview} alt="Space avatar" className="h-full w-full object-cover" />
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
                      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
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
                          <Globe className="h-4 w-4 text-brand-text/60" />
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
                          <Lock className="h-4 w-4 text-brand-text/60" />
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
              </>
            )}

            {section === 'requests' && (
              <div className="rounded-2xl border border-brand-divider bg-brand-card p-5">
                {requestCount === 0 ? (
                  <p className="text-sm text-brand-text/40">No pending member requests.</p>
                ) : (
                  <GroupJoinRequestsPanel groupId={groupId} />
                )}
              </div>
            )}

            {section === 'pending' && (
              <div className="rounded-2xl border border-brand-divider bg-brand-card p-5">
                {posts.length === 0 ? (
                  <p className="text-sm text-brand-text/40">No posts waiting for approval.</p>
                ) : (
                  <div className="space-y-2">
                    {posts.map((p) => (
                      <div key={p.id} className="flex items-start gap-3 rounded-xl border border-brand-divider p-3">
                        <div className="min-w-0 flex-1">
                          {p.title && <p className="truncate text-sm font-bold text-brand-text">{p.title}</p>}
                          <p className="line-clamp-2 text-xs text-brand-text/60">{p.body || '(no text)'}</p>
                          <p className="mt-1 text-[10px] text-brand-text/35">
                            {new Date(p.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          onClick={() => approvePost.mutate(p.id)}
                          disabled={approvePost.isPending}
                          className="flex items-center gap-1 rounded-lg bg-brand-text px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand-bg transition-all hover:opacity-90 disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" />
                          Approve
                        </button>
                        <button
                          onClick={() => rejectPost.mutate(p.id)}
                          disabled={rejectPost.isPending}
                          className="flex items-center gap-1 rounded-lg bg-brand-text/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand-text/60 transition-all hover:bg-brand-text/12 disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                          Reject
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {section === 'banned' && (
              <div className="rounded-2xl border border-brand-divider bg-brand-card p-5">
                {banned.length === 0 ? (
                  <p className="text-sm text-brand-text/40">No one is banned from this space.</p>
                ) : (
                  <div className="space-y-2">
                    {banned.map((b) => (
                      <div key={b.user_id} className="flex items-center gap-3 rounded-xl border border-brand-divider p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-brand-text">{b.user_id}</p>
                          {b.reason && <p className="truncate text-[11px] text-brand-text/45">{b.reason}</p>}
                        </div>
                        <button
                          onClick={() => unban.mutate(b.user_id)}
                          disabled={unban.isPending}
                          className="rounded-lg bg-brand-text/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand-text/60 transition-all hover:bg-brand-text/12 disabled:opacity-50"
                        >
                          Unban
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {section === 'rules' && <GroupRulesTab groupId={groupId} isAdmin={isAdmin} />}
          </div>
        </main>
      </div>
    </AppShell>
  )
}

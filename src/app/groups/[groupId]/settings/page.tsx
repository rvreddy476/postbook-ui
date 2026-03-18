'use client'

import React, { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useRouter, useParams } from 'next/navigation'
import { useGroupDetails, useGroupMembers, useUpdateGroup, useDeleteGroup } from '@/hooks/useGroups'
import { useAuthUser } from '@/store/auth'
import { ArrowLeft, Globe, Lock, Loader2, Trash2 } from 'lucide-react'

export default function GroupSettingsPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.groupId as string

  const authUser = useAuthUser()
  const { data: group, isLoading } = useGroupDetails(groupId)
  const { data: members } = useGroupMembers(groupId)
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()

  const membership = members?.find((m) => m.user_id === authUser?.id)
  const isAdmin = membership?.role === 'admin'

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (group) {
      setName(group.name)
      setDescription(group.description || '')
      setVisibility(group.visibility as 'public' | 'private')
    }
  }, [group])

  if (isLoading) {
    return (
      <AppShell>
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <div className="h-64 bg-brand-secondary rounded-2xl animate-pulse" />
      </div>
      </AppShell>
    )
  }

  if (!group || !isAdmin) {
    return (
      <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-brand-text">Access Denied</h2>
        <p className="text-brand-text/60 mt-2 text-sm">Only group admins can access settings.</p>
        <button onClick={() => router.back()} className="mt-4 text-brand-text text-sm font-bold hover:underline">Go Back</button>
      </div>
      </AppShell>
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await updateGroup.mutateAsync({ groupId, name: name.trim(), description: description.trim(), visibility })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${group.name}"? This cannot be undone.`)) return
    await deleteGroup.mutateAsync(groupId)
    router.push('/groups')
  }

  return (
    <AppShell>
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.push(`/groups/${groupId}`)} className="p-2 bg-brand-secondary rounded-full text-brand-highlight hover:bg-brand-secondary transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-black text-brand-text">Group Settings</h1>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-brand-card rounded-2xl border border-brand-divider p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-highlight mb-2">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-brand-secondary border border-brand-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-text/30"
              maxLength={100}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-highlight mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-brand-secondary border border-brand-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-text/30 resize-none"
              rows={3}
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-highlight mb-3">Visibility</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  visibility === 'public' ? 'border-brand-text/50 bg-brand-text/5' : 'border-brand-divider bg-brand-card hover:border-brand-text/30'
                }`}
              >
                <Globe className={`w-4 h-4 ${visibility === 'public' ? 'text-brand-text/50' : 'text-brand-text/60'}`} />
                <span className="text-sm font-bold text-brand-text">Public</span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  visibility === 'private' ? 'border-brand-text/50 bg-brand-text/5' : 'border-brand-divider bg-brand-card hover:border-brand-text/30'
                }`}
              >
                <Lock className={`w-4 h-4 ${visibility === 'private' ? 'text-brand-text/50' : 'text-brand-text/60'}`} />
                <span className="text-sm font-bold text-brand-text">Private</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || updateGroup.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 orchid-gradient text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {updateGroup.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved ? 'Saved!' : updateGroup.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="mt-8 bg-brand-card rounded-2xl border border-rose-200 p-6">
        <h3 className="text-sm font-black uppercase tracking-wider text-rose-600 mb-2">Danger Zone</h3>
        <p className="text-xs text-brand-text/60 mb-4">Deleting this group is permanent and cannot be undone. All posts, members, and data will be lost.</p>
        <button
          onClick={handleDelete}
          disabled={deleteGroup.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-600 text-sm font-bold rounded-xl hover:bg-rose-100 transition-all disabled:opacity-50"
        >
          {deleteGroup.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {deleteGroup.isPending ? 'Deleting...' : 'Delete Group'}
        </button>
      </div>
    </div>
    </AppShell>
  )
}

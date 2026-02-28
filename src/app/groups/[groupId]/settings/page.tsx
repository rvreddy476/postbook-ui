'use client'

import React, { useState, useEffect } from 'react'
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
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!group || !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-slate-700">Access Denied</h2>
        <p className="text-slate-400 mt-2 text-sm">Only group admins can access settings.</p>
        <button onClick={() => router.back()} className="mt-4 text-violet-600 text-sm font-bold hover:underline">Go Back</button>
      </div>
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
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.push(`/groups/${groupId}`)} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-black text-slate-800">Group Settings</h1>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              maxLength={100}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
              rows={3}
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Visibility</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  visibility === 'public' ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <Globe className={`w-4 h-4 ${visibility === 'public' ? 'text-violet-500' : 'text-slate-400'}`} />
                <span className="text-sm font-bold text-slate-700">Public</span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  visibility === 'private' ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <Lock className={`w-4 h-4 ${visibility === 'private' ? 'text-violet-500' : 'text-slate-400'}`} />
                <span className="text-sm font-bold text-slate-700">Private</span>
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
      <div className="mt-8 bg-white rounded-2xl border border-rose-200 p-6">
        <h3 className="text-sm font-black uppercase tracking-wider text-rose-600 mb-2">Danger Zone</h3>
        <p className="text-xs text-slate-400 mb-4">Deleting this group is permanent and cannot be undone. All posts, members, and data will be lost.</p>
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
  )
}

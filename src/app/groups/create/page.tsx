'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateGroup } from '@/hooks/useGroups'
import { ArrowLeft, Globe, Lock } from 'lucide-react'

export default function CreateGroupPage() {
  const router = useRouter()
  const createGroup = useCreateGroup()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      const group = await createGroup.mutateAsync({ name: name.trim(), description: description.trim(), visibility })
      router.push(`/groups/${group.id}`)
    } catch {
      // Error handled by React Query
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-8 pb-12">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 text-sm font-medium">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-black text-slate-800 mb-8">Create Group</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Group Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter group name..."
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            maxLength={100}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this group about?"
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            rows={4}
            maxLength={500}
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Visibility</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setVisibility('public')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                visibility === 'public' ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <Globe className={`w-5 h-5 ${visibility === 'public' ? 'text-violet-500' : 'text-slate-400'}`} />
              <div className="text-left">
                <p className="text-sm font-bold text-slate-700">Public</p>
                <p className="text-xs text-slate-400">Anyone can join</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setVisibility('private')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                visibility === 'private' ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <Lock className={`w-5 h-5 ${visibility === 'private' ? 'text-violet-500' : 'text-slate-400'}`} />
              <div className="text-left">
                <p className="text-sm font-bold text-slate-700">Private</p>
                <p className="text-xs text-slate-400">Invite only</p>
              </div>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!name.trim() || createGroup.isPending}
          className="w-full py-3 orchid-gradient text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {createGroup.isPending ? 'Creating...' : 'Create Group'}
        </button>
      </form>
    </div>
  )
}
